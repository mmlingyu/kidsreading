"""Job directories must not request setgid. RestrictSUIDSGID stays on."""
import json, os, sqlite3, stat, subprocess, textwrap
from pathlib import Path
import pytest
from reader_service.studio_store import StudioSettings, StudioStore, plain_dir
from reader_service.studio_worker import StudioWorker

ROOT=Path(__file__).resolve().parents[1]
PY=os.environ.get('STUDIO_TEST_PYTHON','/tmp/r4-venv/bin/python')

def sudo(*args, check=True, input=None):
    return subprocess.run(['sudo','-n',*args], check=check, input=input, text=True, capture_output=True)

def test_filtered_mkdir_inherits_parent_setgid_and_publish_stays_shared(tmp_path):
    script=textwrap.dedent('''
    import os, stat, sys
    from pathlib import Path
    sys.path.insert(0, sys.argv[1])
    os.umask(0o007)
    from tools.restrict_suid_sgid import install
    parent=Path(sys.argv[2])
    os.chmod(parent, 0o2770)
    install()
    from reader_service.studio_store import plain_dir
    child=parent/'job'
    plain_dir(child)
    mode=stat.S_IMODE(child.stat().st_mode)
    if mode & stat.S_ISGID==0 or (mode & 0o777)!=0o770:
        raise SystemExit('inherited mode '+oct(mode))
    try:
        plain_dir(parent/'no', 0o2770)
        raise SystemExit('helper accepted an explicit setgid mode')
    except RuntimeError:
        pass
    fd=os.open(child/'preview.html', os.O_CREAT|os.O_EXCL|os.O_WRONLY, 0o660)
    os.write(fd, b'ok'); os.close(fd)
    print('shared-file')
    ''')
    parent=tmp_path/'shared'
    parent.mkdir()
    os.chmod(parent, 0o2770)
    run=subprocess.run([PY,'-c',script,str(ROOT),str(parent)], capture_output=True, text=True)
    assert run.returncode==0, run.stderr
    assert 'shared-file' in run.stdout
    assert stat.S_IMODE((parent/'job').stat().st_mode) & stat.S_ISGID

def test_two_users_share_a_filtered_publish(tmp_path):
    if sudo('true', check=False).returncode!=0:
        pytest.fail('sudo is required')
    group, api, worker='studio-data-html7','studio-api-html7','studio-worker-html7'
    if sudo('getent','group',group, check=False).returncode!=0:
        sudo('groupadd','--system',group)
    for user in (api, worker):
        if sudo('id',user, check=False).returncode!=0:
            sudo('useradd','--system','--gid',group,'--no-create-home','--shell','/usr/sbin/nologin',user)
    base=Path('/tmp/studio-html7-share')
    sudo('rm','-rf',str(base))
    sudo('mkdir','-p',str(base))
    sudo('chown',f'root:{group}',str(base))
    sudo('chmod','2770',str(base))
    sudo('chmod','755',str(ROOT))
    code=textwrap.dedent(f'''
    import os, sys
    from pathlib import Path
    sys.path.insert(0, {str(ROOT)!r})
    os.umask(0o007)
    from tools.restrict_suid_sgid import install
    install()
    from reader_service.studio_store import plain_dir
    root=Path({str(base)!r})
    job=root/'job'; plain_dir(job); plain_dir(job/'published')
    fd=os.open(job/'published'/'preview.html', os.O_CREAT|os.O_EXCL|os.O_WRONLY, 0o660)
    os.write(fd, b'preview-ok'); os.close(fd)
    ''')
    made=sudo('-u',worker,PY,'-c',code)
    assert made.returncode==0, made.stderr
    read=sudo('-u',api,PY,'-c',f'print(open({str(base/"job"/"published"/"preview.html")!r}).read())')
    assert read.returncode==0 and 'preview-ok' in read.stdout

def test_cancel_is_not_blocked_by_the_running_slot(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    from reader_service.studio_api import create_app
    monkeypatch.setenv('STUDIO_ENABLE_GENERATION','1')
    monkeypatch.setattr('reader_service.studio_worker.accepted', lambda path=None: True)
    app=create_app(StudioSettings(tmp_path/'studio', {__import__('hashlib').sha256(b'A'*48).hexdigest():'ann'}, origins=('https://studio.example',)))
    headers={'Authorization':'Bearer '+('A'*48)}
    with TestClient(app) as client:
        first=client.post('/api/studio/jobs', json={'skill':'html-builder','brief':'占着并发'}, headers=headers)
        assert first.status_code==202
        blocked=client.post('/api/studio/jobs', json={'skill':'zdog','brief':'第二个'}, headers=headers)
        assert blocked.status_code==429
        cancelled=client.post('/api/studio/jobs/'+first.json()['id']+'/cancel', headers=headers)
        assert cancelled.status_code==202 and cancelled.json()['status']=='cancelled'
        second=client.post('/api/studio/jobs', json={'skill':'knowledge-travel','brief':'取消后可以创建'}, headers=headers)
        assert second.status_code==202

def test_orphan_recovery_is_idempotent_and_refuses_reader(tmp_path):
    from tools.studio_recover import recover
    store=StudioStore(StudioSettings(tmp_path/'studio', {'a':'ann'}))
    row=store.create('ann', {'skill':'html-builder','brief':'遗留任务'})
    store.claim()
    ids=recover(store.dbpath)
    assert ids==[row['id']]
    assert store.get('ann', row['id'])['status']=='failed'
    assert store.get('ann', row['id'])['error']=='studio_orphan_recovered'
    assert recover(store.dbpath)==[]
    with pytest.raises(SystemExit):
        recover(Path('/var/lib/reader/queue.sqlite3'))

def test_worker_survives_an_injected_failure_and_the_next_job(tmp_path, monkeypatch):
    monkeypatch.setenv('STUDIO_ENABLE_GENERATION','1')
    monkeypatch.setattr('reader_service.studio_worker.accepted', lambda path=None: True)
    store=StudioStore(StudioSettings(tmp_path/'studio', {'a':'ann'}))
    os.chmod(store.root, 0o2770)
    plain_dir(store.root/'jobs')
    os.chmod(store.root/'jobs', 0o2770)
    row=store.create('ann', {'skill':'html-builder','brief':'注入失败'})
    store.claim()
    class Boom(StudioWorker):
        def start_agent(self, work, prompt, sock=None):
            raise RuntimeError('secret stack DEEPSEEK_API_KEY=should-not-leak')
    worker=Boom(store, model_key='x')
    worker.run_one(row)
    failed=store.get('ann', row['id'])
    assert failed['status']=='failed' and failed['error']=='studio_worker_failed'
    assert 'DEEPSEEK' not in failed['error'] and 'secret' not in failed['error']
    nxt=store.create('ann', {'skill':'html-builder','brief':'进程还活着'})
    assert nxt['status']=='queued'
