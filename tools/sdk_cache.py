"""Explicit offline cache preparation. CLI root preparer runs seed as reader-worker, never as root.
No provider traffic/credential lookup. HOME cache extraction is not DSH_HOME session state.
"""
import argparse,hashlib,json,os,pwd,shutil,stat,subprocess,sys,tempfile,threading
from pathlib import Path
from reader_service.runtime_cache import MAX_BYTES,MAX_FILES,fingerprint,verify_cache
from reader_service.gateway import Broker
from reader_service.sandbox import ROOT

class FakeResponse:
    headers={'Content-Type':'text/event-stream'}
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def read(self,size):
        events=[('message_start',{'type':'message_start','message':{'id':'offline-cache','type':'message','role':'assistant','model':'deepseek-flash','content':[],'stop_reason':None,'usage':{'input_tokens':1,'output_tokens':0}}}),
            ('content_block_start',{'type':'content_block_start','index':0,'content_block':{'type':'text','text':''}}),
            ('content_block_delta',{'type':'content_block_delta','index':0,'delta':{'type':'text_delta','text':'OK'}}),
            ('content_block_stop',{'type':'content_block_stop','index':0}),
            ('message_delta',{'type':'message_delta','delta':{'stop_reason':'end_turn','stop_sequence':None},'usage':{'output_tokens':1}}),('message_stop',{'type':'message_stop'})]
        return ''.join('event: '+name+'\ndata: '+json.dumps(body)+'\n\n' for name,body in events).encode()
class ToolResponse(FakeResponse):
    def __init__(self,command):self.command=command
    def read(self,size):
        events=[('message_start',{'type':'message_start','message':{'id':'offline-tool','type':'message','role':'assistant','model':'deepseek-flash','content':[],'stop_reason':None,'usage':{'input_tokens':1,'output_tokens':0}}}),
            ('content_block_start',{'type':'content_block_start','index':0,'content_block':{'type':'tool_use','id':'fixture-call','name':'bash','input':{}}}),
            ('content_block_delta',{'type':'content_block_delta','index':0,'delta':{'type':'input_json_delta','partial_json':json.dumps({'command':self.command})}}),
            ('content_block_stop',{'type':'content_block_stop','index':0}),('message_delta',{'type':'message_delta','delta':{'stop_reason':'tool_use'},'usage':{'output_tokens':1}}),('message_stop',{'type':'message_stop'})]
        return ''.join('event: '+name+'\ndata: '+json.dumps(body)+'\n\n' for name,body in events).encode()
class FakeOpener:
    def __init__(self):self.calls=0
    def open(self,request,timeout):
        self.calls+=1
        return ToolResponse('printf offline-cache-ready') if self.calls==1 else FakeResponse()

def seed(build,runtime):
    if os.geteuid()==0:raise RuntimeError('seed_requires_nonroot')
    build=Path(build);home=build/'home';home.mkdir();work=build/'work';work.mkdir()
    sock=build/'fake.sock';opener=FakeOpener()
    # This one-time trusted extraction has an exec filesystem supplied by root, no model tools.
    code="""import threading
from http.server import ThreadingHTTPServer
from sandbox_entry import Relay
from deepseek_harness import DeepSeekHarness
server=ThreadingHTTPServer(('127.0.0.1',18080),Relay)
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with DeepSeekHarness(profile='sdk-minimal',cwd='/work',runtime_cwd='/work',dsh_home='/work/.dsh',base_url='http://127.0.0.1:18080',api_key='OFFLINE-FAKE',max_tokens=32,request_timeout_seconds=30) as h:
  result=h.run('Reply OK only. Do not call tools.')
  if result.final_response!='OK' or not any(e.get('type')=='tool/result' and not e.get('data',{}).get('message',{}).get('isError') for e in result.events):raise RuntimeError('offline_cache_seed_failed')
finally:server.shutdown()
"""
    (build/'seed.py').write_text(code)
    args=['/usr/bin/bwrap','--unshare-all','--die-with-parent','--new-session','--cap-drop','ALL','--clearenv','--ro-bind','/usr','/usr']
    for name in ('/lib','/lib64','/bin'):
        if Path(name).exists():args+=['--ro-bind',name,name]
    args+=['--proc','/proc','--dev','/dev','--size','16777216','--tmpfs','/tmp','--dir','/run','--dir','/etc',
        '--ro-bind',str(Path(runtime).resolve()),'/opt/reader-runtime','--ro-bind',str(ROOT/'reader_service'),'/app',
        '--bind',str(home),'/sdk-home','--bind',str(work),'/work',
        '--ro-bind',str(sock),'/run/model.sock','--setenv','NARB_NATIVE_CACHE_DIR','/sdk-home/.cache/narb','--setenv','HOME','/sdk-home','--setenv','PATH','/opt/reader-runtime/bin:/usr/bin:/bin',
        '--setenv','PYTHONDONTWRITEBYTECODE','1','--chdir','/work','--','/opt/reader-runtime/bin/python','-c',"import sys;sys.path.insert(0,'/app');"+code]
    with Broker(sock,'OFFLINE-FAKE',opener=opener) as server:
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:subprocess.run(args,env={'PATH':'/usr/bin:/bin'},stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True,timeout=60)
        finally:server.shutdown();thread.join()
    if opener.calls!=2:raise RuntimeError('offline_seed_request_count')
    # Keep ONLY packaged static code. Never publish work/.dsh, fake socket or probe input.
    pkg=home/'.cache/pkg'
    if not pkg.is_dir() or pkg.is_symlink():raise RuntimeError('no_pkg_cache')
    total=0;files={}
    for p in home.rglob('*'):
        if p.is_symlink():raise RuntimeError('cache_symlink')
        if p.is_dir():continue
        st=p.lstat()
        if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1 or not (p.is_relative_to(pkg) or p.is_relative_to(home/'.cache/narb')):raise RuntimeError('nonstatic_cache_entry')
        total+=st.st_size;files[p.relative_to(build).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
        if total>MAX_BYTES or len(files)>MAX_FILES:raise RuntimeError('cache_capacity_exceeded')
    (build/'CACHE-SHA256.json').write_text(json.dumps({'runtime_sha256':fingerprint(runtime),'bytes':total,'files':files},sort_keys=True,indent=2)+'\n')
    return total

def prepare(destination,runtime,user='reader-worker'):
    if os.geteuid()!=0:raise RuntimeError('root_preparer_required')
    for service in ('reader-worker.service','reader-api.service'):
        result=subprocess.run(['systemctl','is-active','--quiet',service],check=False)
        if result.returncode==0:raise RuntimeError('stop_reader_services_before_cache_prepare')
        if result.returncode not in (3,4):raise RuntimeError('cannot_confirm_reader_services_inactive')
    account=pwd.getpwnam(user)
    if account.pw_uid==0 or user=='ubuntu':raise RuntimeError('dedicated_seed_user_required')
    target=Path(destination)
    if target.exists() or target.is_symlink():raise RuntimeError('refuse_existing_cache_use_new_version_path')
    if target.parent.stat().st_uid!=0 or target.parent.stat().st_mode&0o022:raise RuntimeError('cache_parent_must_be_root_readonly')
    build=Path(tempfile.mkdtemp(prefix='.reader-cache-',dir=target.parent));os.chown(build,account.pw_uid,account.pw_gid)
    try:
        subprocess.run(['runuser','-u',user,'--',str(Path(runtime)/'bin/python'),'-m','tools.sdk_cache','--seed',str(build),'--runtime',str(runtime)],cwd=ROOT,
            env={'PATH':'/usr/sbin:/usr/bin:/bin','PYTHONDONTWRITEBYTECODE':'1'},stdin=subprocess.DEVNULL,check=True,timeout=90)
        verify_cache(build,runtime,require_root=False)
        # Remove all disposable first-session content before root publication.
        for p in build.iterdir():
            if p.name in ('home','CACHE-SHA256.json'):continue
            if p.is_dir() and not p.is_symlink():shutil.rmtree(p)
            else:p.unlink()
        for p in [build,*build.rglob('*')]:
            os.chown(p,0,0,follow_symlinks=False);os.chmod(p,0o755 if p.is_dir() else 0o644)
        build.rename(target);verify_cache(target,runtime)
    finally:
        if build.exists():shutil.rmtree(build)

if __name__=='__main__':
    parser=argparse.ArgumentParser();choice=parser.add_mutually_exclusive_group(required=True)
    choice.add_argument('--prepare');choice.add_argument('--seed');parser.add_argument('--runtime',default='/opt/reader-runtime');parser.add_argument('--user',default='reader-worker');args=parser.parse_args()
    if args.seed:print('static cache bytes',seed(Path(args.seed),Path(args.runtime)))
    else:prepare(args.prepare,args.runtime,args.user);print('prepared root-owned static cache:',args.prepare)
