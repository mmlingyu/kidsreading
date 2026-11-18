#!/bin/sh
# Stop only the studio units and restore the ACL snapshot from this install.
# Does not unmount the jobs volume, does not edit Caddy, and does not stop reader or TTS.
set -eu
[ "${1:-}" = --stop-studio ] || { echo 'Usage: rollback-studio.sh --stop-studio'; exit 2; }
[ "$(id -u)" = 0 ] || { echo 'Run by an authorized coordinator as root'; exit 2; }
SRC=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
ETC=${STUDIO_ETC:-/etc/studio}
if [ "${STUDIO_SKIP_SYSTEMCTL:-}" != 1 ]; then
  systemctl stop studio-api.service studio-worker.service || true
  systemctl disable studio-api.service studio-worker.service || true
fi
if [ -d "$ETC/acl-before" ]; then
  python3 "$SRC/tools/studio_acl.py" restore --snapshot-dir "$ETC/acl-before"
else
  echo 'no ACL snapshot at '"$ETC/acl-before"'; left existing ACLs unchanged' >&2
fi
printf '%s\n' 'Studio units stopped. ACL snapshot restored when one was present. /opt/reader/current, reader units, TTS, Harness and the edge Caddyfile were not modified.'
