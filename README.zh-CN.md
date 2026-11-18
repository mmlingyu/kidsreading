# Reader Phase1 reader-phase1-20261117-r5

r4基线上的腾讯云Piper/Phonon语音接入，box代码与离线回归交付，不是上线/真实试听证明。

- 新Reader鉴权同源TTS代理，固定127.0.0.1:8800；动态脱敏音色/授权标识、串行WAV、取消、超时、并发/限流/大小边界。
- Token仅浏览器内存；独立TTS_API_TOKEN只给reader-api，不给模型worker/sandbox。旧TTS服务/鉴权完全不变。
- 无Pocket启用/安装、无静默云端失败降级；保留明确browser备用、阅读进度与本地书稿入库。
- 原生成隔离/原技能QA/预算/SDK锁保留，VERSION与frontend/overlay cache-buster同步r5；包内门禁示例仍六false/ENABLE0，部署必须按新hash重新验证。

详见`R5-CHANGES.zh-CN.md`、`deploy/RUNBOOK-r5.zh-CN.md`、`API.zh-CN.md`、`evidence/`。历史r3/r4手册仅作历史证据，不应代替r5步骤。本包尚未验收。现场音色计数和 default/Zoey 试听不能写成全部音色已测。

发布包：

```bash
python3 tools/stage_release.py --output /tmp/reader-phase1-20261117-r5.tar.gz
```

不要在含维护说明或历史 `tts/` 的 Git 根目录直接运行 `tools/build_release.py`。服务器须按新 `TRUSTED-SHA256.json` 重验六项门禁和 `READER_ENABLE_GENERATION`，示例仍为六项 false、生成 0，不能沿用 r4 签署。最小凭据是 root:root 0600 的 `/etc/reader/tts-client.env`，只含 `TTS_API_TOKEN`，只由 reader-api 加载。回滚步骤在 `deploy/RUNBOOK-r5.zh-CN.md`。
