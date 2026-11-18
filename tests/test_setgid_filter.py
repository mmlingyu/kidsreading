import os,subprocess,sys
from pathlib import Path

def test_kernel_filter_reproduces_original_mkdir_chmod_failure_and_fixed_store(tmp_path):
    script=r"""
import errno,hashlib,json,os,stat,sys
from pathlib import Path
from tools.restrict_suid_sgid import install
from reader_service.core import Settings,Store
root=Path(sys.argv[1]);proof=install()
for action in (lambda:os.mkdir(root/'old',0o2770),lambda:os.chmod(root,0o2770)):
 try:action();raise AssertionError('setgid request escaped actual filter')
 except OSError as e:assert e.errno==errno.EPERM
store=Store(Settings(root/'data',{hashlib.sha256(b'A'*48).hexdigest():'a'}))
store.heartbeat();assert stat.S_IMODE(store.dbpath.stat().st_mode)==0o660
assert stat.S_IMODE(store.root.stat().st_mode)==0o770
try:Store(Settings(root/'not-root-prepared',{hashlib.sha256(b'A'*48).hexdigest():'a'},require_shared_roots=True));raise AssertionError('production root auto-created')
except RuntimeError as e:assert 'root_precreated' in str(e)
print(json.dumps(proof))
"""
    r=subprocess.run([sys.executable,'-c',script,str(tmp_path)],env={'PATH':'/usr/bin:/bin'},capture_output=True,text=True,timeout=20)
    assert r.returncode==0,r.stderr
    assert 'kernel_seccomp_loaded' in r.stdout


def test_production_settings_do_not_auto_provision_shared_roots(tmp_path,monkeypatch):
    import grp,hashlib,json,pytest
    from reader_service.core import Settings,Store
    auth=tmp_path/'synthetic-owners.json';auth.write_text(json.dumps({hashlib.sha256(b'A'*48).hexdigest():'a'}));auth.chmod(0o640)
    monkeypatch.setenv('READER_AUTH_FILE',str(auth));monkeypatch.setenv('READER_DATA',str(tmp_path/'not-prepared'))
    monkeypatch.setenv('READER_DATA_GROUP',grp.getgrgid(os.getegid()).gr_name)
    settings=Settings.load();assert settings.require_shared_roots
    with pytest.raises(RuntimeError,match='root_precreated'):Store(settings)
    assert not settings.data.exists()
