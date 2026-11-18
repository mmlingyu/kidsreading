import os,sys,tempfile
from pathlib import Path
import pytest
from tools.noexec_smoke import run_probe

def test_real_sdk_noexec_first_run_resume_two_repairs_cancel_and_restart(sdk_static_cache):
    if sdk_static_cache is None:pytest.skip('installed SDK and bwrap required')
    parent=Path('/dev/shm')
    if not parent.exists() or not os.statvfs(parent).f_flag&os.ST_NOEXEC:pytest.skip('real noexec mount unavailable')
    result=run_probe(parent,Path(sys.prefix),sdk_static_cache,require_root=False)
    assert result['quality_repairs']==2 and result['real_sdk_inflight_cancel']
