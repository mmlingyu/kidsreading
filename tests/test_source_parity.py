import ast,copy,hashlib,json,subprocess,sys,tempfile,threading,time,os
from pathlib import Path
import pytest
from reader_service import original_quality
from reader_service.sandbox import ROOT
from reader_service.core import Settings,Store
from reader_service.worker import Worker
from reader_service.review_entry import review
from reader_service.prompts import initial
from test_validator import valid


def test_uploaded_skill_bytes_and_extracted_functions_match():
    manifest=ROOT/'evidence/original-source/SHA256MANIFEST.txt.txt'
    for line in manifest.read_text(encoding='utf-8-sig').splitlines():
        digest,name=line.split('  ',1)
        if name.startswith('skills/adventure-reader/'):
            assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest
    source=ast.parse((ROOT/'evidence/original-source/quality_review.py.txt').read_text())
    target=ast.parse((ROOT/'reader_service/original_quality.py').read_text())
    def functions(tree):return {x.name:ast.dump(x,include_attributes=False) for x in tree.body if isinstance(x,ast.FunctionDef)}
    a,b=functions(source),functions(target)
    for name in ['_report_gate','_book_checker','_review_book','revision_prompt']:assert a[name]==b[name]
    assert (ROOT/'frontend/app/vendor/adventure-recall.js').read_bytes()==(ROOT/'skills/adventure-reader/assets/recall.js').read_bytes()


def test_original_fixture_report_gate_and_python_vs_old_frontend():
    with tempfile.TemporaryDirectory(prefix='rdr-qa-') as tmp:
        work=Path(tmp);(work/'outputs').mkdir()
        (work/'outputs/book.json').write_text(json.dumps(valid()))
        assert not review(work,Path(sys.prefix)/'bin/node')['passed']
        (work/'outputs/report.md').write_text('这是分级改写，不是原文。书id tree-house-night，章数1，年龄8-12，原Python校验与填空自测通过。'*2)
        report=review(work,Path(sys.prefix)/'bin/node');assert report['passed'],report
        book=valid();del book['chapters'][0]['game']['title']
        (work/'outputs/book.json').write_text(json.dumps(book))
        report=review(work,Path(sys.prefix)/'bin/node');assert not report['passed'] and any('title' in e for e in report['errors'])

@pytest.fixture
def prepared(monkeypatch):
    import reader_service.worker as m
    monkeypatch.setattr(m,'verify_manifest',lambda:None);monkeypatch.setattr(m,'accepted',lambda:True)
    monkeypatch.setenv('READER_ENABLE_GENERATION','1')
    with tempfile.TemporaryDirectory(prefix='rdr-round-') as tmp:
        s=Store(Settings(Path(tmp),{hashlib.sha256(b'A'*48).hexdigest():'a'}));yield s

class FakeWorker(Worker):
    def __init__(self,store,outcomes):super().__init__(store,runtime=sys.prefix);self.outcomes=outcomes;self.prompts=[]
    def start_fetch(self,work):
        # Trusted fetch process fake, no DNS/HTTP. Agent only receives already extracted source.
        code=f'from pathlib import Path;Path({str(work/"assets/source.txt")!r}).write_text("A fox helps a friend. "*4)'
        return subprocess.Popen([sys.executable,'-c',code],env={'PATH':'/usr/bin:/bin'},start_new_session=True)
    def start_agent(self,work,sock,prompt,resume):
        import reader_service.worker as m
        self.prompts.append((prompt,resume));index=len(self.prompts)-1
        assert index<len(self.outcomes),'more model attempts than allowed'
        outcome=self.outcomes[index];book=valid() if outcome=='valid' else {'id':'bad','padding':'x'*100}
        lines=['import json,os','from pathlib import Path',"assert 'DEEPSEEK_API_KEY' not in os.environ",f'w=Path({str(work)!r})']
        if outcome!='truncated':
            lines += [f'(w/"outputs/book.json").write_text({json.dumps(book)!r})',f'(w/"outputs/report.md").write_text({("This is a graded adaptation not original text. "*5)!r})']
        lines += [f'(w/"agent-result.json").write_text({json.dumps({"finish_reason":"max-tokens" if outcome=="truncated" else "stop"})!r})']
        return m.spawn([sys.executable,'-c',';'.join(lines)])

@pytest.mark.parametrize('outcomes,attempts,status',[
 (['valid'],0,'ready'),(['invalid','valid'],1,'ready'),(['invalid','invalid','valid'],2,'ready'),
 (['invalid']*3,2,'failed'),(['truncated','truncated','valid'],0,'ready'),(['truncated']*3,0,'failed')])
def test_bounded_original_review_repair_revalidate(prepared,outcomes,attempts,status):
    prepared.create('a',{'text':'A little fox finds his friend in a tree house. '*3,'age':'4-6'},'test_key_00000000001')
    row=prepared.claim();worker=FakeWorker(prepared,outcomes);worker.run_one(row,key='FAKE-TEST-NOT-A-KEY')
    result=prepared.get('a',row['id']);assert result['status']==status,result['error']
    assert result['review_attempts']==attempts
    assert len(worker.prompts)==len(outcomes)
    if attempts==2:assert '最后一次自动修订' in worker.prompts[-1][0]
    assert worker.prompts[0][1] is False
    assert all(resume for _,resume in worker.prompts[1:])
    if status=='ready':assert prepared.public(result)['book']['id']=='tree-house-night'


def test_url_job_keeps_source_provenance_and_same_owner_protocol(prepared):
    row=prepared.create('a',{'source':'url','url':'https://example.com/story','age':'8-12'},'test_key_00000000001')
    assert prepared.create('a',{'source':'url','url':'https://example.com/story','age':'8-12'},'test_key_00000000001')['id']==row['id']
    row=prepared.claim();worker=FakeWorker(prepared,['valid']);worker.run_one(row,key='FAKE-TEST-NOT-A-KEY')
    job=prepared.get('a',row['id']);assert job['status']=='ready',job['error']
    assert job['url']=='' and '专用安全抓取器' in worker.prompts[0][0]
    assert sorted(p.name for p in prepared.jobdir(row['id']).iterdir())==['book.json']


def test_cancel_full_job_terminates_actual_agent(prepared):
    import reader_service.worker as m
    prepared.create('a',{'text':'A little fox finds his friend in a tree house. '*3},'test_key_00000000001');row=prepared.claim()
    class Slow(FakeWorker):
        def start_agent(self,work,sock,prompt,resume):
            self.proc=m.spawn([sys.executable,'-c','import time;time.sleep(60)']);return self.proc
    worker=Slow(prepared,[])
    def cancel():
        deadline=time.monotonic()+10
        while not hasattr(worker,'proc') and time.monotonic()<deadline:time.sleep(.02)
        prepared.cancel('a',row['id'])
    thread=threading.Thread(target=cancel);thread.start();worker.run_one(row,key='FAKE-TEST-NOT-A-KEY');thread.join()
    assert prepared.get('a',row['id'])['status']=='cancelled' and worker.proc.poll() is not None

def test_untrusted_publish_destination_cannot_overwrite_other_owner_data(prepared,monkeypatch):
    # Bypass only soft disk guard to exercise the independent no-follow publication boundary.
    monkeypatch.setattr(prepared,'disk_ok',lambda:True)
    prepared.create('a',{'text':'A little fox finds his friend in a tree house. '*3},'test_key_00000000001');row=prepared.claim()
    victim=prepared.root/'other-owner-secret-data';victim.write_text('SYNTHETIC_OTHER_OWNER_DO_NOT_OVERWRITE')
    class SymlinkWorker(FakeWorker):
        def start_agent(self,work,sock,prompt,resume):
            # Equivalent to an agent leaving a dangling host-absolute symlink before exiting its namespace.
            (work/'book.json').symlink_to(victim)
            return super().start_agent(work,sock,prompt,resume)
    worker=SymlinkWorker(prepared,['valid']);worker.run_one(row,key='FAKE-TEST-NOT-A-KEY')
    assert victim.read_text()=='SYNTHETIC_OTHER_OWNER_DO_NOT_OVERWRITE'
    assert prepared.get('a',row['id'])['status']=='ready'
    assert not (prepared.jobdir(row['id'])/'book.json').is_symlink()

def test_review_rejects_output_path_and_file_symlink(tmp_path):
    work=tmp_path/'work';work.mkdir();outside=tmp_path/'outside';outside.mkdir()
    (outside/'book.json').write_text(json.dumps(valid()));(outside/'report.md').write_text('x'*200)
    (work/'outputs').symlink_to(outside,target_is_directory=True)
    assert not review(work,Path(sys.prefix)/'bin/node')['passed']
    (work/'outputs').unlink();(work/'outputs').mkdir()
    (work/'outputs/book.json').symlink_to(outside/'book.json')
    (work/'outputs/report.md').write_text('x'*200)
    assert not review(work,Path(sys.prefix)/'bin/node')['passed']

def test_repair_broker_socket_is_not_in_untrusted_workspace(prepared,monkeypatch):
    # Ensure protection is intrinsic to mount capability placement, not the soft symlink/disk guard.
    monkeypatch.setattr(prepared,'disk_ok',lambda:True)
    prepared.create('a',{'text':'A little fox finds his friend in a tree house. '*3},'test_key_00000000001');row=prepared.claim()
    victim=prepared.root/'synthetic-private-owner-data';victim.write_text('DO_NOT_BIND_INTO_AGENT')
    class SocketSwap(FakeWorker):
        def start_agent(self,work,sock,prompt,resume):
            assert work not in sock.parents and sock.parent.name=='run'
            if not resume:(work/'broker.sock').symlink_to(victim)
            assert sock.is_socket() and not sock.is_symlink()
            return super().start_agent(work,sock,prompt,resume)
    worker=SocketSwap(prepared,['invalid','valid']);worker.run_one(row,key='FAKE-TEST-NOT-A-KEY')
    assert prepared.get('a',row['id'])['status']=='ready'
    assert victim.read_text()=='DO_NOT_BIND_INTO_AGENT' and list((prepared.root/'run').iterdir())==[]


def test_review_report_is_bounded_for_multibyte_and_escaped_source():
    from reader_service.review_entry import encoded_report
    report={'passed':False,'status':'failed','errors':['\x01😀'*150]*13,'evidence':['😀'*200]*8}
    raw=encoded_report(report)
    assert len(raw.encode('utf-8'))<=19000
    assert not json.loads(raw)['passed'] and len(json.loads(raw)['errors'])==13
