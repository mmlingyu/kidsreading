# r3 → r4：setgid目录请求与生产烟测对齐

## 核实的故障
官方systemd v255 `src/shared/seccomp-util.c:seccomp_restrict_sxid` 对mkdir/mkdirat/chmod/fchmod/fchmodat/fchmodat2等调用的mode参数中S_ISUID/S_ISGID位返回EPERM。它在文件系统检查之前生效；nosuid不是这里的拒绝机制。
r3 `Store.shared_directory` 无论路径是否存在均请求mkdir(2770)，且caller拥有目录时再次chmod(2770)。生产root拥有的既有共享根避过chmod，但烟测创建自己的data新路径，mkdir即被拒绝；普通sudo-u不带该filter因此会成功。

## r4运行代码
- `Settings.load()`强制生产共享根策略：DATA与DATA/jobs必须已存在、非symlink、root-owned、gid配置reader-data、恰为2770；缺失或权限不符直接明确报错，服务不自举修复。
- 不对已存在共享根做mkdir/chown/chmod。内部私有测试目录仅以0770请求创建，普通caller拥有且无set-ID位的目录可修正普通0770；已继承SGID目录只验证，不请求重设SGID。bad group/mode仍拒绝，不跳过错误。
- worker job目录仍仅请求0770，继承共享根组及内核SGID；文件0660、WAL/SHM/journal、独立schema flock、原POSIX锁保护全部保留。
- 生产烟测由root脚本建立唯一`.r4-<UUID>/data/jobs`三层合成fixture（root:reader-data2770），实例化unit通过--data使用它；测试客户端与正式API/worker一样仅校验共享根。probe先对自己的普通目录验证请求setgid确实EPERM，若filter没生效则失败，不弱化测试。
- unit退出后root脚本仅凭确切UUID/根拥有marker清理该合成fixture，不碰真实queue/jobs。失败且unit仍活跃则保留并明确报告路径。
- VERSION/health.release/前端cache-buster为r4；构建器静态检查包版本与发布目录一致。

## 真过滤测试，不假冒systemd
`tools/restrict_suid_sgid.py`通过系统libseccomp加载真实native x86_64内核过滤、NNP与官方mode参数规则，含openat2 ENOSYS和fchmodat2兼容；不是mock os.mkdir/chmod。测试先重现旧mkdir/chmod2770的EPERM，再测试修复后行为。两个实际非root UID的SQLite客户端也带此filter，root只做目录预建/进程编排。
完整SDK CLI回归也在该filter下、使用root-owned源码/cache和真正noexec挂载，首启+两次session恢复/repair+原Python/Node QA+请求中取消+重启清理。box并非systemd，故只声称真实等价syscall过滤/namespace回归，不声称正式Tencent unit或全部systemd属性已通过。完整结果见`evidence/R4-REAL-SDK-NOEXEC-SECCOMP.json`；SDK为真实二进制，模型仅离线fake，共6次请求，set-ID负测试之后probe Python审计钩子所见的显式set-ID mkdir/chmod请求数为0；该计数不是对子进程所有syscall的strace统计，子进程仍由真实内核filter约束。

## 不变边界
RestrictSUIDSGID=true、nosuid/noexec、AF_NETLINK、ProtectKernelTunables=false、ProtectControlGroups=true、空caps、NNP、Memory768M/Swap0/Tasks64/CPU100%全部保留；没有trusted-local、额外网络或可见宿主/其他job路径。static SDK cache与r3同一128MiB只读上限/160MiB预留，jobs512MiB不变。密钥不进入agent，proxy/预算不变。
原技能字节及原QA四函数AST/依赖锁保持。没有TTS改动；Piper/Phonon在本阶段验收后另做。

## box与目标bubblewrap兼容性：没有削弱filter
box现有`/usr/bin/bwrap`为0.12.0，在官方v255式filter将openat2返回ENOSYS时，不能打开/usr并报Function not implemented；这不代表修复后的Store仍请求setgid，也不是移除规则的理由。
完整SDK+真实filter回归采用官方Ubuntu24.04当前安全包`bubblewrap_0.9.0-1ubuntu0.3_amd64.deb`的**独立root-owned提取副本**，只用于box测试，不安装/替换系统binary、不进入发布包、不改变生产/usr/bin/bwrap默认路径。过滤仍包括openat2 ENOSYS，全程无网络job、真正noexec工作区、root只读cache。
- 官方包URL：https://security.ubuntu.com/ubuntu/pool/main/b/bubblewrap/bubblewrap_0.9.0-1ubuntu0.3_amd64.deb
- 官方包SHA256：`2461f1beee9cb04c8942739fe1a2b37e7b7c2a3d518f0779dc75f9245baa3094`（packages.ubuntu.com/noble/amd64/bubblewrap/download）
- 提取binary SHA256：`e318903862396f96de3df57264e0158682b952fd3fb53ac23d876413e7b30f71`；版本`bubblewrap 0.9.0`。
`tools/run_filtered_noexec.py`明确标记formal_systemd_unit=false。正式烟测必须使用服务器实际/usr/bin/bwrap与真正systemd属性，记录其版本；若服务器也有不兼容新bwrap，应报告兼容性阻碍，不能去除openat2规则/RestrictSUIDSGID或擅换binary。本执行者未核实服务器bwrap包版本。
官方filter证据：https://github.com/systemd/systemd/blob/v255/src/shared/seccomp-util.c （seccomp_restrict_sxid）。不是对整套systemd的仿真。

额外生产路径校验：fixture使用短名`.r4-<UUID>`，其模型代理AF_UNIX地址为104bytes（Linux sun_path可用上限107）。旧长描述前缀会到117bytes，已修正并加发布模板回归与probe早期长度检查，不能仅凭较短box路径通过而漏掉生产限制。
