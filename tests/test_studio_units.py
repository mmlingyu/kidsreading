"""systemd unit names and the skill mount the worker actually gives bwrap."""
import os, subprocess
from pathlib import Path
import pytest
from reader_service.sandbox import ROOT, command
from reader_service.studio_store import StudioSettings, StudioStore
from reader_service.studio_worker import StudioWorker

DEPLOY=ROOT/'deploy'

def test_packaged_mount_name_matches_where_and_services_follow_it():
    bad=DEPLOY/'studio-jobs.mount'
    good=DEPLOY/'var-lib-studio-jobs.mount'
    assert not bad.exists()
    where=[line.split('=',1)[1] for line in good.read_text().splitlines() if line.startswith('Where=')][0]
    escaped=subprocess.check_output(['systemd-escape','-p','--suffix=mount', where], text=True).strip()
    assert escaped==good.name=='var-lib-studio-jobs.mount'
    passed=subprocess.run(['systemd-analyze','verify', str(good)], capture_output=True, text=True)
    assert passed.returncode==0, passed.stderr
    renamed=Path('/tmp/studio-jobs.mount')
    renamed.write_text(good.read_text())
    refused=subprocess.run(['systemd-analyze','verify', str(renamed)], capture_output=True, text=True)
    assert refused.returncode!=0
    assert "Where= setting doesn't match unit name" in refused.stderr
    api=(DEPLOY/'studio-api.service').read_text()
    worker=(DEPLOY/'studio-worker.service').read_text()
    for text in (api, worker):
        assert 'Requires=var-lib-studio-jobs.mount' in text
        assert 'Requires=studio-jobs.mount' not in text
        assert 'After=network.target studio-jobs.mount' not in text
    assert 'Environment=READER_RUNTIME_CACHE=/opt/reader-runtime-cache-0.2.2rc2' in worker
    assert 'DEEPSEEK_API_KEY' not in api
    shipped=subprocess.run(['systemd-analyze','verify', str(DEPLOY/'studio-api.service'), str(DEPLOY/'studio-worker.service'), str(good)], capture_output=True, text=True)
    assert shipped.returncode!=0
    assert "Where= setting doesn't match unit name" not in shipped.stderr
    assert 'Command /opt/reader-runtime/bin/python is not executable' in shipped.stderr

def test_worker_binds_each_html_skill_and_not_the_reader_default(tmp_path, monkeypatch):
    store=StudioStore(StudioSettings(tmp_path/'studio', {'a':'ann'}))
    worker=StudioWorker(store, model_key='unused')
    seen={}
    def fake_spawn(args):
        seen['args']=args
        class Done:
            def poll(self): return 0
            def wait(self, timeout=None): return 0
        return Done()
    monkeypatch.setattr('reader_service.studio_worker.spawn', fake_spawn)
    for skill in ('html-builder','zdog','knowledge-travel'):
        work=tmp_path/skill
        (work/'tmp').mkdir(parents=True)
        (work/'outputs').mkdir()
        (work/'sock').write_bytes(b'')
        worker.current_skill=skill
        worker.start_agent(work, 'prompt', work/'sock')
        args=seen['args']
        assert str(ROOT/'skills'/'html-skills'/skill) in args
        assert str(ROOT/'skills'/'adventure-reader') not in args
        assert '/skill' in args

def test_bwrap_reads_the_three_skill_files_and_the_reader_default(tmp_path):
    if not os.path.exists('/usr/bin/bwrap') or not Path('/tmp/r4-venv/bin/python').exists():
        pytest.fail('bwrap and the test runtime are required')
    cache=tmp_path/'cache'
    (cache/'home').mkdir(parents=True)
    def mounted_name(skill):
        work=tmp_path/('work-'+str(skill))
        (work/'tmp').mkdir(parents=True)
        (work/'outputs').mkdir()
        sock=work/'sock'
        sock.write_bytes(b'')
        args=command(work, sock, runtime='/tmp/r4-venv', cache=cache, skill=skill)
        probe=args[:args.index('--')+1]+['/opt/reader-runtime/bin/python','-c',
            'print([line.split(":",1)[1].strip() for line in open("/skill/SKILL.md",encoding="utf-8") if line.startswith("name:")][0])']
        result=subprocess.run(probe, env={'PATH':'/usr/bin:/bin'}, capture_output=True, text=True, timeout=30)
        assert result.returncode==0, result.stderr
        return result.stdout.strip()
    assert mounted_name(None)=='adventure-reader'
    for skill in ('html-builder','zdog','knowledge-travel'):
        assert mounted_name('html-skills/'+skill)==skill
