#!/bin/sh
# Stop only the studio units. The stable reader release stays where it is.
set -eu
[ "${1:-}" = --stop-studio ] || { echo 'Usage: rollback-studio.sh --stop-studio'; exit 2; }
[ "$(id -u)" = 0 ] || { echo 'Run by an authorized coordinator as root'; exit 2; }
systemctl stop studio-api.service studio-worker.service || true
systemctl disable studio-api.service studio-worker.service || true
printf '%s\n' 'Studio units stopped. /opt/reader/current, reader units, TTS and Harness were not modified.'
