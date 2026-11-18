# Pinned SDK protocol evidence

2026-11-17 Asia/Shanghai. SDK0.2.2rc2 shipped sdk-minimal profile was launched inside real OS namespaces against a fake model broker (zero external provider traffic). Observed path `/v1/messages`, not `/chat/completions`. Broker maps this ONLY to `https://api.deepseek.com/anthropic/v1/messages`.

Opened public reference this turn: https://api-docs.deepseek.com/api/create-message.md ; model alias reference: https://api-docs.deepseek.com/quick_start/pricing/ . Current model configured `deepseek-flash`; legacy SDK default `deepseek-v4-flash` is deliberately overridden/pinned by broker.

The SDK dataclass exposes profile/patches and approval requests, not a proven filesystem/network sandbox. sdk-minimal documentation says shell/read_image/local execution remain. Therefore permission prompts or profile choice alone are NOT treated as security isolation; mount/PID/network namespaces and a constrained credential broker are mandatory. Native server-side web tools/URL images are rejected at broker too.

R2: retained same endpoint/protocol and tested actual SDK session restoration plus bash tool-generated original fixture inside no-network namespace. Original Python+Node gates run inside namespace and independently outside; no paid/provider traffic. Budget is job-wide 12 requests, <=512000 request bytes each, <=8192 max_tokens each; repair/continuation do not reset it.

R3: native-cache evidence uses pinned binary0.2.2rc2. Reproduced system.node failed-to-map on true noexec; prewarmed system+PTY and configured NARB_NATIVE_CACHE_DIR from loader interface https://unpkg.com/node-addon-native-custom-loader@0.1.3/lib/index.js . Read-only cache + noexec DSH_HOME/TMPDIR passed actual SDK first turn, two resumes/repairs and inflight cancellation. No real key/provider traffic.
