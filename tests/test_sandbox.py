import json, os, shutil, subprocess, sys
from pathlib import Path
import pytest
from reader_service import sandbox

def test_real_namespace_denies_host_files_network_and_env(tmp_path,monkeypatch):
    if not shutil.which('bwrap'): pytest.skip('bubblewrap not installed')
    root=tmp_path/'release'; app=root/'reader_service'; app.mkdir(parents=True)
    (root/'skills'/'adventure-reader').mkdir(parents=True)
    runtime=tmp_path/'runtime'; (runtime/'bin').mkdir(parents=True)
    (runtime/'bin'/'python').symlink_to(Path(sys.executable).resolve())
    work=tmp_path/'job'; work.mkdir();(work/'tmp').mkdir()
    (work/'assets').mkdir();(work/'assets/source.txt').write_text('synthetic source')
    (work/'input.json').write_text('{}');(work/'control.json').write_text('{}')
    sentinel=tmp_path/'host-only.txt'; sentinel.write_text('NOT_PRIVATE_TEST_SENTINEL')
    sock=tmp_path/'dummy-socket'; sock.write_text('dummy')
    source='''import os,json,socket
from pathlib import Path
r={}
r['host_file_hidden']=not Path(HOST_FILE).exists()
r['etc_hidden']=not Path('/etc/passwd').exists()
r['host_environment_cleared']='HOST_SENTINEL' not in os.environ
for name in ['/work/assets/source.txt','/work/input.json','/work/control.json']:
 try: Path(name).write_text('tampered');r[name]=False
 except OSError:r[name]=True
try: Path('/app/probe.py').write_text('bad'); r['source_readonly']=False
except OSError: r['source_readonly']=True
try:
 s=socket.socket(); s.settimeout(.2); s.connect(('1.1.1.1',443)); r['network_denied']=False
except OSError: r['network_denied']=True
Path('/work/result.json').write_text(json.dumps(r))
'''.replace('HOST_FILE',repr(str(sentinel)))
    (app/'probe.py').write_text(source)
    monkeypatch.setattr(sandbox,'ROOT',root)
    args=sandbox.command(work,sock,runtime=str(runtime),entry='probe.py')
    result=subprocess.run(args,env={'PATH':'/usr/bin:/bin','HOST_SENTINEL':'FAKE_TEST_VALUE'},capture_output=True,timeout=15)
    assert result.returncode==0,result.stderr.decode()
    assert all(json.loads((work/'result.json').read_text()).values())
    assert sentinel.read_text()=='NOT_PRIVATE_TEST_SENTINEL'

def test_source_hash_tamper_fails_closed(tmp_path,monkeypatch):
    import hashlib
    (tmp_path/'trusted.txt').write_text('fixed')
    (tmp_path/'TRUSTED-SHA256.json').write_text(json.dumps({'trusted.txt':hashlib.sha256(b'fixed').hexdigest()}))
    monkeypatch.setattr(sandbox,'ROOT',tmp_path)
    sandbox.verify_manifest(require_root=False)
    (tmp_path/'trusted.txt').write_text('changed')
    with pytest.raises(RuntimeError): sandbox.verify_manifest(require_root=False)
