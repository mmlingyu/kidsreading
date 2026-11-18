#!/bin/sh
# Explicit LOCAL HOST preparation by coordinator only; no SSH/network/model calls.
# Installs inactive units and files; does not switch current, restart or alter Caddy.
set -eu
[ "${1:-}" = --prepare-inactive ] || { echo 'Usage: prepare.sh --prepare-inactive'; exit 2; }
[ "$(id -u)" = 0 ] || { echo 'Run by authorized coordinator as root'; exit 2; }
if systemctl is-active --quiet reader-worker; then echo 'Stop only reader-worker before inactive preparation'; exit 2; fi
SRC=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$SRC"
sha256sum --strict -c SHA256MANIFEST.txt
getent group reader-data >/dev/null || groupadd --system reader-data
id reader-api >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin --gid reader-data reader-api
id reader-worker >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin --gid reader-data reader-worker
install -d -o root -g reader-data -m 2770 /var/lib/reader /var/lib/reader/jobs
# Run only with reader-worker stopped when applying an upgrade.
command -v setfacl >/dev/null || { echo 'acl package/setfacl required'; exit 2; }
[ ! -L /var/lib/reader/run ] || { echo 'Unsafe run directory'; exit 2; }
install -d -o reader-worker -g reader-data -m 0700 /var/lib/reader/run
setfacl -b -k /var/lib/reader/run
chmod 0700 /var/lib/reader/run
install -d -o root -g reader-data -m 0750 /etc/reader
# Existing operator configuration is NEVER overwritten.
[ -e /etc/reader/api.env ] || install -m 0600 deploy/api.env.example /etc/reader/api.env
[ -e /etc/reader/worker.env ] || install -m 0600 deploy/worker.env.example /etc/reader/worker.env
install -m 0644 deploy/reader-api.service /etc/systemd/system/reader-api.service
install -m 0644 deploy/reader-worker.service /etc/systemd/system/reader-worker.service
printf '%s\n' 'Prepared inactive units only. Coordinator must prepare dedicated jobs filesystem/public runtime/TLS/auth/acceptance; original source parity evidence is included; no service was started.'
