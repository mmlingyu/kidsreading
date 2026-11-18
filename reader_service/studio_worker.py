"""HTML jobs. The reader book worker is not this module and is not started here.

One job keeps one broker. A max-tokens stop may resume the same session at most
twice. That does not open another queued job or reset the 12-call budget.
"""
import json, os, stat, time
from pathlib import Path
from .gateway import MODEL_CALLS, OUTPUT_CAPS
from .sandbox import ROOT, spawn, terminate
from .studio_store import plain_dir
from .studio_catalog import skill
from .studio_prompts import continuation, initial
from .studio_review import review

HARD_DEADLINE=900
HARD_PROGRESS=300
MAX_CONTINUATIONS=2
OUTPUT_CAP={'html-builder':8192,'zdog':8192,'knowledge-travel':16384}
FINISH_REASONS={'max-tokens','stop','end_turn','blocked','error','failed','cancelled'}
UNRECOVERABLE_FINISH={'blocked','error','failed','cancelled'}
SAFETY_ERRORS={
    'html_scan_danger','parent_bridge','file_url','javascript_url','banned_runtime',
    'kt_storage','kt_build','unsafe_outputs','unsafe_output_entry','zdog_cdn','zdog_three',
}
assert set(OUTPUT_CAP.values())<=set(OUTPUT_CAPS)
assert MODEL_CALLS==12

def output_cap(skill_id):
    return OUTPUT_CAP.get(skill_id, 8192)

def generation_enabled():
    return os.environ.get('STUDIO_ENABLE_GENERATION')=='1'

def accepted(path=None):
    from .acceptance import accepted as reader_accepted
    target=Path(path or os.environ.get('STUDIO_ACCEPTED_FILE','/etc/studio/accepted.json'))
    return reader_accepted(target)

def take_model_key(explicit=None):
    """Read the broker secret once. Later jobs and restarts must not depend on a second pop."""
    if explicit is not None:
        return explicit
    return os.environ.pop('DEEPSEEK_API_KEY', '')

class StudioWorker:
    def __init__(self, store, model_key=None):
        self.store=store
        self.model_key=model_key if model_key is not None else take_model_key()
        os.environ.pop('DEEPSEEK_API_KEY', None)
    def deadlines(self):
        total=int(os.environ.get('STUDIO_JOB_TIMEOUT','600'))
        progress=int(os.environ.get('STUDIO_PROGRESS_TIMEOUT','180'))
        return min(max(total, 1), HARD_DEADLINE), min(max(progress, 1), HARD_PROGRESS)
    def start_gateway(self, row, key):
        import subprocess, sys
        run=self.store.root/'run'
        plain_dir(run, 0o700)
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
        broker.stdin.write(json.dumps({'key':key,'max_tokens':output_cap(row['skill'])}).encode()); broker.stdin.close()
        for _ in range(50):
            if sock.exists():
                return sock, broker
            if broker.poll() is not None:
                raise RuntimeError('broker_failed')
            time.sleep(.1)
        raise RuntimeError('broker_timeout')
    def start_agent(self, work, prompt, sock=None, resume=False):
        if sock is None:
            raise RuntimeError('studio_agent_not_configured')
        (work/'input.json').write_text(json.dumps({'id':work.name}), encoding='utf-8')
        (work/'control.json').write_text(json.dumps({
            'prompt':prompt,'resume':bool(resume),'max_tokens':output_cap(self.current_skill),
        }, ensure_ascii=False), encoding='utf-8')
        from .runtime_cache import cache_root
        from .sandbox import command
        runtime=os.environ.get('STUDIO_RUNTIME','/opt/reader-runtime')
        return spawn(command(work, sock, runtime=runtime, cache=cache_root(), skill='html-skills/'+self.current_skill))
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
    def _finish_reason(self, work):
        path=work/'agent-result.json'
        try:
            if path.is_symlink() or not path.is_file() or path.stat().st_nlink!=1:
                return None
            data=json.loads(path.read_bytes()[:200].decode('utf-8'))
        except (OSError, ValueError, UnicodeError):
            return None
        reason=data.get('finish_reason') if isinstance(data, dict) else None
        return reason if reason in FINISH_REASONS else None
    def _can_continue(self, reason, result, continues):
        if continues>=MAX_CONTINUATIONS or reason!='max-tokens' or result['passed']:
            return False
        return not any(code in SAFETY_ERRORS for code in result['errors'])
    def _failure(self, reason, result):
        if reason=='max-tokens' and not any(code in SAFETY_ERRORS for code in result['errors']):
            return 'studio_generation_budget'
        if reason in UNRECOVERABLE_FINISH:
            return 'studio_generation_failed'
        return 'studio_review_failed'
    def _noted(self, result, reason):
        if reason!='max-tokens':
            return result
        return {**result, 'evidence':(['stop max-tokens']+list(result['evidence']))[:8]}
    def run_one(self, row, key=None):
        proc=None
        broker=None
        sock=None
        try:
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
            plain_dir(work.parent)
            plain_dir(work)
            plain_dir(work/'inputs')
            plain_dir(work/'outputs')
            plain_dir(work/'tmp')
            (work/'inputs'/'brief.txt').write_text(row['brief'], encoding='utf-8')
            if self.store.get(row['owner'], row['id'])['status']=='cancelled':
                return
            prompt=initial(row['skill'], row['brief'])
            (work/'inputs'/'prompt.txt').write_text(prompt, encoding='utf-8')
            self.current_skill=row['skill']
            total, progress=self.deadlines()
            deadline=time.monotonic()+total
            real_agent=type(self).start_agent is StudioWorker.start_agent
            if real_agent:
                key=self.model_key if key is None else key
                if not key:
                    self._stop(row,'failed','model_credential_unavailable')
                    return
                sock, broker=self.start_gateway(row, key)
            resume=False
            continues=0
            while True:
                if self.store.get(row['owner'], row['id'])['status']=='cancelled':
                    return
                if time.monotonic()>=deadline:
                    self._stop(row,'failed','studio_deadline')
                    return
                proc=self.start_agent(work, prompt, sock, resume=resume) if real_agent else self.start_agent(work, prompt)
                outcome=self.supervise(proc, row, work, deadline, progress)
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
                reason=self._finish_reason(work)
                result=self._noted(review(work, row['skill']), reason)
                if self.store.get(row['owner'], row['id'])['status']=='cancelled':
                    return
                if result['passed'] and reason not in UNRECOVERABLE_FINISH:
                    self._publish(work)
                    self._stop(row,'ready','', json.dumps(result, ensure_ascii=False))
                    return
                if result['passed']:
                    self._stop(row,'failed','studio_generation_failed', json.dumps(result, ensure_ascii=False))
                    return
                if self._can_continue(reason, result, continues) and time.monotonic()<deadline:
                    continues+=1
                    prompt=continuation(row['skill'])
                    resume=True
                    continue
                self._stop(row,'failed', self._failure(reason, result), json.dumps(result, ensure_ascii=False))
                return
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
        plain_dir(published)
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
    worker=StudioWorker(store, model_key=take_model_key())
    while True:
        beat=store.root/'worker-heartbeat'
        beat.write_text(str(time.time()), encoding='utf-8')
        os.chmod(beat, 0o660)
        row=store.claim()
        if row is None:
            time.sleep(1)
            continue
        try:
            worker.run_one(row)
        except Exception:
            worker._stop(row,'failed','studio_worker_failed')

if __name__=='__main__':
    main()
