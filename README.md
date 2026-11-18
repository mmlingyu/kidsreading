# kidsreading · HTML 技能分支

这个分支从已验收 r5 提交 `3d5578003a4a3fefc48f8b711d9c690bbdec4769` 分出。不要改 `R5`、`main` 或稳定标签。使用说明在 `USAGE.zh-CN.md`。发布目录名是 `reader-phase1-20261117-r5-html2`，不要拿去替换 `/opt/reader/current`。

# kidsreading · R5（未验收）

`R5` 从已验收提交 `580a0fa8e49aca1f3e24c3a26a4c31f9a390bdf0` 分出，接入腾讯云 Piper/Phonon。标签 `reader-phase1-20261117-r4` 仍指向该提交。本分支不合并，验收前不打 r5 稳定标签。

- 要改的前端只在 `frontend/app/`，overlay 与它保持同一 r5 cache-buster。
- 产品说明见 `README.zh-CN.md`、`R5-CHANGES.zh-CN.md`、`deploy/RUNBOOK-r5.zh-CN.md`。
- 可部署包：

```bash
python3 tools/stage_release.py --output /tmp/reader-phase1-20261117-r5.tar.gz
```

不要在本 Git 根目录直接运行 `tools/build_release.py`。本文件、`MAINTENANCE.zh-CN.md`、`docs/` 和历史 `tts/`、`speech.js`、`phonon-sw.js` 不属于发布包。

最小凭据是 `/etc/reader/tts-client.env`（root:root 0600，只有 `TTS_API_TOKEN`），只由 reader-api 加载。示例门禁仍是六项 false，生成开关为 0。服务器必须按新的 `TRUSTED-SHA256.json` 重验，不能沿用 r4。
