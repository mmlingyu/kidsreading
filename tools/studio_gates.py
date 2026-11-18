#!/usr/bin/env python3
"""Run the six studio gates and bind the result to this tree's trusted hash.

Mocking the model response is allowed. The SDK, bwrap, gateway object, owner
checks and filesystem layout are not mocked. Failure deletes a partial evidence
file and does not change accepted.json or the generation switch.
"""
import hashlib, json, os, shutil, stat, subprocess, sys, tempfile, time
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
KEYS=('source_parity_reviewed','namespace_negative_probes','filesystem_hard_quota','systemd_cgroup_limits','linux_py312_sdk_smoke','https_auth_checked')

def trusted_hash():
    return hashlib.sha256((ROOT/'TRUSTED-SHA256.json').read_bytes()).hexdigest()

def fail(name, detail):
    raise SystemExit(name+': '+detail)

def probe_source():
    listed=(ROOT/'skills'/'html-skills'/'SOURCE-SHA256.txt').read_text().splitlines()
    if len(listed)!=13:
        fail('source_parity_reviewed','skill manifest is not the uploaded 13 files')
    for line in listed:
        digest, rel, _size=line.split('  ')
        if hashlib.sha256((ROOT/'skills'/'html-skills'/rel).read_bytes()).hexdigest()!=digest:
            fail('source_parity_reviewed', rel)
    zdog=(ROOT/'skills'/'html-skills'/'zdog'/'vendor'/'zdog.dist.min.js').read_bytes()
    if hashlib.sha256(zdog).hexdigest()!='2baede641561fa7f00490809a3357ce66a70a47c4c46385b078b8e10027c14f0':
        fail('source_parity_reviewed','zdog dist hash')
    catalog=json.loads((ROOT/'skills'/'html-skills'/'CATALOG.json').read_text())
    enabled=sorted(item['id'] for item in catalog['skills'] if item['status']=='enabled')
    blocked={item['id']:item['reason'] for item in catalog['skills'] if item['status']=='blocked'}
    if enabled!=['html-builder','knowledge-travel','zdog']:
        fail('source_parity_reviewed','enabled set changed')
    expect={
        'spdesign':'missing_image_adapter_and_eleven_reference_images',
        '3d-game-dev':'missing_blender_gateway_and_human_target_approval',
        'creation-engine':'missing_3dplay_rules_catalog_and_img2threejs',
        'grill-me':'missing_grilling_skill_and_model_invocation_disabled',
    }
    if blocked!=expect:
        fail('source_parity_reviewed','blocked reasons changed')

def probe_namespace():
    if not shutil.which('bwrap'):
        fail('namespace_negative_probes','bwrap missing')
    runtime=os.environ.get('STUDIO_RUNTIME','/opt/reader-runtime')
    if not Path(runtime,'bin','python').is_file():
        fail('namespace_negative_probes','runtime python missing')
    work=Path(tempfile.mkdtemp(prefix='studio-ns-'))
    try:
        (work/'tmp').mkdir(); (work/'outputs').mkdir(); (work/'cache'/'home').mkdir(parents=True)
        (work/'sock').write_bytes(b'')
        from reader_service.sandbox import command
        args=command(work, work/'sock', runtime=runtime, skill='html-skills/html-builder', cache=work/'cache')
        if any(token in args for token in ('/var/lib/reader','/etc/reader')):
            fail('namespace_negative_probes','reader paths are mounted')
        program=args.index('--')
        probe=args[:program+1]+['/opt/reader-runtime/bin/python','-c','raise SystemExit(0 if __import__("pathlib").Path("/etc/reader/owners.json").exists() else 3)']
        result=subprocess.run(probe, env={'PATH':'/usr/bin:/bin'}, capture_output=True, timeout=30)
        if result.returncode!=3:
            detail=(result.stderr or result.stdout).decode()[-300:]
            fail('namespace_negative_probes','expected the owners file to be invisible, got '+str(result.returncode)+' '+detail)
    finally:
        shutil.rmtree(work, ignore_errors=True)

def probe_quota():
    from reader_service.studio_review import review
    work=Path(tempfile.mkdtemp(prefix='studio-quota-'))
    jobs=Path(os.environ.get('STUDIO_JOBS','/var/lib/studio/jobs'))
    script=None
    try:
        outputs=work/'outputs'
        outputs.mkdir()
        (outputs/'report.md').write_text('x'*90)
        (outputs/'preview.html').symlink_to(outputs/'report.md')
        result=review(work,'html-builder')
        if result['passed']:
            fail('filesystem_hard_quota','symlink preview was accepted')
        mount=(ROOT/'deploy'/'studio-jobs.mount').read_text()
        worker=(ROOT/'deploy'/'studio-worker.service').read_text()
        for item in ('loop','nodev','nosuid','noexec','LimitFSIZE=32M'):
            if item not in mount and item not in worker:
                fail('filesystem_hard_quota', item)
        if 'LimitFSIZE=32M' not in worker or 'noexec' not in mount:
            fail('filesystem_hard_quota','unit does not keep the file-size and noexec caps')
        if not os.path.ismount(jobs):
            fail('filesystem_hard_quota','jobs path is not a mounted filesystem: '+str(jobs))
        info=os.statvfs(jobs)
        if not info.f_flag & os.ST_NOEXEC or not info.f_flag & os.ST_NOSUID:
            fail('filesystem_hard_quota','jobs mount is not nosuid,noexec')
        if info.f_blocks*info.f_frsize>128*1024*1024:
            fail('filesystem_hard_quota','jobs filesystem is larger than 128MiB')
        script=jobs/'gate-exec.sh'
        script.write_text('#!/bin/sh\necho EXECUTABLE\n')
        os.chmod(script, 0o755)
        if script.stat().st_mode & 0o111==0:
            fail('filesystem_hard_quota','the noexec probe script was not marked executable')
        try:
            executed=subprocess.run([str(script)], capture_output=True, timeout=10)
        except PermissionError:
            executed=None
        if executed is not None and (executed.returncode==0 or b'EXECUTABLE' in executed.stdout):
            fail('filesystem_hard_quota','a script on the jobs volume executed')
        probe=subprocess.run([sys.executable,'-c',
            'import os,resource\n'
            'resource.setrlimit(resource.RLIMIT_FSIZE,(32*1024*1024,32*1024*1024))\n'
            'path=os.environ["STUDIO_GATE_FILE"]\n'
            'try:\n'
            '    open(path,"wb").write(b"x"*(33*1024*1024))\n'
            'except OSError:\n'
            '    raise SystemExit(3)\n'
            'raise SystemExit(0)\n'],
            env={'PATH':'/usr/bin:/bin','STUDIO_GATE_FILE':str(jobs/'gate-big.bin')}, capture_output=True, timeout=20)
        big=jobs/'gate-big.bin'
        if probe.returncode==0 or (big.exists() and big.stat().st_size>32*1024*1024):
            fail('filesystem_hard_quota','a 33MiB write survived RLIMIT_FSIZE')
    finally:
        if script is not None:
            script.unlink(missing_ok=True)
        leftover=jobs/'gate-big.bin'
        if leftover.exists():
            leftover.unlink()
        shutil.rmtree(work, ignore_errors=True)

def probe_cgroup():
    api=(ROOT/'deploy'/'studio-api.service').read_text()
    worker=(ROOT/'deploy'/'studio-worker.service').read_text()
    for text, required in ((api, ('MemoryMax=128M','MemorySwapMax=0','TasksMax=32','UMask=0007','--host 127.0.0.1','--port 6011')),
                           (worker, ('MemoryMax=384M','MemorySwapMax=0','TasksMax=32','UMask=0007','ProtectControlGroups=true','LimitFSIZE=32M'))):
        for item in required:
            if item not in text:
                fail('systemd_cgroup_limits', item)
    if os.geteuid()!=0:
        fail('systemd_cgroup_limits','root required for the live memory scope')
    scope=Path('/sys/fs/cgroup/studio-gate-scope')
    if scope.exists():
        fail('systemd_cgroup_limits','a previous scope is still present')
    try:
        scope.mkdir()
        (scope/'memory.max').write_text('8388608')
        result=subprocess.run([sys.executable,'-c',
            'import os; fd=os.open("/sys/fs/cgroup/studio-gate-scope/cgroup.procs", os.O_WRONLY); os.write(fd, str(os.getpid()).encode()); os.close(fd); b=bytearray(32*1024*1024)'],
            capture_output=True, timeout=20)
        if result.returncode==0:
            fail('systemd_cgroup_limits','allocation survived an 8MiB memory.max')
    finally:
        if scope.exists():
            try: (scope/'memory.max').write_text('max')
            except OSError: pass
            for _ in range(30):
                try:
                    scope.rmdir()
                    break
                except OSError:
                    time.sleep(0.05)
        if scope.exists():
            fail('systemd_cgroup_limits','scope was not removed')

def probe_sdk():
    try:
        import deepseek_harness  # noqa: F401
    except ImportError:
        fail('linux_py312_sdk_smoke','pinned SDK is not importable')
    if not shutil.which('bwrap'):
        fail('linux_py312_sdk_smoke','bwrap missing')
    cache=os.environ.get('READER_RUNTIME_CACHE')
    if not cache or not (Path(cache)/'home').is_dir():
        fail('linux_py312_sdk_smoke','runtime cache was not prepared')
    cache_stat=(Path(cache)/'home').stat()
    if cache_stat.st_uid!=0 or cache_stat.st_mode & 0o022:
        fail('linux_py312_sdk_smoke','runtime cache is not root-owned and group/world read-only')
    os.environ['DEEPSEEK_API_KEY']='GATE-PROBE-NOT-A-REAL-KEY'
    from reader_service.studio_worker import take_model_key
    first=take_model_key()
    second=take_model_key()
    if first!='GATE-PROBE-NOT-A-REAL-KEY' or second:
        fail('linux_py312_sdk_smoke','a second read must not invent or retain the secret in the environment')
    probe=ROOT/'tests'/'studio_sdk_as_user.py'
    base=Path(tempfile.mkdtemp(prefix='studio-sdk-gate-'))
    try:
        user=os.environ.get('STUDIO_WORKER_USER','studio-worker')
        os.chown(base, __import__('pwd').getpwnam(user).pw_uid, __import__('pwd').getpwnam(user).pw_gid)
        os.chmod(base, 0o755)
        result=subprocess.run(['runuser','-u',user,'--','env',
            'PYTHONPATH='+str(ROOT),'READER_RUNTIME_CACHE='+cache,'PYTHONDONTWRITEBYTECODE=1','PATH=/usr/bin:/bin',
            sys.executable,str(probe),str(base),sys.prefix,cache], capture_output=True, timeout=120)
        status=(base/'sdk-status.txt').read_text() if (base/'sdk-status.txt').exists() else result.stderr.decode()[-1000:]
        if result.returncode!=0 or 'GATE-PROBE' in status:
            fail('linux_py312_sdk_smoke', status[-400:] or 'sdk process failed')
        if 'finish_reason' not in (base/'work'/'agent-result.json').read_text():
            fail('linux_py312_sdk_smoke','sdk did not finish through the gateway')
    finally:
        shutil.rmtree(base, ignore_errors=True)

def probe_auth():
    import hashlib
    from fastapi.testclient import TestClient
    from reader_service.studio_api import create_app
    from reader_service.studio_store import StudioSettings
    token='A'*48
    owners={hashlib.sha256(token.encode()).hexdigest():'ann'}
    root=Path(tempfile.mkdtemp(prefix='studio-auth-'))
    try:
        app=create_app(StudioSettings(root, owners, origins=('https://studio.example',)))
        with TestClient(app) as client:
            if client.get('/api/studio/skills').status_code!=401:
                fail('https_auth_checked','anonymous request was accepted')
            blocked=client.post('/api/studio/jobs', json={'skill':'grill-me','brief':'no'}, headers={'Authorization':'Bearer '+token})
            if blocked.status_code!=403:
                fail('https_auth_checked','blocked skill was accepted')
            other=client.get('/api/studio/jobs/'+'ab'*16, headers={'Authorization':'Bearer '+('B'*48)})
            if other.status_code!=401:
                fail('https_auth_checked','unknown bearer was accepted')
        unit=(ROOT/'deploy'/'studio-api.service').read_text()
        if '--host 127.0.0.1 --port 6011' not in unit:
            fail('https_auth_checked','API is not bound to the loopback port')
    finally:
        shutil.rmtree(root, ignore_errors=True)

def can(user, flag, path):
    return subprocess.run(['runuser','-u',user,'--','test',flag,str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode==0

def probe_service_paths():
    import grp, pwd
    users=(os.environ.get('STUDIO_API_USER','studio-api'), os.environ.get('STUDIO_WORKER_USER','studio-worker'))
    current=Path(os.environ.get('STUDIO_CURRENT','/opt/studio/current'))
    runtime=Path(os.environ.get('STUDIO_RUNTIME','/opt/reader-runtime'))
    cache=Path(os.environ.get('READER_RUNTIME_CACHE','/opt/reader-runtime-cache-0.2.2rc2'))
    owners=Path(os.environ.get('STUDIO_OWNERS','/etc/reader/owners.json'))
    reader_data=Path(os.environ.get('STUDIO_READER_DATA','/var/lib/reader'))
    reader_group=os.environ.get('STUDIO_READER_GROUP','reader-data')
    etc=Path(os.environ.get('STUDIO_ETC','/etc/studio'))
    for user in users:
        try:
            account=pwd.getpwnam(user)
        except KeyError:
            fail('https_auth_checked','service user missing: '+user)
        names={grp.getgrgid(account.pw_gid).gr_name}
        names.update(item.gr_name for item in grp.getgrall() if user in item.gr_mem)
        if reader_group in names:
            fail('https_auth_checked', user+' is in '+reader_group)
        if not can(user,'-x',owners.parent) or not can(user,'-r',owners):
            fail('https_auth_checked', user+' cannot read owners.json through the parent directory')
        parent_mode=owners.parent.stat().st_mode
        in_dir_group=account.pw_gid==owners.parent.stat().st_gid or any(item.gr_gid==owners.parent.stat().st_gid and user in item.gr_mem for item in grp.getgrall())
        if not (parent_mode & 0o004) and not in_dir_group and can(user,'-r',owners.parent):
            fail('https_auth_checked', user+' can list the reader config directory')
        if reader_data.is_dir() and can(user,'-w',reader_data):
            fail('https_auth_checked', user+' can write reader data')
        for tree in (current, runtime, cache):
            if not can(user,'-x',tree) or not can(user,'-r',tree):
                fail('linux_py312_sdk_smoke', user+' cannot read '+str(tree))
        if not can(user,'-x',runtime/'bin'/'python'):
            fail('linux_py312_sdk_smoke', user+' cannot execute the runtime python')
        secret=etc/'worker.env'
        if secret.is_file() and can(user,'-r',secret):
            fail('https_auth_checked', user+' can read the worker env file')

def probe_cancel():
    import hashlib
    from reader_service.studio_store import StudioSettings, StudioStore
    root=Path(tempfile.mkdtemp(prefix='studio-cancel-'))
    try:
        token='C'*48
        store=StudioStore(StudioSettings(root,{hashlib.sha256(token.encode()).hexdigest():'ann'}))
        row=store.create('ann', {'skill':'html-builder','brief':'cancel me'})
        claimed=store.claim()
        if claimed is None or claimed['id']!=row['id']:
            fail('cancel_race','cancel fixture was not claimed')
        store.cancel('ann', row['id'])
        if store.finish_if_running(row['id'], 'ready', '', 'late'):
            fail('cancel_race','a late success overwrote cancel')
        if store.get('ann', row['id'])['status']!='cancelled':
            fail('cancel_race','cancelled job changed status')
    finally:
        shutil.rmtree(root, ignore_errors=True)

PROBES=(
    ('source_parity_reviewed', probe_source),
    ('namespace_negative_probes', probe_namespace),
    ('filesystem_hard_quota', probe_quota),
    ('systemd_cgroup_limits', probe_cgroup),
    ('linux_py312_sdk_smoke', probe_sdk),
    ('https_auth_checked', probe_auth),
)

def run(evidence_path):
    evidence=Path(evidence_path)
    if evidence.exists():
        evidence.unlink()
    results={}
    try:
        for name, func in PROBES:
            func()
            results[name]=True
        probe_service_paths()
        probe_cancel()
        if list(results)!=list(KEYS) or not all(results.values()):
            fail('gates','incomplete')
        payload={
            'trusted_manifest_sha256': trusted_hash(),
            'probes': results,
            'signed_by': 'tools/studio_gates.py',
            'unix_time': int(time.time()),
        }
        payload.update(results)
        evidence.parent.mkdir(parents=True, exist_ok=True)
        temporary=evidence.with_suffix('.tmp')
        temporary.write_text(json.dumps(payload, indent=2)+'\n')
        os.chmod(temporary, 0o640)
        os.replace(temporary, evidence)
        print(json.dumps({'ok':True,'trusted_manifest_sha256':payload['trusted_manifest_sha256']}))
    except SystemExit:
        if evidence.exists():
            evidence.unlink()
        raise
    except Exception as exc:
        if evidence.exists():
            evidence.unlink()
        import traceback
        traceback.print_exc()
        fail('gates', type(exc).__name__+': '+str(exc))

def main():
    if os.geteuid()!=0:
        raise SystemExit('studio gates must run as root and fail closed otherwise')
    evidence=sys.argv[1] if len(sys.argv)>1 else '/var/lib/studio/gate-evidence.json'
    run(evidence)

if __name__=='__main__':
    main()
