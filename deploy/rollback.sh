#!/bin/sh
# Previous reader release path required. No automatic data/schema downgrade.
set -eu
[ "${1:-}" = --rollback-reader-only ] || { echo 'Usage: rollback.sh --rollback-reader-only PREVIOUS_RELEASE'; exit 2; }
exec "$(dirname "$0")/switch.sh" --activate-reader-only "${2:?previous reader release required}"
