"""Real SDK, mocked model. Proves max-tokens leaves no file, and a later turn can."""
import json, shutil, subprocess, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import pytest
from reader_service import sandbox
from reader_service.gateway import Broker
from reader_service.studio_prompts import continuation, initial
from reader_service.studio_review import review

PAGE='<!doctype html><html><body><canvas></canvas><script type="application/json" id="game-spec">{}</script><script>function levelHasKnowledge(){return false} requestAnimationFrame(function(){}); addEventListener("keydown",e=>{if(e.key=="ArrowRight"){}})</script></body></html>'
REPORT='关卡、门类型和验收都已写明。'*6

def stream(stop, text):
    events=[
      ('message_start',{'type':'message_start','message':{'id':'fake','type':'message','role':'assistant','model':'deepseek-flash','content':[],'stop_reason':None,'stop_sequence':None,'usage':{'input_tokens':1,'output_tokens':0}}}),
      ('content_block_start',{'type':'content_block_start','index':0,'content_block':{'type':'thinking','thinking':''}}),
      ('content_block_delta',{'type':'content_block_delta','index':0,'delta':{'type':'thinking_delta','thinking':text}}),
      ('content_block_stop',{'type':'content_block_stop','index':0}),
      ('message_delta',{'type':'message_delta','delta':{'stop_reason':stop,'stop_sequence':None},'usage':{'output_tokens':8}}),
      ('message_stop',{'type':'message_stop'})]
    return _body(events)

def tool_stream(command):
    events=[
      ('message_start',{'type':'message_start','message':{'id':'fake-tool','type':'message','role':'assistant','model':'deepseek-flash','content':[],'stop_reason':None,'usage':{'input_tokens':1,'output_tokens':0}}}),
      ('content_block_start',{'type':'content_block_start','index':0,'content_block':{'type':'tool_use','id':'call-write','name':'bash','input':{}}}),
      ('content_block_delta',{'type':'content_block_delta','index':0,'delta':{'type':'input_json_delta','partial_json':json.dumps({'command':command})}}),
      ('content_block_stop',{'type':'content_block_stop','index':0}),
      ('message_delta',{'type':'message_delta','delta':{'stop_reason':'tool_use'},'usage':{'output_tokens':4}}),
      ('message_stop',{'type':'message_stop'})]
    return _body(events)

def _body(events):
    return ''.join('event: '+name+'\ndata: '+json.dumps(value)+'\n\n' for name,value in events).encode()

class Payload:
    def __init__(self, body):
        self.body=body
        self.headers={'Content-Type':'text/event-stream'}
    def __enter__(self): return self
    def __exit__(self,*_): pass
    def read(self,_): return self.body

def _runtime():
    pytest.importorskip('deepseek_harness')
    runtime=Path(sys.prefix)
    if not shutil.which('bwrap') or not (runtime/'bin'/'node').exists():
        pytest.skip('bwrap/node runtime required')
    return runtime

def _run(args):
    result=subprocess.run(args, env={'PATH':'/usr/bin:/bin','PYTHONDONTWRITEBYTECODE':'1'}, capture_output=True, timeout=90)
    assert result.returncode==0, result.stderr.decode()[-1500:]

def test_sdk_max_tokens_is_one_step_and_keeps_the_requested_cap(tmp_path):
    pytest.importorskip('deepseek_harness')
    from deepseek_harness import DeepSeekHarness
    captured=[]
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*_): pass
        def do_POST(self):
            raw=self.rfile.read(int(self.headers.get('Content-Length','0')))
            captured.append(json.loads(raw))
            body=stream('max_tokens','planning without a tool')
            self.send_response(200)
            self.send_header('Content-Type','text/event-stream')
            self.send_header('Content-Length',str(len(body)))
            self.end_headers()
            self.wfile.write(body)
    server=ThreadingHTTPServer(('127.0.0.1',0), Handler)
    host, port=server.server_address
    threading.Thread(target=server.serve_forever, daemon=True).start()
    work=tmp_path/'work'
    work.mkdir()
    try:
        with DeepSeekHarness(profile='sdk-minimal', cwd=str(work), runtime_cwd=str(work), dsh_home=str(tmp_path/'dsh'),
                             base_url=f'http://{host}:{port}', api_key='PROBE-NOT-A-KEY', model='deepseek-flash',
                             max_tokens=16384, request_timeout_seconds=30, initialize_timeout_seconds=20) as harness:
            result=harness.run('Write nothing.', session_id='budget-probe')
        assert result.finish_reason=='max-tokens'
        assert result.final_response==''
        assert captured and captured[0]['max_tokens']==16384
        assert captured[0]['thinking']=={'type':'enabled'}
        assert captured[0]['output_config']=={'effort':'high'}
        assert not any(event.get('type')=='tool/call' for event in result.events)
    finally:
        server.shutdown()

def test_sdk_max_tokens_writes_nothing_then_resume_can_finish_partial_output(tmp_path):
    import shlex
    runtime=_runtime()
    work=tmp_path/'work'
    (work/'tmp').mkdir(parents=True)
    (work/'outputs').mkdir()
    (work/'input.json').write_text(json.dumps({'id':'b'*32}), encoding='utf-8')
    partial='python -c '+shlex.quote('from pathlib import Path; Path("outputs").mkdir(exist_ok=True); Path("outputs/preview.html").write_text("x"*40)')
    full='python -c '+shlex.quote(
        'from pathlib import Path; Path("outputs").mkdir(exist_ok=True); '
        f'Path("outputs/preview.html").write_text({PAGE!r}); Path("outputs/report.md").write_text({REPORT!r})')
    class Opener:
        def __init__(self):
            self.calls=0
            self.caps=[]
        def open(self, request, timeout):
            self.calls+=1
            payload=json.loads(request.data)
            self.caps.append(payload.get('max_tokens'))
            if self.calls==1:
                return Payload(tool_stream(partial))
            if self.calls==2:
                return Payload(stream('max_tokens','cut off before the report'))
            if self.calls==3:
                return Payload(tool_stream(full))
            return Payload(stream('end_turn','done'))
    opener=Opener()
    sock=tmp_path/'broker.sock'
    with Broker(sock,'TEST-NOT-A-REAL-KEY',opener=opener,max_tokens=16384) as broker:
        thread=threading.Thread(target=broker.serve_forever, daemon=True)
        thread.start()
        try:
            (work/'control.json').write_text(json.dumps({
                'prompt':initial('knowledge-travel','恐龙'),'resume':False,'max_tokens':16384,
            }, ensure_ascii=False), encoding='utf-8')
            args=sandbox.command(work, sock, runtime=str(runtime), skill='html-skills/knowledge-travel')
            _run(args)
            first=json.loads((work/'agent-result.json').read_text(encoding='utf-8'))
            assert first=={'finish_reason':'max-tokens'}
            assert (work/'outputs'/'preview.html').read_text(encoding='utf-8')=='x'*40
            assert not (work/'outputs'/'report.md').exists()
            checked=review(work, 'knowledge-travel')
            assert checked['passed'] is False
            assert 'preview_too_small_or_unsafe' in checked['errors']
            assert 'report_too_small_or_unsafe' in checked['errors']
            (work/'control.json').write_text(json.dumps({
                'prompt':continuation('knowledge-travel'),'resume':True,'max_tokens':16384,
            }, ensure_ascii=False), encoding='utf-8')
            _run(args)
            assert review(work, 'knowledge-travel')['passed'] is True
            assert opener.calls==4
            assert opener.caps==[16384, 16384, 16384, 16384]
        finally:
            broker.shutdown()
            thread.join()
