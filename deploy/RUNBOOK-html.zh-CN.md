# HTML 技能部署（html6，服务器尚未验收）

版本目录是 `reader-phase1-20261117-r5-html6`。不要安装 html1 到 html5。不要把这个目录接成 `/opt/reader/current`。不要运行 reader 的 `prepare.sh`、`switch.sh` 或 `rollback.sh`。不要重启 reader-api:6010、TTS:8800 或 Harness:3080。不要执行 html2 备份里的 `ROLLBACK.sh`。html3 的边缘已经用官方 restore 撤掉，不要再 restore 一次。

html3 的 `studio-jobs.mount` 名字不合法，systemd 报 `Where= setting doesn't match unit name`。本包改为 `var-lib-studio-jobs.mount`。生产上那份旧 unit 已 disabled，128MiB jobs 盘仍挂着。`prepare` 会删掉无效 unit 文件并 `daemon-reload`，不会重新 mkfs，也不会卸载现有 jobs 盘。已有的 `/etc/studio/worker.env`（含已注入的密钥、`0600`）不会被覆盖密钥或把生成开关改成 1。

本机云端没有 PID 1 systemd，不能把进程直接拉起当成正式 unit 已启动。`systemd-analyze verify` 不需要 PID 1，已经能抓住挂载单元名错误。下面的 `systemctl start` 只在服务器上执行。

## 先放好的东西

1. 阅读器保持 `/opt/reader/current` → `reader-phase1-20261117-r5`。`/etc/reader` 维持 `0750 root:reader-data`。不要把 studio 用户加入 `reader-data`。
2. 解包到 `/opt/studio/releases/reader-phase1-20261117-r5-html6`，把 `/opt/studio/current` 改指向这一目录。属主 root，不要做成组可写。html5 的 jobs 盘和 `var-lib-studio-jobs.mount` 保持不动，不要 mkfs，不要 umount。不要改 `/opt/reader-runtime` 里的包装器。
3. `/opt/reader-runtime/bin/python` 和 `/opt/reader-runtime-cache-0.2.2rc2` 保持 root 所有、组和其他不可写。

核对包。打印出的哈希必须等于后面 `gate` 的 `trusted_manifest_sha256`。不要填 html5 的 `c50adced25a347ede3e49c01adcb5a95d13d0e7b0a77b3c6c495d339979cea74`。

```bash
python3 - <<'PY'
import hashlib, pathlib
p=pathlib.Path('/opt/studio/current/TRUSTED-SHA256.json')
print(hashlib.sha256(p.read_bytes()).hexdigest())
PY
```

## 单元静态检查

在 `systemctl start` 之前先核对交付的三个 unit。这一步不读 `worker.env`。

```bash
systemd-escape -p --suffix=mount /var/lib/studio/jobs
# 预期 var-lib-studio-jobs.mount
systemd-analyze verify \
  /opt/studio/current/deploy/studio-api.service \
  /opt/studio/current/deploy/studio-worker.service \
  /opt/studio/current/deploy/var-lib-studio-jobs.mount
```

在有 `/opt/reader-runtime/bin/python` 的机器上，预期退出码 0，没有 `Where= setting doesn't match unit name`。本云端没有这份 runtime，同一命令的结果是退出码 1，且只报告：

`Command /opt/reader-runtime/bin/python is not executable: No such file or directory`

这是这台机器缺解释器，不是单元名错误。把同名文件改成 `studio-jobs.mount` 再 verify，必须出现 `Where= setting doesn't match unit name`。

## prepare

```bash
sudo /opt/studio/current/deploy/studio-lifecycle.sh prepare
```

预期以 `Studio units installed inactive.` 开头。

它会：

- 沿用已有的 `studio-data`、`studio-api`、`studio-worker`。主组仍只是 `studio-data`。
- 若 `/var/lib/studio/jobs` 已经是不超过 128MiB 的 `nosuid,noexec` 挂载，保持该盘和里面的数据，不重新 mkfs。
- 安装 `var-lib-studio-jobs.mount`。若还留着 html3 的 `studio-jobs.mount`，disable 并删除该文件，然后 `daemon-reload`。不 `umount`。
- 已存在的 `/etc/studio/worker.env` 和 `api.env` 只补路径类变量。`DEEPSEEK_API_KEY` 和 `STUDIO_ENABLE_GENERATION` 保持原样。不要再手工 export `READER_RUNTIME_CACHE`。

验证：

```bash
systemctl cat var-lib-studio-jobs.mount | head
test ! -e /etc/systemd/system/studio-jobs.mount && echo stale-unit-gone
sudo -u studio-api test -x /etc/reader; echo dir-search:$?          # 0
sudo -u studio-api test -r /etc/reader; echo dir-list:$?            # 非 0
sudo -u studio-api test -r /etc/reader/owners.json; echo owners:$?  # 0
sudo -u studio-api test -w /var/lib/reader; echo reader-write:$?    # 非 0
sudo -u studio-worker test -r /etc/studio/worker.env; echo env-read:$?  # 非 0
findmnt /var/lib/studio/jobs
stat -c '%a %U:%G' /etc/studio/worker.env
```

预期：旧 unit 文件不在；`dir-search:0`，列出目录失败，owners 可读，阅读器数据不可写，worker 不能读自己的 env 文件。挂载仍含 `nosuid,nodev,noexec`。env 仍是 `600 root:root`。`id -nG studio-api` 里没有 `reader-data`。

只有在 `worker.env` 里还是 `REPLACE_SECURELY_AT_DEPLOYMENT` 时才写入密钥。html3 已经写入的不要改，也不要打印。

安装后的 unit 再验一次：

```bash
systemd-analyze verify \
  /etc/systemd/system/studio-api.service \
  /etc/systemd/system/studio-worker.service \
  /etc/systemd/system/var-lib-studio-jobs.mount
```

服务器上预期退出码 0。

## 现网 HTTPS

现网 Caddy 里已经没有 studio 片段。本轮不要再跑 `edge-studio.sh restore`。等 API 真正听在 6011 之后再执行：

```bash
sudo /opt/studio/current/deploy/edge-studio.sh install
```

预期：`studio prefix merged and validated; backup /root/backups/studio-edge-...`

脚本只在已经反代 `127.0.0.1:6010` 的站点块末尾插入一行 import，对整份 `/etc/local-tts-edge/Caddyfile` 做 `caddy validate`，再 `systemctl reload local-tts-edge.service`。不 restart，不碰 TTS。失败会写回备份。

## 启动、门禁、启用

```bash
sudo /opt/studio/current/deploy/studio-lifecycle.sh start
sudo /opt/studio/current/deploy/studio-lifecycle.sh health
```

`start` 启用的是 `var-lib-studio-jobs.mount`，然后才是 api 和 worker。启用前 health 的 `generation` 必须是 `false`，`release` 以 `html6` 结尾。html5 的正式 start 已经成功过，这一步不要改 unit 名、包装器或 MemorySwapMax。

```bash
sudo /opt/studio/current/deploy/studio-lifecycle.sh gate
```

不需要事先 `export READER_RUNTIME_CACHE`。脚本从 worker unit 的 `Environment=` 读取缓存、runtime 和工作目录，不 source `worker.env`。然后 `systemd-analyze verify` 三个已安装 unit，不过则不会写签署。

预期一行 JSON：`{"ok": true, "trusted_manifest_sha256": "<本目录 TRUSTED-SHA256.json 的 sha256>"}`。

cgroup 探针在私有目录 `/sys/fs/cgroup/studio-gate-scope` 里写入并读回 `memory.max=8388608` 和 `memory.swap.max=0`。成功必须同时是：读回值就是这两个数、子进程被 SIGKILL（退出码 -9）、`memory.events` 里 `oom` 和 `oom_kill` 都增加。只写 `memory.max` 不够：html4 在约 1987MiB swap 上 32MiB 分配活了下来。任何别的非零退出、超时、或没有 `oom_kill`，都不算通过。探针结束会清掉这个临时 cgroup，不改阅读器或其他服务的 cgroup。成功时 JSON 里带实测的 `cgroup` 字段。

`/opt/reader-runtime/bin/python` 是 56 字节的 root 包装器，内容只能是 `exec /opt/reader-runtime/venv/bin/python "$@"`。gate 用 unit 的这个入口再启动一次，核对 Python 3.12、`sys.prefix` 是该 runtime 的 venv、`deepseek-harness-sdk` 是 `0.2.2rc2`，以及 fastapi 在这个前缀里。包装器若指向别处、属主不是 root、或组/其他可写，探针失败。不要改包装器，也不要 export 另一个解释器来绕过。

SDK 探针随后仍用这个入口，对 `html-builder`、`zdog`、`knowledge-travel` 各跑一次真实 bwrap + SDK。运行前确认服务用户能执行 bwrap、能读这三个 `SKILL.md`。鉴权探针直接调用 ASGI，不依赖测试用的 httpx。命名空间里读到的 `/skill/SKILL.md` 必须是该技能原文，产物检查的是 `preview.html`，不是 `book.json`。不传 skill 时会挂上 `adventure-reader`，那不算通过。上游仍是假流，不代替真实密钥验收。

失败时不写 `gate-evidence.json`，也不改 `accepted.json`。会另写 `gate-diagnostic.json`，里面 `signed` 和 `accepted` 都是 false，并记下已经跑过的探针和失败原因，不含密钥。这个文件不能当作签署。enable 若读到 `signed: false` 会拒绝。html5 那次 gate 删掉了证据，不能把“前面没打印失败”当成 cgroup 已在生产验收。

```bash
sudo /opt/studio/current/deploy/studio-lifecycle.sh enable
sudo /opt/studio/current/deploy/studio-lifecycle.sh health
```

`enable` 再跑一遍探针。哈希不一致或 verify 失败时不会把六项写成 true。通过后才写 `/etc/studio/accepted.json`（`root:studio-data` `640`）并把两个 env 的 `STUDIO_ENABLE_GENERATION` 设为 `1`，只重启 studio 两个 unit。重启后的 health 里 `generation` 才是 `true`。密钥仍是进程启动时读一次，同一进程的后续任务复用，不进 bwrap 的环境或参数。

真实模型仍由部署者在这一步之后用自己的密钥验收。

## 关闭和回滚

```bash
sudo /opt/studio/current/deploy/studio-lifecycle.sh disable
sudo /opt/studio/current/deploy/studio-lifecycle.sh rollback
```

`disable` 只把生成设回 0、六项改回 false，并只重启 studio。`rollback` 停 api/worker，disable 并删除无效的 `studio-jobs.mount`，`daemon-reload`，用 ACL 快照还原。不卸载 jobs 盘，不删盘内数据，不改 Caddy，不改 `/opt/reader/current`。

若之后又装过边缘片段，才用 `edge-studio.sh restore 备份目录`。html3 那次已经 restore 过，不要重复。

## 测试从哪来，以及正式 systemd 还没测什么

发布 tar/zip 含完整 `tests/`。云端数字是在目录名等于版本名的展开树里、用 `/tmp/r4-venv` 跑的 pytest。那不是生产门禁。生产门禁是 root 执行 `studio-lifecycle.sh gate`，并且 `systemd-analyze verify` 必须先通过。

html5 的 `systemd-analyze verify` 和正式 `systemctl start` 已在服务器成功，health 为 html5 且 generation false。随后 gate 因包装器路径失败并回滚，没有留下可当签署的 cgroup 证据。本云端仍然没有 PID 1 systemd，不能重复那次 start。云端用 root 包装器复现了 `exec venv/bin/python`，并确认写错目标、属主或权限会被拒绝；bwrap 里三个技能仍读到各自的 `SKILL.md`。html6 的六项签署、三次真实生成、线上 401/403 和下载头都还没有在服务器上跑。
