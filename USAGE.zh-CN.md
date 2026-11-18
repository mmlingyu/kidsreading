# HTML 技能使用说明

版本目录：`reader-phase1-20261117-r5-html1`。这不是已验收的 r5 标签，也不要替换正在服务的阅读器。下面的域名写成 `https://SERVICE`，部署时改成实际 HTTPS 源。示例里没有 Token。

2026-11-18 19:29 已允许把这 7 个技能源码公开进仓库。样例 HTML 没有打进发布包。

## 七个技能

| 技能 | 状态 | 原因 |
|---|---|---|
| html-builder | 可调用 | 原 `SKILL.md` 已原样放入 `skills/html-skills/html-builder/`。产物是 `preview.html` 和 `report.md`。 |
| zdog | 可调用 | 原技能要求 Zdog 1.1.3。发布包内置官方 npm 1.1.3 的 `zdog.dist.min.js`（SHA256 `2baede641561fa7f00490809a3357ce66a70a47c4c46385b078b8e10027c14f0`），禁止再去 CDN。 |
| knowledge-travel | 可调用 | 原 `SKILL.md`、`examples.md`、`reference.md` 已放入。没有随包提供 huashu 本机参考路径，也不因此联网。 |
| spdesign | blocked | 缺生图适配，也没有任务所需的 11 张参考图。`missing_image_adapter_and_eleven_reference_images` |
| 3d-game-dev | blocked | 缺 Blender 网关和人工目标图确认。`missing_blender_gateway_and_human_target_approval` |
| creation-engine | blocked | 原技能依赖的 `3dplay` 校验、`catalog.json` 和 `img2threejs` 不在上传包里。`missing_3dplay_rules_catalog_and_img2threejs` |
| grill-me | blocked | 正文只调用缺失的 `grilling`，并且 `disable-model-invocation: true`。带 MIT LICENSE。`missing_grilling_skill_and_model_invocation_disabled` |

首期输入只有 brief 文本。不上传图片，不抓取 URL。

## 页面

打开 `https://SERVICE/studio/`。填入现有 Reader Token，选可调用技能，写 brief，提交。blocked 技能会显示原因，提交会被拒绝。完成后下载 `preview.html`。预览 iframe 只有 `sandbox="allow-scripts"`，没有 `allow-same-origin`。Token 不进预览，也不进 localStorage。这个页面不是阅读器，不会改书架。

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
- `studio_review_failed`：页面不是完整 HTML、报告不足 80 字节、有 file://、父页桥、危险扫描，或 zdog 没有内联规定的库。
- 真实模型生成和服务器验收不在本说明的完成范围内。

## 依赖还缺什么

- spdesign：生图适配和 11 张参考图。
- 3d-game-dev：Blender。不要装到现有 4 核 4GB 的阅读器机器上。
- creation-engine：`3dplay` 规则、校验脚本、词表和 `img2threejs`。
- grill-me：`grilling` 技能。
- zdog 官方 npm 包 1.1.3 没有单独的 LICENSE 文件。dist 文件头写的是 MIT，Copyright 2020 Metafizzy。

## 回滚

根用户执行 `deploy/rollback-studio.sh --stop-studio`。只停 studio。阅读器 current、6010、8800、3080 保持不动。
