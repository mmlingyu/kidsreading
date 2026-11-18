import hashlib, json, os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from reader_service.api import create_app
from reader_service.core import Fault, Settings
from reader_service.sandbox import ROOT
from reader_service.studio_api import create_app as studio_app
from reader_service.studio_store import StudioSettings, StudioStore
from reader_service.studio_worker import StudioWorker

TOKEN_A='A'*48
TOKEN_B='B'*48
OWNERS={hashlib.sha256(TOKEN_A.encode()).hexdigest():'ann', hashlib.sha256(TOKEN_B.encode()).hexdigest():'bo'}

def settings(tmp_path):
    return StudioSettings(tmp_path/'studio', OWNERS, origins=('https://studio.example',), enable=False)

def client(tmp_path):
    return TestClient(studio_app(settings(tmp_path)))

def html_ok(extra=''):
    return '<!doctype html><html><body><p>local only page for a sandboxed preview.</p>'+extra+'</body></html>'

class Writer(StudioWorker):
    def __init__(self, store, html):
        super().__init__(store)
        self.html=html
    def start_agent(self, work, prompt):
        (work/'outputs'/'preview.html').write_text(self.html, encoding='utf-8')
        (work/'outputs'/'report.md').write_text('结构、交互、依赖和验证都已写明。'*6, encoding='utf-8')
        class Done:
            def wait(self, timeout=None): return 0
            def poll(self): return 0
        return Done()

def zdog_html():
    marker=(ROOT/'skills'/'html-skills'/'zdog'/'vendor'/'zdog.dist.min.js').read_text(encoding='utf-8')
    return html_ok('<canvas class="zdog-canvas"></canvas><script>'+marker+'</script><script>new Zdog.Illustration({dragRotate:true});requestAnimationFrame(function(){})</script>')

def travel_html():
    return html_ok('<canvas></canvas><script type="application/json" id="game-spec">{}</script><script>function levelHasKnowledge(){return false} requestAnimationFrame(function(){}); addEventListener("keydown",e=>{if(e.key=="ArrowRight"){}})</script>')

@pytest.mark.parametrize('skill,html', [
    ('html-builder', html_ok()),
    ('zdog', None),
    ('knowledge-travel', None),
])
def test_enabled_skills_publish_only_after_review(tmp_path, skill, html, monkeypatch):
    monkeypatch.setenv('STUDIO_ENABLE_GENERATION','1')
    monkeypatch.setattr('reader_service.studio_worker.accepted', lambda path=None: True)
    store=StudioStore(settings(tmp_path))
    row=store.create('ann', {'skill':skill,'brief':'做一个可点击的小页面'})
    page=zdog_html() if skill=='zdog' else travel_html() if skill=='knowledge-travel' else html
    Writer(store, page).run_one(row)
    done=store.get('ann', row['id'])
    assert done['status']=='ready', done['error']
    published=store.jobdir(row['id'])/'published'
    assert sorted(p.name for p in published.iterdir())==['preview.html','report.md']

def test_model_key_is_kept_for_the_next_job_and_kept_out_of_children(tmp_path, monkeypatch):
    sentinel='SENTINEL-NOT-A-REAL-KEY'
    monkeypatch.setenv('DEEPSEEK_API_KEY', sentinel)
    monkeypatch.setenv('STUDIO_ENABLE_GENERATION','1')
    monkeypatch.setattr('reader_service.studio_worker.accepted', lambda path=None: True)
    short=Path('/tmp/studio-key-reuse')
    if short.exists():
        import shutil; shutil.rmtree(short)
    short.mkdir()
    store=StudioStore(settings(short))
    worker=StudioWorker(store)
    assert 'DEEPSEEK_API_KEY' not in os.environ
    seen=[]
    def fake_spawn(args):
        assert all(sentinel not in str(part) for part in args)
        work=None
        for index, part in enumerate(args):
            if part=='--bind' and args[index+2]=='/work':
                work=Path(args[index+1])
        (work/'outputs'/'preview.html').write_text(html_ok(), encoding='utf-8')
        (work/'outputs'/'report.md').write_text('结构、交互、依赖和验证都已写明。'*6, encoding='utf-8')
        class Done:
            def poll(self): return 0
            def wait(self, timeout=None): return 0
        return Done()
    monkeypatch.setattr('reader_service.studio_worker.spawn', fake_spawn)
    real=StudioWorker.start_gateway
    def wrap(self, row, key):
        seen.append(key)
        sock, broker=real(self, row, key)
        blob=Path(f'/proc/{broker.pid}/environ').read_bytes()+Path(f'/proc/{broker.pid}/cmdline').read_bytes()
        assert sentinel.encode() not in blob
        return sock, broker
    monkeypatch.setattr(StudioWorker, 'start_gateway', wrap)
    for brief in ('第一页', '第二页'):
        row=store.create('ann', {'skill':'html-builder','brief':brief})
        worker.run_one(row)
        done=store.get('ann', row['id'])
        assert done['status']=='ready', done['error']
        blob=''.join(path.read_text(encoding='utf-8', errors='replace') for path in store.jobdir(row['id']).rglob('*') if path.is_file())
        assert sentinel not in blob
    assert seen==[sentinel, sentinel]
    monkeypatch.setenv('DEEPSEEK_API_KEY', sentinel)
    restarted=StudioWorker(store)
    assert restarted.model_key==sentinel
    assert 'DEEPSEEK_API_KEY' not in os.environ

def test_danger_symlink_and_missing_report_fail(tmp_path, monkeypatch):
    monkeypatch.setenv('STUDIO_ENABLE_GENERATION','1')
    monkeypatch.setattr('reader_service.studio_worker.accepted', lambda path=None: True)
    store=StudioStore(settings(tmp_path))
    row=store.create('ann', {'skill':'html-builder','brief':'bad'})
    class Bad(Writer):
        def start_agent(self, work, prompt):
            (work/'outputs'/'preview.html').write_text(html_ok('<script>eval(atob("YQ=="))</script>'), encoding='utf-8')
            (work/'outputs'/'report.md').write_text('x'*90, encoding='utf-8')
            class Done:
                def wait(self, timeout=None): return 0
                def poll(self): return 0
            return Done()
    Bad(store, '').run_one(row)
    assert store.get('ann', row['id'])['error']=='studio_review_failed'
    row=store.create('ann', {'skill':'html-builder','brief':'link'})
    class Link(Writer):
        def start_agent(self, work, prompt):
            target=work/'outside.html'
            target.write_text(html_ok(), encoding='utf-8')
            (work/'outputs'/'preview.html').symlink_to(target)
            (work/'outputs'/'report.md').write_text('x'*90, encoding='utf-8')
            class Done:
                def wait(self, timeout=None): return 0
                def poll(self): return 0
            return Done()
    Link(store, '').run_one(row)
    assert store.get('ann', row['id'])['status']=='failed'

@pytest.mark.parametrize('skill', ['spdesign','3d-game-dev','creation-engine','grill-me'])
def test_blocked_skills_do_not_start(tmp_path, skill):
    store=StudioStore(settings(tmp_path))
    with pytest.raises(Fault) as caught:
        store.create('ann', {'skill':skill,'brief':'不要启动'})
    assert caught.value.code=='studio_skill_blocked'

def test_cross_owner_quota_cancel_and_artifact_headers(tmp_path, monkeypatch):
    monkeypatch.setenv('STUDIO_ENABLE_GENERATION','1')
    monkeypatch.setattr('reader_service.studio_worker.accepted', lambda path=None: True)
    app=studio_app(settings(tmp_path))
    headers={'Authorization':'Bearer '+TOKEN_A}
    other={'Authorization':'Bearer '+TOKEN_B}
    with TestClient(app) as c:
        assert c.get('/api/studio/skills').status_code==401
        denied=c.post('/api/studio/jobs', json={'skill':'html-builder','brief':'x','url':'https://evil'}, headers=headers)
        assert denied.status_code==400
        created=c.post('/api/studio/jobs', json={'skill':'html-builder','brief':'一个按钮'}, headers=headers)
        assert created.status_code==202
        job=created.json()['id']
        assert c.get('/api/studio/jobs/'+job, headers=other).status_code==404
        store=app.state.store
        store.s.max_hour=1
        store.s.max_running=5
        assert c.post('/api/studio/jobs', json={'skill':'html-builder','brief':'第二个'}, headers=headers).status_code==429
        Writer(store, html_ok()).run_one(store.get('ann', job))
        downloaded=c.get('/api/studio/jobs/'+job+'/files/preview.html', headers=headers)
        assert downloaded.status_code==200
        assert downloaded.headers['content-disposition'].startswith('attachment')
        assert downloaded.headers['content-security-policy']=='sandbox'
        assert TOKEN_A not in downloaded.text
        assert c.post('/api/studio/jobs/'+job+'/cancel', headers=headers).json()['status']=='ready'
        fresh=c.post('/api/studio/jobs', json={'skill':'zdog','brief':'取消这个'}, headers=headers)
        # hour quota already consumed; raise the hour cap for the cancel path
        store.s.max_hour=3
        fresh=c.post('/api/studio/jobs', json={'skill':'zdog','brief':'取消这个'}, headers=headers)
        assert c.post('/api/studio/jobs/'+fresh.json()['id']+'/cancel', headers=headers).json()['status']=='cancelled'

def test_workbench_iframe_cannot_share_origin_or_token(tmp_path):
    with TestClient(studio_app(settings(tmp_path))) as c:
        page=c.get('/studio/')
        script=c.get('/studio/app.js')
    html=page.text
    assert 'sandbox="allow-scripts"' in html
    assert 'allow-same-origin' not in html
    assert 'postMessage' not in html and 'postMessage' not in script.text
    assert 'localStorage' not in script.text
    assert 'innerHTML' not in script.text

def test_reader_app_has_no_studio_route(tmp_path):
    app=create_app(Settings(tmp_path, {hashlib.sha256(TOKEN_A.encode()).hexdigest():'ann'}))
    with TestClient(app) as c:
        assert c.get('/api/studio/skills').status_code==404

def test_cancel_around_completion_does_not_become_ready(tmp_path, monkeypatch):
    import subprocess, threading
    monkeypatch.setenv('STUDIO_ENABLE_GENERATION','1')
    monkeypatch.setenv('STUDIO_JOB_TIMEOUT','5')
    monkeypatch.setenv('STUDIO_PROGRESS_TIMEOUT','5')
    monkeypatch.setattr('reader_service.studio_worker.accepted', lambda path=None: True)
    store=StudioStore(settings(tmp_path))
    row=store.create('ann', {'skill':'html-builder','brief':'取消进行中的任务'})
    class Slow(StudioWorker):
        def start_agent(self, work, prompt, sock=None):
            return subprocess.Popen(['sleep','30'], start_new_session=True)
    def cancel():
        import time
        time.sleep(.2)
        store.cancel('ann', row['id'])
    threading.Thread(target=cancel).start()
    Slow(store).run_one(row)
    assert store.get('ann', row['id'])['status']=='cancelled'
    row=store.create('ann', {'skill':'html-builder','brief':'完成前取消'})
    class Late(Writer):
        def start_agent(self, work, prompt, sock=None):
            store.cancel('ann', row['id'])
            return super().start_agent(work, prompt)
    Late(store, html_ok()).run_one(row)
    done=store.get('ann', row['id'])
    assert done['status']=='cancelled'
    assert not (store.jobdir(row['id'])/'published'/'preview.html').exists()

def test_deadline_and_progress_stop_the_process_tree(tmp_path, monkeypatch):
    import subprocess
    monkeypatch.setenv('STUDIO_ENABLE_GENERATION','1')
    monkeypatch.setattr('reader_service.studio_worker.accepted', lambda path=None: True)
    store=StudioStore(settings(tmp_path))
    monkeypatch.setenv('STUDIO_JOB_TIMEOUT','1')
    monkeypatch.setenv('STUDIO_PROGRESS_TIMEOUT','30')
    row=store.create('ann', {'skill':'html-builder','brief':'总时限'})
    class Tree(StudioWorker):
        def start_agent(self, work, prompt, sock=None):
            return subprocess.Popen(['bash','-c','sleep 30 & wait'], start_new_session=True)
    worker=Tree(store)
    worker.run_one(row)
    assert store.get('ann', row['id'])['error']=='studio_deadline'
    monkeypatch.setenv('STUDIO_JOB_TIMEOUT','30')
    monkeypatch.setenv('STUDIO_PROGRESS_TIMEOUT','1')
    row=store.create('ann', {'skill':'html-builder','brief':'没有新产物'})
    Tree(store).run_one(row)
    assert store.get('ann', row['id'])['error']=='studio_progress_timeout'

def test_generation_stays_off_without_acceptance(tmp_path, monkeypatch):
    monkeypatch.delenv('STUDIO_ENABLE_GENERATION', raising=False)
    store=StudioStore(settings(tmp_path))
    row=store.create('ann', {'skill':'html-builder','brief':'关闭时不要生成'})
    StudioWorker(store).run_one(row)
    assert store.get('ann', row['id'])['error']=='studio_generation_disabled'
