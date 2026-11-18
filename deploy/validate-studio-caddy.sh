#!/bin/sh
# Validate the studio fragment without reading or writing the live Caddy config.
set -eu
SRC=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
command -v caddy >/dev/null || { echo 'caddy is not installed; fragment was not validated'; exit 2; }
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
cat > "$dir/Caddyfile" <<EOF
{
	admin off
	auto_https off
}
http://127.0.0.1:19998 {
	import $SRC/deploy/caddy-studio.fragment
}
EOF
caddy validate --config "$dir/Caddyfile" --adapter caddyfile
printf '%s\n' 'studio caddy fragment validated'
