"""Two Unix users share only the studio directory. The model is mocked; the gateway class is real."""
import hashlib, json, os, stat, subprocess, textwrap
from pathlib import Path
import pytest

ROOT=Path(__file__).resolve().parents[1]
PY=os.environ.get('STUDIO_TEST_PYTHON','/tmp/r4-venv/bin/python')

def sudo(*args, check=True, input=None):
    return subprocess.run(['sudo','-n',*args], check=check, input=input, text=True, capture_output=True)

def test_lifecycle_script_does_not_touch_reader_units():
    script=(ROOT/'deploy'/'studio-lifecycle.sh').read_text()
    assert 'systemctl stop reader' not in script
    assert '/opt/reader/current' not in script
    assert '6010' not in script and '8800' not in script and '3080' not in script
    for name in ('prepare-studio.sh','rollback-studio.sh','studio-lifecycle.sh','validate-studio-caddy.sh','edge-studio.sh'):
        subprocess.run(['bash','-n',str(ROOT/'deploy'/name)], check=True)
    fragment=(ROOT/'deploy'/'caddy-studio.fragment').read_text()
    assert '/api/studio/' in fragment and '/studio/' in fragment and '127.0.0.1:6011' in fragment
    assert 'reverse_proxy 127.0.0.1:6010' not in fragment
    assert '@reader_api' not in fragment

def test_two_users_share_studio_data_not_reader_data():
    if sudo('true', check=False).returncode!=0:
        pytest.fail('sudo is required for the two-user studio permission test')
    group='studio-data-html2'
    api='studio-api-html2'
    worker='studio-worker-html2'
    other='reader-data-html2'
    for name in (group, other):
        if sudo('getent','group',name, check=False).returncode!=0:
            sudo('groupadd','--system',name)
    for user, grp in ((api, group),(worker, group)):
        if sudo('id',user, check=False).returncode!=0:
            sudo('useradd','--system','--no-create-home','--shell','/usr/sbin/nologin','--gid',grp,user)
    base=Path('/tmp/studio-html2-perm')
    sudo('rm','-rf',str(base))
    sudo('mkdir','-p',str(base/'studio'),str(base/'reader'),str(base/'etc'))
    sudo('chown',f'root:{group}',str(base/'studio'))
    sudo('chmod','2770',str(base/'studio'))
    sudo('chown',f'root:{other}',str(base/'reader'))
    sudo('chmod','2770',str(base/'reader'))
    owners=base/'etc'/'owners.json'
    sudo('bash','-c',f'printf %s \'{json.dumps({hashlib.sha256(b"A"*48).hexdigest():"ann"})}\' > {owners}')
    sudo('chown',f'root:{other}',str(owners))
    sudo('chmod','640',str(owners))
    sudo('setfacl','-m',f'u:{api}:r,u:{worker}:r',str(owners))
    mode=oct(os.stat(owners).st_mode & 0o777)
    assert mode=='0o640'
    script=textwrap.dedent(f'''
import os, sqlite3, stat
from pathlib import Path
os.umask(0o007)
root=Path({str(base/'studio')!r})
db=root/'studio.sqlite3'
conn=sqlite3.connect(db)
conn.execute('create table if not exists jobs(id text)')
conn.execute('insert into jobs values (?)', ('job',))
conn.commit(); conn.close()
os.chmod(db, 0o660)
pub=root/'published'
pub.mkdir(mode=0o2770, exist_ok=True)
(pub/'preview.html').write_text('<html>ok</html>')
os.chmod(pub/'preview.html', 0o660)
''')
    sudo('-u',api,PY,'-c',script)
    read=sudo('-u',worker,PY,'-c',f'print(open({str(base/"studio"/"published"/"preview.html")!r}).read())')
    assert 'ok' in read.stdout
    denied=sudo('-u',api,'bash','-c',f'touch {base/"reader"}/nope', check=False)
    assert denied.returncode!=0
    owner_read=sudo('-u',worker,PY,'-c',f'print(open({str(owners)!r}).read()[:1])')
    assert owner_read.returncode==0
    assert stat.S_IMODE(os.stat(owners).st_mode)==0o640

def test_worker_user_gateway_and_sdk_mock_model(sdk_static_cache):
    import shutil, sys
    pytest.importorskip('deepseek_harness')
    if sudo('true', check=False).returncode!=0:
        pytest.fail('sudo is required')
    if not shutil.which('bwrap') or sdk_static_cache is None or not Path(PY).exists():
        pytest.fail('bwrap, the pinned runtime cache, and the test interpreter are required')
    if sudo('id','studio-worker-html2', check=False).returncode!=0:
        pytest.fail('studio-worker-html2 was not created by the permission test')
    os.chmod(ROOT.parent, 0o755)
    subprocess.run(['chmod','-R','a+rX',str(ROOT)], check=True)
    base=Path('/tmp/studio-html2-sdk')
    cache=Path('/tmp/studio-html2-cache')
    sudo('rm','-rf',str(base),str(cache))
    subprocess.run(['cp','-a',str(sdk_static_cache),str(cache)], check=True)
    subprocess.run(['chmod','-R','a+rX',str(cache)], check=True)
    sudo('mkdir','-p',str(base))
    sudo('chown','studio-worker-html2',str(base))
    probe=ROOT/'tests'/'studio_sdk_as_user.py'
    run=subprocess.run(['sudo','-n','-u','studio-worker-html2','env',f'PYTHONPATH={ROOT}',PY,str(probe),str(base),sys.prefix,str(cache),'html-builder'],capture_output=True,text=True,timeout=120)
    detail=(base/'sdk-status.txt').read_text() if (base/'sdk-status.txt').exists() else run.stderr[-2000:]
    assert run.returncode==0, detail
    shown=sudo('cat',str(base/'work'/'agent-result.json'))
    assert 'finish_reason' in shown.stdout
    binding=json.loads(sudo('cat',str(base/'work'/'binding.json')).stdout)
    assert binding['name']=='html-builder' and binding['book_contract'] is False
    assert sudo('cat',str(base/'sock-mode.txt')).stdout.strip()=='0o600'
    denied=sudo('-u','studio-api-html2','test','-x',str(base/'run'), check=False)
    assert denied.returncode!=0
