#!/bin/sh
# Studio only. This script must not stop reader, TTS, or Harness.
set -eu
cmd=${1:-}
SRC=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$SRC"
case "$cmd" in
  prepare) exec "$SRC/deploy/prepare-studio.sh" --prepare-inactive ;;
  start)
    systemctl enable --now studio-api.service studio-worker.service
    ;;
  health)
    curl -fsS http://127.0.0.1:6011/api/studio/health
    printf '\n'
    ;;
  gate)
    python3 - <<'PY'
import json, os
from pathlib import Path
env=Path('/etc/studio/api.env').read_text()
acc=json.loads(Path('/etc/studio/accepted.json').read_text())
assert 'STUDIO_ENABLE_GENERATION=0' in env
assert acc['trusted_manifest_sha256'].startswith('REPLACE_') or acc['trusted_manifest_sha256']
for key in ('source_parity_reviewed','namespace_negative_probes','filesystem_hard_quota','systemd_cgroup_limits','linux_py312_sdk_smoke','https_auth_checked'):
    assert acc[key] is False, key
print('studio generation remains off; six gates are still false')
PY
    ;;
  enable)
    echo 'Refusing to enable generation. Re-sign all six gates for this package trusted hash first. Do not copy the r5 signature.'
    exit 2
    ;;
  rollback) exec "$SRC/deploy/rollback-studio.sh" --stop-studio ;;
  *)
    echo 'Usage: studio-lifecycle.sh prepare|start|health|gate|enable|rollback'
    exit 2
    ;;
esac
