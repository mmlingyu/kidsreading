#!/usr/bin/env python3
"""Real SDK and bwrap as the studio worker. The model is mocked.

argv: base runtime cache skill_id
The skill argument is required. Omitting it mounts adventure-reader, which is
the reader default and is not a studio result.
"""
import hashlib, json, os, subprocess, sys, threading
from pathlib import Path
from reader_service.gateway import Broker
from reader_service.sandbox import command
from reader_service.studio_prompts import initial
from reader_service.studio_review import review

class Response:
    headers={'Content-Type':'text/event-stream'}
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, _n):
        events=[
          ('message_start',{'type':'message_start','message':{'id':'fake','type':'message','role':'assistant','model':'deepseek-flash','content':[],'stop_reason':None,'usage':{'input_tokens':1,'output_tokens':0}}}),
          ('content_block_start',{'type':'content_block_start','index':0,'content_block':{'type':'text','text':''}}),
          ('content_block_delta',{'type':'content_block_delta','index':0,'delta':{'type':'text_delta','text':'OK'}}),
          ('content_block_stop',{'type':'content_block_stop','index':0}),
          ('message_delta',{'type':'message_delta','delta':{'stop_reason':'end_turn','stop_sequence':None},'usage':{'output_tokens':1}}),
          ('message_stop',{'type':'message_stop'})]
        return ''.join('event: '+name+'\ndata: '+json.dumps(body)+'\n\n' for name,body in events).encode()

class Opener:
    def open(self, request, timeout):
        return Response()

PROOF=r'''
import hashlib, json, pathlib, sys
text=pathlib.Path("/skill/SKILL.md").read_text(encoding="utf-8")
name=""
for line in text.splitlines():
    if line.startswith("name:"):
        name=line.split(":",1)[1].strip()
        break
binding={"name":name,"sha256":hashlib.sha256(text.encode()).hexdigest(),"book_contract":"outputs/book.json" in text}
pathlib.Path("/work/binding.json").write_text(json.dumps(binding))
out=pathlib.Path("/work/outputs")
out.mkdir(exist_ok=True)
report="结构、交互、依赖和验证都已写明。"*6
if name=="html-builder":
    page="<!doctype html><html><body><p>local only page for a sandboxed preview.</p><p>"+text.splitlines()[2]+"</p></body></html>"
elif name=="zdog":
    vendor=pathlib.Path("/skill/vendor/zdog.dist.min.js").read_text(encoding="utf-8")
    page="<!doctype html><html><body><canvas class=\"zdog-canvas\"></canvas><script>"+vendor+"</script><script>new Zdog.Illustration({dragRotate:true});requestAnimationFrame(function(){})</script></body></html>"
elif name=="knowledge-travel":
    page="<!doctype html><html><body><canvas></canvas><script type=\"application/json\" id=\"game-spec\">{}</script><script>function levelHasKnowledge(){return false} requestAnimationFrame(function(){}); addEventListener(\"keydown\",e=>{if(e.key==\"ArrowRight\"){}})</script></body></html>"
else:
    raise SystemExit(3)
(out/"preview.html").write_text(page, encoding="utf-8")
(out/"report.md").write_text(report, encoding="utf-8")
'''

def prove(args):
    program=args.index('--')
    probe=args[:program+1]+['/opt/reader-runtime/bin/python','-c',PROOF]
    result=subprocess.run(probe, env={'PATH':'/usr/bin:/bin','PYTHONDONTWRITEBYTECODE':'1'}, capture_output=True, timeout=30)
    if result.returncode!=0:
        raise SystemExit(result.stderr.decode()[-500:] or 'skill mount was not readable')

def main():
    if len(sys.argv)!=5:
        raise SystemExit('usage: studio_sdk_as_user.py BASE RUNTIME CACHE SKILL_ID')
    base, runtime, cache=map(Path, sys.argv[1:4])
    skill_id=sys.argv[4]
    if skill_id not in {'html-builder','zdog','knowledge-travel'}:
        raise SystemExit('refusing reader default or blocked skill')
    os.umask(0o077)
    run=base/'run'
    run.mkdir(mode=0o700, exist_ok=True)
    os.chmod(run, 0o700)
    work=base/'work'
    if work.exists():
        raise SystemExit('work directory already exists')
    (work/'tmp').mkdir(parents=True)
    (work/'outputs').mkdir()
    (work/'input.json').write_text(json.dumps({'id':'a'*32}))
    prompt=initial(skill_id, '做一个可离线打开的小页面')
    if 'outputs/book.json' in prompt or 'preview.html' not in prompt:
        raise SystemExit('studio prompt is not the html contract')
    (work/'control.json').write_text(json.dumps({'prompt':prompt,'resume':False}, ensure_ascii=False))
    os.environ['READER_RUNTIME_CACHE']=str(cache)
    sock=run/'job.sock'
    broker=Broker(sock,'TEST-NOT-A-REAL-KEY',opener=Opener())
    os.chmod(sock, 0o600)
    thread=threading.Thread(target=broker.serve_forever, daemon=True)
    thread.start()
    try:
        args=command(work, sock, runtime=str(runtime), entry='sandbox_entry.py', cache=cache, skill='html-skills/'+skill_id)
        if '/skills/adventure-reader' in args:
            raise SystemExit('studio command mounted the reader skill')
        prove(args)
        binding=json.loads((work/'binding.json').read_text())
        host=(Path(__file__).resolve().parents[1]/'skills'/'html-skills'/skill_id/'SKILL.md').read_text(encoding='utf-8')
        if binding['name']!=skill_id or binding['sha256']!=hashlib.sha256(host.encode()).hexdigest() or binding['book_contract']:
            raise SystemExit('mounted skill does not match '+skill_id)
        result=subprocess.run(args, env={'PATH':'/usr/bin:/bin','PYTHONDONTWRITEBYTECODE':'1'}, capture_output=True, timeout=90)
        status=base/'sdk-status.txt'
        status.write_text(str(result.returncode)+'\n'+result.stderr.decode()[-2000:])
        os.chmod(status, 0o644)
        mode=base/'sock-mode.txt'
        mode.write_text(oct(sock.stat().st_mode & 0o777))
        os.chmod(mode, 0o644)
        if result.returncode!=0:
            raise SystemExit(result.returncode)
        if 'finish_reason' not in (work/'agent-result.json').read_text():
            raise SystemExit('sdk did not finish')
        if (work/'outputs'/'book.json').exists():
            raise SystemExit('studio skill wrote a reader book')
        checked=review(work, skill_id)
        if not checked['passed']:
            raise SystemExit('html review failed '+json.dumps(checked, ensure_ascii=False))
    finally:
        broker.shutdown()

if __name__=='__main__':
    main()
