"""Swap on lets an 8MiB cgroup survive; MemorySwapMax=0 kills it. The gate uses the second."""
import json, os, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PY=os.environ.get('STUDIO_TEST_PYTHON','/tmp/r4-venv/bin/python')

def sudo(*args, check=True, input=None):
    return subprocess.run(['sudo','-n',*args], check=check, input=input, text=True, capture_output=True)

def test_swap_max_zero_is_required_when_the_host_can_swap():
    if sudo('true', check=False).returncode!=0:
        raise SystemExit('sudo is required for the cgroup swap regression')
    before=sudo('awk','/SwapTotal/{print $2}','/proc/meminfo').stdout.strip()
    swap=Path('/tmp/studio-html5-swapfile')
    sudo('rm','-f',str(swap))
    try:
        sudo('dd','if=/dev/zero',f'of={swap}','bs=1M','count=64','status=none')
        sudo('chmod','600',str(swap))
        sudo('mkswap',str(swap))
        sudo('swapon',str(swap))
        active=sudo('awk','/SwapTotal/{print $2}','/proc/meminfo').stdout.strip()
        assert int(active)>=65532
        opened=json.loads(sudo('env','PYTHONDONTWRITEBYTECODE=1',PY,'-c',
            'import json,sys; sys.path.insert(0,%r); from tools.studio_gates import exercise_memory_scope; print(json.dumps(exercise_memory_scope("max","studio-gate-swap-on")))'%str(ROOT)).stdout)
        assert opened['memory_max']=='8388608' and opened['memory_swap_max']=='max'
        assert opened['returncode']==0 and opened['oom_kill']==0 and opened['timed_out'] is False
        closed=json.loads(sudo('env','PYTHONDONTWRITEBYTECODE=1',PY,'-c',
            'import json,sys; sys.path.insert(0,%r); from tools.studio_gates import exercise_memory_scope; print(json.dumps(exercise_memory_scope("0","studio-gate-swap-off")))'%str(ROOT)).stdout)
        assert closed['memory_max']=='8388608' and closed['memory_swap_max']=='0'
        assert closed['returncode']==-9 and closed['oom']>=1 and closed['oom_kill']>=1 and closed['timed_out'] is False
    finally:
        sudo('swapoff',str(swap), check=False)
        sudo('rm','-f',str(swap))
        sudo('rmdir','/sys/fs/cgroup/studio-gate-swap-on', check=False)
        sudo('rmdir','/sys/fs/cgroup/studio-gate-swap-off', check=False)
        after=sudo('awk','/SwapTotal/{print $2}','/proc/meminfo').stdout.strip()
        assert after==before

def test_auth_probe_does_not_need_httpx(tmp_path):
    from tools.studio_gates import asgi_status
    import hashlib
    from reader_service.studio_api import create_app
    from reader_service.studio_store import StudioSettings
    token='A'*48
    app=create_app(StudioSettings(tmp_path/'auth', {hashlib.sha256(token.encode()).hexdigest():'ann'}, origins=('https://studio.example',)))
    assert asgi_status(app, 'GET', '/api/studio/skills')==401
    assert asgi_status(app, 'POST', '/api/studio/jobs', {'authorization':'Bearer '+token,'content-type':'application/json'}, b'{"skill":"grill-me","brief":"no"}')==403
