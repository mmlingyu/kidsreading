"""Budget stop is a distinct, bounded failure. The file gate stays closed."""
import json, subprocess
from pathlib import Path
from reader_service.gateway import MODEL_CALLS, OUTPUT_CAPS, Broker
from reader_service.sandbox_entry import OUTPUT_CAPS as ENTRY_CAPS
from reader_service.sandbox_entry import requested_cap
from reader_service.studio_prompts import continuation, initial
from reader_service.studio_review import review
from reader_service.studio_store import StudioSettings, StudioStore
from reader_service.studio_worker import MAX_CONTINUATIONS, OUTPUT_CAP, StudioWorker, output_cap
from test_studio import html_ok, settings, travel_html

SECRET='sk-LIVE-SECRET-NOT-FOR-ERRORS'


def _enable(monkeypatch):
    monkeypatch.setenv('STUDIO_ENABLE_GENERATION','1')
    monkeypatch.setattr('reader_service.studio_worker.accepted', lambda path=None: True)

def _reason(work, reason):
    (work/'agent-result.json').write_text(json.dumps({'finish_reason':reason,'note':SECRET}), encoding='utf-8')

def _report():
    return '关卡、门类型和验收都已写明。'*6

class Script(StudioWorker):
    def __init__(self, store, steps):
        super().__init__(store)
        self.steps=list(steps)
        self.prompts=[]
    def start_agent(self, work, prompt):
        self.prompts.append(prompt)
        action=self.steps.pop(0)
        proc=action(work)
        if proc is not None:
            return proc
        class Done:
            def poll(self): return 0
            def wait(self, timeout=None): return 0
        return Done()

def _no_files(reason):
    def step(work):
        _reason(work, reason)
    return step

def _partial(work):
    (work/'outputs'/'preview.html').write_text('x'*40, encoding='utf-8')
    _reason(work, 'max-tokens')

def _valid(skill):
    def step(work):
        page=travel_html() if skill=='knowledge-travel' else html_ok()
        (work/'outputs'/'preview.html').write_text(page, encoding='utf-8')
        (work/'outputs'/'report.md').write_text(_report(), encoding='utf-8')
        _reason(work, 'stop')
    return step

def _assert_clean(store, row):
    done=store.get('ann', row['id'])
    blob=done['error']+' '+(done['review'] or '')
    assert SECRET not in blob
    assert 'LIVE' not in blob
    return done

def test_caps_stay_inside_the_model_and_the_old_skills():
    assert ENTRY_CAPS==OUTPUT_CAPS==(8192, 16384)
    assert MODEL_CALLS==12 and MAX_CONTINUATIONS==2
    assert output_cap('html-builder')==8192 and output_cap('zdog')==8192
    assert output_cap('knowledge-travel')==16384
    assert set(OUTPUT_CAP)=={'html-builder','zdog','knowledge-travel'}
    assert requested_cap({})==8192
    assert requested_cap({'max_tokens':16384})==16384
    assert requested_cap({'max_tokens':999999})==8192
    assert requested_cap({'max_tokens':'16384'})==8192

def test_knowledge_travel_prompt_keeps_the_skill_and_does_not_paste_a_page():
    import hashlib
    from reader_service.sandbox import ROOT
    text=initial('knowledge-travel','恐龙怎么走路')
    assert 'SKILL.md' in text and 'reference.md' in text and 'examples.md' in text
    assert 'levelHasKnowledge' in text and 'outputs/preview.html' in text
    assert '<html' not in text.lower() and '<canvas' not in text.lower()
    assert 'levelHasKnowledge' not in initial('html-builder','一个按钮')
    follow=continuation('knowledge-travel')
    assert 'max-tokens' in follow and '固定模板' in follow and SECRET not in follow
    assert '<html' not in follow.lower()
    for name, digest in {
        'SKILL.md':'0d63b2465328ba3dbf56c754dea786f84d4b883451adfb6f756882cc6612fd31',
        'examples.md':'376023d3d801cfaca75e1b05b09592527ff5dbcce4b1d5200ff090e31b1bc107',
        'reference.md':'64d22048d8189be42d6a5d4a1faa03946fa5679b18be8f74d81bef6463e23a81',
    }.items():
        body=(ROOT/'skills'/'html-skills'/'knowledge-travel'/name).read_bytes()
        assert hashlib.sha256(body).hexdigest()==digest

def test_missing_or_short_files_still_fail_closed(tmp_path):
    work=tmp_path/'job'
    (work/'outputs').mkdir(parents=True)
    missing=review(work, 'knowledge-travel')
    assert missing['passed'] is False
    assert missing['errors']==['report_too_small_or_unsafe','preview_too_small_or_unsafe']
    assert missing['evidence']==[]
    (work/'outputs'/'preview.html').write_text('x'*79, encoding='utf-8')
    (work/'outputs'/'report.md').write_text('y'*79, encoding='utf-8')
    short=review(work, 'knowledge-travel')
    assert short['errors']==['report_too_small_or_unsafe','preview_too_small_or_unsafe']

def test_max_tokens_without_files_recovers_once_then_stops(tmp_path, monkeypatch):
    _enable(monkeypatch)
    store=StudioStore(settings(tmp_path))
    row=store.create('ann', {'skill':'knowledge-travel','brief':'恐龙'})
    worker=Script(store, [_no_files('max-tokens'), _valid('knowledge-travel')])
    worker.run_one(row)
    done=_assert_clean(store, row)
    assert done['status']=='ready', done['error']
    assert len(worker.prompts)==2 and 'max-tokens' in worker.prompts[1]
    with store.db() as db:
        assert db.execute('SELECT COUNT(*) c FROM jobs').fetchone()['c']==1

def test_partial_files_can_be_finished_inside_the_same_job(tmp_path, monkeypatch):
    _enable(monkeypatch)
    store=StudioStore(settings(tmp_path))
    row=store.create('ann', {'skill':'knowledge-travel','brief':'恐龙'})
    worker=Script(store, [_partial, _valid('knowledge-travel')])
    worker.run_one(row)
    done=_assert_clean(store, row)
    assert done['status']=='ready'
    assert (store.jobdir(row['id'])/'published'/'preview.html').is_file()

def test_exhausted_max_tokens_is_budget_not_the_size_gate(tmp_path, monkeypatch):
    _enable(monkeypatch)
    store=StudioStore(settings(tmp_path))
    row=store.create('ann', {'skill':'knowledge-travel','brief':'恐龙'})
    worker=Script(store, [_no_files('max-tokens') for _ in range(3)])
    worker.run_one(row)
    done=_assert_clean(store, row)
    assert done['status']=='failed' and done['error']=='studio_generation_budget'
    assert 'too_small' not in done['error'] and 'unsafe' not in done['error']
    saved=json.loads(done['review'])
    assert saved['errors']==['report_too_small_or_unsafe','preview_too_small_or_unsafe']
    assert saved['evidence']==['stop max-tokens']
    assert len(worker.prompts)==3
    assert not (store.jobdir(row['id'])/'published').exists()

def test_normal_stop_without_files_stays_a_review_failure(tmp_path, monkeypatch):
    _enable(monkeypatch)
    store=StudioStore(settings(tmp_path))
    row=store.create('ann', {'skill':'html-builder','brief':'按钮'})
    worker=Script(store, [_no_files('stop')])
    worker.run_one(row)
    done=_assert_clean(store, row)
    assert done['error']=='studio_review_failed'
    assert len(worker.prompts)==1

def test_short_files_are_not_called_a_budget_stop(tmp_path, monkeypatch):
    _enable(monkeypatch)
    store=StudioStore(settings(tmp_path))
    row=store.create('ann', {'skill':'html-builder','brief':'按钮'})
    def short(work):
        (work/'outputs'/'preview.html').write_text('x'*79, encoding='utf-8')
        (work/'outputs'/'report.md').write_text('y'*90, encoding='utf-8')
        _reason(work, 'stop')
    worker=Script(store, [short])
    worker.run_one(row)
    assert _assert_clean(store, row)['error']=='studio_review_failed'
    assert len(worker.prompts)==1

def test_accepted_skill_with_files_publishes_even_if_the_turn_hit_max_tokens(tmp_path, monkeypatch):
    _enable(monkeypatch)
    store=StudioStore(settings(tmp_path))
    for skill in ('html-builder','zdog'):
        row=store.create('ann', {'skill':skill,'brief':'已写完'})
        def done(work, skill=skill):
            page=html_ok() if skill=='html-builder' else __import__('test_studio', fromlist=['zdog_html']).zdog_html()
            (work/'outputs'/'preview.html').write_text(page, encoding='utf-8')
            (work/'outputs'/'report.md').write_text(_report(), encoding='utf-8')
            _reason(work, 'max-tokens')
        worker=Script(store, [done])
        worker.run_one(row)
        assert _assert_clean(store, row)['status']=='ready'
        assert len(worker.prompts)==1

def test_unsafe_output_is_not_retried_or_copied_into_the_error(tmp_path, monkeypatch):
    _enable(monkeypatch)
    store=StudioStore(settings(tmp_path))
    row=store.create('ann', {'skill':'html-builder','brief':'坏'})
    def danger(work):
        page=html_ok('<script>eval(atob("'+SECRET+'"))</script>')
        (work/'outputs'/'preview.html').write_text(page, encoding='utf-8')
        (work/'outputs'/'report.md').write_text(_report(), encoding='utf-8')
        _reason(work, 'max-tokens')
    worker=Script(store, [danger, _valid('html-builder')])
    worker.run_one(row)
    done=_assert_clean(store, row)
    assert done['error']=='studio_review_failed'
    assert 'html_scan_danger' in done['review']
    assert len(worker.prompts)==1

def test_provider_error_does_not_continue_or_publish(tmp_path, monkeypatch):
    _enable(monkeypatch)
    store=StudioStore(settings(tmp_path))
    row=store.create('ann', {'skill':'knowledge-travel','brief':'恐龙'})
    def bad(work):
        (work/'outputs'/'preview.html').write_text(travel_html(), encoding='utf-8')
        (work/'outputs'/'report.md').write_text(_report(), encoding='utf-8')
        _reason(work, 'error')
    worker=Script(store, [bad, _valid('knowledge-travel')])
    worker.run_one(row)
    done=_assert_clean(store, row)
    assert done['status']=='failed' and done['error']=='studio_generation_failed'
    assert not (store.jobdir(row['id'])/'published').exists()
    assert len(worker.prompts)==1

def test_cancel_during_continuation_does_not_become_ready(tmp_path, monkeypatch):
    _enable(monkeypatch)
    store=StudioStore(settings(tmp_path))
    row=store.create('ann', {'skill':'knowledge-travel','brief':'取消'})
    def cancel(work):
        _reason(work, 'max-tokens')
        store.cancel('ann', row['id'])
    worker=Script(store, [_no_files('max-tokens'), cancel, _valid('knowledge-travel')])
    worker.run_one(row)
    done=store.get('ann', row['id'])
    assert done['status']=='cancelled'
    assert not (store.jobdir(row['id'])/'published').exists()
    assert len(worker.prompts)==2

def test_deadline_and_progress_stop_a_continuation(tmp_path, monkeypatch):
    _enable(monkeypatch)
    monkeypatch.setenv('STUDIO_JOB_TIMEOUT','1')
    monkeypatch.setenv('STUDIO_PROGRESS_TIMEOUT','30')
    store=StudioStore(settings(tmp_path))
    row=store.create('ann', {'skill':'knowledge-travel','brief':'总时限'})
    def sleep(work):
        _reason(work, 'max-tokens')
        return subprocess.Popen(['sleep','30'], start_new_session=True)
    worker=Script(store, [_no_files('max-tokens'), sleep])
    worker.run_one(row)
    assert store.get('ann', row['id'])['error']=='studio_deadline'
    monkeypatch.setenv('STUDIO_JOB_TIMEOUT','30')
    monkeypatch.setenv('STUDIO_PROGRESS_TIMEOUT','1')
    row=store.create('ann', {'skill':'knowledge-travel','brief':'没有新产物'})
    worker=Script(store, [_no_files('max-tokens'), sleep])
    worker.run_one(row)
    assert store.get('ann', row['id'])['error']=='studio_progress_timeout'

def test_control_file_uses_one_broker_and_the_skill_cap(tmp_path, monkeypatch):
    _enable(monkeypatch)
    store=StudioStore(settings(tmp_path))
    worker=StudioWorker(store, model_key=SECRET)
    controls=[]
    gateways=[]
    def start_gateway(self, row, key):
        gateways.append(output_cap(row['skill']))
        assert key==SECRET
        return tmp_path/'missing.sock', None
    def fake_spawn(args):
        assert all(SECRET not in str(part) for part in args)
        work=None
        for index, part in enumerate(args):
            if part=='--bind' and args[index+2]=='/work':
                work=Path(args[index+1])
        control=json.loads((work/'control.json').read_text(encoding='utf-8'))
        controls.append(control)
        assert SECRET not in control['prompt']
        if control['max_tokens']==16384 and len(controls)==2:
            (work/'outputs'/'preview.html').write_text(travel_html(), encoding='utf-8')
            (work/'outputs'/'report.md').write_text(_report(), encoding='utf-8')
            (work/'agent-result.json').write_text('{"finish_reason":"stop"}', encoding='utf-8')
        elif control['max_tokens']==8192:
            (work/'outputs'/'preview.html').write_text(html_ok(), encoding='utf-8')
            (work/'outputs'/'report.md').write_text(_report(), encoding='utf-8')
            (work/'agent-result.json').write_text('{"finish_reason":"max-tokens"}', encoding='utf-8')
        else:
            (work/'agent-result.json').write_text('{"finish_reason":"max-tokens"}', encoding='utf-8')
        class Done:
            def poll(self): return 0
            def wait(self, timeout=None): return 0
        return Done()
    monkeypatch.setattr(StudioWorker, 'start_gateway', start_gateway)
    monkeypatch.setattr('reader_service.studio_worker.spawn', fake_spawn)
    travel=store.create('ann', {'skill':'knowledge-travel','brief':'恐龙'})
    worker.run_one(travel)
    assert store.get('ann', travel['id'])['status']=='ready'
    assert gateways==[16384]
    assert [item['resume'] for item in controls]==[False, True]
    assert [item['max_tokens'] for item in controls]==[16384, 16384]
    built=store.create('ann', {'skill':'html-builder','brief':'按钮'})
    worker.run_one(built)
    assert store.get('ann', built['id'])['status']=='ready'
    assert gateways==[16384, 8192]
    assert controls[-1]['max_tokens']==8192 and controls[-1]['resume'] is False
    blob=''.join(path.read_text(encoding='utf-8', errors='replace') for path in store.jobdir(travel['id']).rglob('*') if path.is_file())
    assert SECRET not in blob

def test_broker_cap_cannot_be_raised_by_the_request(tmp_path):
    import socket, threading
    path=tmp_path/'model.sock'
    class Response:
        headers={'Content-Type':'application/json'}
        def __enter__(self): return self
        def __exit__(self,*_): pass
        def read(self,_): return b'{"ok":true}'
    class Opener:
        def __init__(self): self.calls=[]
        def open(self, request, timeout):
            self.calls.append(json.loads(request.data))
            return Response()
    opener=Opener()
    with Broker(path,'FAKE-TEST-KEY',opener=opener,max_tokens=16384) as broker:
        thread=threading.Thread(target=broker.serve_forever, daemon=True); thread.start()
        try:
            body=json.dumps({'messages':[],'max_tokens':999999,'output_config':{'effort':'max'},
                             'thinking':{'type':'enabled','budget_tokens':99999}}).encode()
            def once():
                with socket.socket(socket.AF_UNIX) as sock:
                    sock.connect(str(path))
                    sock.sendall(f'POST /v1/messages HTTP/1.0\r\nHost: broker\r\nContent-Length: {len(body)}\r\n\r\n'.encode()+body)
                    out=b''
                    while True:
                        chunk=sock.recv(65536)
                        if not chunk: break
                        out+=chunk
                    return out
            for _ in range(MODEL_CALLS):
                assert b'200 OK' in once()
            assert b'429' in once()
            assert len(opener.calls)==MODEL_CALLS
            for payload in opener.calls:
                assert payload['max_tokens']==16384 and payload['model']=='deepseek-flash'
                assert 'output_config' not in payload and 'api_key' not in payload
                assert payload['thinking']['budget_tokens']==2048
        finally:
            broker.shutdown(); thread.join()
    other=Broker(tmp_path/'other.sock','FAKE',max_tokens=999999)
    try:
        assert other.max_tokens==8192
    finally:
        other.server_close()

def test_page_names_the_budget_stop_without_rendering_html(tmp_path):
    from fastapi.testclient import TestClient
    from reader_service.studio_api import create_app
    with TestClient(create_app(settings(tmp_path))) as client:
        script=client.get('/studio/app.js').text
    assert 'studio_generation_budget' in script
    assert '生成达到本次输出预算' in script
    assert 'innerHTML' not in script and 'localStorage' not in script
