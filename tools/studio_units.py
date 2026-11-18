#!/usr/bin/env python3
"""Check the studio units systemd will actually load.

The mount unit filename has to be the escaped Where= path. studio-jobs.mount
is rejected before api or worker can start. Gate and enable take the runtime,
cache, work directory and jobs path from these units. They do not source
worker.env, because that file holds the model secret.
"""
import argparse, os, shlex, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
MOUNT_SOURCE='var-lib-studio-jobs.mount'
STALE_MOUNT='studio-jobs.mount'

def escape_mount(where):
    result=subprocess.run(['systemd-escape','-p','--suffix=mount', where], check=False, text=True, capture_output=True)
    if result.returncode!=0 or not result.stdout.strip():
        raise SystemExit(result.stderr or 'systemd-escape failed')
    return result.stdout.strip()

def unit_dir(explicit=None):
    chosen=explicit or os.environ.get('STUDIO_UNIT_DIR')
    if chosen:
        return Path(chosen)
    installed=Path('/etc/systemd/system')
    if (installed/'studio-worker.service').is_file():
        return installed
    return ROOT/'deploy'

def read_unit(directory, name):
    path=directory/name
    if not path.is_file():
        raise SystemExit('missing unit '+str(path))
    return path, path.read_text()

def value(text, key):
    prefix=key+'='
    found=[line[len(prefix):] for line in text.splitlines() if line.startswith(prefix)]
    if len(found)!=1:
        raise SystemExit(key+' must appear once')
    return found[0]

def environment(text, key):
    prefix='Environment='+key+'='
    found=[line[len(prefix):] for line in text.splitlines() if line.startswith(prefix)]
    if len(found)!=1:
        raise SystemExit('Environment='+key+' must appear once')
    return found[0]

def load(directory):
    directory=Path(directory)
    stale=directory/STALE_MOUNT
    if stale.exists():
        raise SystemExit('stale unit still installed: '+str(stale))
    worker_path, worker=read_unit(directory, 'studio-worker.service')
    api_path, api=read_unit(directory, 'studio-api.service')
    jobs=None
    mount_path=None
    mount=None
    for candidate in sorted(directory.glob('*.mount')):
        text=candidate.read_text()
        where=value(text, 'Where')
        what=value(text, 'What')
        if 'studio' not in where and 'studio' not in what and 'studio' not in candidate.name:
            continue
        if escape_mount(where)!=candidate.name:
            raise SystemExit(candidate.name+' does not match Where='+where)
        jobs, mount_path, mount=where, candidate, text
        break
    if mount is None:
        raise SystemExit('no studio jobs mount unit in '+str(directory))
    name=mount_path.name
    if name!=escape_mount(jobs):
        raise SystemExit(name+' does not match Where='+jobs)
    for label, text in (('api', api), ('worker', worker)):
        if 'Requires='+name not in text or 'After=network.target '+name not in text:
            raise SystemExit(label+' does not require '+name)
        if 'Requires='+STALE_MOUNT in text or 'After=network.target '+STALE_MOUNT in text:
            raise SystemExit(label+' still references '+STALE_MOUNT)
    cache=environment(worker, 'READER_RUNTIME_CACHE')
    current=value(worker, 'WorkingDirectory')
    if value(api, 'WorkingDirectory')!=current:
        raise SystemExit('api and worker working directories differ')
    runtime=value(worker, 'ExecStart').split()[0]
    if not runtime.endswith('/bin/python'):
        raise SystemExit('worker ExecStart is not the runtime python')
    if value(api, 'ExecStart').split()[0]!=runtime:
        raise SystemExit('api and worker do not use the same python')
    if environment(api, 'PYTHONDONTWRITEBYTECODE')!='1':
        raise SystemExit('api unit dropped PYTHONDONTWRITEBYTECODE')
    if '--host 127.0.0.1 --port 6011' not in value(api, 'ExecStart'):
        raise SystemExit('api is not bound to 127.0.0.1:6011')
    if 'DEEPSEEK_API_KEY' in api or 'EnvironmentFile='+str(Path('/etc/studio/worker.env')) in api:
        raise SystemExit('api unit can see the worker secret file')
    for item in ('MemoryMax=128M','MemorySwapMax=0','TasksMax=32','UMask=0007','ProtectControlGroups=true','RestrictSUIDSGID=true'):
        if item not in api:
            raise SystemExit('api unit missing '+item)
    for item in ('MemoryMax=384M','MemorySwapMax=0','TasksMax=32','UMask=0007','LimitFSIZE=32M','ProtectControlGroups=true',
                 'RestrictSUIDSGID=true','UnsetEnvironment=TTS_API_TOKEN','ReadOnlyPaths='+cache):
        if item not in worker:
            raise SystemExit('worker unit missing '+item)
    writes=value(worker, 'ReadWritePaths').split()
    parent=str(Path(jobs).parent)
    if parent not in writes or jobs not in writes:
        raise SystemExit('worker ReadWritePaths do not cover '+parent+' and '+jobs)
    if value(api, 'ReadWritePaths')!=value(worker, 'ReadWritePaths'):
        raise SystemExit('api and worker ReadWritePaths differ')
    for item in ('loop','nodev','nosuid','noexec'):
        if item not in value(mount, 'Options'):
            raise SystemExit('jobs mount is missing '+item)
    return {
        'dir': directory,
        'mount_name': name,
        'mount_path': mount_path,
        'jobs': jobs,
        'what': value(mount, 'What'),
        'cache': cache,
        'current': current,
        'runtime': str(Path(runtime).parent.parent),
        'python': runtime,
        'api': api_path,
        'worker': worker_path,
    }

def apply_process_env(config):
    """Use the unit values. Refuse a shell export that points somewhere else."""
    expected={
        'READER_RUNTIME_CACHE': config['cache'],
        'STUDIO_RUNTIME': config['runtime'],
        'STUDIO_CURRENT': config['current'],
        'STUDIO_JOBS': config['jobs'],
    }
    for key, value in expected.items():
        current=os.environ.get(key)
        if current and current!=value:
            raise SystemExit(key+'='+current+' does not match the unit value '+value)
        os.environ[key]=value

def verify(config):
    result=subprocess.run(['systemd-analyze','verify', str(config['api']), str(config['worker']), str(config['mount_path'])],
                          check=False, text=True, capture_output=True)
    if result.returncode!=0:
        sys.stderr.write(result.stderr or result.stdout)
        raise SystemExit(result.returncode or 1)
    return result

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('action', choices=('check','env','mount-name','verify'))
    parser.add_argument('--unit-dir', default='')
    args=parser.parse_args()
    config=load(unit_dir(args.unit_dir or None))
    if args.action=='mount-name':
        print(config['mount_name'])
    elif args.action=='env':
        for key in ('READER_RUNTIME_CACHE','STUDIO_RUNTIME','STUDIO_CURRENT','STUDIO_JOBS'):
            print(key+'='+shlex.quote(config[{'READER_RUNTIME_CACHE':'cache','STUDIO_RUNTIME':'runtime','STUDIO_CURRENT':'current','STUDIO_JOBS':'jobs'}[key]]))
    elif args.action=='verify':
        verify(config)
        print('systemd-analyze verify passed for '+config['mount_name'])
    else:
        print(config['mount_name'])
        print(config['jobs'])
        print(config['cache'])
        print(config['runtime'])

if __name__=='__main__':
    main()
