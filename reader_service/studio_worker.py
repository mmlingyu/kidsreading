"""HTML jobs. The reader book worker is not this module and is not started here."""
import json, os, time
from pathlib import Path
from .sandbox import ROOT, spawn
from .studio_catalog import skill, skill_root
from .studio_prompts import initial
from .studio_review import review

def generation_enabled():
    return os.environ.get('STUDIO_ENABLE_GENERATION')=='1'

def accepted(path=None):
    from .acceptance import accepted as reader_accepted
    target=Path(path or os.environ.get('STUDIO_ACCEPTED_FILE','/etc/studio/accepted.json'))
    return reader_accepted(target)

class StudioWorker:
    def __init__(self, store):
        self.store=store
    def start_agent(self, work, prompt):
        if os.environ.get('STUDIO_USE_SANDBOX')!='1':
            raise RuntimeError('studio_agent_not_configured')
        (work/'input.json').write_text(json.dumps({'id':work.name}), encoding='utf-8')
        (work/'control.json').write_text(json.dumps({'prompt':prompt,'resume':False}, ensure_ascii=False), encoding='utf-8')
        from .sandbox import command
        return spawn(command(work, work/'broker.sock', skill='html-skills/'+self.current_skill))
    def run_one(self, row):
        item=skill(row['skill'])
        if item is None or item['status']!='enabled':
            self.store.finish(row['id'],'failed','studio_skill_blocked')
            return
        if not generation_enabled() or not accepted():
            self.store.finish(row['id'],'failed','studio_generation_disabled')
            return
        work=self.store.jobdir(row['id'])
        if work.exists():
            self.store.finish(row['id'],'failed','studio_jobdir_exists')
            return
        work.parent.mkdir(mode=0o700, exist_ok=True)
        work.mkdir(mode=0o700)
        (work/'inputs').mkdir(mode=0o700)
        (work/'outputs').mkdir(mode=0o700)
        (work/'inputs'/'brief.txt').write_text(row['brief'], encoding='utf-8')
        current=self.store.get(row['owner'], row['id'])
        if current['status']=='cancelled':
            return
        prompt=initial(row['skill'], row['brief'])
        (work/'inputs'/'prompt.txt').write_text(prompt, encoding='utf-8')
        self.current_skill=row['skill']
        proc=None
        try:
            proc=self.start_agent(work, prompt)
            proc.wait(timeout=30)
            result=review(work, row['skill'])
            if not result['passed']:
                self.store.finish(row['id'],'failed','studio_review_failed', json.dumps(result, ensure_ascii=False))
                return
            self._publish(work)
            self.store.finish(row['id'],'ready','', json.dumps(result, ensure_ascii=False))
        except Exception:
            self.store.finish(row['id'],'failed','studio_worker_failed')
        finally:
            if proc is not None and proc.poll() is None:
                from .sandbox import terminate
                terminate(proc)
    def _publish(self, work):
        published=work/'published'
        published.mkdir(mode=0o700)
        for name in ('preview.html','report.md'):
            source=work/'outputs'/name
            if source.is_symlink() or not source.is_file() or source.stat().st_nlink!=1:
                raise RuntimeError('unsafe_publish')
            target=published/name
            fd=os.open(target, os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd,'wb') as out, source.open('rb') as inp:
                out.write(inp.read())
    def sandbox_command(self, work, broker):
        """Production shape: one read-only skill, no network tools, no reader DB."""
        item_root=skill_root(json.loads((work/'inputs'/'skill.json').read_text())['id'])
        return [str(ROOT/'reader_service'/'sandbox.py'), str(item_root), str(work), str(broker)]

def main():
    from .studio_store import StudioSettings, StudioStore
    store=StudioStore(StudioSettings.load())
    worker=StudioWorker(store)
    while True:
        row=store.claim()
        if row is None:
            time.sleep(1)
            continue
        worker.run_one(row)

if __name__=='__main__':
    main()
