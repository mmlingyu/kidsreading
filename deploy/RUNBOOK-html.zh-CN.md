# HTML 技能部署（html3，服务器尚未验收）

版本目录是 `reader-phase1-20261117-r5-html2` 的下一包：`reader-phase1-20261117-r5-html3`。不要安装 html1 或 html2。不要把这个目录接成 `/opt/reader/current`。不要运行 reader 的 `prepare.sh`、`switch.sh` 或 `rollback.sh`。不要重启 reader-api:6010、TTS:8800 或 Harness:3080。不要执行 html2 备份里的 `ROLLBACK.sh`，那份脚本会改写现网 Caddy。

本机云端演练没有 systemd（PID 1 不是 systemd），也没有连接生产机，也没有调用真实模型。下面的命令是部署者在服务器上跑的路径。演练只证明这些命令在复刻的权限布局里能走完。

## 先放好的东西

1. 阅读器保持 `/opt/reader/current` → `reader-phase1-20261117-r5`。`/etc/reader` 维持 `0750 root:reader-data`。不要把 `studio-api` 或 `studio-worker` 加入 `reader-data`。
2. 解包到 `/opt/studio/releases/reader-phase1-20261117-r5-html3`，`/opt/studio/current` 只指向这一目录。属主 root，不要做成组可写。
3. `/opt/reader-runtime/bin/python` 和 `/opt/reader-runtime-cache-0.2.2rc2` 保持 root 所有、组和其他不可写。Studio 缺遍历权限时，prepare 只加 named user 的 `r`/`x` ACL，并先把原 ACL 记到 `/etc/studio/acl-before`。

核对包：

```bash
python3 - <<'PY'
import hashlib, pathlib
p=pathlib.Path('/opt/studio/current/TRUSTED-SHA256.json')
print(hashlib.sha256(p.read_bytes()).hexdigest())
PY
```

这个哈希必须等于后面 `gate` 打印的 `trusted_manifest_sha256`。不要填 html1、html2 或 r5 的旧哈希。

## prepare

```bash
sudo deploy/studio-lifecycle.sh prepare
```

预期输出以这句开头：`Studio units installed inactive.`

它会：

- 建立 `studio-data`、`studio-api`、`studio-worker`。主组是 `studio-data`，不是 `reader-data`。
- `/var/lib/studio` 为 `root:studio-data` `2770`。
- 新建独立的 128MiB ext4：`/var/lib/studio-storage/jobs.ext4`，挂到 `/var/lib/studio/jobs`，选项 `loop,nodev,nosuid,noexec`。这不是阅读器那块 512MiB 盘。
- `/etc/studio/api.env` 和 `worker.env` 为 `root:root` `0600`。生成开关仍是 `0`。
- 若 ACL 快照还不存在，先 `getfacl` 再给 `/etc/reader` 只加 `u:studio-api:x,u:studio-worker:x`，给 `owners.json` 只加 `r`。

验证：

```bash
sudo -u studio-api test -x /etc/reader; echo dir-search:$?
sudo -u studio-api test -r /etc/reader; echo dir-list:$?
sudo -u studio-api test -r /etc/reader/owners.json; echo owners-read:$?
sudo -u studio-api test -w /var/lib/reader; echo reader-write:$?
id -nG studio-api
findmnt /var/lib/studio/jobs
stat -c '%a %U:%G' /var/lib/studio /etc/studio/worker.env
```

预期：`dir-search:0`，`dir-list` 非 0，`owners-read:0`，`reader-write` 非 0。`id` 里没有 `reader-data`。挂载标志含 `nosuid,nodev,noexec`。数据目录是 `2770 root:studio-data`，worker.env 是 `600 root:root`。服务用户不能读这个 env 文件；systemd 启动时以 root 读入。

把 `DEEPSEEK_API_KEY=REPLACE_SECURELY_AT_DEPLOYMENT` 改成真实密钥。只改 `/etc/studio/worker.env`。不要写进 api.env，不要写进命令历史后提交。模式保持 `0600`。

## 现网 HTTPS

对外边缘是 `local-tts-edge.service` 和 `/etc/local-tts-edge/Caddyfile`。`caddy.service` 与 `/etc/caddy/Caddyfile` 不是现网。`deploy/validate-studio-caddy.sh` 只检查片段本身，不能代替这一步。

```bash
sudo deploy/edge-studio.sh install
```

预期：`studio prefix merged and validated; backup /root/backups/studio-edge-...`

脚本只在已经反代 `127.0.0.1:6010` 的站点块末尾插入一行 `import`。然后对**整份**现网 Caddyfile 执行 `caddy validate`，再 `systemctl reload local-tts-edge.service`。不 `restart`，不碰 TTS 进程。校验失败或随后 `http://127.0.0.1:6010/api/reader/health` 失败时，自动写回备份并再次 reload。

确认旧路由还在：

```bash
sudo grep -n '127.0.0.1:6010\|127.0.0.1:8800\|127.0.0.1:6011\|caddy-studio.fragment' /etc/local-tts-edge/Caddyfile
curl -fsS http://127.0.0.1:6010/api/reader/health
```

预期：6010、8800 和 studio 的 import 都在；阅读器 health 仍是 ok。

手动退回这一步（不要用 html2 的 ROLLBACK.sh）：

```bash
sudo deploy/edge-studio.sh restore /root/backups/studio-edge-时间戳
```

## 启动、门禁、启用

```bash
sudo systemctl enable --now studio-jobs.mount
sudo deploy/studio-lifecycle.sh start
sudo deploy/studio-lifecycle.sh health
```

启用前 health 的 `generation` 必须是 `false`，`release` 以 `html3` 结尾，`reader_replaced` 是 `false`。

```bash
sudo deploy/studio-lifecycle.sh gate
```

预期一行 JSON：`{"ok": true, "trusted_manifest_sha256": "<本目录 TRUSTED-SHA256.json 的 sha256>"}`。

六项都会实际跑，失败则删除 `/var/lib/studio/gate-evidence.json`，不改 `accepted.json`，生成保持 0：

- 源对齐：7 个技能原字节、3 个 enabled、4 个 blocked 原因不变，Zdog dist 哈希不变。
- 隔离：bwrap 里看不到 `/etc/reader/owners.json`，命令行不挂 `/var/lib/reader`。
- 配额与 noexec：jobs 盘已挂载、不超过 128MiB、`nosuid,noexec`，盘上的脚本不能执行；`RLIMIT_FSIZE` 32MiB 写超会失败。
- cgroup：unit 里的 MemoryMax/Swap/TasksMax，以及本机 cgroup v2 `memory.max=8MiB` 会杀掉 32MiB 分配。
- SDK：真实 `deepseek_harness`、真实 bwrap、真实 gateway。上游响应是门禁里的假流，不代替真实密钥验收。
- 鉴权：匿名 401，blocked 技能 403，未知 Bearer 401，API 只绑 `127.0.0.1:6011`。另外检查两个服务用户能读 current/runtime/cache、不能读 worker.env、不能写阅读器数据，以及取消后的成功写不会覆盖 `cancelled`。

```bash
sudo deploy/studio-lifecycle.sh enable
sudo deploy/studio-lifecycle.sh health
```

`enable` 会再跑一遍探针。哈希不一致或任一探针失败时直接退出，不会把六项写成 true。通过后才写 `/etc/studio/accepted.json`（`root:studio-data` `640`，六项 true，哈希等于本树），把两个 env 的 `STUDIO_ENABLE_GENERATION` 设为 `1`，并只重启 studio 两个 unit。重启后的 health 里 `generation` 才是 `true`。worker 每次启动从 env 读一次密钥，随后从自己的环境删掉；同一进程里的后续任务复用这份内存。密钥不进子进程 argv、环境、任务目录或日志。重启后由 systemd 再次注入，不在代码里写死。

真实模型仍由部署者在这一步之后用自己的密钥验收。门禁通过不等于真实模型验收。

## 关闭和回滚

```bash
sudo deploy/studio-lifecycle.sh disable
```

预期：`studio generation disabled and gate flags cleared`。两个 env 回到 `STUDIO_ENABLE_GENERATION=0`，六项变回 false。只重启 studio。

```bash
sudo deploy/studio-lifecycle.sh rollback
```

预期：只停 studio unit，并用 `setfacl --restore` 还原 prepare 时的 ACL 快照。不执行 `setfacl -b`，不删除快照里原有的 ACL。不卸载 jobs 盘，不改 Caddy，不改 `/opt/reader/current`。

边缘要单独 `edge-studio.sh restore`。

## 测试从哪来

发布 tar/zip 里包含 `tests/`。云端数字是在目录名等于 `reader-phase1-20261117-r5-html3` 的展开树里、用 `/tmp/r4-venv` 的 Python 3.12 跑完整 `pytest`。Git 工作目录名叫 `kidsreading`，那一项版本目录断言要在展开树里看。pytest 数量不能代替上面的 root 门禁。本轮部署断言在 `tests/test_studio_deploy.py`：`0750` 父目录、只给目录 `x` 和文件 `r`、回滚只撤本次 ACL、边缘合并后整文件 `caddy validate`、连续任务密钥、以及 prepare → gate → enable → mock 任务 → disable/rollback。
