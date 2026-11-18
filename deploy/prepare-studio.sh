#!/bin/sh
# Install inactive studio units beside the stable reader. Does not stop or edit reader.
set -eu
[ "${1:-}" = --prepare-inactive ] || { echo 'Usage: prepare-studio.sh --prepare-inactive'; exit 2; }
[ "$(id -u)" = 0 ] || { echo 'Run by an authorized coordinator as root'; exit 2; }
SRC=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$SRC"
getent group studio-data >/dev/null || groupadd --system studio-data
id studio-api >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin --gid studio-data studio-api
id studio-worker >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin --gid studio-data studio-worker
command -v setfacl >/dev/null || { echo 'acl package/setfacl required'; exit 2; }
install -d -o root -g studio-data -m 2770 /var/lib/studio
# Read the existing owner-hash file only. Do not chmod it and do not join reader-data:
# that group can write /var/lib/reader because the reader data directory is 2770.
if [ -f /etc/reader/owners.json ]; then
  setfacl -m u:studio-api:r,u:studio-worker:r /etc/reader/owners.json
fi
install -d -o root -g studio-data -m 0750 /etc/studio
[ -e /etc/studio/api.env ] || install -m 0600 deploy/studio-api.env.example /etc/studio/api.env
[ -e /etc/studio/worker.env ] || install -m 0600 deploy/studio-worker.env.example /etc/studio/worker.env
[ -e /etc/studio/accepted.json ] || install -m 0644 deploy/studio-accepted.json.example /etc/studio/accepted.json
install -m 0644 deploy/studio-api.service /etc/systemd/system/studio-api.service
install -m 0644 deploy/studio-worker.service /etc/systemd/system/studio-worker.service
printf '%s\n' 'Studio units installed inactive. Reader current, TTS 8800 and Harness 3080 were not changed. Generation stays 0 until the new trusted hash is re-checked.'
