#!/bin/sh
# Exact reader-only release activation or rollback; never touches Harness/TTS/Caddy.
set -eu
[ "${1:-}" = --activate-reader-only ] || { echo 'Usage: switch.sh --activate-reader-only /opt/reader/releases/RELEASE'; exit 2; }
[ "$(id -u)" = 0 ] || exit 2
TARGET=$(realpath "${2:?release directory required}")
case "$TARGET" in /opt/reader/releases/reader-phase1-*) ;; *) echo 'Unapproved target prefix'; exit 2;; esac
cd "$TARGET"; sha256sum --strict -c SHA256MANIFEST.txt
[ -f /etc/reader/owners.json ] && [ -x /opt/reader-runtime/bin/python ] || { echo 'Runtime/auth missing'; exit 2; }
[ "$(stat -c %u "$TARGET")" = 0 ] || { echo 'Release must be root-owned'; exit 2; }
# Refuse rollback into code that cannot read the existing additive schema (r1 used positional INSERT).
/opt/reader-runtime/bin/python - "$TARGET" <<'PYCOMPAT'
import json,sqlite3,sys
from pathlib import Path
target=Path(sys.argv[1]); db=Path('/var/lib/reader/queue.sqlite3')
if db.exists():
    with sqlite3.connect('file:'+str(db)+'?mode=ro',uri=True) as c:
        try:r=c.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone();version=int(r[0]) if r else 1
        except sqlite3.OperationalError:version=1
    descriptor=target/'DB_SCHEMA.json'
    supported=json.loads(descriptor.read_text())['reads'] if descriptor.exists() else [1]
    if version not in supported:raise SystemExit('Refusing incompatible DB rollback; preserve data and use offline explicit restore plan')
PYCOMPAT
# Caller records old target for rollback before executing this explicit action.
systemctl stop reader-worker.service reader-api.service
ln -s "$TARGET" /opt/reader/current.next
mv -Tf /opt/reader/current.next /opt/reader/current
systemctl daemon-reload
systemctl start reader-api.service reader-worker.service
# A gated release intentionally returns health503 until acceptance is complete.
systemctl is-active reader-api.service reader-worker.service
