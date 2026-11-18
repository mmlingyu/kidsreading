#!/usr/bin/env python3
"""Run only on deployment host as root. Prints paths, NEVER the generated token."""
import hashlib,json,os,re,secrets,sys
from pathlib import Path
if os.geteuid()!=0: raise SystemExit('root required')
owner=sys.argv[1] if len(sys.argv)==2 else ''
if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}',owner): raise SystemExit('Usage: generate-owner.py OWNER')
base=Path('/etc/reader'); target=base/('client-token-'+owner)
if target.exists(): raise SystemExit('Token exists; rotation requires explicit operator procedure')
os.umask(0o077)
token=secrets.token_urlsafe(48)
auth=base/'owners.json'; owners=json.loads(auth.read_text()) if auth.exists() else {}
if owner in owners.values(): raise SystemExit('Owner already configured')
owners[hashlib.sha256(token.encode()).hexdigest()]=owner
fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f:f.write(token+'\n')
tmp=base/'owners.json.next'; tmp.write_text(json.dumps(owners)+'\n')
import grp
os.chown(tmp,0,grp.getgrnam('reader-data').gr_gid); os.chmod(tmp,0o640); os.replace(tmp,auth)
print('Created restricted token file and hash map:',str(target),str(auth))
