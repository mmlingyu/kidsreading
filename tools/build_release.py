#!/usr/bin/env python3
"""Rebuild manifests plus deterministic archive, on the box/staging only."""
import ast,gzip,hashlib,json,shutil,stat,tarfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
version=next(ast.literal_eval(n.value) for n in ast.parse((ROOT/'reader_service/__init__.py').read_text()).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='VERSION' for t in n.targets))
if version!=ROOT.name:raise SystemExit('release folder and package VERSION mismatch')
EXCLUDED={'__pycache__','.pytest_cache','.git'}
for p in sorted(ROOT.rglob('*'),key=lambda p:len(p.parts),reverse=True):
    if p.is_dir() and p.name in EXCLUDED: shutil.rmtree(p)
def files():
    return sorted(p for p in ROOT.rglob('*') if p.is_file() and p.name not in {'SHA256MANIFEST.txt','TRUSTED-SHA256.json'})
for p in files():
    if p.is_symlink() or p.name=='.env' or p.suffix in {'.pem','.key'}: raise SystemExit('unsafe release file')
trusted={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files() if p.relative_to(ROOT).parts[0] in {'reader_service','skills'}}
(ROOT/'TRUSTED-SHA256.json').write_text(json.dumps(trusted,indent=2,sort_keys=True)+'\n')
allfiles=files()+[ROOT/'TRUSTED-SHA256.json']
(ROOT/'SHA256MANIFEST.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+str(p.relative_to(ROOT))+'\n' for p in sorted(allfiles)))
allfiles+=[ROOT/'SHA256MANIFEST.txt']
zip_path=ROOT.with_suffix('.zip')
with zipfile.ZipFile(zip_path,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted(allfiles):
        info=zipfile.ZipInfo(ROOT.name+'/'+str(p.relative_to(ROOT)),date_time=(2026,11,17,0,0,0))
        info.external_attr=((stat.S_IFREG| (0o755 if p.suffix=='.sh' else 0o644))<<16)
        info.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(info,p.read_bytes())
print(zip_path,zip_path.stat().st_size,hashlib.sha256(zip_path.read_bytes()).hexdigest())
print('trusted_manifest_sha256',hashlib.sha256((ROOT/'TRUSTED-SHA256.json').read_bytes()).hexdigest())

tar_path=ROOT.parent/(ROOT.name+'.tar.gz')
with tar_path.open('wb') as f, gzip.GzipFile(fileobj=f,mode='wb',mtime=0) as gz,tarfile.open(fileobj=gz,mode='w') as tar:
    for p in sorted(allfiles):
        info=tar.gettarinfo(str(p),arcname=ROOT.name+'/'+str(p.relative_to(ROOT)))
        info.uid=info.gid=0;info.uname=info.gname='root';info.mtime=0
        info.mode=0o755 if p.suffix=='.sh' else 0o644
        with p.open('rb') as source: tar.addfile(info,source)
print(tar_path,tar_path.stat().st_size,hashlib.sha256(tar_path.read_bytes()).hexdigest())
