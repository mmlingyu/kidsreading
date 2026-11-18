#!/bin/sh
# Creates inactive dedicated hard-cap storage. NOT executed by the coding workflow.
# Refuses existing image/mount/nonempty job directory. Never edits fstab or global quota settings.
set -eu
[ "${1:-}" = --prepare-new-empty-512m-jobs-filesystem ] || { echo 'Explicit --prepare-new-empty-512m-jobs-filesystem required'; exit 2; }
[ "$(id -u)" = 0 ] || exit 2
getent group reader-data >/dev/null
for cmd in fallocate mkfs.ext4 mountpoint install; do command -v "$cmd" >/dev/null; done
JOBS=/var/lib/reader/jobs
IMAGE=/var/lib/reader-storage/jobs.ext4
[ -d "$JOBS" ] && [ ! -L "$JOBS" ] || { echo 'Prepared real jobs directory required'; exit 2; }
! mountpoint -q "$JOBS" || { echo 'Already mounted; inspect instead of replacing'; exit 2; }
[ -z "$(ls -A "$JOBS")" ] || { echo 'Jobs directory is not empty; migration needs separate backup/cutover'; exit 2; }
[ ! -e "$IMAGE" ] || { echo 'Existing image will never be overwritten'; exit 2; }
install -d -o root -g root -m 0700 /var/lib/reader-storage
fallocate -l 512M "$IMAGE"
chmod 0600 "$IMAGE"
mkfs.ext4 -q -F -m 0 "$IMAGE"
install -m 0644 "$(dirname "$0")/var-lib-reader-jobs.mount" /etc/systemd/system/var-lib-reader-jobs.mount
printf '%s\n' 'Inactive image/unit prepared. Coordinator must review then daemon-reload, start ONLY var-lib-reader-jobs.mount, chown root:reader-data and chmod2770 the mounted jobs root, verify size/capacity and SDK noexec smoke before acceptance.'
