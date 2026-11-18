#!/bin/sh
# Studio only. Does not stop reader-api, reader-worker, TTS, or Harness.
set -eu
export PYTHONDONTWRITEBYTECODE=1
cmd=${1:-}
SRC=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$SRC"
ETC=${STUDIO_ETC:-/etc/studio}
VAR=${STUDIO_VAR:-/var/lib/studio}
case "$cmd" in
  prepare) exec "$SRC/deploy/prepare-studio.sh" --prepare-inactive ;;
  start)
    if [ "${STUDIO_SKIP_SYSTEMCTL:-}" = 1 ]; then
      echo 'STUDIO_SKIP_SYSTEMCTL is set; units were not started'
      exit 0
    fi
    systemctl enable --now studio-jobs.mount
    systemctl enable --now studio-api.service studio-worker.service
    ;;
  health)
    curl -fsS http://127.0.0.1:6011/api/studio/health
    printf '\n'
    ;;
  gate)
    [ "$(id -u)" = 0 ] || { echo 'root required'; exit 2; }
    PY=${STUDIO_PYTHON:-/opt/reader-runtime/bin/python}
    [ -x "$PY" ] || { echo "runtime python missing: $PY"; exit 2; }
    "$PY" "$SRC/tools/studio_gates.py" "$VAR/gate-evidence.json"
    ;;
  enable)
    [ "$(id -u)" = 0 ] || { echo 'root required'; exit 2; }
    PY=${STUDIO_PYTHON:-/opt/reader-runtime/bin/python}
    [ -x "$PY" ] || { echo "runtime python missing: $PY"; exit 2; }
    "$PY" "$SRC/tools/studio_gates.py" "$VAR/gate-evidence.json"
    STUDIO_GROUP=${STUDIO_GROUP:-studio-data} python3 - "$SRC" "$ETC" "$VAR" "${STUDIO_GROUP:-studio-data}" <<'PY'
import grp, hashlib, json, os, sys
from pathlib import Path
src, etc, var=map(Path, sys.argv[1:4])
group=sys.argv[4]
digest=hashlib.sha256((src/'TRUSTED-SHA256.json').read_bytes()).hexdigest()
evidence=json.loads((var/'gate-evidence.json').read_text())
keys=('source_parity_reviewed','namespace_negative_probes','filesystem_hard_quota','systemd_cgroup_limits','linux_py312_sdk_smoke','https_auth_checked')
if evidence.get('trusted_manifest_sha256')!=digest or any(evidence.get(key) is not True for key in keys):
    raise SystemExit('evidence does not match this tree; generation stays off')
accepted={key: True for key in keys}
accepted['trusted_manifest_sha256']=digest
target=etc/'accepted.json'
target.write_text(json.dumps(accepted, indent=2)+'\n')
os.chown(target, 0, grp.getgrnam(group).gr_gid)
os.chmod(target, 0o640)
for name in ('api.env','worker.env'):
    path=etc/name
    lines=[]
    seen=False
    for line in path.read_text().splitlines():
        if line.startswith('STUDIO_ENABLE_GENERATION='):
            lines.append('STUDIO_ENABLE_GENERATION=1')
            seen=True
        else:
            lines.append(line)
    if not seen:
        lines.append('STUDIO_ENABLE_GENERATION=1')
    path.write_text('\n'.join(lines)+'\n')
    os.chmod(path, 0o600)
print('studio generation enabled for', digest)
PY
    if [ "${STUDIO_SKIP_SYSTEMCTL:-}" != 1 ]; then
      systemctl restart studio-api.service studio-worker.service
    fi
    ;;
  disable)
    [ "$(id -u)" = 0 ] || { echo 'root required'; exit 2; }
    python3 - "$ETC" <<'PY'
import json, os, sys
from pathlib import Path
etc=Path(sys.argv[1])
keys=('source_parity_reviewed','namespace_negative_probes','filesystem_hard_quota','systemd_cgroup_limits','linux_py312_sdk_smoke','https_auth_checked')
for name in ('api.env','worker.env'):
    path=etc/name
    lines=['STUDIO_ENABLE_GENERATION=0' if line.startswith('STUDIO_ENABLE_GENERATION=') else line for line in path.read_text().splitlines()]
    path.write_text('\n'.join(lines)+'\n')
    os.chmod(path, 0o600)
acc=etc/'accepted.json'
if acc.exists():
    data=json.loads(acc.read_text())
    for key in keys:
        data[key]=False
    acc.write_text(json.dumps(data, indent=2)+'\n')
print('studio generation disabled and gate flags cleared')
PY
    if [ "${STUDIO_SKIP_SYSTEMCTL:-}" != 1 ]; then
      systemctl restart studio-api.service studio-worker.service
    fi
    ;;
  rollback) exec "$SRC/deploy/rollback-studio.sh" --stop-studio ;;
  *)
    echo 'Usage: studio-lifecycle.sh prepare|start|health|gate|enable|disable|rollback'
    exit 2
    ;;
esac
