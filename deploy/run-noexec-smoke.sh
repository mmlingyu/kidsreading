#!/bin/sh
# Coordinator explicit action only. Root prepares fixture; hardened nonroot unit only validates/uses it.
set -eu
[ "${1:-}" = --install-and-run-fake-reader-probe ] || { echo 'Explicit --install-and-run-fake-reader-probe required'; exit 2; }
[ "$(id -u)" = 0 ] || exit 2
state=$(systemctl is-active reader-worker || true)
[ "$state" = inactive ] || [ "$state" = failed ] || { echo 'Stop reader-worker before probe'; exit 2; }
DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ID=$(python3 -c 'import uuid;print(uuid.uuid4().hex)')
BASE=/var/lib/reader/jobs/.r5-$ID
UNIT=reader-noexec-smoke@$ID.service
# Source group/SGID validation and the real mount check must precede fixture creation.
python3 - "$BASE" <<'PY'
import grp,os,stat,sys
from pathlib import Path
base=Path(sys.argv[1]);jobs=base.parent;st=jobs.lstat();v=os.statvfs(jobs)
if jobs.is_symlink() or not os.path.ismount(jobs) or not v.f_flag&os.ST_NOEXEC or v.f_blocks*v.f_frsize>512*1024*1024:raise SystemExit('bounded mounted noexec jobs required')
gid=grp.getgrnam('reader-data').gr_gid
if st.st_uid!=0 or st.st_gid!=gid or stat.S_IMODE(st.st_mode)!=0o2770:raise SystemExit('root-prepared shared jobs root required')
base.mkdir(mode=0o770)
for p in [base,base/'data',base/'data/jobs']:
 if p!=base:p.mkdir(mode=0o770)
 os.chown(p,0,gid);os.chmod(p,0o2770)
(base/'.root-created-reader-probe').write_text(base.name)
os.chmod(base/'.root-created-reader-probe',0o600)
print('Root prepared synthetic fixture:',base)
PY
install -m 0644 "$DIR/reader-noexec-smoke@.service" /etc/systemd/system/reader-noexec-smoke@.service
systemctl daemon-reload
set +e
systemctl start "$UNIT"
RESULT=$?
set -e
systemctl show "$UNIT" -p Result -p ExecMainStatus -p MemoryPeak
journalctl -u "$UNIT" -n 15 --no-pager
# Remove only this root-created synthetic fixture after the unit has exited.
STATE=$(systemctl is-active "$UNIT" || true)
if [ "$STATE" = inactive ] || [ "$STATE" = failed ]; then
 python3 - "$BASE" <<'PY'
import os,re,shutil,sys
from pathlib import Path
p=Path(sys.argv[1]);marker=p/'.root-created-reader-probe'
if p.parent!=Path('/var/lib/reader/jobs') or not re.fullmatch(r'\.r5-[a-f0-9]{32}',p.name) or p.is_symlink() or p.stat().st_uid!=0:raise SystemExit('unsafe probe cleanup')
if marker.is_symlink() or marker.stat().st_uid!=0 or marker.read_text()!=p.name:raise SystemExit('invalid root probe marker')
shutil.rmtree(p)
PY
else
 printf '%s\n' "Probe still active; fixture retained: $BASE"
fi
# Never edits accepted.json, ENABLE, TTS, Harness or mounts.
exit "$RESULT"
