Phase 1 staging artifact (not deployed).
Source: copy of uncommitted worktree files from D:\aispace\html-share (original worktree not modified).
Does not include .env, .git, data/, outputs/, other skills, or full main.py.

Expected Phase 1 patches (not applied in this package):
- Slim ASGI entry (reader routes + health only); do not expose full IdeaLab/main.py surface.
- Skill whitelist: adventure-reader only; REA_MCP=0.
- public_job: map blocked to failed; add cancel + client timeout.
- Auth per user; do not reuse readerlocal for multi-tenant.
- CORS configurable; WorkBuddy READER_API becomes configurable or same-origin.
- SSRF controls for URL import and agent egress.
- Bind 127.0.0.1:6010; future public routes must not use /api/tts /api/voices /api/health.
- library.py and port_games.py are import couplings of current studio/harness_runtime/task_specs/quality_review; do not enable /api/port or other modules.

Hashes: SHA256MANIFEST.txt