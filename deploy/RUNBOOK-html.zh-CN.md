# HTML 技能部署（未在服务器执行）

这个包的版本目录名是 `reader-phase1-20261117-r5-html2`。不要使用 html1。不要把它接成 `/opt/reader/current`，也不要重启 reader-api:6010、TTS:8800 或 Harness:3080。服务器验收还没有做。

## 安装

1. 用 `python3 tools/stage_release.py --output /tmp/reader-phase1-20261117-r5-html2.tar.gz` 生成包，核对 SHA256 与 `TRUSTED-SHA256.json`。
2. 解到 `/opt/studio/releases/reader-phase1-20261117-r5-html2`，root 只读。studio 的 `current` 只指向这个目录。
3. `deploy/studio-lifecycle.sh prepare`。它只创建 `/var/lib/studio`（`root:studio-data` `2770`）、`/etc/studio` 和两个 unit。若 owners 文件已在，只加 studio 用户的读 ACL，不改 `640`，也不把他们加入 `reader-data`。
4. `deploy/validate-studio-caddy.sh` 通过后，把 `deploy/caddy-studio.fragment` 加进现有 HTTPS 站点。不要替换 `/api/reader/*`。
5. `deploy/studio-lifecycle.sh start`，然后 `health` 和 `gate`。`gate` 必须仍显示六项 false、生成 0。`enable` 会直接拒绝。
6. worker 启动 `reader_service.gateway`，套接字在 `/var/lib/studio/run`（worker 自己的 `0700`），不放进任务目录。模型密钥只经标准输入进入 gateway。
7. 六项门禁按**这个包的新 trusted hash**由部署者重签后，才可以改生成开关。r5 和 html1 的旧签署都不能沿用。真实模型生成还没有做。

## 回滚

`deploy/rollback-studio.sh --stop-studio`。只停 studio 两个 unit。阅读器、数据库、TTS 和 Harness 不动。

## 构建

不要在含 `MAINTENANCE.zh-CN.md` 或历史 `tts/` 的 Git 根目录直接运行 `tools/build_release.py`。用 `tools/stage_release.py`。
