import hashlib, os, subprocess, sys, time
import pytest
from reader_service.core import Settings,Store
from reader_service.worker import Worker
from reader_service.sandbox import terminate

@pytest.fixture
def store(tmp_path):
    import tempfile
    from pathlib import Path
    with tempfile.TemporaryDirectory(prefix='rdr-test-') as directory:
        yield Store(Settings(Path(directory),{hashlib.sha256(b'A'*48).hexdigest():'a'}))
def row(store):
    store.create('a',{'source':'text','text':'A happy story. '*10},'key_00000000000000001')
    return store.claim()

def test_gate_is_fail_closed(store,monkeypatch):
    import reader_service.worker as m
    monkeypatch.setattr(m,'verify_manifest',lambda:None)
    monkeypatch.setenv('READER_ENABLE_GENERATION','0')
    r=row(store); Worker(store).run_one(r,key=None)
    assert store.get('a',r['id'])['error']=='generation_not_accepted'

def test_missing_model_key_is_terminal(store,monkeypatch):
    import reader_service.worker as m
    monkeypatch.setattr(m,'verify_manifest',lambda:None)
    monkeypatch.setattr(m,'accepted',lambda:True)
    monkeypatch.setenv('READER_ENABLE_GENERATION','1')
    r=row(store); Worker(store).run_one(r,key=None)
    assert store.get('a',r['id'])['status']=='failed'
    assert store.get('a',r['id'])['error']=='model_credential_unavailable'

def test_true_cancel_terminates_child(store):
    r=row(store); p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)'],start_new_session=True)
    store.cancel('a',r['id'])
    status,error=Worker(store).wait(p,r)
    assert status=='cancelled' and p.poll() is not None

def test_timeout_terminates_child(store):
    r=row(store); store.s.timeout=-1
    p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)'],start_new_session=True)
    status,error=Worker(store).wait(p,r)
    assert (status,error)==('failed','job_timeout') and p.poll() is not None

def test_failed_sdk_not_running_forever(store):
    r=row(store); p=subprocess.Popen([sys.executable,'-c','raise SystemExit(3)'],start_new_session=True); p.wait()
    assert Worker(store).wait(p,r)==('failed','generation_failed_or_blocked')

def test_acceptance_absent(tmp_path):
    from reader_service.acceptance import accepted
    assert not accepted(tmp_path/'absent.json')

def test_worker_publishes_only_validated_book(store,monkeypatch,tmp_path):
    import json
    import reader_service.worker as m
    from test_validator import valid
    monkeypatch.setattr(m,'verify_manifest',lambda:None)
    monkeypatch.setattr(m,'accepted',lambda:True)
    monkeypatch.setenv('READER_ENABLE_GENERATION','1')
    class FakeWorker(Worker):
        def start_agent(self,work,sock,prompt,resume):
            payload=json.dumps(valid())
            code=(f'from pathlib import Path;Path({str(work/"outputs/book.json")!r}).write_text({payload!r});'
                  f'Path({str(work/"outputs/report.md")!r}).write_text('+repr('This is a graded adaptation, not the original text. '*4)+');'
                  f'Path({str(work/"agent-result.json")!r}).write_text('+repr('{"finish_reason":"stop"}')+');'
                  f'Path({str(work/"unwanted.html")!r}).write_text("not-published")')
            return m.spawn([sys.executable,'-c',code])
    r=row(store);FakeWorker(store,runtime=sys.prefix).run_one(r,key='FAKE-NOT-A-PROVIDER-KEY')
    current=store.get('a',r['id'])
    assert current['status']=='ready',current['error']
    assert sorted(p.name for p in store.jobdir(r['id']).iterdir())==['book.json']
    assert store.public(current)['book']['id']=='tree-house-night'

def test_queued_deadline(store):
    job=store.create('a',{'text':'A happy story. '*10},'key_00000000000000001')
    store.s.timeout=-1
    assert store.claim() is None
    assert store.get('a',job['id'])['error']=='queue_timeout'
