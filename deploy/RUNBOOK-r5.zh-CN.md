# r5部署/回滚手册（本执行者未执行服务器动作）

1. 保存r4 release/current/units/API与worker受限配置、对应accepted及SQLite备份。只暂停Reader API/worker，保持Harness/TTS/反代现有服务不动；切换期间生成保持0。
2. 校验外部ZIP/TAR hash及包内SHA256MANIFEST，部署`/opt/reader/releases/reader-phase1-20261117-r5`为root-owned只读源码（目录0755、文件0644、sh0755）。依赖锁/SDK/runtime-bin0.2.2rc2不变，无需安装Pocket/新模型/新Python依赖。
3. DATA与已挂载512MiB nosuid/nodev/noexec jobs共享根仍root:reader-data2770，数据库/侧文件0660。只在Reader停止时审查执行`deploy/prepare.sh --prepare-inactive`，其中预建`/var/lib/reader/run`为reader-worker:reader-data0700、setfacl -b -k清访问/默认ACL。脚本不启动服务/不改Caddy/不读凭据；缺setfacl应先准备acl包，不绕过检查。
4. 部署root安全创建**独立**`/etc/reader/tts-client.env`，root:root0600，仅一行`TTS_API_TOKEN=<已有上游独立Bearer>`。从受限服务配置安全提供单个值，不显示终端/日志，不复制整个`/etc/local-tts-api.env`。不能使用Reader Token/DeepSeek Key。无需用户再提交Key。本包示例为空值。
5. 安装r5 API unit（仅该unit增加可选EnvironmentFile=-/etc/reader/tts-client.env）；worker unit绝无该文件。环境文件由systemd root管理器读取后降权，reader-api不需直接读取文件权限；模型worker/sandbox不能读取此env。API原128MiB内存上限等不变；不能为通过测试放宽保护。
6. current切r5、daemon-reload，启动Reader服务。凭据缺失时新语音接口返回503；旧生成控制面及原独立TTS服务不被改造。health.release应为r5。前端和overlay用相同r5版本。
7. 按**r5新TRUSTED-SHA256.json hash重新核验六项生成门禁**：source parity、namespace负测试、硬quota、cgroup、正式Linux py3.12 SDK smoke、HTTPS/鉴权。旧r4通过记录仅历史，不能原样复制hash当新签署。包内示例六false、ENABLE0。可用`deploy/run-noexec-smoke.sh --install-and-run-fake-reader-probe`（root预建.r5-UUID夹具，正式unit保持全部保护，不加载任何真实凭据）。原只读SDK cache复用。接口/worker成功后才由协调写真实验收记录并恢复原生成设置。
8. 运行全部pytest、`node tests/test_frontend.mjs`、`node tests/test_tts_ui.mjs`及JS语法；注意box为Python3.13，服务器真实Python3.12仍须跑。TTS新增协议测试纯fake，不得将真实Key导入测试环境。
9. HTTPS匿名TTS proxy必须401，Reader Token有效可获取两引擎实时脱敏清单；坏参数/越权/限流、无路径/Token泄漏、原原生TTS鉴权不变。观察API RSS/MemoryPeak、原TTS/生成并发时资源、取消后socket关闭/原TTS忙锁及超时。
10. 浏览器在“语音与连接”填纯Reader Token，刷新列表选择Piper英语、Phonon default/Zoey各短句，验证真实音频/音色切换、停止/换页、中文Piper和Phonon中文明确browser策略。模拟云端失败应可见且不静默降级；手动browser备用可用。确认书架/答题/解锁/刷新持久和生成/运行中取消未回退。源许可应按实时元数据展示，未提供时不得声称有授权；不要把返回数量当全部音色实测。

## 回滚
仅Reader切回保存r4 current/units与其对应受限配置和accepted，重启Reader API/worker；不修改TTS/Harness/Caddy/AppArmor/sysctl、jobs挂载或SDK只读cache。DB schema仍2、没有语音数据迁移，run0700兼容r4。r5独立tts-client.env可留root0600但r4 API不加载；不要把它转给worker。前端同步回滚至r4。r4前端原本机语音指向将恢复，故云端语音不应再标记可用。
