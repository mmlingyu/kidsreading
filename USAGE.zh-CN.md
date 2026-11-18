# HTML 技能使用说明

版本目录：`reader-phase1-20261117-r5-html8`。html1 到 html7 不能再当作待装包。阅读器页面是 `https://124.222.128.61/reader/`，不是这个 IP 的网站根。阅读器 API 仍是 `https://124.222.128.61/api/reader/`。Studio 页面是 `https://124.222.128.61/studio/`，API 是 `https://124.222.128.61/api/studio/`。下面其他例子把主机写成 `https://SERVICE`。示例里没有 Token。

html7 已在服务器打开生成，并且仍是线上正在跑的那一版，直到部署者按新的哈希改指向 html8。html-builder 与 zdog 各有一次真实 ready 产物。knowledge-travel 在 html7 有一次真实调用，58 秒后 `studio_review_failed`，任务 `675f2e0834994547b6092b8de7ef06b2`。只读取证确认 `outputs/` 是空目录，两个文件都不存在；`agent-result.json` 的 `finish_reason` 是 `max-tokens`，会话同为 `max-tokens`，`maxTokens=8192`，推理强度是默认的 high。最后一轮只有推理、没有写文件。html8 把这一次标成生成预算用尽，并允许同一任务最多续写两次。云端没有生产模型，不能把 html8 写成已经通过。当前这一小时的 3 次额度已满，不要立刻再付费重试，也不要改额度或另开 owner。等 html8 完成自己的 gate 和 enable，并且进入下一个额度窗口后，knowledge-travel 只验收 1 次。四个 blocked 技能仍不可调用。排队中途取消、第二个 owner、进度超时和墙钟超时还没有生产实测。

2026-11-18 19:29 已允许把这 7 个技能源码公开进仓库。样例 HTML 没有打进发布包。

## 七个技能

| 技能 | 状态 | 原因 |
|---|---|---|
| html-builder | 生产已通过一次 | 任务 `0dc62b1a13754544a15cdc0ad59942bb`，约 29 秒 ready。preview 9632 字节，report 1507 字节。 |
| zdog | 生产已通过一次 | 任务 `11d198a839f74bcc85fa8fa7ed3dfd90`，约 111 秒 ready。preview 32432 字节，report 1471 字节。官方离线 Zdog 1.1.3 已内联，无 CDN。 |
| knowledge-travel | html7 生产一次未通过，html8 待下一个窗口重验 | 任务 `675f2e0834994547b6092b8de7ef06b2`。文件没有写出，停止原因是 `max-tokens`。没有公布产物。不要把它写成已通过。 |
| spdesign | blocked | 缺生图适配，也没有任务所需的 11 张参考图。`missing_image_adapter_and_eleven_reference_images` |
| 3d-game-dev | blocked | 缺 Blender 网关和人工目标图确认。`missing_blender_gateway_and_human_target_approval` |
| creation-engine | blocked | 原技能依赖的 `3dplay` 校验、`catalog.json` 和 `img2threejs` 不在上传包里。`missing_3dplay_rules_catalog_and_img2threejs` |
| grill-me | blocked | 正文只调用缺失的 `grilling`，并且 `disable-model-invocation: true`。带 MIT LICENSE。`missing_grilling_skill_and_model_invocation_disabled` |

首期输入只有 brief 文本。不上传图片，不抓取 URL。

## 页面

阅读器页面打开 `https://124.222.128.61/reader/`。Studio 打开 `https://124.222.128.61/studio/`。填入现有 Reader Token。html8 启用前，线上仍是 html7，knowledge-travel 先不要再提交。启用后的下一个额度窗口只选 knowledge-travel 验收一次；html-builder 和 zdog 不必为了这次修复再跑。blocked 技能会显示原因，提交会被拒绝。完成后下载 `preview.html`。预览 iframe 只有 `sandbox="allow-scripts"`，没有 `allow-same-origin`。Token 不进预览，也不进 localStorage。这个页面不是阅读器，不会改书架。任务状态会显示固定错误码。看到 `studio_generation_budget` 就是这一次生成把单步输出预算用完了，合格文件还没写完。

## curl

把 Token 放在你自己的环境变量里，不要写进命令历史后提交。

```bash
curl -sS -H "Authorization: Bearer $READER_TOKEN" https://SERVICE/api/studio/skills
curl -sS -H "Authorization: Bearer $READER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"skill":"html-builder","brief":"做一个只有一个按钮的小页面"}' \
  https://SERVICE/api/studio/jobs
curl -sS -H "Authorization: Bearer $READER_TOKEN" https://SERVICE/api/studio/jobs/JOB
curl -sS -D - -H "Authorization: Bearer $READER_TOKEN" \
  -o preview.html https://SERVICE/api/studio/jobs/JOB/files/preview.html
```

下载响应应是 `content-disposition: attachment` 和 `content-security-policy: sandbox`。

## PowerShell

```powershell
$headers = @{ Authorization = "Bearer $env:READER_TOKEN" }
Invoke-RestMethod -Headers $headers -Uri https://SERVICE/api/studio/skills
$body = @{ skill = "html-builder"; brief = "做一个只有一个按钮的小页面" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Headers $headers -ContentType "application/json" -Body $body -Uri https://SERVICE/api/studio/jobs
```

## 失败时看什么

- `401` / `unauthorized`：Token 不对或没带 Bearer。
- `403` / `studio_skill_blocked`：上表四个 blocked 技能。
- `400` / `studio_bad_request`：多了 URL、图片或其他字段。
- `429`：同一身份同时任务或每小时次数到了。
- `studio_generation_disabled`：生成开关仍是 0，或六项门禁还没按新 hash 签过。这是默认状态。
- `studio_generation_budget`：模型这一步的输出预算用完，合格的 `preview.html` / `report.md` 还没写出来。页面上会写「生成达到本次输出预算」。这不是把 80 字节门槛放宽。同一个任务最多自动续写 2 次，仍然失败就停，不会新开一个任务，也不再占一次每小时额度。
- `studio_generation_failed`：模型回合以 error、failed、blocked 或 cancelled 结束。不会把模型原文写进错误。
- `studio_review_failed`：回合正常结束，但审查没有接受产物。`preview_too_small_or_unsafe` 和 `report_too_small_or_unsafe` 只表示文件不是「普通文件、硬链接数为 1、长度在 80 字节到上限之间」。缺文件、符号链接、硬链接、短于 80 字节、或超过上限，都是这一个码。内容检查（是否完整 HTML、knowledge-travel 的 `game-spec`）要等这一关通过才跑。危险页面、父页面桥接、外链脚本不会被当成预算问题再试一次。
- html-builder 与 zdog 的真实模型已各通过一次。knowledge-travel 的那一次没有通过，html8 还没有生产验收。排队中途取消、第二个 owner、超时还没有生产实测。

## 一次任务能花多少

模型仍是 `deepseek-flash`，不换模型，也不加新的付费服务。思考模式默认开着，强度是 high。官方说明里，`max_tokens` 限制的是每一次模型请求的输出，不是整轮对话的合计；思考默认可用到 64K，模型硬上限是 384K。html7 的代理把每一次都改写成 8192，所以 knowledge-travel 的长推理会在写出文件之前被截断。SDK 这一版只发送 `thinking.type=enabled`，不发送 `budget_tokens`，因此代理里「把 thinking 预算压到 2048」的规则没有作用到这次失败上。

续写使用同一个会话和同一个代理，不重置次数。总时限仍是默认 600 秒、硬上限 900 秒；产物没有更新时默认 180 秒、硬上限 300 秒。每小时仍是 3 个任务。

| 技能 | 每次请求输出上限 | 每个任务最多请求 | 最多续写 | 输出 token 上限 |
|---|---:|---:|---:|---:|
| html-builder | 8192，与 html7 相同 | 12 | 2，仅在 `max-tokens` 且审查未过、也不是危险内容时 | 98304 |
| zdog | 8192，与 html7 相同 | 12 | 2，条件同上 | 98304 |
| knowledge-travel | 16384 | 12 | 2，条件同上 | 196608 |
| 阅读器改写 | 8192，没有改 | 12 | 2，原有逻辑 | 98304 |

按公开标价，输出高峰约 $1.2 / 1M token。knowledge-travel 把单步上限从 8192 提到 16384，一个任务的输出上限大约从 $0.12 变成 $0.24。这是现有模型能力里的小幅上调，只作用在这一个技能。html-builder 和 zdog 的上限不动。输入另计，续写不新开任务。

## 依赖还缺什么

- spdesign：生图适配和 11 张参考图。
- 3d-game-dev：Blender。不要装到现有 4 核 4GB 的阅读器机器上。
- creation-engine：`3dplay` 规则、校验脚本、词表和 `img2threejs`。
- grill-me：`grilling` 技能。
- zdog 官方 npm 包 1.1.3 没有单独的 LICENSE 文件。dist 文件头写的是 MIT，Copyright 2020 Metafizzy。

## 安装和当前状态

步骤、预期输出和失败恢复在 `deploy/RUNBOOK-html.zh-CN.md`。摘要：

- `prepare` 不把 studio 用户加入 `reader-data`。`/etc/reader` 只加目录搜索 `x`，`owners.json` 只加 `r`。回滚用 prepare 当时的 ACL 快照，不用 `setfacl -b`。已有的 `worker.env` 密钥和生成开关保持原样。
- jobs 在独立 128MiB `nosuid,nodev,noexec` 盘。挂载单元名是 `var-lib-studio-jobs.mount`，不是 `studio-jobs.mount`。`prepare` 会清掉旧的无效 unit，不重做已经挂上的盘。
- 现网 HTTPS 是 `local-tts-edge.service` 和 `/etc/local-tts-edge/Caddyfile`。`deploy/edge-studio.sh install` 备份后只插入 studio 前缀，校验整份文件，再 `reload` 这个 unit。`validate-studio-caddy.sh` 只检查片段。
- `gate` 先 `systemd-analyze verify`，再按 unit 里的 runtime 和只读 cache 跑六项探针，并对三个可调用技能各做一次真实 bwrap 绑定。`enable` 只有探针通过且哈希等于本树 `TRUSTED-SHA256.json` 时才写签署并打开生成。不要沿用 html6 或更早的签署。任务目录只请求 `0770`，由 root 预先准备的 setgid 父目录继承组；worker 不设置 setgid。`RestrictSUIDSGID=true` 保持打开。取消不占创建任务的并发额度。遗留 running 用 `studio-lifecycle.sh recover` 标成失败，不能标成成功。
- 密钥只在 worker 的 env 文件里。进程启动读一次，之后从环境删除；同一进程的后续任务复用内存里的那一份。不进 bwrap 的环境或参数。

Studio 的 api 和 worker 共用 `studio-data`，目录 `2770`，`UMask=0007`。数据库和发布文件是 `0660`。取消不会把已经取消的任务写成 ready。总时限默认 600 秒、硬上限 900 秒；产物没有更新时默认 180 秒、硬上限 300 秒。

## 回滚

`deploy/studio-lifecycle.sh disable` 关掉生成。`rollback` 只停 studio 并还原本次 ACL。边缘用 `deploy/edge-studio.sh restore 备份目录`。阅读器 current、6010、8800、3080 保持不动。
