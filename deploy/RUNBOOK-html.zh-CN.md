# HTML 技能部署（未在服务器执行）

这个包的版本目录名是 `reader-phase1-20261117-r5-html1`。不要把它接成 `/opt/reader/current`，也不要重启 reader-api:6010、TTS:8800 或 Harness:3080。

## 安装

1. 用 `python3 tools/stage_release.py --output /tmp/reader-phase1-20261117-r5-html1.tar.gz` 生成包，核对 SHA256 与 `TRUSTED-SHA256.json`。
2. 解到 `/opt/studio/releases/reader-phase1-20261117-r5-html1`，root 只读。`current` 软链只指向这个 studio 目录。
3. `deploy/prepare-studio.sh --prepare-inactive`。它只创建 `/var/lib/studio`、`/etc/studio` 和 `studio-api` / `studio-worker`。
4. `STUDIO_ENABLE_GENERATION` 保持 0。`deploy/studio-accepted.json.example` 六项都是 false。
5. 可以只读复用现有 `/etc/reader/owners.json`（`STUDIO_AUTH_FILE`）。这沿用 Reader Token 的哈希，不新造 token，也不把 TTS 或模型密钥给浏览器。模型密钥只放在 `/etc/studio/worker.env`。
6. `STUDIO_CORS_ORIGINS` 必须是浏览器页面的精确 HTTPS 源。源站证书目前是 IP 证书时，填 `https://124.222.128.61`。不要编一个新域名。
7. 反代只增加 `127.0.0.1:6011` 的 `/api/studio/*` 和 `/studio/`。不要改 `/api/reader/*`。
8. 六项门禁按**这个包的新 trusted hash**重新核验后，才可以把对应项改成 true 并把生成开关改成 1。r5 的旧签署不能沿用。真实模型生成由部署流另做，本仓库没有声称已经跑通。

## 回滚

`deploy/rollback-studio.sh --stop-studio`。只停 studio 两个 unit。阅读器、数据库、TTS 和 Harness 不动。

## 构建

不要在含 `MAINTENANCE.zh-CN.md` 或历史 `tts/` 的 Git 根目录直接运行 `tools/build_release.py`。用 `tools/stage_release.py`。
