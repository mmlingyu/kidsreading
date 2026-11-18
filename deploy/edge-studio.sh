#!/bin/sh
# Merge only the studio prefix into the live local-tts-edge Caddyfile.
# Reloads that unit. Does not restart it and does not touch the TTS process.
set -eu
action=${1:-}
SRC=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
CADDYFILE=${EDGE_CADDYFILE:-/etc/local-tts-edge/Caddyfile}
UNIT=${EDGE_UNIT:-local-tts-edge.service}
FRAGMENT_DEST=${EDGE_FRAGMENT:-/etc/local-tts-edge/caddy-studio.fragment}
BACKUP_ROOT=${EDGE_BACKUP_ROOT:-/root/backups}
[ "$(id -u)" = 0 ] || { echo 'root required'; exit 2; }
command -v caddy >/dev/null || { echo 'caddy binary required to validate the live file'; exit 2; }
case "$action" in
  install)
    [ -f "$CADDYFILE" ] || { echo 'live Caddyfile missing'; exit 2; }
    stamp=$(date -u +%Y%m%d-%H%M%S)
    backup="$BACKUP_ROOT/studio-edge-$stamp"
    mkdir -p "$backup"
    cp -a "$CADDYFILE" "$backup/Caddyfile"
    cp -a "${EDGE_FRAGMENT_SRC:-$SRC/deploy/caddy-studio.fragment}" "$FRAGMENT_DEST"
    python3 "$SRC/tools/studio_edge.py" insert "$CADDYFILE" "$FRAGMENT_DEST"
    if ! caddy validate --config "$CADDYFILE" --adapter caddyfile; then
      cp -a "$backup/Caddyfile" "$CADDYFILE"
      rm -f "$FRAGMENT_DEST"
      echo 'validate failed; live file restored; edge not reloaded'
      exit 1
    fi
    if [ "${EDGE_SKIP_RELOAD:-}" != 1 ]; then
      systemctl reload "$UNIT"
      if ! curl -fsS --max-time 5 http://127.0.0.1:6010/api/reader/health >/dev/null; then
        cp -a "$backup/Caddyfile" "$CADDYFILE"
        rm -f "$FRAGMENT_DEST"
        systemctl reload "$UNIT" || true
        echo 'reader health failed after reload; edge config restored'
        exit 1
      fi
    fi
    printf '%s\n' "studio prefix merged and validated; backup $backup"
    ;;
  restore)
    backup=${2:-}
    [ -n "$backup" ] && [ -f "$backup/Caddyfile" ] || { echo 'Usage: edge-studio.sh restore BACKUP_DIR'; exit 2; }
    cp -a "$backup/Caddyfile" "$CADDYFILE"
    rm -f "$FRAGMENT_DEST"
    caddy validate --config "$CADDYFILE" --adapter caddyfile
    [ "${EDGE_SKIP_RELOAD:-}" = 1 ] || systemctl reload "$UNIT"
    printf '%s\n' 'studio prefix removed from the edge config'
    ;;
  *)
    echo 'Usage: edge-studio.sh install|restore BACKUP_DIR'
    exit 2
    ;;
esac
