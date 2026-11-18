#!/usr/bin/env python3
"""One worker process: real gateway and review, mock model text, no network."""
import json, os, time
from pathlib import Path
from reader_service.studio_store import StudioSettings, StudioStore
from reader_service.studio_worker import StudioWorker

def page():
    return '<!doctype html><html><body><p>local only page for a sandboxed preview.</p></body></html>'

def main():
    sentinel=os.environ.get('DEEPSEEK_API_KEY','')
    store=StudioStore(StudioSettings.load())
    worker=StudioWorker(store)
    report={'held':bool(sentinel) and worker.model_key==sentinel and 'DEEPSEEK_API_KEY' not in os.environ,
            'key_in_child':False,'jobs':[]}
    real_gateway=StudioWorker.start_gateway
    def gateway(self, row, key):
        sock, broker=real_gateway(self, row, key)
        blob=Path(f'/proc/{broker.pid}/environ').read_bytes()+Path(f'/proc/{broker.pid}/cmdline').read_bytes()
        if sentinel and sentinel.encode() in blob:
            report['key_in_child']=True
        return sock, broker
    StudioWorker.start_gateway=gateway
    def fake_spawn(args):
        if sentinel and any(sentinel in str(part) for part in args):
            report['key_in_child']=True
        work=None
        for index, part in enumerate(args):
            if part=='--bind' and index+2<len(args) and args[index+2]=='/work':
                work=Path(args[index+1])
        (work/'outputs'/'preview.html').write_text(page(), encoding='utf-8')
        (work/'outputs'/'report.md').write_text('结构、交互、依赖和验证都已写明。'*6, encoding='utf-8')
        class Done:
            def poll(self): return 0
            def wait(self, timeout=None): return 0
        return Done()
    import reader_service.studio_worker as worker_module
    worker_module.spawn=fake_spawn
    deadline=time.time()+float(os.environ.get('STUDIO_MOCK_SECONDS','20'))
    target=store.root/'mock-report.json'
    while time.time()<deadline and not (store.root/'stop-worker').exists():
        row=store.claim()
        if row is None:
            time.sleep(0.05)
            continue
        worker.run_one(row)
        done=store.get(row['owner'], row['id'])
        report['jobs'].append({'id':done['id'],'status':done['status'],'error':done['error']})
        folder=store.jobdir(done['id'])
        blob=''.join(path.read_text(encoding='utf-8', errors='replace') for path in folder.rglob('*') if path.is_file() and not path.is_symlink())
        if sentinel and sentinel in blob:
            report['key_in_child']=True
        target.write_text(json.dumps(report), encoding='utf-8')
        os.chmod(target, 0o640)
    target.write_text(json.dumps(report), encoding='utf-8')
    os.chmod(target, 0o640)

if __name__=='__main__':
    main()
