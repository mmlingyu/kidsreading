# r4 → r5：阅读器腾讯云Piper / Phonon语音

## 范围与完成状态
仅box版本化源码、mock协议/模块/原回归测试；未连接服务器，未读取实际TTS/Reader/DeepSeek凭据，未真实合成或试听。r4此前线上六门禁/真实生成/阅读流程通过属于部署流提供的基线，并非本执行者重新验证。r5上线及实际声音验收仍由部署流与浏览器完成。

## 路径与协议
- 浏览器只用Reader Bearer调用当前站点GET `/api/reader/tts/voices?engine=piper|phonon`、POST `/api/reader/tts`，不直连原TTS，不把其凭据写入前端。
- Reader API只连接固定127.0.0.1:8800，对应固定`/api/voices?engine=...`与`/api/tts`；忽略代理环境，无任意URL/headers/path参数、无重定向。原`/api/tts`、`/api/voices`、`/api/health`及原TTS Bearer机制完全不改。
- 当前上游协议由协调部署流现场只读回传：apiVersion1.2.0/serviceVersion1.1.0。box历史文档/公共Phonon清单来源hash在`evidence/R5-TTS-PROTOCOL-PROVENANCE.json`，旧8790/Pocket路由不得继续使用。
- 上游Piper `voices[].voice`、Phonon `voices[].id`，适配voice/name、language/locale，输出只含`engine,id,name,language,license`；路径、模型文件、进程状态等不透出。只显示源提供的licenseClass/datasetLicense/license标识，未知明确“未提供”；没有凭空补许可或将8/38硬编码成实时结果。
- Piper文本trim后1..2000码位；Phonon原文≤1000码位且非空/无汉字；无NUL/非法Unicode。只接受text/engine/language/voice/speaker，Piper语言zh/en/ja/ko/fr，ja允许female/male/整数0/1；Phonon仅en且无speaker。Phonon名字/ID不分大小写匹配实时列表后转成规范ID。未知参数、音色/语言冲突均拒绝；不自动重试400/401/403。

## 安全和资源
- `/etc/reader/tts-client.env`由部署root安全创建root:root0600，**只含TTS_API_TOKEN**；仅reader-api unit加载。绝不复制整个上游env，不进入worker.env、模型进程或sandbox；worker unit还明确UnsetEnvironment=TTS_API_TOKEN，避免误配manager全局环境时继承。缺失/空值明确503，不产生匿名代理。
- Reader Bearer沿用constant-time owner映射；语音和导入共享模块内存Token，刷新需重填。输入仅trim两端复制空白，拒绝Bearer前缀/引号/内部空格，错误不回显令牌；不更换已解决401的真实Token。语音仅同源，即使导入另配HTTPS源也不携Token为语音请求跨源。
- API单进程全局上游并发1，另有贯穿整个音频响应传输的全局lease（防慢接收者积压多份完整WAV）；已生成整段WAV以32KiB块发送，非推理流式。API HTTP并发硬上限16，传输总时限230秒。忙立即429/Retry-After2；每owner每分钟音频60、清单20次，429/60秒。无音频持久缓存/磁盘落地；只缓存每引擎最多128条脱敏音色60秒。
- 请求体≤14000字节/读入≤10秒；元数据≤128KiB，上游头≤16KiB，WAV≤12MiB。connect≤10秒/read≤200秒/整次≤210秒，浏览器≤220秒。单进程并发1限制缓冲峰值；原API MemoryHigh96M/MemoryMax128M/Swap0等不放宽，仍需现场监测。
- 不盲信Content-Type：校验RIFF/WAVE长度、PCM16单声道、8–48kHz、时长≤200秒与实际帧长度。仅白名单安全音频头转发；上游错误正文完全不透传，避免路径/文本/Token泄漏。
- 已通过真实ASGI disconnect事件→实际loopback TCP关闭回归（不使用穿过middleware可能漏事件的is_disconnected轮询）。停止/切引擎/换音色/换页会Abort fetch、关闭Reader到TTS socket、停止Audio并释放Blob URL；浏览器排队旧片段失效。**原TTS无推理取消接口：关闭HTTP不等于杀死其既有推理**，原上游忙锁/180秒超时继续约束，不能宣称终止原TTS进程。SDK任务取消边界不变。

## UI与兼容
- 顶栏“语音与连接”“停止朗读”，状态常驻可见；同一Reader Token可授权导入及语音。Piper/Phonon动态刷新，英文音色可选；全部语言/源授权标识可展开，非商用标识显著显示。
- Piper按朗读语言使用对应音色；英文使用所选英文音色；设置中可展开选择其他语言音色（如中文xiao_ya），中文/法/日/韩按对应选择或列表默认。Phonon仅英文，中文提示明确告知使用浏览器语音，维持旧阅读器行为。云端错误不自动降级，用户可明确选择浏览器备用。
- 逐句/限长串行合成与播放，不全书并发。speed不传上游；原rate只控制本地播放速度。
- 移除活跃Pocket导入/配置，旧Pocket存档迁移到浏览器；旧静态Pocket文件保持不加载，不安装/启用Pocket。书架/进度/原book.json本地导入保留。
- 修正原mixed `state.js?v=24`与无query造成的重复状态模块：state/tts/Reader auth统一r5 URL。frontend与overlay同步包含所有改动依赖。
- 最小运维修复：prepare必须worker停止，root预建run为reader-worker:reader-data0700并清除默认/访问ACL；`unsafe_broker_directory` 作为任务错误码保留，日志只有这一固定码，不再改写成 `isolated_worker_failed`。不输出异常路径或材料。正式隔离、固定原技能、QA、预算、原SQLite模式均不变。
- 成功响应不转发 `x-streaming`。上游给的是整段 WAV，不是推理流。关闭 Reader 到 TTS 的 HTTP 仍不会取消已经开始的上游推理；客户端断开后 2 秒内全局 busy，不能马上再开一段绕过它。
- 现场曾看到 Piper 8 条、Phonon 38 条，生产只试听过 `default` 和 Zoey。界面数量以当时鉴权后的清单为准，不能把 8/38 写死，也不能说其余音色已经测过。
- Phonon 遇到中文提示会明确写出「Phonon仅英文」再使用浏览器语音，这是原来的中文提示行为，不是云端失败后的静默换引擎。云端失败只显示错误，不自动改走浏览器。
- 可部署包不要在 Git 工作区根目录运行 `tools/build_release.py`。使用 `python3 tools/stage_release.py --output /tmp/reader-phase1-20261117-r5.tar.gz`。构建器若看到维护说明或历史 `tts/`、`speech.js`、`phonon-sw.js` 会直接拒绝。部署必须按新的 `TRUSTED-SHA256.json` 重验六项门禁，不能继承 r4 的签署。
