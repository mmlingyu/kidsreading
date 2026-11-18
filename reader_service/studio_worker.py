"""HTML jobs. The reader book worker is not this module and is not started here."""
import json, os, stat, time
from pathlib import Path
from .sandbox import ROOT, spawn, terminate
from .studio_catalog import skill
from .studio_prompts import initial
from .studio_review import review

HARD_DEADLINE=900
HARD_PROGRESS=300

def generation_enabled():
    return os.environ.get('STUDIO_ENABLE_GENERATION')=='1'

def accepted(path=None):
    from .acceptance import accepted as reader_accepted
    target=Path(path or os.environ.get('STUDIO_ACCEPTED_FILE','/etc/studio/accepted.json'))
    return reader_accepted(target)

class StudioWorker:
    def __init__(self, store):
        self.store=store
    def deadlines(self):
        total=int(os.environ.get('STUDIO_JOB_TIMEOUT','600'))
        progress=int(os.environ.get('STUDIO_PROGRESS_TIMEOUT','180'))
        return min(max(total, 1), HARD_DEADLINE), min(max(progress, 1), HARD_PROGRESS)
    def start_gateway(self, row, key):
        import subprocess, sys
        run=self.store.root/'run'
        run.mkdir(mode=0o700, exist_ok=True)
        os.chmod(run, 0o700)
        st=run.lstat()
        if not stat.S_ISDIR(st.st_mode) or st.st_uid!=os.geteuid() or st.st_mode & 0o077:
            raise RuntimeError('unsafe_broker_directory')
        sock=run/(row['id']+'.sock')
        if sock.exists() or sock.is_symlink():
            sock.unlink()
        broker=subprocess.Popen([sys.executable,'-m','reader_service.gateway',str(sock)], cwd=ROOT,
            env={'PATH':'/usr/bin:/bin','PYTHONDONTWRITEBYTECODE':'1'}, stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        broker.stdin.write(json.dumps({'key':key}).encode()); broker.stdin.close()
        for _ in range(50):
            if sock.exists():
                return sock, broker
            if broker.poll() is not None:
                raise RuntimeError('broker_failed')
            time.sleep(.1)
        raise RuntimeError('broker_timeout')
    def start_agent(self, work, prompt, sock=None):
        if sock is None:
            raise RuntimeError('studio_agent_not_configured')
        (work/'input.json').write_text(json.dumps({'id':work.name}), encoding='utf-8')
        (work/'control.json').write_text(json.dumps({'prompt':prompt,'resume':False}, ensure_ascii=False), encoding='utf-8')
        from .sandbox import command
        return spawn(command(work, sock, skill='html-skills/'+self.current_skill))
    def _progress(self, work):
        outputs=work/'outputs'
        if not outputs.is_dir() or outputs.is_symlink():
            return 0
        mark=0
        for child in outputs.iterdir():
            if child.is_symlink():
                continue
            mark=max(mark, child.stat().st_mtime_ns, child.stat().st_size)
        return mark
    def supervise(self, proc, row, work, deadline, progress_limit):
        seen=self._progress(work)
        changed=time.monotonic()
        while proc.poll() is None:
            if self.store.get(row['owner'], row['id'])['status']=='cancelled':
                terminate(proc)
                return 'cancelled'
            now=time.monotonic()
            if now>=deadline:
                terminate(proc)
                return 'deadline'
            mark=self._progress(work)
            if mark!=seen:
                seen, changed=mark, now
            elif now-changed>=progress_limit:
                terminate(proc)
                return 'progress'
            time.sleep(.05)
        return 'exited'
    def run_one(self, row, key=None):
        item=skill(row['skill'])
        if item is None or item['status']!='enabled':
            self._stop(row,'failed','studio_skill_blocked')
            return
        if not generation_enabled() or not accepted():
            self._stop(row,'failed','studio_generation_disabled')
            return
        work=self.store.jobdir(row['id'])
        if work.exists():
            self._stop(row,'failed','studio_jobdir_exists')
            return
        work.parent.mkdir(mode=0o2770, exist_ok=True)
        work.mkdir(mode=0o2770)
        (work/'inputs').mkdir(mode=0o2770)
        (work/'outputs').mkdir(mode=0o2770)
        (work/'tmp').mkdir(mode=0o2770)
        (work/'inputs'/'brief.txt').write_text(row['brief'], encoding='utf-8')
        if self.store.get(row['owner'], row['id'])['status']=='cancelled':
            return
        prompt=initial(row['skill'], row['brief'])
        (work/'inputs'/'prompt.txt').write_text(prompt, encoding='utf-8')
        self.current_skill=row['skill']
        proc=None
        broker=None
        sock=None
        total, progress=self.deadlines()
        try:
            if type(self).start_agent is StudioWorker.start_agent:
                key=os.environ.pop('DEEPSEEK_API_KEY','') if key is None else key
                if not key:
                    self._stop(row,'failed','model_credential_unavailable')
                    return
                sock, broker=self.start_gateway(row, key)
                proc=self.start_agent(work, prompt, sock)
            else:
                proc=self.start_agent(work, prompt)
            outcome=self.supervise(proc, row, work, time.monotonic()+total, progress)
            if outcome=='cancelled':
                return
            if outcome=='deadline':
                self._stop(row,'failed','studio_deadline')
                return
            if outcome=='progress':
                self._stop(row,'failed','studio_progress_timeout')
                return
            if self.store.get(row['owner'], row['id'])['status']=='cancelled':
                return
            result=review(work, row['skill'])
            if self.store.get(row['owner'], row['id'])['status']=='cancelled':
                return
            if not result['passed']:
                self._stop(row,'failed','studio_review_failed', json.dumps(result, ensure_ascii=False))
                return
            self._publish(work)
            self._stop(row,'ready','', json.dumps(result, ensure_ascii=False))
        except Exception:
            self._stop(row,'failed','studio_worker_failed')
        finally:
            if proc is not None and proc.poll() is None:
                terminate(proc)
            if broker is not None:
                terminate(broker)
            if sock is not None:
                sock.unlink(missing_ok=True)
    def _stop(self, row, status, error='', review=''):
        if not self.store.finish_if_running(row['id'], status, error, review):
            self.store.finish_if_status(row['id'], 'queued', status, error, review)
    def _publish(self, work):
        published=work/'published'
        published.mkdir(mode=0o770)
        os.chmod(published, 0o2770)
        for name in ('preview.html','report.md'):
            source=work/'outputs'/name
            if source.is_symlink() or not source.is_file() or source.stat().st_nlink!=1:
                raise RuntimeError('unsafe_publish')
            target=published/name
            fd=os.open(target, os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW, 0o660)
            with os.fdopen(fd,'wb') as out, source.open('rb') as inp:
                out.write(inp.read())
def main():
    from .studio_store import StudioSettings, StudioStore
    store=StudioStore(StudioSettings.load())
    store.recover_orphans()
    worker=StudioWorker(store)
    while True:
        beat=store.root/'worker-heartbeat'
        beat.write_text(str(time.time()), encoding='utf-8')
        os.chmod(beat, 0o660)
        row=store.claim()
        if row is None:
            time.sleep(1)
            continue
        worker.run_one(row)

if __name__=='__main__':
    main()
