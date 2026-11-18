"""Production-layout deploy loop. systemd is not PID 1 here, so unit ExecStart is run directly."""
import hashlib, json, os, shutil, stat, subprocess, textwrap, time
from pathlib import Path
import pytest

ROOT=Path(__file__).resolve().parents[1]
PY=os.environ.get('STUDIO_TEST_PYTHON','/tmp/r4-venv/bin/python')
SENTINEL='SENTINEL-NOT-A-REAL-KEY'

def sudo(*args, check=True, input=None, env=None):
    command=['sudo','-n']
    if env:
        command+=['env',*[f'{key}={value}' for key, value in env.items()]]
    command+=list(args)
    return subprocess.run(command, check=check, input=input, text=True, capture_output=True)

def user_ok(user, flag, path):
    return sudo('runuser','-u',user,'--','test',flag,str(path), check=False).returncode==0

def root_text(path):
    return sudo('cat', str(path)).stdout

def write_root(path, text):
    sudo(PY,'-c','import pathlib,sys; pathlib.Path(sys.argv[1]).write_text(sys.stdin.read())', str(path), input=text)

def ensure_user(user, group):
    if sudo('getent','group',group, check=False).returncode!=0:
        sudo('groupadd','--system',group)
    if sudo('id',user, check=False).returncode!=0:
        sudo('useradd','--system','--no-create-home','--shell','/usr/sbin/nologin','--gid',group,user)

def test_edge_merge_validates_the_whole_file_and_reloads_only_the_live_unit(tmp_path):
    if sudo('true', check=False).returncode!=0:
        pytest.fail('sudo is required')
    if not shutil.which('caddy'):
        pytest.fail('caddy is required to validate the merged file')
    live=tmp_path/'Caddyfile'
    live.write_text(textwrap.dedent('''
        {
        \tadmin off
        \tauto_https off
        }
        https://203.0.113.10 {
        \thandle /api/reader/* {
        \t\treverse_proxy 127.0.0.1:6010
        \t}
        \thandle /api/tts/* {
        \t\treverse_proxy 127.0.0.1:8800
        \t}
        \thandle /api/harness/* {
        \t\treverse_proxy 127.0.0.1:3080
        \t}
        }
    ''').lstrip())
    bin_dir=tmp_path/'bin'
    bin_dir.mkdir()
    log=tmp_path/'systemctl.log'
    log.write_text('')
    os.chmod(log, 0o666)
    (bin_dir/'systemctl').write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$STUDIO_SYSTEMCTL_LOG"\nexit 0\n')
    (bin_dir/'curl').write_text('#!/bin/sh\nexit 0\n')
    os.chmod(bin_dir/'systemctl', 0o755)
    os.chmod(bin_dir/'curl', 0o755)
    fragment=tmp_path/'fragment-dest'
    backup=tmp_path/'backups'
    env={
        'EDGE_CADDYFILE':str(live),
        'EDGE_UNIT':'local-tts-edge.service',
        'EDGE_FRAGMENT':str(fragment),
        'EDGE_BACKUP_ROOT':str(backup),
        'STUDIO_SYSTEMCTL_LOG':str(log),
        'PATH':str(bin_dir)+':/usr/sbin:/usr/bin:/bin',
    }
    done=sudo(str(ROOT/'deploy'/'edge-studio.sh'),'install', env=env)
    assert done.returncode==0, done.stderr
    merged=live.read_text()
    assert 'import '+str(fragment) in merged
    assert '127.0.0.1:6010' in merged and '127.0.0.1:8800' in merged and '127.0.0.1:3080' in merged
    assert 'reload local-tts-edge.service' in log.read_text()
    assert 'restart' not in log.read_text()
    assert 'caddy.service' not in log.read_text()
    again=sudo(str(ROOT/'deploy'/'edge-studio.sh'),'install', env=env)
    assert again.returncode==0, again.stderr
    assert live.read_text().count('import '+str(fragment))==1
    broken=tmp_path/'broken.caddy'
    broken.write_text('this is not a caddyfile {\n')
    saved=live.read_text()
    log.write_text('')
    failed=sudo(str(ROOT/'deploy'/'edge-studio.sh'),'install', env={**env,'EDGE_FRAGMENT_SRC':str(broken)}, check=False)
    assert failed.returncode!=0
    assert live.read_text()==saved
    assert not fragment.exists()
    assert log.read_text()==''
    health=bin_dir/'curl'
    health.write_text('#!/bin/sh\nexit 1\n')
    os.chmod(health, 0o755)
    log.write_text('')
    unhealthy=sudo(str(ROOT/'deploy'/'edge-studio.sh'),'install', env=env, check=False)
    assert unhealthy.returncode!=0
    assert live.read_text()==saved
    assert 'reload local-tts-edge.service' in log.read_text()

def test_restricted_reader_directory_and_acl_rollback(tmp_path):
    if sudo('true', check=False).returncode!=0:
        pytest.fail('sudo is required')
    group='reader-data-html3'
    keeper='acl-keep-html3'
    api='studio-api-html3'
    worker='studio-worker-html3'
    studio='studio-data-html3'
    ensure_user(keeper, group)
    ensure_user(api, studio)
    ensure_user(worker, studio)
    base=Path('/tmp/studio-html3-acl')
    sudo('rm','-rf',str(base))
    reader=base/'etc'/'reader'
    data=base/'var'/'reader'
    sudo('mkdir','-p',str(reader),str(data))
    sudo('chown',f'root:{group}',str(reader),str(data))
    sudo('chmod','0750',str(reader))
    sudo('chmod','2770',str(data))
    owners=reader/'owners.json'
    body=json.dumps({hashlib.sha256(b'A'*48).hexdigest():'ann'})
    write_root(owners, body)
    sudo('chown',f'root:{group}',str(owners))
    sudo('chmod','0640',str(owners))
    sudo('setfacl','-m',f'u:{keeper}:x',str(reader))
    sudo('setfacl','-m',f'u:{keeper}:r',str(owners))
    sudo('setfacl','-m',f'u:{api}:r',str(owners))
    assert not user_ok(api,'-r',owners)
    sudo('setfacl','-x',f'u:{api}',str(owners))
    snap=base/'acl-before'
    sudo(PY,str(ROOT/'tools'/'studio_acl.py'),'apply','--reader-dir',str(reader),'--owners',str(owners),'--snapshot-dir',str(snap),'--users',f'{api},{worker}')
    assert user_ok(api,'-r',owners) and user_ok(worker,'-x',reader)
    assert not user_ok(api,'-r',reader)
    assert not user_ok(api,'-w',data)
    assert 'reader-data-html3' not in sudo('id','-nG',api).stdout
    assert sudo('stat','-c','%a',str(reader)).stdout.strip()=='750'
    assert sudo('stat','-c','%a',str(owners)).stdout.strip()=='640'
    assert user_ok(keeper,'-r',owners)
    sudo(PY,str(ROOT/'tools'/'studio_acl.py'),'apply','--reader-dir',str(reader),'--owners',str(owners),'--snapshot-dir',str(snap),'--users',f'{api},{worker}')
    sudo(PY,str(ROOT/'tools'/'studio_acl.py'),'restore','--snapshot-dir',str(snap))
    assert not user_ok(api,'-r',owners)
    assert user_ok(keeper,'-r',owners)
    assert sudo('stat','-c','%a',str(reader)).stdout.strip()=='750'
    assert sudo('stat','-c','%a',str(owners)).stdout.strip()=='640'
    listed=sudo('getfacl','-p',str(owners))
    assert f'user:{keeper}:r' in listed.stdout
    assert f'user:{api}:' not in listed.stdout

def _prepare_env(base, cache):
    return {
        'STUDIO_GROUP':'studio-data-html3',
        'STUDIO_API_USER':'studio-api-html3',
        'STUDIO_WORKER_USER':'studio-worker-html3',
        'STUDIO_VAR':str(base/'var'/'studio'),
        'STUDIO_ETC':str(base/'etc'/'studio'),
        'STUDIO_OWNERS':str(base/'etc'/'reader'/'owners.json'),
        'STUDIO_CURRENT':str(ROOT),
        'STUDIO_RUNTIME':str(Path(PY).absolute().parent.parent),
        'READER_RUNTIME_CACHE':str(cache),
        'STUDIO_JOBS_IMAGE':str(base/'image'/'jobs.ext4'),
        'STUDIO_JOBS':str(base/'var'/'studio'/'jobs'),
        'STUDIO_UNIT_DIR':str(base/'units'),
        'STUDIO_SKIP_SYSTEMCTL':'1',
        'STUDIO_READER_DATA':str(base/'var'/'reader'),
        'STUDIO_READER_GROUP':'reader-data-html3',
        'STUDIO_PYTHON':PY,
        'PYTHONPATH':str(ROOT),
        'PYTHONDONTWRITEBYTECODE':'1',
    }

def test_prepare_gate_enable_mock_jobs_and_rollback(tmp_path, sdk_static_cache):
    if sudo('true', check=False).returncode!=0:
        pytest.fail('sudo is required')
    pytest.importorskip('deepseek_harness')
    if sdk_static_cache is None or not Path(PY).exists() or not shutil.which('bwrap'):
        pytest.fail('bwrap, the pinned runtime and its cache are required')
    if sudo('ss','-ltn', check=False).stdout.find(':6011')>=0:
        pytest.fail('127.0.0.1:6011 is already in use')
    ensure_user('acl-keep-html3','reader-data-html3')
    ensure_user('studio-api-html3','studio-data-html3')
    ensure_user('studio-worker-html3','studio-data-html3')
    base=Path('/tmp/studio-html3-layout')
    cache=Path('/tmp/studio-html3-cache')
    sudo('rm','-rf',str(base))
    if cache.exists():
        sudo('rm','-rf',str(cache))
    reader=base/'etc'/'reader'
    data=base/'var'/'reader'
    sudo('mkdir','-p',str(reader),str(data),str(base/'image'))
    sudo('chown','root:reader-data-html3',str(reader),str(data))
    sudo('chmod','0750',str(reader))
    sudo('chmod','2770',str(data))
    owners=reader/'owners.json'
    body=json.dumps({hashlib.sha256(b'A'*48).hexdigest():'ann'})
    write_root(owners, body)
    sudo('chown','root:reader-data-html3',str(owners))
    sudo('chmod','0640',str(owners))
    sudo('setfacl','-m','u:acl-keep-html3:x',str(reader))
    sudo('setfacl','-m','u:acl-keep-html3:r',str(owners))
    subprocess.run(['cp','-a',str(sdk_static_cache),str(cache)], check=True)
    sudo('chown','-R','root:root',str(cache))
    sudo('chmod','-R','a+rX',str(cache))
    sudo('chmod','-R','go-w',str(cache))
    os.chmod(ROOT.parent, 0o755)
    subprocess.run(['chmod','-R','a+rX',str(ROOT)], check=True)
    runtime=Path(PY).absolute().parent.parent
    if not str(runtime).startswith('/tmp/'):
        pytest.fail('refusing to relax permissions outside the test runtime')
    subprocess.run(['chmod','-R','a+rX',str(runtime)], check=True)
    env=_prepare_env(base, cache)
    jobs=Path(env['STUDIO_JOBS'])
    mounted=False
    api=None
    try:
        prepared=sudo(str(ROOT/'deploy'/'prepare-studio.sh'),'--prepare-inactive', env=env)
        assert prepared.returncode==0, prepared.stderr
        mounted=True
        assert user_ok('studio-api-html3','-r',owners)
        assert not user_ok('studio-api-html3','-r',reader)
        assert not user_ok('studio-worker-html3','-w',data)
        assert user_ok('acl-keep-html3','-r',owners)
        assert user_ok('studio-worker-html3','-x',runtime/'bin'/'python')
        assert user_ok('studio-api-html3','-r',ROOT/'reader_service'/'studio_api.py')
        assert not user_ok('studio-worker-html3','-r',base/'etc'/'studio'/'worker.env')
        mounted_info=sudo(PY,'-c','import os,sys; p=sys.argv[1]; i=os.statvfs(p); print(int(os.path.ismount(p)), int(bool(i.f_flag & os.ST_NOEXEC)), i.f_blocks*i.f_frsize)', str(jobs))
        is_mount, noexec, size=mounted_info.stdout.split()
        assert is_mount=='1' and noexec=='1' and int(size)<=128*1024*1024
        unit=(base/'units'/'studio-worker.service').read_text()
        assert 'User=studio-worker-html3' in unit and 'LimitFSIZE=32M' in unit and 'MemoryMax=384M' in unit
        assert 'Requires=studio-jobs.mount' not in unit and 'Requires=' in unit
        escaped=subprocess.check_output(['systemd-escape','-p','--suffix=mount', str(jobs)], text=True).strip()
        assert (base/'units'/escaped).is_file()
        write_root(base/'units'/'studio-jobs.mount', '[Mount]\nWhat=/tmp/old.img\nWhere=/var/lib/studio/jobs\nType=ext4\nOptions=loop,nodev,nosuid,noexec\n')
        secret_env=root_text(base/'etc'/'studio'/'worker.env').replace(
            'DEEPSEEK_API_KEY=REPLACE_SECURELY_AT_DEPLOYMENT','DEEPSEEK_API_KEY='+SENTINEL)
        write_root(base/'etc'/'studio'/'worker.env', secret_env)
        sudo('chmod','0600',str(base/'etc'/'studio'/'worker.env'))
        again=sudo(str(ROOT/'deploy'/'prepare-studio.sh'),'--prepare-inactive', env=env)
        assert again.returncode==0, again.stderr
        kept=root_text(base/'etc'/'studio'/'worker.env')
        assert 'DEEPSEEK_API_KEY='+SENTINEL in kept and 'STUDIO_ENABLE_GENERATION=0' in kept
        assert not (base/'units'/'studio-jobs.mount').exists()
        verified=subprocess.run(['systemd-analyze','verify', str(base/'units'/'studio-api.service'), str(base/'units'/'studio-worker.service'), str(base/'units'/escaped)], capture_output=True, text=True)
        assert verified.returncode==0, verified.stderr
        assert 'DEEPSEEK_API_KEY' not in root_text(base/'etc'/'studio'/'api.env')
        failed=sudo(PY,str(ROOT/'tools'/'studio_gates.py'),str(base/'var'/'studio'/'not-mounted.json'), env={**env,'STUDIO_JOBS':str(base/'etc')}, check=False)
        assert failed.returncode!=0
        assert sudo('test','-e',str(base/'var'/'studio'/'not-mounted.json'), check=False).returncode!=0
        gate=sudo(str(ROOT/'deploy'/'studio-lifecycle.sh'),'gate', env=env, check=False)
        assert gate.returncode==0, gate.stderr[-4000:]+gate.stdout[-2000:]
        evidence=json.loads(root_text(base/'var'/'studio'/'gate-evidence.json'))
        assert all(evidence[key] is True for key in (
            'source_parity_reviewed','namespace_negative_probes','filesystem_hard_quota',
            'systemd_cgroup_limits','linux_py312_sdk_smoke','https_auth_checked'))
        enabled=sudo(str(ROOT/'deploy'/'studio-lifecycle.sh'),'enable', env=env, check=False)
        assert enabled.returncode==0, enabled.stderr[-4000:]+enabled.stdout[-1000:]
        accepted=json.loads(root_text(base/'etc'/'studio'/'accepted.json'))
        assert accepted['trusted_manifest_sha256']==evidence['trusted_manifest_sha256']
        for key in ('source_parity_reviewed','namespace_negative_probes','filesystem_hard_quota','systemd_cgroup_limits','linux_py312_sdk_smoke','https_auth_checked'):
            assert accepted[key] is True
        assert sudo('stat','-c','%a',str(base/'etc'/'studio'/'accepted.json')).stdout.strip()=='640'
        assert 'STUDIO_ENABLE_GENERATION=1' in root_text(base/'etc'/'studio'/'worker.env')
        worker_env=root_text(base/'etc'/'studio'/'worker.env').replace('DEEPSEEK_API_KEY=REPLACE_SECURELY_AT_DEPLOYMENT','DEEPSEEK_API_KEY='+SENTINEL)
        write_root(base/'etc'/'studio'/'worker.env', worker_env)
        sudo('chmod','0600',str(base/'etc'/'studio'/'worker.env'))
        home=base/'home'
        sudo('mkdir','-p',str(home/'api'),str(home/'worker'))
        sudo('chown','studio-api-html3',str(home/'api'))
        sudo('chown','studio-worker-html3',str(home/'worker'))
        api=subprocess.Popen(['sudo','-n','env',f'PYTHONPATH={ROOT}',f'HOME={home/"api"}',PY,str(ROOT/'tests'/'studio_as_service.py'),
            'studio-api-html3',str(base/'etc'/'studio'/'api.env'),PY,'-m','uvicorn','reader_service.studio_api:create_app',
            '--factory','--host','127.0.0.1','--port','6011','--workers','1','--no-access-log','--no-proxy-headers'],
            start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        deadline=time.time()+20
        health=None
        while time.time()<deadline:
            probe=subprocess.run(['curl','-fsS','http://127.0.0.1:6011/api/studio/health'], capture_output=True, text=True)
            if probe.returncode==0:
                health=json.loads(probe.stdout)
                break
            time.sleep(0.2)
        assert health is not None, 'studio API did not answer on 127.0.0.1:6011'
        assert health['generation'] is True and health['release'].endswith('html4') and health['reader_replaced'] is False
        token='A'*48
        write_root(base/'etc'/'studio'/'worker.env', root_text(base/'etc'/'studio'/'worker.env')+'STUDIO_MOCK_SECONDS=25\n')
        sudo('chmod','0600',str(base/'etc'/'studio'/'worker.env'))
        worker=subprocess.Popen(['sudo','-n','env',f'PYTHONPATH={ROOT}',f'HOME={home/"worker"}',PY,str(ROOT/'tests'/'studio_as_service.py'),
            'studio-worker-html3',str(base/'etc'/'studio'/'worker.env'),PY,str(ROOT/'tests'/'studio_mock_jobs.py')],
            start_new_session=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        created=[]
        try:
            for brief in ('第一页', '第二页'):
                posted=subprocess.run(['curl','-fsS','-H',f'Authorization: Bearer {token}','-H','Content-Type: application/json',
                    '-d',json.dumps({'skill':'html-builder','brief':brief}),'http://127.0.0.1:6011/api/studio/jobs'], capture_output=True, text=True)
                assert posted.returncode==0, posted.stderr
                job=json.loads(posted.stdout)['id']
                created.append(job)
                seen=None
                until=time.time()+20
                while time.time()<until:
                    got=subprocess.run(['curl','-fsS','-H',f'Authorization: Bearer {token}',f'http://127.0.0.1:6011/api/studio/jobs/{job}'], capture_output=True, text=True)
                    if got.returncode==0 and json.loads(got.stdout)['status'] in ('ready','failed','cancelled'):
                        seen=json.loads(got.stdout)
                        break
                    time.sleep(0.1)
                assert seen is not None and seen['status']=='ready', seen or worker.stderr.read()
        finally:
            write_root(base/'var'/'studio'/'stop-worker', 'stop\n')
            try: worker.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(worker.pid, 15)
        db=base/'var'/'studio'/'studio.sqlite3'
        assert sudo('stat','-c','%a',str(db)).stdout.strip()=='660'
        report=json.loads(root_text(base/'var'/'studio'/'mock-report.json'))
        assert report['held'] is True and report['key_in_child'] is False
        assert [item['status'] for item in report['jobs']]==['ready','ready']
        published=base/'var'/'studio'/'jobs'/created[0]/'published'/'preview.html'
        assert sudo('stat','-c','%a',str(published)).stdout.strip()=='660'
        assert not user_ok('studio-api-html3','-x',base/'var'/'studio'/'run')
        cancelled=subprocess.run(['curl','-fsS','-H',f'Authorization: Bearer {token}','-H','Content-Type: application/json',
            '-d',json.dumps({'skill':'html-builder','brief':'停掉这个'}),'http://127.0.0.1:6011/api/studio/jobs'], capture_output=True, text=True)
        job=json.loads(cancelled.stdout)['id']
        stop=subprocess.run(['curl','-fsS','-X','POST','-H',f'Authorization: Bearer {token}',f'http://127.0.0.1:6011/api/studio/jobs/{job}/cancel'], capture_output=True, text=True)
        assert json.loads(stop.stdout)['status']=='cancelled'
        disabled=sudo(str(ROOT/'deploy'/'studio-lifecycle.sh'),'disable', env=env)
        assert disabled.returncode==0, disabled.stderr
        assert 'STUDIO_ENABLE_GENERATION=0' in root_text(base/'etc'/'studio'/'worker.env')
        flags=json.loads(root_text(base/'etc'/'studio'/'accepted.json'))
        assert all(flags[key] is False for key in ('source_parity_reviewed','namespace_negative_probes','filesystem_hard_quota','systemd_cgroup_limits','linux_py312_sdk_smoke','https_auth_checked'))
        rolled=sudo(str(ROOT/'deploy'/'rollback-studio.sh'),'--stop-studio', env=env)
        assert rolled.returncode==0, rolled.stderr
        assert not user_ok('studio-api-html3','-r',owners)
        assert user_ok('acl-keep-html3','-r',owners)
        assert '6010' not in rolled.stdout and 'reader-api' not in rolled.stdout
    finally:
        if api is not None and api.poll() is None:
            os.killpg(api.pid, 15)
            try: api.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(api.pid, 9)
        if mounted:
            sudo('umount',str(jobs), check=False)
