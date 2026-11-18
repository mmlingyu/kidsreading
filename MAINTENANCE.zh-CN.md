# 维护与版本约定

## 这条分支是什么

`R4` 是已验收 `reader-phase1-20261117-r4` 的源码维护线。它从 `main` 的 `cf4d8b54a20ae45ad560fdcc67781adb32d1fb73` 分出，保留该提交之前的全部历史。不改写、不压缩、不合并不强制更新 `main`。

附注标签 `reader-phase1-20261117-r4` 指向本基线的最终提交。提交 SHA 写在标签说明里，用下面的命令读取，不要把 SHA 写进 `SHA256MANIFEST.txt`：

```bash
git rev-parse reader-phase1-20261117-r4^{}
git for-each-ref refs/tags/reader-phase1-20261117-r4 --format='%(contents)'
```

`main` 继续是迁移前的根目录静态站。审查本分支的差异时不要把它合并进 `main`，除非另有明确决定。

r5 已停止，不在本树里，也不要在这条基线上接着做。已验收说明里的后续 Piper/Phonon 服务工作同样停在本基线之外。

## 目录

| 路径 | 角色 |
|---|---|
| `frontend/app/` | 唯一继续维护的前端。字节与已验收 r4 一致。 |
| `frontend-overlay/` | 已验收发布里的冻结覆盖层，不是第二处维护点。其中 `app/index.html` 的脚本参数仍是 `app.js?v=reader-phase1-r2`，与 `frontend/app/index.html` 的 `reader-phase1-r4` 只差这一处。不要为了“改齐”去改覆盖层。 |
| `reader_service/` `skills/` `deploy/` `tests/` `tools/` `evidence/` | 已验收后端、原技能、部署模板、QA 与证据，路径和字节保持原样。 |
| `SHA256MANIFEST.txt` `TRUSTED-SHA256.json` `requirements*.txt` `requirements-linux-py312.lock` | 已验收清单、可信哈希和依赖锁。 |
| `tts/` `speech.js` `phonon-sw.js` `test-speech-plan.mjs` `test-synth-queue.mjs` | `main` 上已有的 Phonon/Kokoro 离线语音工具。它们不属于 r4 清单。相对路径仍指向仓库根，所以留在原处，不删、不改。 |
| `docs/PRE-R4-STATIC-SITE.md` | `main` 的原 README。里面的站点根目录和 Nginx 说明只适用于迁移前的静态站。 |
| `README.md` `MAINTENANCE.zh-CN.md` `maintenance/` `.gitignore` | 本仓库追加的维护信息，不在已验收清单内。 |

旧的根目录前端（`index.html`、`app.js`、`assets/`、`data/`、`vendor/` 等）已移到 `frontend/app/`，再按 r4 字节对齐。仓库根不再放另一份阅读站。历史仍在 `main` 和本分支的重命名记录里。

`frontend/app/tts.js` 与 `frontend/app/pocket.js` 是 r4 前端自带的朗读客户端，指向本机 Phonon/Pocket 接口，并声明 Pocket 权重应放在同源 `vendor/pocket`。这些权重、ONNX、WASM、WAV 没有打进已验收包，这里也不添加。根目录 `tts/` 是另一套更早的 Kokoro 工具，两边不要互相覆盖。

## 已验收包与本仓库的映射

已验收归档身份（导入时核对过，未改这些字节）：

| 对象 | SHA256 | 大小 |
|---|---|---|
| `reader-phase1-20261117-r4.tar.gz` | `03728d3994a54bf88563958b513fcb2e304c3a98d215053f5985c9c8b2ae3b39` | 23740090 字节 |
| 包内 `SHA256MANIFEST.txt` | `49617553d0fc2bef3e13677e971cf5bb1ce662f89b4f4a6311475860103a7f27` | 451 条 |
| 包内 `TRUSTED-SHA256.json` | `f098c07bd78f4d21b81a9cd1bc9851fd4e2e5f8b899a2be8c51bd578ecd84f0d` | — |

树内普通文件 452 个。清单 451 条覆盖除清单文件自身以外的全部发布文件，核对结果是 0 缺失、0 多余、0 不匹配。包内无目录项、无符号链接、无硬链接。

源码提交与该 tar 的对应关系是：标签 `reader-phase1-20261117-r4` 所指向提交里的发布路径，等于该 tar 解出的 452 个文件。同一提交里的维护文件和历史语音工具不在 tar 里。

核对工作区：

```bash
python3 maintenance/reproduce-r4-archive.py --check
```

在工作区外复现已验收 tar（不要把生成的包提交进 Git）：

```bash
python3 maintenance/reproduce-r4-archive.py --output /tmp/reader-phase1-20261117-r4.tar.gz
```

复现规则与当时能对上原哈希的头部一致，并在 CPython 3.12.3 上核对过：

- 只打包上述 452 个路径。
- gzip 原名为 `reader-phase1-20261117-r4.tar`，mtime 为 0，压缩级别 9。
- tar 为 ustar，成员顺序是 `pathlib.Path` 排序（因此 `frontend/app` 在 `frontend-overlay` 之前），uid/gid 为 0，用户组名为 `root`，mtime 为 0。
- 以 `.sh` 结尾的文件模式为 `0755`，其余为 `0644`。

`tools/build_release.py` 是发布树里的原构建器，本导入没有改它。在一个只含这 452 个文件、目录名恰好是 `reader-phase1-20261117-r4` 的副本上，它会写出相同的清单字节，但 gzip 不带原文件名，得到的 tar SHA256 是 `5409152ffa7600cab0b7f1110ec415bbc6b2d7daf832137ce395f6e3be79f794`（23740060 字节）。那不是已验收部署包的哈希。不要在 Git 工作区里运行它：它会把历史语音工具和维护文件卷进新清单并改写 `SHA256MANIFEST.txt`。

## 部署和安全配置是另一回事

本分支是源码基线，不是服务器部署。不要连接腾讯云，不要读取或写入真实密钥，不要把下面这些放进 Git：

- `/etc/reader/worker.env`、`/etc/reader/api.env`、`/etc/reader/owners.json`、`client-token*` 和其他已填实值
- `/var/lib/reader/**`
- `/opt/reader-runtime`、`/opt/reader-runtime-cache-0.2.2rc2`、上游 Harness 运行时与 wheel
- Caddy/TLS 私钥、运行日志、验收现场书稿、模型权重

可以保留的示例是 `deploy/worker.env.example`、`deploy/api.env.example`、`deploy/accepted.json.example`。示例里的生成开关是 `0`，六项门禁是 `false`，密钥位置是 `REPLACE_SECURELY_AT_DEPLOYMENT`。`deploy/api.env.example` 里的 CORS 源是公开 IP，不是凭据。

已验收单元里的 noexec 任务卷、cgroup 限制、owner 鉴权和 `RestrictSUIDSGID=true` 按原文件保留，包括 `deploy/var-lib-reader-jobs.mount`、`deploy/reader-worker.service`、`deploy/reader-api.service`、`deploy/reader-noexec-smoke@.service`。官方 AppArmor 不在这棵源码树里；运行手册要求部署时不要改动主机上的 AppArmor。这里不新增、不删除、也不用一份自写配置代替它。

`deploy/generate-owner.py` 只在部署机上生成受限令牌。不要在本仓库运行它，也不要提交它的输出。

## 许可与公开范围

仓库根不新增 LICENSE，也不把未知许可写成已经齐全。pixelfx 的 MIT 文本仍在 vendor 目录。书稿、插画和 `evidence/original-source/` 按维护者对这次公开导入的确认纳入 `R4`。这不表示全书稿和插画的权利声明已经完整。

## 在本环境跑过和没有跑过的检查

检查对象是与已验收 tar 字节相同的发布树。Python 3.12.3，依赖只安装了 `requirements.txt` 与 `requirements-test.txt`。没有安装 `requirements-worker.txt` 里的 `deepseek-harness-sdk` 或 runtime bin。

| 检查 | 结果 |
|---|---|
| 451 条清单和 `TRUSTED-SHA256.json` | 通过，与上表哈希一致 |
| `python3 -m compileall`（`reader_service` `tests` `tools` `deploy`） | 通过 |
| `bash -n` 六个 `deploy/*.sh` | 通过 |
| `node --check`，发布树内 312 个 `.js`/`.mjs`（不含 `evidence/`） | 通过。Node v22.23.4 |
| `node tests/test_frontend.mjs` | 通过 |
| 历史 `node test-speech-plan.mjs`、`node test-synth-queue.mjs` | 通过。这是 `main` 留下的工具，不是 r4 清单的一部分 |
| pytest | 107 通过，6 跳过，1 失败。见下 |

pytest 第一次有 9 个原 QA/worker 失败，是因为虚拟环境前缀下没有 `bin/node`，审查进程按发布代码到这个路径找 Node。把宿主机 Node v22.23.4 链接到该路径后，这 9 个通过。这不是生产 runtime 镜像里的 Node，也不能代替腾讯云正式 unit。

唯一失败是 `tests/test_runtime_cache.py::test_cache_version_mismatch_rejected`。发布代码先查找锁定的 runtime 二进制，本环境没有该文件，异常是 `pinned_linux_runtime_not_found`，测试期待的 `version_mismatch` 没有发生。没有为了让它变绿而安装上游 runtime。

6 个跳过：

- `test_noexec_layout.py`：没有已安装 SDK，也没有 bwrap
- `test_runtime_cache.py` 两条：没有已安装 SDK
- `test_sandbox.py`：没有 bwrap
- `test_sdk_mocked.py` 两条：没有 `deepseek_harness`

`/dev/shm` 在这台机器上是 noexec，但没有 SDK 与 bwrap，正式 noexec 烟测没有跑。没有声称：正式 systemd unit、Python 3.12 生产 runtime、官方 Ubuntu bwrap 0.9 过滤回归、cgroup 峰值、HTTPS/auth 现场、真实模型或腾讯云验收已通过。发布说明里记录的 box 结果（Python 3.13 上 114 个 pytest、真实 SDK）是原验收记录，不是这次在本机重新跑出的数字。

另有一条 Starlette 弃用警告：当前 `fastapi`/`starlette` 提示 `httpx` 测试客户端已弃用。测试仍使用发布锁里的版本，没有为消警告升级依赖。
