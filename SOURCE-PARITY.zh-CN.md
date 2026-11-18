# 上传源码→r2功能对照与边界

## 来源与完整性
用户亲自上传的ZIP，非重新读取被拒D盘。26条原清单全部校验；上传文件和独立解压目录都保留。实际所需书稿代码齐全；没有再访问任何用户电脑。原main.py、agent_tools.py不在ZIP：前者仅作为旧路由挂载位置，后者只出现在通用runtime能力/图像工具提示，book-only逻辑不需要；本包显式移除，不用虚构实现补齐。

## 逐文件审查
|原始文件/路径|保留或替换|r2位置/行为|
|---|---|---|
|skills/adventure-reader/SKILL.md|字节完全一致|/skill/SKILL.md只读；年龄/句长/每句中英与grammar/核心词词形/quiz/recall顺序、egZh与recall.zh说明保留|
|references/book-schema.md、example-book.json|字节完全一致|真实fixture单章仍可通过；不再像r1错误地强制所有故事4–8章；长篇4–8章由原技能规则要求，云端总章数上限8|
|scripts/validate.py|字节完全一致且真执行|原check_book：场景、4–12句、4–8词、2道quiz、game.title/zh/intro、填空数量/顺序/词形与回填|
|scripts/playtest.js、assets/recall.js|字节完全一致且真执行|真实引擎空提交、大小写/空格、错误答案、知识库/错题本互斥迁移和每题判分；原recall同时同步frontend/vendor|
|其余原skills assets|字节保留，只读不发布新HTML|只服务规则/兼容；旧书游戏仍由原前端支持，新生成必须recall|
|quality_review.py|只提取book相关4函数，AST一致|reader_service/original_quality.py；原report≥80byte门禁、原Python validator、原Node subprocess60秒上限与原revision_prompt|
|harness_runtime.py:696–765、793–854|实质迁移书稿编排，不照搬服务管理器|worker.py：同job SDK session恢复，最多2次无产物max-tokens续写，初次review+最多2次repair+重新review；统一budget/deadline/cancel；QA报告与次数持久入SQLite私有字段|
|studio.py:990–1009、1165–1178、1194–1202|保留book prompt来源/语义，安全替换通用能力|prompts.py；材料assets/source.txt→outputs/book.json+report.md，必须跑两步；删除agent_tools图像/通用资源提示，不让agent开链接或改引擎|
|reader_imports.py:94–150、166–204|保留text/url/age与book预览协议，安全替换身份/状态|core/api：真实owner映射代替readerlocal；云端URL先取正文；blocked明确failed；cancelled独立终态；增加queued/cancelling/version但前端保持兼容|
|task_specs.py adventure-reader契约|保留准确输入/输出约束|书稿正文/网页+年龄；book.json/report.md；不导入PIL/其他模块分支|
|skill_registry.py及其curriculum依赖|审查导入闭包，替换动态技能目录/解压安装|固定只读adventure-reader与trusted manifest；不开放技能上传/修改/解锁|
|storage/users/curriculum/library/run_stats/content/security/port_games|审查依赖来源；不把全Studio搬上云|原项目/用户/课程/HTML分享/图片/游戏搬家属于其他模块或本机管理，替换为独立SQLite、Bearer、jobdir与安全JSON产物；原源码快照留在evidence非执行目录|

## 明确的云端安全差异（不是偷偷扩大权限）
- 原技能“打开链接”→可信受限fetcher先拿正文；模型仍无网络。HTTP/HTTPS仅域名默认端口，IP字面量/内网/特殊用途地址/嵌套映射地址拒绝；所有DNS答案校验，每跳重做；connect使用数字IP且TLS验证原域名。不是只靠prompt防SSRF。
- 原允许修改recall.js来修引擎→技能/校验器/引擎全部只读，需维护者另发版本；每job不能放松测试。
- 原trusted-local/DSH_PATCHES与通用本地工具权限→固定OS namespace+无网络+只读挂载+专用UID/cgroup，模型唯一外部能力为限定模型代理。
- 原report/quality-report/logs/HTML分享→report仅内部门禁、QA私有DB、不公开任何HTML/任意路径；只把最终book.json交给所属owner。用户仍需预览确认才写浏览器书架。
- 原已有路径art→固定前端真实静态图片白名单；禁止外链/伪造路径；JSON无HTML/原型键/危险色值；附加浏览器兼容检查，原Python/Node校验没有被替换或放宽。
- 原无限运行/本机固定用户→总15分钟、每job模型调用预算、排队/保留/磁盘硬上限、owner隔离、可真正终止的fetch/agent/review/模型连接。
- 原book-only分支不需要完整agent_tools.py、main.py；没有把未上传的其他技能/工具函数编造出来。

## 已测试与未声称
测试包括原字节/函数AST一致、原fixture、报告门禁、原Python比旧前端多出的game.title字段、真实Node填空引擎、0/1/2次repair及第三次仍失败不再修、两次max-tokens续写、完整任务取消、URL假抓取与同源前端、SSRF/DNS rebinding/逐跳重查/固定IP+SNI/代理无效、越权/持久化/幂等/恶意symlink发布与socket重绑、真实SDK二进制在namespace中的假模型及session恢复。
没有声称：真实网页抽取已联公网验收、真实付费模型书稿已生成、r2已在腾讯部署、所有其他skills已迁移、源语义/内容质量已由用户人工验收。六门禁仍需统一部署工作流记录真实证据。

## r3部署安全适配
原技能所有字节及原QA四函数AST继续一致；仅新增root只读原生运行时cache、独立noexec session/tmp布局、共享SQLite权限与重启清理。详见R3-CHANGES；没有替换原生成规则/validators，也未开放任何原Studio接口。

## r4部署安全适配
原技能/QA/依赖锁不变。仅修正非root setgid请求、root预建烟测布局及发布版本一致性；不含TTS，不移除RestrictSUIDSGID或noexec。详见R4-CHANGES。

## r5语音接入
原技能全部字节、原QA四函数、生成prompt/repair编排、SDK/依赖锁保留；TTS独立Reader-auth API内新增固定loopback异步代理，不交给agent/worker。worker只增加固定脱敏诊断码。前端语音及同一状态模块URL更新，其他阅读内容/原书稿入库路径保留；详见R5-CHANGES。当前TTS协议依部署流现场只读交接，而非旧8790/Pocket历史材料。
