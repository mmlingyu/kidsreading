#!/bin/sh
# Install inactive studio units beside the stable reader. Does not stop or edit reader.
set -eu
export PYTHONDONTWRITEBYTECODE=1
[ "${1:-}" = --prepare-inactive ] || { echo 'Usage: prepare-studio.sh --prepare-inactive'; exit 2; }
[ "$(id -u)" = 0 ] || { echo 'Run by an authorized coordinator as root'; exit 2; }
SRC=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$SRC"
GROUP=${STUDIO_GROUP:-studio-data}
API=${STUDIO_API_USER:-studio-api}
WORKER=${STUDIO_WORKER_USER:-studio-worker}
VAR=${STUDIO_VAR:-/var/lib/studio}
ETC=${STUDIO_ETC:-/etc/studio}
OWNERS=${STUDIO_OWNERS:-/etc/reader/owners.json}
CURRENT=${STUDIO_CURRENT:-/opt/studio/current}
RUNTIME=${STUDIO_RUNTIME:-/opt/reader-runtime}
CACHE=${READER_RUNTIME_CACHE:-/opt/reader-runtime-cache-0.2.2rc2}
IMAGE=${STUDIO_JOBS_IMAGE:-/var/lib/studio-storage/jobs.ext4}
JOBS=${STUDIO_JOBS:-$VAR/jobs}
UNIT_DIR=${STUDIO_UNIT_DIR:-/etc/systemd/system}
getent group "$GROUP" >/dev/null || groupadd --system "$GROUP"
id "$API" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin --gid "$GROUP" "$API"
id "$WORKER" >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin --gid "$GROUP" "$WORKER"
command -v setfacl >/dev/null || { echo 'acl package/setfacl required'; exit 2; }
command -v systemd-escape >/dev/null || { echo 'systemd-escape required'; exit 2; }
command -v mount >/dev/null || { echo 'mount required'; exit 2; }
command -v mkfs.ext4 >/dev/null || { echo 'mkfs.ext4 required'; exit 2; }
[ -d "$CURRENT" ] || { echo "unpack the release to $CURRENT before prepare"; exit 1; }
[ -x "$RUNTIME/bin/python" ] || { echo "runtime python missing: $RUNTIME/bin/python"; exit 1; }
[ -d "$CACHE/home" ] || { echo "runtime cache missing: $CACHE/home"; exit 1; }
[ -f "$OWNERS" ] || { echo "reader owners file missing: $OWNERS"; exit 1; }
install -d -o root -g "$GROUP" -m 2770 "$VAR"
install -d -o root -g root -m 0700 "$(dirname "$IMAGE")"
if ! mountpoint -q "$JOBS"; then
  install -d -o root -g root -m 0755 "$JOBS"
  if [ -n "$(ls -A "$JOBS")" ]; then
    echo "jobs directory is not an empty mount point: $JOBS" >&2
    exit 1
  fi
  if [ ! -e "$IMAGE" ]; then
    fallocate -l 128M "$IMAGE"
    chmod 0600 "$IMAGE"
    mkfs.ext4 -q -F -m 0 "$IMAGE"
  fi
  mount -o loop,nodev,nosuid,noexec "$IMAGE" "$JOBS"
fi
chown root:"$GROUP" "$JOBS"
chmod 2770 "$JOBS"
python3 - "$JOBS" <<'PY'
import os, sys
path=sys.argv[1]
info=os.statvfs(path)
if not os.path.ismount(path) or not info.f_flag & os.ST_NOEXEC or not info.f_flag & os.ST_NOSUID:
    raise SystemExit('jobs mount is not nosuid,noexec')
if info.f_blocks*info.f_frsize>128*1024*1024:
    raise SystemExit('jobs filesystem is larger than 128MiB')
PY
install -d -o root -g "$GROUP" -m 0750 "$ETC"
python3 "$SRC/tools/studio_acl.py" apply --reader-dir "$(dirname "$OWNERS")" --owners "$OWNERS" --snapshot-dir "$ETC/acl-before" --users "$API,$WORKER"
python3 "$SRC/tools/studio_acl.py" grant-tree --user "$API" --root "$CURRENT" --snapshot-dir "$ETC/acl-before"
python3 "$SRC/tools/studio_acl.py" grant-tree --user "$WORKER" --root "$CURRENT" --snapshot-dir "$ETC/acl-before"
python3 "$SRC/tools/studio_acl.py" grant-tree --user "$API" --root "$RUNTIME" --snapshot-dir "$ETC/acl-before"
python3 "$SRC/tools/studio_acl.py" grant-tree --user "$WORKER" --root "$RUNTIME" --snapshot-dir "$ETC/acl-before"
python3 "$SRC/tools/studio_acl.py" grant-tree --user "$WORKER" --root "$CACHE" --snapshot-dir "$ETC/acl-before"
[ -e "$ETC/api.env" ] || install -m 0600 deploy/studio-api.env.example "$ETC/api.env"
[ -e "$ETC/worker.env" ] || install -m 0600 deploy/studio-worker.env.example "$ETC/worker.env"
[ -e "$ETC/accepted.json" ] || install -m 0644 deploy/studio-accepted.json.example "$ETC/accepted.json"
chown root:root "$ETC/api.env" "$ETC/worker.env"
chmod 0600 "$ETC/api.env" "$ETC/worker.env"
python3 - "$ETC/api.env" "$ETC/worker.env" "$VAR" "$OWNERS" "$ETC/accepted.json" "$CACHE" <<'PY'
import sys
from pathlib import Path
api, worker, var, owners, accepted, cache=sys.argv[1:]
def rewrite(path, mapping):
    lines=[]
    seen=set()
    for line in Path(path).read_text().splitlines():
        key=line.split('=',1)[0]
        if key in mapping:
            lines.append(key+'='+mapping[key])
            seen.add(key)
        else:
            lines.append(line)
    for key, value in mapping.items():
        if key not in seen:
            lines.append(key+'='+value)
    Path(path).write_text('\n'.join(lines)+'\n')
shared={'STUDIO_DATA':var,'STUDIO_AUTH_FILE':owners,'STUDIO_ACCEPTED_FILE':accepted}
rewrite(api, shared)
rewrite(worker, {**shared,'READER_RUNTIME_CACHE':cache})
PY
MOUNT_UNIT=$(python3 - "$SRC" "$UNIT_DIR" "$API" "$WORKER" "$GROUP" "$CURRENT" "$RUNTIME" "$ETC" "$VAR" "$JOBS" "$CACHE" "$IMAGE" <<'PY'
import subprocess, sys
from pathlib import Path
src, unit_dir, api, worker, group, current, runtime, etc, var, jobs, cache, image=sys.argv[1:]
unit=Path(unit_dir)
unit.mkdir(parents=True, exist_ok=True)
def put(name, text):
    path=unit/name
    path.write_text(text)
    path.chmod(0o644)
    return path
mount_name=subprocess.check_output(['systemd-escape','-p','--suffix=mount', jobs], text=True).strip()
def retarget(text):
    text=text.replace('var-lib-studio-jobs.mount', '\0')
    text=text.replace('studio-jobs.mount', mount_name)
    return text.replace('\0', mount_name)
api_text=retarget((Path(src)/'deploy'/'studio-api.service').read_text())
api_text=api_text.replace('User=studio-api','User='+api).replace('Group=studio-data','Group='+group)
api_text=api_text.replace('WorkingDirectory=/opt/studio/current','WorkingDirectory='+current)
api_text=api_text.replace('EnvironmentFile=/etc/studio/api.env','EnvironmentFile='+etc+'/api.env')
api_text=api_text.replace('ExecStart=/opt/reader-runtime/bin/python','ExecStart='+runtime+'/bin/python')
api_text=api_text.replace('ReadWritePaths=/var/lib/studio /var/lib/studio/jobs','ReadWritePaths='+var+' '+jobs)
put('studio-api.service', api_text)
worker_text=retarget((Path(src)/'deploy'/'studio-worker.service').read_text())
worker_text=worker_text.replace('User=studio-worker','User='+worker).replace('Group=studio-data','Group='+group)
worker_text=worker_text.replace('WorkingDirectory=/opt/studio/current','WorkingDirectory='+current)
worker_text=worker_text.replace('EnvironmentFile=/etc/studio/worker.env','EnvironmentFile='+etc+'/worker.env')
worker_text=worker_text.replace('ExecStart=/opt/reader-runtime/bin/python','ExecStart='+runtime+'/bin/python')
worker_text=worker_text.replace('Environment=READER_RUNTIME_CACHE=/opt/reader-runtime-cache-0.2.2rc2','Environment=READER_RUNTIME_CACHE='+cache)
worker_text=worker_text.replace('ReadWritePaths=/var/lib/studio /var/lib/studio/jobs','ReadWritePaths='+var+' '+jobs)
worker_text=worker_text.replace('ReadOnlyPaths=/opt/reader-runtime-cache-0.2.2rc2','ReadOnlyPaths='+cache)
put('studio-worker.service', worker_text)
mount=retarget((Path(src)/'deploy'/'var-lib-studio-jobs.mount').read_text())
mount=mount.replace('What=/var/lib/studio-storage/jobs.ext4','What='+image)
mount=mount.replace('Where=/var/lib/studio/jobs','Where='+jobs)
put(mount_name, mount)
stale=unit/'studio-jobs.mount'
if stale.exists() and stale.name!=mount_name:
    stale.unlink()
print(mount_name)
PY
)
if [ -f "$UNIT_DIR/studio-jobs.mount" ]; then
  if [ "${STUDIO_SKIP_SYSTEMCTL:-}" != 1 ]; then
    systemctl disable studio-jobs.mount || true
  fi
  rm -f "$UNIT_DIR/studio-jobs.mount"
fi
if [ "${STUDIO_SKIP_SYSTEMCTL:-}" != 1 ]; then
  systemctl daemon-reload
  systemctl enable "$MOUNT_UNIT"
fi
printf '%s\n' "Studio units installed inactive. Jobs volume $JOBS is nosuid,noexec and at most 128MiB. Reader current, TTS and Harness were not changed. Generation stays 0 until this tree's trusted hash passes tools/studio_gates.py."
