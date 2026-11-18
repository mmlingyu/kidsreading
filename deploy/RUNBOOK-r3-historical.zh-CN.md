# r3统一部署/回滚（脚本均未在服务器执行）

先读 `R3-CHANGES.zh-CN.md`。r3不降jobs noexec、不加共享可写exec盘；缓存来自锁定SDK的原生模块，session留在原盘。API v1、URL策略、原技能/QA、前端不回退。

## r2 → r3顺序
1. 保持 `/etc/reader/api.env`、`worker.env` 两份 `READER_ENABLE_GENERATION=0`。保存旧current/unit/env/accepted（受限权限，不打印内容）；停**仅**reader-api/reader-worker，确认无任务进程、备份DB及ready书稿。可用`tools.maintenance backup`以reader-worker身份、只提供DATA/AUTH环境执行；不向备份进程提供模型Key。不动TTS/Harness/Caddy/AppArmor/sysctl。
2. 解压 `/opt/reader/releases/reader-phase1-20261117-r3`，校验zip/tar外部SHA及 `sha256sum -c SHA256MANIFEST.txt`；整个release/runtime root-owned，目录0755/文件0644，shell0755。依赖hash锁与r2相同，SDK/runtime-bin0.2.2rc2；Node24公开路径仍 `/opt/reader-runtime/bin/node`，不放宽ubuntu home。
3. 审查并显式执行 `deploy/migrate-r3-permissions.sh --reader-stopped-apply-0660`。只操作 `/var/lib/reader`、已挂载jobs根及四个SQLite确切文件；需setfacl工具。父目录root:reader-data2770和默认ACL、DB/侧文件root:reader-data0660。现有run0700/job权限不递归放宽；检查512MiB mount仍loop,nosuid,nodev,noexec。
4. 在r3目录，**root协调准备器**以干净环境执行：
```
env -i PATH=/usr/sbin:/usr/bin:/bin PYTHONDONTWRITEBYTECODE=1 /opt/reader-runtime/bin/python -m tools.sdk_cache --prepare /opt/reader-runtime-cache-0.2.2rc2 --runtime /opt/reader-runtime --user reader-worker
```
此命令要求两reader unit inactive；SDK和假模型均由runuser后的非root reader-worker运行，bwrap无外网。预热首轮+真实bash printf，验证后root封存原生缓存；不读auth/key、不请求外部模型。若目标已存在，脚本拒绝覆盖；先用`reader_service.runtime_cache.verify_cache`核对所有权、runtime/hash/容量再复用。损坏缓存须另建版本路径，并同步worker.env/两个unit路径；不能原地开放写权限。父目录必须root-owned且不可group/world写。
5. worker.env添加（不打印/覆盖原Key）：`READER_RUNTIME_CACHE=/opt/reader-runtime-cache-0.2.2rc2`。两env可明确 `READER_DATA_GROUP=reader-data`，默认亦如此。准确秘密路径不变：Key只 `/etc/reader/worker.env` 的`DEEPSEEK_API_KEY`，root0600；API不加载Key。owners映射 `/etc/reader/owners.json` root:reader-data0640，独立token不复用TTS，不写浏览器存储。
6. 安装r3正式units，保持原保护（worker AF_NETLINK、ProtectKernelTunables=false、ProtectControlGroups=true、空caps、NoNewPrivileges、Memory768M/Swap0/CPU100%/Tasks64/KillMode控制组）；新ReadOnlyPaths包含只读cache。通过已有reader-only switch流程切current到r3，生成仍关。若switch启动worker会自动做重启恢复清理，先确保备份；之后为探针再停worker。不要改反代或旧服务。
7. 真跨UID测试（root只作编排，所有DB客户端非root），新建/清理专用合成目录，不打开线上queue：
```
env -i PATH=/usr/sbin:/usr/bin:/bin PYTHONDONTWRITEBYTECODE=1 /opt/reader-runtime/bin/python -m tools.sqlite_permissions --parent /var/lib/reader --runtime /opt/reader-runtime --api-user reader-api --worker-user reader-worker
```
须两种首次启动顺序、新库/旧schema迁移/重启、WAL/SHM/journal0660和无关UID拒绝全通过。
8. root审查并执行 `deploy/run-noexec-smoke.sh --install-and-run-fake-reader-probe`：安装独立reader-noexec-smoke unit，配置等同正式worker且不加载任何EnvironmentFile。用env -i、假token/假模型、真实SDK、真实jobs noexec盘，验证三次SDK启动、两轮QA修复/恢复、生成脚本不能直接exec、HOME只读、请求中真实取消与重启清理。该工具只在本次独立进程对假broker绕过accepted，不修改accepted.json/ENABLE，不接真实Key；不产生生产任务。必须Result=success并保留日志/MemoryPeak/cgroup/mount证据。它不是主worker长期入口。
9. 在真实py3.12另重跑pytest（建议使用已准备只读cache环境 `READER_RUNTIME_CACHE=...`，临时数据放noexec jobs专用目录）、Node模块/语法、原fixture/source parity。确认健康/auth/跨owner/URL/磁盘/重启无回退。按**r3 trusted hash**重新审查全部六门禁；linuxsmoke只在第8步真实通过后才可记true，其余不得直接复制旧hash的true。示例仍全false。本工作流不作这些签署。
10. 六项有证据且用户授权范围内才重启reader并启生成，做最小真实材料/真实模型、公开URL正文、人工预览→确认入库、实际峰值/取消、原TTS/Harness回归。生产负载通过前不宣称第0/1阶段完成。

## 清理与容量
- jobs512MiB不变；session与TMPDIR随job终态清理，重启只清理登记终态。root静态缓存内容≤128MiB/10000文件，只读不能由任务增长；实测约77.1MiB，按块/目录预留160MiB，一份回滚共预留320MiB。无新增每job exec卷、无失挂后写根盘的回退。
- 缓存只有程序，不含用户/凭据，不随备份重复保存；升级SDK必须新缓存目录+runtime hash+新release，不原地改。旧版缓存仅在无引用且已备份回滚方案后由维护者确认清理。
- 正常 `tools.maintenance` 保留200任务/7天dry-run及私有备份，继续适用。DB/WAL/备份可能含历史材料，权限及加密保留策略不变。不在日志记录模型/URL正文、Authorization、Key或SDK回放。

## 回滚
DB schema仍2，无降schema/数据迁移；仅共享权限修正，r2可读。失败时先停reader、保持生成0，切回备份的r2软链/units并恢复原r2对应accepted备份（不得提升linuxsmoke）。r2仍有已知noexec生成缺陷，因此回滚仅恢复禁用生成的API/页面，不能当生成恢复成功。保留新cache与DB证据、不自动删数据、无需撤除jobs noexec或改TTS/Harness/反代。
