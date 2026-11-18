"""One persistent supervisor; trusted fetch/review + isolated SDK, ≤2 repairs and ≤2 truncated continuations."""
import fcntl,json,os,pwd,shutil,signal,stat,subprocess,sys,tempfile,threading,time
from pathlib import Path
from .core import Settings,Store
from .acceptance import accepted
from .sandbox import ROOT,command,spawn,terminate,verify_manifest
from .prompts import initial,continuation
from .runtime_cache import cache_root,verify_cache
from .original_quality import revision_prompt

class Worker:
    def __init__(self,store,runtime='/opt/reader-runtime'):
        self.store,self.stop,self.runtime=store,threading.Event(),Path(runtime)
    def wait(self,proc,row,deadline=None):
        deadline=deadline if deadline is not None else time.monotonic()+self.store.s.timeout
        while proc.poll() is None:
            self.store.heartbeat();current=self.store.get(row['owner'],row['id'])
            if self.stop.is_set() or current['status']=='cancelling':terminate(proc);return 'cancelled',''
            if time.monotonic()>deadline:terminate(proc);return 'failed','job_timeout'
            if not self.store.disk_ok():terminate(proc);return 'failed','disk_budget_exhausted'
            self.stop.wait(.1)
        if proc.returncode:return 'failed','generation_failed_or_blocked'
        return 'ready',''
    def checked_json(self,path,limit=20000):
        st=path.lstat()
        if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1 or st.st_size>limit:raise RuntimeError('unsafe_control_result')
        return json.loads(path.read_text())
    def start_agent(self,work,sock,prompt,resume):
        (work/'control.json').unlink(missing_ok=True)
        (work/'control.json').write_text(json.dumps({'prompt':prompt,'resume':resume},ensure_ascii=False))
        result=work/'agent-result.json'
        if result.exists() or result.is_symlink():result.unlink()
        verify_cache(cache_root(),self.runtime)
        return spawn(command(work,sock,runtime=str(self.runtime)))
    def start_fetch(self,work):
        return subprocess.Popen([sys.executable,'-m','reader_service.fetch_entry',str(work)],cwd=ROOT,
            env={'PATH':'/usr/bin:/bin','PYTHONDONTWRITEBYTECODE':'1'},stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)

    def start_review(self,work):
        # An anonymous host-side file avoids a full stdout pipe deadlocking review before wait().
        output=tempfile.TemporaryFile(dir=self.store.root/'run')
        try:
            proc=subprocess.Popen([sys.executable,'-m','reader_service.review_entry',str(work),str(self.runtime/'bin/node')],
                cwd=ROOT,env={'PATH':str(self.runtime/'bin')+':/usr/bin:/bin','PYTHONDONTWRITEBYTECODE':'1'},
                stdin=subprocess.DEVNULL,stdout=output,stderr=subprocess.DEVNULL,start_new_session=True)
        except Exception:output.close();raise
        proc.review_output=output
        return proc
    def publish_book(self,work):
        # Workdir is untrusted: never follow a model-created destination symlink/hardlink.
        destination=work/'book.json'
        if destination.exists() or destination.is_symlink():destination.unlink()
        fd=os.open(destination,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o660)
        with os.fdopen(fd,'wb') as out,(work/'outputs/book.json').open('rb') as source:shutil.copyfileobj(source,out)
    def has_book(self,work):
        p=work/'outputs/book.json'
        return not (work/'outputs').is_symlink() and p.is_file() and not p.is_symlink() and 80<p.stat().st_size<=2097152
    def run_one(self,row,key=None):
        work=self.store.jobdir(row['id']);broker=None;proc=None;broker_sock=None;status='failed';error='isolated_worker_failed'
        deadline=time.monotonic()+self.store.s.timeout
        try:
            verify_manifest()
            if os.environ.get('READER_ENABLE_GENERATION')!='1' or not accepted():
                self.store.finish(row['id'],'failed','generation_not_accepted');return
            if not key:self.store.finish(row['id'],'failed','model_credential_unavailable');return
            work.mkdir(mode=0o770)
            (work/'assets').mkdir();(work/'outputs').mkdir();(work/'tmp').mkdir()
            (work/'input.json').write_text(json.dumps({'id':row['id'],'source':row['source'],'age':row['age'],'url':row['url']}))
            if row['source']=='url':
                self.store.phase(row['id'],'安全抓取正文')
                proc=self.start_fetch(work)
                status,error=self.wait(proc,row,min(deadline,time.monotonic()+30))
                if status!='ready':
                    if error=='generation_failed_or_blocked':error=self.checked_json(work/'fetch-result.json')['error']
                    elif error=='job_timeout':error='url_fetch_timeout'
                    return
            else:
                (work/'assets/source.txt').write_text('来源：粘贴\n年龄带：'+row['age']+'\n\n'+row['text'],encoding='utf-8')
            # The agent sees extracted text, not the original URL/query or fetch capability.
            (work/'input.json').write_text(json.dumps({'id':row['id'],'source':row['source'],'age':row['age']}))
            # Socket directory is NEVER mounted into model workdir. Otherwise an agent could
            # replace work/broker.sock with a host-absolute symlink before a repair bind mount.
            run=self.store.root/'run';run.mkdir(mode=0o700,exist_ok=True)
            st=run.lstat()
            if not stat.S_ISDIR(st.st_mode) or st.st_uid!=os.geteuid() or st.st_mode & 0o077:raise RuntimeError('unsafe_broker_directory')
            sock=run/(row['id']+'.sock');broker_sock=sock
            if sock.exists() or sock.is_symlink():sock.unlink()
            broker=subprocess.Popen([sys.executable,'-m','reader_service.gateway',str(sock)],cwd=ROOT,
                env={'PATH':'/usr/bin:/bin','PYTHONDONTWRITEBYTECODE':'1'},stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
            broker.stdin.write(json.dumps({'key':key}).encode());broker.stdin.close()
            for _ in range(50):
                if sock.exists():break
                if broker.poll() is not None:raise RuntimeError('broker_failed')
                time.sleep(.1)
            if not sock.exists():raise RuntimeError('broker_timeout')
            prompt=initial(row['age'],row['source']);resume=False;repairs=0;continues=0
            while True:
                self.store.phase(row['id'],'改写' if not resume else f'修订/续写 {repairs}/2')
                proc=self.start_agent(work,sock,prompt,resume)
                status,error=self.wait(proc,row,deadline)
                if status!='ready':break
                result=self.checked_json(work/'agent-result.json')
                if result.get('finish_reason') in ('blocked','error','failed','cancelled'):
                    status,error='failed','generation_failed_or_blocked';break
                if result.get('finish_reason')=='max-tokens' and not self.has_book(work) and continues<2:
                    continues+=1;prompt=continuation(row['age']);resume=True;continue
                if not self.has_book(work):
                    status,error='failed','artifact_missing';break
                self.store.phase(row['id'],'校验')
                proc=self.start_review(work)
                status,error=self.wait(proc,row,min(deadline,time.monotonic()+80))
                if status!='ready':break
                proc.review_output.seek(0);raw=proc.review_output.read(20001);proc.review_output.close()
                if len(raw)>20000:raise RuntimeError('review_output_limit')
                report=json.loads(raw)
                self.store.record_review(row['id'],report,repairs)
                if report['passed']:
                    # Agent/process namespace has exited. Publish just the immutable validated book data.
                    self.publish_book(work)
                    status,error='ready','';break
                if repairs>=2:status,error='failed','validation_or_playtest_failed';break
                repairs+=1
                # Original revision_prompt exact body, scoped to book-only sandbox.
                prompt=revision_prompt({'module':'adventure-reader'},report,repairs)
                resume=True
        except Exception as exc:
            if isinstance(exc,RuntimeError) and str(exc)=='unsafe_broker_directory':
                # Fixed code only. Do not collapse this into isolated_worker_failed or log a path.
                import logging
                logging.getLogger('reader.worker').warning('reader_worker_error code=unsafe_broker_directory')
                status,error='failed','unsafe_broker_directory'
            else:
                status,error='failed','isolated_worker_failed'
        finally:
            # All model/validation/fetch descendants and upstream TCP close BEFORE terminal state.
            if proc is not None:
                terminate(proc)
                if hasattr(proc,'review_output'):proc.review_output.close()
            if broker is not None:terminate(broker)
            if broker_sock is not None:broker_sock.unlink(missing_ok=True)
            current=self.store.get(row['owner'],row['id'])
            if current['status'] in ('running','cancelling'):self.store.finish(row['id'],status,error)
            keep=self.store.get(row['owner'],row['id'])['status']=='ready'
            self.cleanup_work(work,keep)
    def cleanup_work(self,work,keep=False):
        if work.exists() and not work.is_symlink():
            for p in work.iterdir():
                if keep and p.name=='book.json' and not p.is_symlink():continue
                if p.is_dir() and not p.is_symlink():shutil.rmtree(p)
                else:p.unlink(missing_ok=True)
    def recover_cleanup(self):
        # Only recorded terminal jobs, under the single-worker lock. No other trees are touched.
        with self.store.db() as db:rows=db.execute("SELECT id,status FROM jobs WHERE status IN ('failed','cancelled','ready')").fetchall()
        for row in rows:
            self.cleanup_work(self.store.jobdir(row['id']),row['status']=='ready')
            sock=self.store.root/'run'/(row['id']+'.sock')
            if sock.exists() or sock.is_symlink():sock.unlink()
    def run(self,key):
        with (self.store.root/'worker.lock').open('a') as lock:
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);self.store.recover();self.recover_cleanup()
            while not self.stop.is_set():
                self.store.heartbeat();row=self.store.claim()
                if row:self.run_one(row,key)
                else:self.stop.wait(1)

def main():
    os.umask(0o007)
    if os.geteuid()==0 or pwd.getpwuid(os.geteuid()).pw_name=='ubuntu':raise SystemExit('worker_requires_dedicated_nonroot_nonubuntu_uid')
    worker=Worker(Store(Settings.load()))
    signal.signal(signal.SIGTERM,lambda *_:worker.stop.set());signal.signal(signal.SIGINT,lambda *_:worker.stop.set())
    # Deployment only: unit-injected key never enters agent/fetch/review environment.
    worker.run(os.environ.pop('DEEPSEEK_API_KEY',None))
if __name__=='__main__':main()
