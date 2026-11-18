#!/usr/bin/env python3
"""Start one command as a service user with an EnvironmentFile.

Used when this machine has no systemd. The secret is placed in the new
process environment. It is not put on the command line. Production start is
systemctl, which reads the same file as root.
"""
import os, sys

KEEP={
    'PATH','PYTHONPATH','PYTHONDONTWRITEBYTECODE','HOME','LANG','LC_ALL',
    'READER_RUNTIME_CACHE','STUDIO_DATA','STUDIO_AUTH_FILE','STUDIO_ENABLE_GENERATION',
    'STUDIO_ACCEPTED_FILE','STUDIO_CORS_ORIGINS','DEEPSEEK_API_KEY',
    'STUDIO_JOB_TIMEOUT','STUDIO_PROGRESS_TIMEOUT','STUDIO_MOCK_SECONDS',
}

def load(path):
    values={}
    for line in open(path, encoding='utf-8'):
        line=line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value=line.split('=', 1)
        values[key]=value
    return values

def main():
    if os.geteuid()!=0:
        raise SystemExit('root required')
    user, envfile, *cmd=sys.argv[1:]
    env={key:value for key, value in load(envfile).items() if key in KEEP}
    env['PATH']=os.environ.get('PATH','/usr/bin:/bin')
    env['PYTHONPATH']=os.environ.get('PYTHONPATH','')
    env['PYTHONDONTWRITEBYTECODE']='1'
    env['HOME']=os.environ.get('HOME','/tmp')
    os.umask(0o007)
    os.execvpe('runuser', ['runuser','-u',user,'--preserve-environment','--',*cmd], env)

if __name__=='__main__':
    main()
