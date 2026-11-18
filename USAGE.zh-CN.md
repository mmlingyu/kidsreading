# HTML 技能使用说明

版本目录：`reader-phase1-20261117-r5-html7`。html1 到 html6 不能部署。阅读器页面是 `https://124.222.128.61/reader/`，不是这个 IP 的网站根。阅读器 API 仍是 `https://124.222.128.61/api/reader/`。Studio 页面是 `https://124.222.128.61/studio/`，API 是 `https://124.222.128.61/api/studio/`。下面其他例子把主机写成 `https://SERVICE`。示例里没有 Token。

html7 已在服务器打开生成。html-builder 与 zdog 各有一次真实 ready 产物。knowledge-travel 有一次真实调用，审查失败，没有可下载产物，不要把它写成已通过，也不要在当前这一小时的 3 次额度里再付费重试。四个 blocked 技能仍不可调用。排队中途取消、第二个 owner、进度超时和墙钟超时还没有生产实测。

2026-11-18 19:29 已允许把这 7 个技能源码公开进仓库。样例 HTML 没有打进发布包。

## 七个技能

| 技能 | 状态 | 原因 |
|---|---|---|
| html-builder | 生产已通过一次 | 任务 `0dc62b1a13754544a15cdc0ad59942bb`，约 29 秒 ready。preview 9632 字节，report 1507 字节。 |
| zdog | 生产已通过一次 | 任务 `11d198a839f74bcc85fa8fa7ed3dfd90`，约 111 秒 ready。preview 32432 字节，report 1471 字节。官方离线 Zdog 1.1.3 已内联，无 CDN。 |
| knowledge-travel | 可调用，生产一次未通过 | 任务 `675f2e0834994547b6092b8de7ef06b2`，约 58 秒 `studio_review_failed`。没有公布产物。原因还不能从现有记录分成缺文件、过短或符号链接。 |
| spdesign | blocked | 缺生图适配，也没有任务所需的 11 张参考图。`missing_image_adapter_and_eleven_reference_images` |
| 3d-game-dev | blocked | 缺 Blender 网关和人工目标图确认。`missing_blender_gateway_and_human_target_approval` |
| creation-engine | blocked | 原技能依赖的 `3dplay` 校验、`catalog.json` 和 `img2threejs` 不在上传包里。`missing_3dplay_rules_catalog_and_img2threejs` |
| grill-me | blocked | 正文只调用缺失的 `grilling`，并且 `disable-model-invocation: true`。带 MIT LICENSE。`missing_grilling_skill_and_model_invocation_disabled` |

首期输入只有 brief 文本。不上传图片，不抓取 URL。

## 页面

阅读器页面打开 `https://124.222.128.61/reader/`。Studio 打开 `https://124.222.128.61/studio/`。填入现有 Reader Token，目前只选 html-builder 或 zdog。blocked 技能会显示原因，提交会被拒绝。knowledge-travel 先不要再提交。完成后下载 `preview.html`。预览 iframe 只有 `sandbox="allow-scripts"`，没有 `allow-same-origin`。Token 不进预览，也不进 localStorage。这个页面不是阅读器，不会改书架。

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
- `studio_review_failed`：审查没有接受 `outputs/preview.html` 或 `outputs/report.md`。`preview_too_small_or_unsafe` 和 `report_too_small_or_unsafe` 只表示文件不是「普通文件、硬链接数为 1、长度在 80 字节到上限之间」。缺文件、符号链接、硬链接、短于 80 字节、或超过上限，都是这一个码。内容检查（是否完整 HTML、knowledge-travel 的 `game-spec`）要等这一关通过才跑。
- html-builder 与 zdog 的真实模型已各通过一次。knowledge-travel 的那一次没有通过。排队中途取消、第二个 owner、超时还没有生产实测。

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
