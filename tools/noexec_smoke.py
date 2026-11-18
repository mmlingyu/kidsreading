"""Synthetic production-layout probe. CLI requires a real noexec volume and root-owned source/cache.
No auth/key file read. Only this disposable process bypasses acceptance for a fake broker.
Run as reader-worker in the formal worker unit's sandbox/cgroup; never against live DB.
"""
import argparse,contextlib,errno,hashlib,json,os,shlex,shutil,stat,subprocess,sys,tempfile,threading,time
from pathlib import Path
from reader_service import worker as module
from reader_service.core import Settings,Store
from reader_service.gateway import Broker
from reader_service.runtime_cache import verify_cache
from reader_service.sandbox import ROOT,verify_manifest
from tools.sdk_cache import FakeResponse,ToolResponse

class ProbeOpener:
    def __init__(self,audit,hold):self.calls=0;self.audit=Path(audit);self.hold=hold
    def open(self,request,timeout):
        self.calls+=1;self.audit.write_text(str(self.calls))
        if self.hold:time.sleep(60)
        if self.calls%2==0:return FakeResponse()
        fixture=json.loads((ROOT/'skills/adventure-reader/references/example-book.json').read_text())
        if self.calls<5:del fixture['chapters'][0]['game']['title']
        code=("import json,subprocess;from pathlib import Path;"
            "assert not Path('/var/lib/reader').exists();"
            f"Path('outputs/book.json').write_text({json.dumps(fixture)!r});"
            f"Path('outputs/report.md').write_text({('Offline graded fixture adaptation, not original content. '*4)!r});"
            "p=Path('tmp/raw-exec');p.write_text('#!/bin/sh\\nexit 0\\n');p.chmod(0o700);"
            "\ntry:subprocess.run([str(p.resolve())],check=True);raise AssertionError('job volume executable')"
            "\nexcept PermissionError:pass\n"
            "try:Path('/sdk-home/write-test').write_text('denied');raise AssertionError('cache HOME writable')"
            "\nexcept (PermissionError,OSError):pass\n")
        return ToolResponse('python -c '+shlex.quote(code))

def fake_broker(sock,audit,hold):
    value=json.loads(sys.stdin.buffer.read(4096))
    if value!={'key':'OFFLINE-FAKE'}:raise RuntimeError('fake_probe_only')
    with Broker(Path(sock),'OFFLINE-FAKE',opener=ProbeOpener(audit,hold)) as server:server.serve_forever()

def run_probe(parent,runtime,cache,require_root=True,prepared_data=None,check_setid_filter=False):
    parent=Path(parent);runtime=Path(runtime);cache=Path(cache)
    if not os.statvfs(parent).f_flag&os.ST_NOEXEC:raise RuntimeError('probe_requires_real_noexec_mount')
    verify_cache(cache,runtime,require_root=require_root)
    if require_root:verify_manifest()
    saved=(module.accepted,module.verify_manifest,module.verify_cache,subprocess.Popen,os.environ.get('READER_ENABLE_GENERATION'),os.environ.get('READER_RUNTIME_CACHE'))
    if require_root and prepared_data is None:raise RuntimeError('root_prepared_probe_data_required')
    if prepared_data is not None and len(os.fsencode(str(Path(prepared_data)/'run'/('0'*32+'.sock'))))>107:raise RuntimeError('probe_unix_socket_path_too_long')
    context=contextlib.nullcontext(str(Path(prepared_data).parent)) if prepared_data is not None else tempfile.TemporaryDirectory(prefix='r5-noexec-probe-',dir=parent)
    with context as tmp:
        base=Path(tmp);audit=base/'fake-broker-count';processes=[]
        mode_audit={'explicit_setid_requests_after_guard':0}
        if check_setid_filter:
            guard=base/'ordinary-mode-guard';guard.mkdir(mode=0o770)
            for action in (lambda:os.mkdir(guard/'forbidden-setgid',0o2770),lambda:os.chmod(guard,0o2770)):
                try:action();raise RuntimeError('RestrictSUIDSGID_not_enforced')
                except OSError as exc:
                    if exc.errno!=errno.EPERM:raise
            guard.rmdir()
            def mode_guard(event,args):
                if event in ('os.mkdir','os.chmod') and len(args)>1 and args[1] & 0o6000:
                    mode_audit['explicit_setid_requests_after_guard']+=1
                    raise AssertionError('service attempted explicit set-ID mode')
            sys.addaudithook(mode_guard)
        store=Store(Settings(Path(prepared_data) if prepared_data is not None else base/'data',{hashlib.sha256(b'A'*48).hexdigest():'probe'},timeout=45,require_shared_roots=prepared_data is not None))
        real_popen=saved[3]
        def popen(args,*a,**kw):
            if isinstance(args,list) and 'reader_service.gateway' in args:
                args=[sys.executable,'-m','tools.noexec_smoke','--fake-broker',args[-1],'--audit',str(audit)]
                if hold[0]:args+=['--hold']
            proc=real_popen(args,*a,**kw);processes.append(proc);return proc
        starts=[]
        class ProbeWorker(module.Worker):
            def start_agent(self,work,sock,prompt,resume):
                if resume:assert list((work/'.dsh').rglob('session.v4.jsonl')),'durable session missing before repair'
                starts.append(resume);return super().start_agent(work,sock,prompt,resume)
        hold=[False]
        try:
            module.accepted=lambda:True
            module.verify_manifest=(lambda:None) if not require_root else saved[1]
            module.verify_cache=lambda c,r:verify_cache(c,r,require_root=require_root)
            subprocess.Popen=popen;os.environ['READER_ENABLE_GENERATION']='1';os.environ['READER_RUNTIME_CACHE']=str(cache)
            worker=ProbeWorker(store,str(runtime))
            store.create('probe',{'text':'A little fox helps his friend in a tree house. '*3},'offline_probe_000001')
            row=store.claim();worker.run_one(row,key='OFFLINE-FAKE');result=store.get('probe',row['id'])
            assert result['status']=='ready',(result['status'],result['error'])
            assert result['review_attempts']==2 and starts==[False,True,True],(result['review_attempts'],starts)
            assert audit.read_text()=='6','expected 3 real SDK turns and 3 real bash calls'
            assert sorted(p.name for p in store.jobdir(row['id']).iterdir())==['book.json']
            # A second real SDK request waits inside the fake provider; cancellation kills SDK AND broker.
            hold[0]=True;audit.unlink();starts.clear()
            store.create('probe',{'text':'A second fox story used only for cancellation. '*3},'offline_probe_000002');row=store.claim()
            def cancel():
                deadline=time.monotonic()+25
                while not audit.exists() and time.monotonic()<deadline:time.sleep(.02)
                if audit.exists():store.cancel('probe',row['id'])
            thread=threading.Thread(target=cancel);thread.start();worker.run_one(row,key='OFFLINE-FAKE');thread.join()
            assert store.get('probe',row['id'])['status']=='cancelled'
            assert all(p.poll() is not None for p in processes),'probe descendant still alive'
            assert not list(store.jobdir(row['id']).iterdir()) and not list((store.root/'run').glob('*.sock'))
            # Interrupted persistent session must become failed and be purged under the worker lock.
            store.create('probe',{'text':'A third fake story for crash recovery. '*3},'offline_probe_000003');row=store.claim()
            work=store.jobdir(row['id']);(work/'.dsh').mkdir(parents=True);(work/'.dsh/private-session').write_text('SYNTHETIC')
            store.recover();worker.recover_cleanup()
            assert store.get('probe',row['id'])['error']=='worker_restarted' and not list(work.iterdir())
            verify_cache(cache,runtime,require_root=require_root)
            return {**mode_audit,'restrict_suid_sgid_enforced':check_setid_filter,'root_prepared_shared_roots':prepared_data is not None,'noexec_mount':True,'sdk_real_binary':True,'sdk_turns':3,'session_resumes':2,'quality_repairs':2,'fake_model_requests':6,'real_sdk_inflight_cancel':True,'restart_session_cleanup':True,'static_cache_unchanged':True}
        finally:
            module.accepted,module.verify_manifest,module.verify_cache,subprocess.Popen=saved[:4]
            for name,value in zip(('READER_ENABLE_GENERATION','READER_RUNTIME_CACHE'),saved[4:]):
                if value is None:os.environ.pop(name,None)
                else:os.environ[name]=value
            for proc in processes:
                if proc.poll() is None:module.terminate(proc)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--parent',default='/var/lib/reader/jobs');p.add_argument('--runtime',default='/opt/reader-runtime');p.add_argument('--cache',default='/opt/reader-runtime-cache-0.2.2rc2')
    p.add_argument('--data',required=False);p.add_argument('--fake-broker');p.add_argument('--audit');p.add_argument('--hold',action='store_true');a=p.parse_args()
    if a.fake_broker:fake_broker(a.fake_broker,a.audit,a.hold)
    else:
        if os.geteuid()==0:raise SystemExit('probe must run as dedicated nonroot worker')
        print(json.dumps(run_probe(a.parent,a.runtime,a.cache,prepared_data=a.data,check_setid_filter=True),sort_keys=True))
