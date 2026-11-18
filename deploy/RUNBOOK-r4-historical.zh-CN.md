# r4统一部署（本执行者只在box，未执行服务器步骤）

1. 保持生成0/linuxsmoke false，备份r3软链、units、受限env/accepted与DB；只停reader-api/reader-worker，不动TTS/Harness/Caddy/AppArmor/sysctl。
2. 解压`/opt/reader/releases/reader-phase1-20261117-r4`，验证外部ZIP/TAR SHA与SHA256MANIFEST；release/runtime全root-owned、目录0755/文件0644、sh0755。SDK/runtime-bin0.2.2rc2及依赖锁不变。VERSION必须与目录同为r4。
3. 全部生产DATA及已挂载jobs根必须root:reader-data2770，不允许服务自行创建/设置SGID。r3已正确预建则只核验，勿递归改job/run；若不符，用保留的`migrate-r3-permissions.sh --reader-stopped-apply-0660`在reader停止时root离线修正（要求512MiB mounted noexec jobs）。0660 SQLite/侧文件及默认ACL策略不变，绝不chmod777。
4. r3 root只读缓存可复用：`/opt/reader-runtime-cache-0.2.2rc2`，先用`reader_service.runtime_cache.verify_cache`核对runtime/hash/容量/权限。worker.env仍`READER_RUNTIME_CACHE=...`，模型Key仅原worker.env root0600，不打印/复制进探针。若需新缓存，按R3历史手册的root准备器执行，其SDK过程仍非root/无网络/假模型。
5. 安装r4 API/worker units，保持所有保护，reader-only切current到r4，生成继续0。API/worker应使用原共享根启动；核对health.release=r4（健康状态可能degraded503属门禁未签署预期），再停worker为烟测留资源。
6. 运行真实跨UID权限回归（root仅编排，子进程自动带真实mode-bit seccomp过滤）：
```
env -i PATH=/usr/sbin:/usr/bin:/bin PYTHONDONTWRITEBYTECODE=1 /opt/reader-runtime/bin/python -m tools.sqlite_permissions --parent /var/lib/reader --runtime /opt/reader-runtime --api-user reader-api --worker-user reader-worker
```
应含新库/迁移、两UID顺序及并发、WAL/SHM/journal0660、无关UID拒绝。
7. 审查后执行：`deploy/run-noexec-smoke.sh --install-and-run-fake-reader-probe`。r4安装`reader-noexec-smoke@.service`而非旧非实例unit。root先在真正jobs卷创建唯一合成fixture，再启动对应实例。unit保留RestrictSUIDSGID=true、原AF_NETLINK/ProtectKernelTunables/cgroup等，且不加载任何秘密EnvironmentFile。
8. 新probe通过--data只使用该root预创建合成根，必须先证明mkdir/chmod2770被真实EPERM拒绝，然后真实SDK+假proxy完成首轮、两次持久session恢复/repair、原QA、请求中取消、重启清理。记录服务器实际`/usr/bin/bwrap --version`、Result/ExecMainStatus/MemoryPeak/日志以及noexec/nosuid挂载证据；unit退出后脚本只清理该UUID合成fixture。没有改accepted/ENABLE。box的seccomp等价结果不是本步骤正式unit结果。
9. 真py3.12可重跑pytest与JS模块/语法，临时数据放专用任务卷，缓存使用已准备root只读cache。核验原source parity、HTTPS/auth、owner隔离、URL安全、quota/cgroup、原服务回归与health版本。所有六门禁按r4新trusted hash重新核验，不能把旧r3 true直接当新签署；linuxsmoke只在第8步真实通过后置true。示例仍全false。
10. 授权窗口内再最小真实生成/URL/人工预览入库/真实峰值验收，才宣布第0/1阶段完成；随后另开TTS Piper/Phonon工作，本包不混入。

## 回滚与容量
DB schema仍2，共享0660权限兼容r3；失败时停reader，保持生成0，恢复备份r3软链/units/其对应accepted（linuxsmoke仍false），不要去掉RestrictSUIDSGID或jobs noexec。r3烟测已知失败，回滚不能冒称生成已恢复。旧非实例smoke unit不需启用/运行，r4脚本不删除其他unit。
jobs512MiB、static cache≤128MiB逻辑内容/160MiB磁盘预留不变；新增仅一次合成probe fixture、由root安全清理。没有新增exec卷或共享可写session。详细r3原生cache根因与旧操作只作历史参考`RUNBOOK-r3-historical.zh-CN.md`。

## bubblewrap兼容性注意
box的0.12.0依赖openat2，遇官方v255 RestrictSUIDSGID的ENOSYS规则失败。已使用官方Ubuntu24.04安全包0.9.0的root-owned独立副本在box通过完整真实SDK/真实filter回归，但没有改生产binary/path。详见R4-CHANGES及evidence；正式unit必须实测服务器原/usr/bin/bwrap，不能为通过测试删filter或开放执行权限。
