#!/bin/sh
# Root coordinator only, reader stopped; no config/credentials/model/network access.
set -eu
[ "${1:-}" = --reader-stopped-apply-0660 ] || { echo 'Explicit --reader-stopped-apply-0660 required'; exit 2; }
[ "$(id -u)" = 0 ] || exit 2
for unit in reader-api reader-worker; do
  state=$(systemctl is-active "$unit" || true)
  [ "$state" = inactive ] || [ "$state" = failed ] || { echo 'Stop only reader-api/worker first'; exit 2; }
done
command -v setfacl >/dev/null || { echo 'Install ACL utility before migration'; exit 2; }
python3 - <<'PY'
import grp,os,stat,subprocess
from pathlib import Path
gid=grp.getgrnam('reader-data').gr_gid
jobs=Path('/var/lib/reader/jobs');v=os.statvfs(jobs)
if not os.path.ismount(jobs) or not v.f_flag&os.ST_NOEXEC or v.f_blocks*v.f_frsize>512*1024*1024:raise SystemExit('512MiB mounted noexec jobs volume required')
for p in [Path('/var/lib/reader'),Path('/var/lib/reader/jobs')]:
 st=p.lstat()
 if not stat.S_ISDIR(st.st_mode) or p.is_symlink():raise SystemExit('unsafe reader directory')
 os.chown(p,0,gid);subprocess.run(['setfacl','-b','-k',str(p)],check=True);os.chmod(p,0o2770)
 subprocess.run(['setfacl','-d','-m','u::rwx,g::rwx,m::rwx,o::---',str(p)],check=True)
for suffix in ('','-journal','-wal','-shm'):
 p=Path('/var/lib/reader/queue.sqlite3'+suffix)
 if not p.exists() and not p.is_symlink():continue
 st=p.lstat()
 if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1 or p.is_symlink():raise SystemExit('unsafe SQLite file')
 subprocess.run(['setfacl','-b',str(p)],check=True);os.chown(p,0,gid);os.chmod(p,0o660)
print('Only reader parent directories and exact SQLite/sidecar permissions migrated; no DB contents changed.')
PY
