"""The production runtime entry is a root-owned exec wrapper, not the venv path."""
import json, os, subprocess
from pathlib import Path
import pytest
from reader_service.sandbox import command

ROOT=Path(__file__).resolve().parents[1]
PY=os.environ.get('STUDIO_TEST_PYTHON','/tmp/r4-venv/bin/python')

def sudo(*args, check=True, input=None):
    return subprocess.run(['sudo','-n',*args], check=check, input=input, text=True, capture_output=True)

def wrapper_bytes(runtime):
    return f'#!/bin/sh\nexec {runtime}/venv/bin/python "$@"\n'.encode()

def test_trusted_wrapper_matches_venv_and_untrusted_entries_fail(tmp_path, monkeypatch):
    if sudo('true', check=False).returncode!=0:
        pytest.fail('sudo is required to build a root-owned runtime')
    runtime=Path('/tmp/studio-html6-runtime')
    sudo('rm','-rf',str(runtime))
    sudo('mkdir','-p',str(runtime/'bin'),str(runtime/'venv'/'bin'),str(runtime/'venv'/'lib'/'python3.12'))
    sudo('ln','-s','/tmp/r4-venv/lib/python3.12/site-packages',str(runtime/'venv'/'lib'/'python3.12'/'site-packages'))
    sudo('ln','-s','/usr/bin/python3.12',str(runtime/'venv'/'bin'/'python'))
    sudo('tee',str(runtime/'venv'/'pyvenv.cfg'), input='home = /usr/bin\ninclude-system-site-packages = false\nversion = 3.12\n')
    sudo('tee',str(runtime/'bin'/'python'), input=wrapper_bytes(runtime).decode())
    sudo('chown','-R','root:root',str(runtime))
    sudo('chmod','755',str(runtime/'bin'/'python'),str(runtime),str(runtime/'bin'),str(runtime/'venv'),str(runtime/'venv'/'bin'))
    monkeypatch.setenv('STUDIO_RUNTIME', str(runtime))
    monkeypatch.setenv('STUDIO_PYTHON_BIN', str(runtime/'bin'/'python'))
    from tools.studio_gates import describe_runtime
    report=describe_runtime(runtime/'bin'/'python')
    assert report['wrapper'] is True
    assert report['version'].startswith('3.12.')
    assert report['sdk']=='0.2.2rc2'
    assert report['fastapi']
    assert Path(report['prefix']).resolve()==(runtime/'venv').resolve()
    assert Path(report['executable']).resolve()==Path(PY).resolve()
    sudo('tee',str(runtime/'bin'/'python'), input='#!/bin/sh\nexec /usr/bin/python3 "$@"\n')
    sudo('chown','root:root',str(runtime/'bin'/'python'))
    sudo('chmod','755',str(runtime/'bin'/'python'))
    with pytest.raises(SystemExit, match='untrusted wrapper'):
        describe_runtime(runtime/'bin'/'python')
    sudo('tee',str(runtime/'bin'/'python'), input=wrapper_bytes(runtime).decode())
    sudo('chown','root:root',str(runtime/'bin'/'python'))
    sudo('chmod','666',str(runtime/'bin'/'python'))
    monkeypatch.setenv('STUDIO_PYTHON_BIN', str(runtime/'bin'/'python'))
    with pytest.raises(SystemExit, match='not root-owned and read-only'):
        describe_runtime(runtime/'bin'/'python')
    sudo('chmod','755',str(runtime/'bin'/'python'))
    sudo('chown','ubuntu:ubuntu',str(runtime/'bin'/'python'))
    with pytest.raises(SystemExit, match='not root-owned and read-only'):
        describe_runtime(runtime/'bin'/'python')
    sudo('chown','root:root',str(runtime/'bin'/'python'))

def test_wrapper_inside_bwrap_still_binds_each_html_skill(tmp_path):
    if not os.path.exists('/usr/bin/bwrap'):
        pytest.fail('bwrap is required')
    runtime=Path('/tmp/studio-html6-bwrap')
    sudo('rm','-rf',str(runtime))
    sudo('mkdir','-p',str(runtime/'bin'),str(runtime/'venv'/'bin'))
    sudo('ln','-s','/usr/bin/python3.12',str(runtime/'venv'/'bin'/'python'))
    sudo('tee',str(runtime/'bin'/'python'), input='#!/bin/sh\nexec /opt/reader-runtime/venv/bin/python "$@"\n')
    sudo('chown','-R','root:root',str(runtime))
    sudo('chmod','755',str(runtime/'bin'/'python'))
    cache=tmp_path/'cache'
    (cache/'home').mkdir(parents=True)
    for skill in ('html-builder','zdog','knowledge-travel'):
        work=tmp_path/skill
        (work/'tmp').mkdir(parents=True)
        (work/'outputs').mkdir()
        (work/'sock').write_bytes(b'')
        args=command(work, work/'sock', runtime=str(runtime), cache=cache, skill='html-skills/'+skill)
        probe=args[:args.index('--')+1]+['/opt/reader-runtime/bin/python','-c',
            'print([line.split(":",1)[1].strip() for line in open("/skill/SKILL.md",encoding="utf-8") if line.startswith("name:")][0])']
        result=subprocess.run(probe, env={'PATH':'/usr/bin:/bin'}, capture_output=True, text=True, timeout=30)
        assert result.returncode==0, result.stderr
        assert result.stdout.strip()==skill

def test_failure_diagnostic_is_not_a_signature(tmp_path):
    from tools.studio_gates import write_diagnostic
    evidence=tmp_path/'gate-evidence.json'
    write_diagnostic(evidence, {'source_parity_reviewed': True}, 'linux_py312_sdk_smoke: example')
    data=json.loads((tmp_path/'gate-diagnostic.json').read_text())
    assert data['signed'] is False and data['accepted'] is False
    assert data['failed']=='linux_py312_sdk_smoke'
    assert not evidence.exists()
    assert data.get('source_parity_reviewed') is not True or data['signed'] is False
