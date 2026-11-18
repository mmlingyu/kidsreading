# r2 → r3：noexec 原生模块缓存与共享SQLite安全适配

## 实际根因，不是“session必须可执行”
在box真实noexec `/dev/shm` 上复现SDK0.2.2rc2首轮`finish_reason=error`，假代理0请求、没有session.v4.jsonl。SDK turn/end给出：
`/work/.cache/pkg/.../@deepseek-ai/node-addon-system-linux-x64/bin/glibc/system.node: failed to map segment from shared object`。
这是ELF共享对象mmap(PROT_EXEC)被noexec拒绝，不是JSONL日志要exec。仅迁DSH_HOME不是正确归因。

另验证了两个惰性加载点：只预热模型不够，首次bash还需node-pty原生模块；把TMPDIR移入noexec盘时，启动绑定`node-addon-require-builtin`也需其原生缓存。实际验证的配置：
- `HOME=/sdk-home`：root只读静态包缓存，含`.cache/pkg`；
- `NARB_NATIVE_CACHE_DIR=/sdk-home/.cache/narb`：loader公开支持的确定性原生缓存；
- `DSH_HOME=/work/.dsh`（SDK显式dsh_home参数）：仍是本job的noexec卷，跨bwrap持久session；
- `TMPDIR=/work/tmp`、`/tmp -> /work/tmp`：启动临时JS可由解释器读取，生成文件也留在noexec jobs卷。

固定runtime缓存先由隔离的非root进程使用假模型预热（包括一次真实bash printf），再由root校验/封存；只复制静态`.cache/pkg`及`.cache/narb`，绝不包含session、用户材料或socket。不是下载primary runtime，不改SDK或wheel，不把jobs remount exec。

## 安全布局与容量
- `/opt/reader-runtime-cache-0.2.2rc2`：root-owned，目录0755/文件0644，双重只读（systemd+namespace）。只有静态代码共享，不含任何job数据；不是共享可写exec缓存。每次真实agent启动验证runtime SHA及所有缓存文件hash/所有权/权限/链接与128MiB、10000文件上限，拒绝noexec缓存源。用户无法增长它。
- 本机实测静态内容80,844,870 bytes / 4,882 files，按文件块/目录/manifest预留≤160MiB磁盘；只保留当前及一个回滚缓存，清理由维护者显式操作，不让agent创建版本目录。缓存不打进release包，必须从服务器已安装的同版本锁定wheel离线生成。
- jobs仍512MiB loop,nodev,nosuid,noexec，包含所有材料、脚本、session、临时文件、产物；每job只挂自己的目录，只有最终book.json公开。没有新增可写宿主exec分区。root/runtime/其他job仍不可见；真实key仍仅在宿主受限broker，模型只Unix socket。
- MemoryMax768M、SwapMax0、Tasks64、CPU100%、AF_NETLINK、ProtectKernelTunables=false及其他保护保持；静态缓存读取的页缓存可能计入cgroup，服务器正式峰值必须重测，不拿box结果代替。

## 状态/清理
同job跨初次与两轮repair的三次bwrap使用同一`/work/.dsh`；QA仍用原Python+Node，原四函数AST/skill字节不变。正常/失败/取消后清掉session及临时文件；重启先将running→failed、cancelling→cancelled，再在单worker锁内只清理DB已登记终态job（ready只留book）与对应陈旧socket。重启不偷偷恢复模型工作，不创建无界会话卷。

## SQLite
data/jobs父目录2770、reader-data组继承；数据库首次创建在SQLite接管前明确0660，已有文件仅合法regular/non-symlink/nlink1才能使用。-journal/-wal/-shm均验证/修正组和0660。生产两个unit仍UMask0007；离线迁移脚本清理临时ACL后设置明确的POSIX默认ACL（group rwx、other---），消除启动顺序依赖。代码不会open/close已有SQLite inode来改权限，避免释放另一个活跃连接的POSIX锁；专门回归验证锁仍有效；另用独立0660 schema锁串行化并发首次启动/迁移，不用DB inode充当额外锁。不给world write，不递归放宽job、run或配置权限。

## 验收现状
box：108 pytest通过（含真实SDK+真实noexec挂载+两次持久resume/repair+原QA+真实SDK请求中取消+重启清理），另真实UID65533/65534、共享GID1000独立进程四组新建/旧库迁移顺序、WAL/SHM/journal写入及无关UID拒绝通过。主机Python3.13；root缓存发布也验证，只有box上的systemd inactive检查在该单项准备器测试中模拟，未假称正式unit通过。

服务器真实Python3.12/正式unit/noexec ext4复验仍待协调：`deploy/run-noexec-smoke.sh`与`tools/sqlite_permissions.py`已提供。linux_py312_sdk_smoke仍false；所有其他门禁必须按r3新trusted hash重核。本工作流不触碰服务器、Key或accepted文件。
