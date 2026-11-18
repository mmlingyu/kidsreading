"""Run as the studio worker user. Mock model, real gateway object, real SDK in bwrap."""
import json, os, subprocess, sys, threading
from pathlib import Path
from reader_service.gateway import Broker
from reader_service.sandbox import command

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

def main():
    base, runtime, cache=map(Path, sys.argv[1:4])
    os.umask(0o077)
    run=base/'run'
    run.mkdir(mode=0o700, exist_ok=True)
    os.chmod(run, 0o700)
    work=base/'work'
    (work/'tmp').mkdir(parents=True, exist_ok=True)
    (work/'outputs').mkdir(exist_ok=True)
    (work/'input.json').write_text(json.dumps({'id':'a'*32}))
    (work/'control.json').write_text(json.dumps({'prompt':'Reply OK. Do not call tools.','resume':False}))
    os.environ['READER_RUNTIME_CACHE']=str(cache)
    sock=run/'job.sock'
    broker=Broker(sock,'TEST-NOT-A-REAL-KEY',opener=Opener())
    os.chmod(sock, 0o600)
    thread=threading.Thread(target=broker.serve_forever, daemon=True)
    thread.start()
    try:
        args=command(work, sock, runtime=str(runtime), entry='sandbox_entry.py')
        result=subprocess.run(args, env={'PATH':'/usr/bin:/bin','PYTHONDONTWRITEBYTECODE':'1'}, capture_output=True, timeout=90)
        status=base/'sdk-status.txt'
        status.write_text(str(result.returncode)+'\n'+result.stderr.decode()[-2000:])
        os.chmod(status, 0o644)
        mode=base/'sock-mode.txt'
        mode.write_text(oct(sock.stat().st_mode & 0o777))
        os.chmod(mode, 0o644)
        if result.returncode!=0:
            raise SystemExit(result.returncode)
    finally:
        broker.shutdown()

if __name__=='__main__':
    main()
