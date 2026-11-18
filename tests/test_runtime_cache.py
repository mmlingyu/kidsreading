import json,os,stat,sys
from pathlib import Path
import pytest
from reader_service.runtime_cache import verify_cache

def test_static_cache_is_complete_bounded_and_has_all_native_addons(sdk_static_cache):
    if sdk_static_cache is None:pytest.skip('installed SDK required')
    record=verify_cache(sdk_static_cache,Path(sys.prefix),require_root=False)
    assert record['bytes']<=128*1024*1024 and len(record['files'])<=10000
    names=list(record['files'])
    assert any('system.node' in n for n in names)
    assert any('pty.node' in n for n in names)
    assert any('.cache/narb/' in n and n.endswith('.node') for n in names)
    assert not any('.dsh' in n or 'session.v4' in n for n in names)

def test_nonroot_cache_is_not_accepted_as_production(sdk_static_cache):
    if sdk_static_cache is None:pytest.skip('installed SDK required')
    if sdk_static_cache.stat().st_uid==0:pytest.skip('external root-prepared cache; checked by standalone root probe')
    with pytest.raises(RuntimeError,match='root_readonly'):verify_cache(sdk_static_cache,Path(sys.prefix))

def test_cache_version_mismatch_rejected(tmp_path):
    (tmp_path/'home').mkdir();(tmp_path/'CACHE-SHA256.json').write_text(json.dumps({'runtime_sha256':'0'*64}))
    with pytest.raises(RuntimeError,match='version_mismatch'):verify_cache(tmp_path,Path(sys.prefix),require_root=False)
