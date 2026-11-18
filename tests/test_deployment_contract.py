import json
from reader_service.sandbox import ROOT

def test_production_unit_compatibility_and_acceptance_default_closed():
    worker=(ROOT/'deploy/reader-worker.service').read_text()
    for required in ['User=reader-worker','AF_NETLINK','ProtectKernelTunables=false','ProtectControlGroups=true',
                     'MemoryMax=768M','MemorySwapMax=0','TasksMax=64','CPUQuota=100%',
                     'KillMode=control-group','OOMPolicy=kill','BindsTo=var-lib-reader-jobs.mount']:
        assert required in worker
    gate=json.loads((ROOT/'deploy/accepted.json.example').read_text())
    for key,value in gate.items():
        if key!='trusted_manifest_sha256':assert value is False
    assert 'READER_ENABLE_GENERATION=0' in (ROOT/'deploy/worker.env.example').read_text()
    assert 'DEEPSEEK_API_KEY' not in (ROOT/'deploy/api.env.example').read_text()
    mount=(ROOT/'deploy/var-lib-reader-jobs.mount').read_text()
    assert 'Options=loop,nodev,nosuid,noexec' in mount
    assert 'api/tts' not in (ROOT/'deploy/switch.sh').read_text()


def test_uuid_smoke_fixture_fits_linux_unix_socket_limit():
    import re
    from pathlib import Path
    root=Path(__file__).resolve().parent.parent
    unit=(root/'deploy/reader-noexec-smoke@.service').read_text()
    data=re.search(r'--data ([^\s]+)',unit).group(1).replace('%i','a'*32)
    assert len(str(Path(data)/'run'/('b'*32+'.sock')).encode())<=107
    script=(root/'deploy/run-noexec-smoke.sh').read_text()
    assert 'BASE=/var/lib/reader/jobs/.r4-$ID' in script
    assert r"r'\.r4-[a-f0-9]{32}'" in script
