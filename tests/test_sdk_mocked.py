"""Optional installed-binary integration: zero provider traffic, namespace has no network."""
import json, shutil, subprocess, sys, threading
from pathlib import Path
import pytest
from reader_service import sandbox
from reader_service.gateway import Broker

class FakeResponse:
    headers={'Content-Type':'text/event-stream'}
    def __enter__(self): return self
    def __exit__(self,*_): pass
    def read(self,_):
        events=[
          ('message_start',{'type':'message_start','message':{'id':'fake','type':'message','role':'assistant','model':'deepseek-flash','content':[],'stop_reason':None,'stop_sequence':None,'usage':{'input_tokens':1,'output_tokens':0}}}),
          ('content_block_start',{'type':'content_block_start','index':0,'content_block':{'type':'text','text':''}}),
          ('content_block_delta',{'type':'content_block_delta','index':0,'delta':{'type':'text_delta','text':'OK'}}),
          ('content_block_stop',{'type':'content_block_stop','index':0}),
          ('message_delta',{'type':'message_delta','delta':{'stop_reason':'end_turn','stop_sequence':None},'usage':{'output_tokens':1}}),
          ('message_stop',{'type':'message_stop'})]
        return ''.join('event: '+name+'\ndata: '+json.dumps(value)+'\n\n' for name,value in events).encode()

class FakeOpener:
    def __init__(self): self.calls=0
    def open(self,req,timeout):
        self.calls+=1
        if hasattr(self,'path'):self.path.write_text(json.dumps(json.loads(req.data).get('tools',[])))
        return FakeResponse()

def test_real_sdk_binary_with_mock_model_and_namespace(tmp_path,monkeypatch):
    pytest.importorskip('deepseek_harness')
    runtime=Path(sys.prefix)
    if not shutil.which('bwrap') or not (runtime/'bin/node').exists(): pytest.skip('bwrap/node runtime required')
    original=sandbox.ROOT
    root=tmp_path/'release'; app=root/'reader_service'; app.mkdir(parents=True)
    (root/'skills/adventure-reader').mkdir(parents=True)
    shutil.copyfile(original/'reader_service/sandbox_entry.py',app/'sandbox_entry.py')
    (app/'probe.py').write_text('''import json,threading
from pathlib import Path
from sandbox_entry import Relay as BaseRelay
class Relay(BaseRelay):
 def do_POST(self):
  Path('/work/request-path.txt').write_text(self.path)
  return super().do_POST()
from http.server import ThreadingHTTPServer
from deepseek_harness import DeepSeekHarness
server=ThreadingHTTPServer(('127.0.0.1',18080),Relay)
threading.Thread(target=server.serve_forever,daemon=True).start()
with DeepSeekHarness(profile='sdk-minimal',cwd='/work',dsh_home='/work/.dsh',base_url='http://127.0.0.1:18080',api_key='FAKE-DUMMY',request_timeout_seconds=20) as h:
 r=h.run('Reply OK. Do not call any tools.')
 first={'reason':r.finish_reason,'text':r.final_response}
 session=r.session_id
with DeepSeekHarness(profile='sdk-minimal',cwd='/work',dsh_home='/work/.dsh',base_url='http://127.0.0.1:18080',api_key='FAKE-DUMMY',request_timeout_seconds=20) as h:
 r=h.resume_session(session).run('Reply OK again. Do not call tools.')
 first['restored_text']=r.final_response
 Path('/work/result.json').write_text(json.dumps(first))
server.shutdown()
''')
    work=tmp_path/'work';work.mkdir();(work/'tmp').mkdir(); sock=tmp_path/'broker.sock'; opener=FakeOpener();opener.path=tmp_path/'tool-definitions.json'
    monkeypatch.setattr(sandbox,'ROOT',root)
    with Broker(sock,'FAKE-TEST-KEY',opener=opener) as broker:
        thread=threading.Thread(target=broker.serve_forever,daemon=True);thread.start()
        try:
            args=sandbox.command(work,sock,runtime=str(runtime),entry='probe.py')
            result=subprocess.run(args,env={'PATH':'/usr/bin:/bin'},capture_output=True,timeout=60)
            assert result.returncode==0,result.stderr.decode()[-4000:]
            response=json.loads((work/'result.json').read_text())
            assert response['text']=='OK' and response['restored_text']=='OK' and opener.calls==2, {'response':response,'calls':opener.calls,'path':(work/'request-path.txt').read_text()}
        finally: broker.shutdown();thread.join()

def test_real_sdk_bash_generates_book_and_original_gates_inside_namespace(tmp_path):
    import shlex
    from reader_service.prompts import initial
    from reader_service.review_entry import review
    from test_validator import valid
    pytest.importorskip('deepseek_harness')
    runtime=Path(sys.prefix)
    if not shutil.which('bwrap') or not (runtime/'bin/node').exists():pytest.skip('runtime required')
    work=tmp_path/'work';work.mkdir();(work/'tmp').mkdir();(work/'assets').mkdir()
    (work/'assets/source.txt').write_text('A small fox lives in a tree house and helps a friend.')
    (work/'input.json').write_text(json.dumps({'id':'a'*32,'age':'8-12','source':'text'}))
    (work/'control.json').write_text(json.dumps({'prompt':initial('8-12'),'resume':False}))
    script=("from pathlib import Path;Path('outputs').mkdir(exist_ok=True);"
            f"Path('outputs/book.json').write_text({json.dumps(valid())!r});"
            f"Path('outputs/report.md').write_text({('This is a graded adaptation, not the original. '*5)!r})")
    command='python -c '+shlex.quote(script)+' && python /skill/scripts/validate.py outputs/book.json && node /skill/scripts/playtest.js outputs/book.json'
    class ToolResponse(FakeResponse):
        def read(self,_):
            events=[
             ('message_start',{'type':'message_start','message':{'id':'fake-tool','type':'message','role':'assistant','model':'deepseek-flash','content':[],'stop_reason':None,'usage':{'input_tokens':1,'output_tokens':0}}}),
             ('content_block_start',{'type':'content_block_start','index':0,'content_block':{'type':'tool_use','id':'call-fixture','name':'bash','input':{}}}),
             ('content_block_delta',{'type':'content_block_delta','index':0,'delta':{'type':'input_json_delta','partial_json':json.dumps({'command':command})}}),
             ('content_block_stop',{'type':'content_block_stop','index':0}),
             ('message_delta',{'type':'message_delta','delta':{'stop_reason':'tool_use'},'usage':{'output_tokens':1}}),
             ('message_stop',{'type':'message_stop'})]
            return ''.join('event: '+n+'\ndata: '+json.dumps(v)+'\n\n' for n,v in events).encode()
    class ToolOpener:
        def __init__(self):self.calls=0
        def open(self,req,timeout):
            self.calls+=1
            return ToolResponse() if self.calls==1 else FakeResponse()
    sock=tmp_path/'broker.sock';opener=ToolOpener()
    with Broker(sock,'FAKE-TEST-NOT-A-KEY',opener=opener) as broker:
        thread=threading.Thread(target=broker.serve_forever,daemon=True);thread.start()
        try:
            result=subprocess.run(sandbox.command(work,sock,runtime=str(runtime)),env={'PATH':'/usr/bin:/bin'},capture_output=True,timeout=60)
            assert result.returncode==0,result.stderr.decode()[-1000:]
            assert opener.calls==2
            result=review(work,runtime/'bin/node');assert result['passed'],result
            assert not any(p.is_symlink() for p in (work/'.dsh').rglob('*')),'real minimal runtime created symlinks that soft guard would reject'
        finally:broker.shutdown();thread.join()
