"""Explicit mount allowlist, isolated PID/NET/IPC/UTS/USER namespaces, empty environment."""
import hashlib, json, os, resource, signal, subprocess, sys
from pathlib import Path
from .runtime_cache import cache_root

ROOT=Path(__file__).resolve().parent.parent

def verify_manifest(require_root=True):
    if require_root:
        for p in (ROOT, ROOT/'TRUSTED-SHA256.json',ROOT/'reader_service',ROOT/'skills',ROOT/'skills'/'adventure-reader'):
            st=p.stat()
            if st.st_uid != 0 or st.st_mode & 0o022: raise RuntimeError('trusted_source_permissions')
    manifest=json.loads((ROOT/'TRUSTED-SHA256.json').read_text())
    for name,digest in manifest.items():
        p=ROOT/name
        if require_root and (p.stat().st_uid != 0 or p.stat().st_mode & 0o022):
            raise RuntimeError('trusted_source_permissions')
        if p.is_symlink() or not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=digest:
            raise RuntimeError('trusted_source_hash_mismatch')

def command(work, broker, runtime='/opt/reader-runtime', bwrap='/usr/bin/bwrap', entry='sandbox_entry.py',cache=None):
    cache=Path(cache) if cache is not None else cache_root()
    args=[bwrap,'--unshare-all','--die-with-parent','--new-session','--cap-drop','ALL','--clearenv',
          '--ro-bind','/usr','/usr']
    for path in ('/lib','/lib64','/bin'):
        if Path(path).exists(): args+=['--ro-bind',path,path]
    args+=['--proc','/proc','--dev','/dev','--symlink','/work/tmp','/tmp','--dir','/run','--dir','/etc',
           '--ro-bind',str(Path(runtime).resolve()),'/opt/reader-runtime',
           '--ro-bind',str(ROOT/'reader_service'),'/app',
           '--ro-bind',str(cache/'home'),'/sdk-home',
           '--ro-bind',str(ROOT/'skills'/'adventure-reader'),'/skill',
           '--bind',str(Path(work).resolve()),'/work',
           '--ro-bind',str(Path(broker).resolve()),'/run/model.sock',
           '--setenv','PATH','/opt/reader-runtime/bin:/usr/bin:/bin',
           '--setenv','NARB_NATIVE_CACHE_DIR','/sdk-home/.cache/narb','--setenv','HOME','/sdk-home','--setenv','TMPDIR','/work/tmp','--setenv','PYTHONDONTWRITEBYTECODE','1',
           '--chdir','/work','--','/opt/reader-runtime/bin/python','/app/'+entry]
    # Parent work mount is per-job; immutable source and supervisor controls overlay it read-only.
    pos=args.index('--setenv')
    overlays=[]
    for name in ('assets','input.json','control.json'):
        path=Path(work)/name
        if path.exists(): overlays+=['--ro-bind',str(path.resolve()),'/work/'+name]
    args[pos:pos]=overlays
    return args

def limits():
    resource.setrlimit(resource.RLIMIT_FSIZE,(32*1024*1024,32*1024*1024))
    resource.setrlimit(resource.RLIMIT_CORE,(0,0))
    resource.setrlimit(resource.RLIMIT_NOFILE,(128,128))
    # cgroup MemoryMax/TasksMax handles descendants; CPU wall timeout enforced by supervisor.

def spawn(args):
    return subprocess.Popen(args,env={'PATH':'/usr/bin:/bin'},stdin=subprocess.DEVNULL,
                            stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                            start_new_session=True,preexec_fn=limits)

def terminate(proc):
    if proc.poll() is None:
        try: os.killpg(proc.pid,signal.SIGKILL)
        except ProcessLookupError: pass
    proc.wait(timeout=10)
