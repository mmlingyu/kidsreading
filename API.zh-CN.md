# Reader API v1 — r2
公网仅HTTPS，内部127.0.0.1:6010。除health外都需独立`Authorization: Bearer <ReaderToken>`，不能用TTS token或模型Key。Token仅浏览器内存。

## 创建
POST /api/reader/imports
Headers：Content-Type: application/json；Idempotency-Key: 16–100位字母数字_-（同一意图网络重试复用）。
正文：`{"source":"text","text":"这里是一段至少二十字的故事正文，随后将由原技能生成分级阅读书稿。","age":"8-12"}`
网页：`{"source":"url","url":"https://example.com/story","age":"4-6"}`
age仅4-6/8-12，缺省8-12。202返回任务。相同owner/key/内容同id，key不同内容409，不因网络重试重复生成。

URL创建阶段检查语法/域名/端口，真实DNS/HTTP在受限子进程中异步执行。只支持公开HTTP/HTTPS合法域名、默认80/443；片段忽略，拒绝用户名密码、IP字面量、异常编码、自定义端口。每跳所有DNS记录必须公网，连接固定已检查IP，TLS验证原域名。最多3跳、1MiB、20–20000字；不携带网站认证，不执行JS/加载图片/绕登录。URL正文过长不会偷偷截断或凭标题编书，返回失败并建议粘贴所需片段。

## 查询/取消
GET /api/reader/imports/{32hex-id}
POST /api/reader/imports/{32hex-id}/cancel
返回：`{"version":1,"id":"...","status":"running","label":"改写","detail":"校验","error":"","book":null}`
状态queued→running→ready/failed；取消queued→cancelled，running→cancelling→cancelled。取消202表示已受理，不等于进程已死，需轮询终态。只有ready含book。跨owner/不存在统一404。所有返回no-store。无任意文件、HTML、其他技能或原始RPC接口。

GET /api/reader/health：200仅表示worker心跳及当前manifest验收门禁通过，未通过503；url_import=true表示实现支持URL，不代表生产已验收。

## 限制与错误
20–20000字正文、100000字节请求，每owner同时1任务/3次小时、队列20/保留200；429含Retry-After:60；磁盘507；无token401；Origin不允许403；语法400；非JSON415；超大413；幂等冲突409。
URL语法问题创建返回400。DNS/HTTP/重定向/提取失败则已创建job终态failed，error为固定代码，例如url_address_denied、url_dns_failed、url_connection_failed、url_http_401、url_port_denied、url_redirect_limit、url_redirect_loop、url_content_type_denied、url_body_too_large、url_text_too_long、url_no_readable_text、url_fetch_timeout。不会在error中回显带凭据的URL或响应正文。
其他failed.error：generation_not_accepted、model_credential_unavailable、worker_restarted、queue_timeout、job_timeout、artifact_missing、generation_failed_or_blocked、validation_or_playtest_failed、isolated_worker_failed。
原质量检查失败最多修订2次，每次复查；最多2次无产物max-tokens续写；全job15分钟及模型预算不重置。前端每请求15秒、每2秒不重叠轮询、总16分钟。网络/鉴权失败停止自动轮询，保留不透明job id供显式恢复；刷新后需重新输入token。
