"""One synthetic static cache per test session; never uses a provider or process credentials."""
import os,sys,shutil,tempfile
from pathlib import Path
import pytest

@pytest.fixture(scope='session',autouse=True)
def sdk_static_cache():
    old=os.environ.get('READER_RUNTIME_CACHE')
    if old and (Path(old)/'CACHE-SHA256.json').exists():yield Path(old);return
    try:import deepseek_harness
    except ImportError:yield None;return
    if not shutil.which('bwrap'):yield None;return
    from tools.sdk_cache import seed
    # Deliberately NOT pytest basetemp: basetemp may be on the noexec job mount.
    with tempfile.TemporaryDirectory(prefix='reader-static-cache-',dir='/workspace' if Path('/workspace').exists() else None) as tmp:
        cache=Path(tmp);seed(cache,Path(sys.prefix));os.environ['READER_RUNTIME_CACHE']=str(cache)
        try:yield cache
        finally:
            if old is None:os.environ.pop('READER_RUNTIME_CACHE',None)
            else:os.environ['READER_RUNTIME_CACHE']=old
