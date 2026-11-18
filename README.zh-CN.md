# Reader Phase1 reader-phase1-20261117-r4

r4是r3的RestrictSUIDSGID/烟测布局/版本号修复，不含TTS变更。

- 运行服务不再显式mkdir/chmod setgid目录；生产DATA与jobs共享根必须由部署root预建root:reader-data2770，服务只校验。普通job目录仅请求0770，组/SGID由父目录内核继承，不重设。
- 生产烟测改为root预建独立合成fixture+同保护的实例化unit；烟测必须实际证明mkdir/chmod setgid返回EPERM，然后完成真实SDK首启、两次恢复repair、原QA、取消与重启清理。
- root只读原生缓存与noexec任务/session/tmp布局保持；SDK0.2.2rc2、预算、单队列、owner鉴权、URL安全、原技能/QA、0660 SQLite及跨UID锁不回退。
- 包VERSION、health.release、目录名、前端cache-buster统一r4；构建器拒绝VERSION/目录不一致。

入口：`R4-CHANGES.zh-CN.md`、`deploy/RUNBOOK.zh-CN.md`；测试与原始源码证据在`evidence/`，原功能对照`SOURCE-PARITY.zh-CN.md`，接口`API.zh-CN.md`。

这里只完成box发布包；server Python3.12正式unit仍须复验。accepted示例六项false、ENABLE=0；必须按r4新trusted hash重新核验，不因box通过就开启生成。没有读真实凭据/调用真实模型/连接服务器。原r1/r2/r3和上传源ZIP保留，原Git与用户电脑不动。

box回归：Python3.13，114 pytest通过（1条第三方弃用warning）；两个真实非root UID+完整mode-bit seccomp SQLite通过；真实SDK/假模型在noexec+真实filter下首启、两次session恢复repair、取消/重启清理通过。box bwrap0.12不兼容该官方filter，完整回归使用独立root-owned官方Ubuntu24.04 bwrap0.9副本，生产binary未改；详见R4-CHANGES。正式Tencent Python3.12 unit仍待验证。
