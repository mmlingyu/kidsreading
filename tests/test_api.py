import hashlib, json, time
import pytest
from fastapi.testclient import TestClient
from reader_service.api import create_app
from reader_service.core import Settings, Store, Fault

TOKENS={'a':'A'*48,'b':'B'*48}
@pytest.fixture
def setup(tmp_path):
    s=Settings(tmp_path,{hashlib.sha256(token.encode()).hexdigest():owner for owner,token in TOKENS.items()},
               origins=('https://reader.example.test',))
    app=create_app(s)
    return s,app.state.store,TestClient(app)

def headers(who='a',key='key_00000000000000001'):
    return {'Authorization':'Bearer '+TOKENS[who],'Idempotency-Key':key}
BODY={'source':'text','text':'This is a story about a small fox. '*3,'age':'8-12'}
def post(c,who='a',key='key_00000000000000001',body=BODY):
    return c.post('/api/reader/imports',headers=headers(who,key),json=body)

def test_auth(setup):
    _,_,c=setup
    for method,path in [('post','/api/reader/imports'),('get','/api/reader/imports/'+'a'*32),('post','/api/reader/imports/'+'a'*32+'/cancel')]:
        assert getattr(c,method)(path).status_code==401
    assert c.get('/api/reader/imports/'+'a'*32,headers={'Authorization':'Bearer '+('X'*48)}).status_code==401

def test_owner_and_traversal(setup):
    _,s,c=setup
    j=post(c).json(); assert j['version']==1 and j['status']=='queued'
    jid=j['id']
    assert c.get('/api/reader/imports/'+jid,headers=headers('b')).status_code==404
    assert c.post('/api/reader/imports/'+jid+'/cancel',headers=headers('b')).status_code==404
    for path in ['../secret','..%2Fsecret','%2e%2e%2fsecret','not-a-uuid','a'*33]:
        assert c.get('/api/reader/imports/'+path,headers=headers()).status_code in (404,405)
    with pytest.raises(Fault): s.jobdir('../secret')
    assert c.get('/api/reader/imports/'+jid,headers=headers()).headers['cache-control']=='no-store'

def test_bounds_and_url_validation(setup):
    _,s,c=setup
    for text in ['', 'a'*19,'a'*20001]:
        assert post(c,body={**BODY,'text':text}).status_code==400
    for url in ['http://127.0.0.1','http://169.254.169.254/latest/meta-data','http://[::1]','file:///etc/passwd']:
        r=post(c,body={'source':'url','url':url}); assert r.status_code==400
    r=post(c,body={'source':'url','url':'https://example.com/story','age':'4-6'})
    assert r.status_code==202
    jid=r.json()['id'];assert s.get('a',jid)['source']=='url'
    assert c.get('/api/reader/imports/'+jid,headers=headers('b')).status_code==404
    assert c.post('/api/reader/imports/'+jid+'/cancel',headers=headers('b')).status_code==404
    assert c.post('/api/reader/imports/'+jid+'/cancel',headers=headers()).json()['status']=='cancelled'
    assert post(c,body={**BODY,'age':'2-3'}).status_code==400
    assert post(c,body={**BODY,'owner':'b'}).status_code==400
    assert c.post('/api/reader/imports',headers=headers(),content=b'X'*100001).status_code==415
    assert c.post('/api/reader/imports',headers={**headers(),'Content-Type':'application/json'},content=b'X'*100001).status_code==413
    assert post(c,key='short').status_code==400

def test_persistence_idempotency_and_rate(setup):
    config,s,c=setup
    first=post(c).json()
    assert post(c).json()['id']==first['id']
    assert post(c,body={**BODY,'text':BODY['text']+'different'}).status_code==409
    assert post(c,key='another_key_0000000001').status_code==429
    assert post(c,'b').status_code==202
    again=Store(config)
    assert again.get('a',first['id'])['status']=='queued'
    assert again.claim()['id']==first['id']
    again.recover()
    assert again.get('a',first['id'])['status']=='failed'
    assert again.get('a',first['id'])['error']=='worker_restarted'
    assert again.get('a',first['id'])['text']==''

def test_cancel_states(setup):
    _,s,c=setup
    jid=post(c).json()['id']
    url='/api/reader/imports/'+jid+'/cancel'
    assert c.post(url,headers=headers()).json()['status']=='cancelled'
    assert s.get('a',jid)['text']==''
    jid=post(c,key='next_000000000000001').json()['id']; s.claim()
    url='/api/reader/imports/'+jid+'/cancel'
    assert c.post(url,headers=headers()).json()['status']=='cancelling'
    s.finish(jid,'ready')
    assert s.get('a',jid)['status']=='cancelled'

def test_cors_and_no_studio(setup):
    _,_,c=setup
    assert post(c).status_code==202
    assert c.get('/api/reader/health',headers={'Origin':'https://evil.test'}).status_code==403
    r=c.options('/api/reader/imports',headers={'Origin':'https://reader.example.test','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,idempotency-key'})
    assert r.status_code==200 and r.headers['access-control-allow-origin']=='https://reader.example.test'
    assert c.get('/api/reader/health').status_code==503
    for path in ['/docs','/openapi.json','/api/studio','/api/tts','/api/voices','/api/health','/rpc']:
        assert c.get(path).status_code==404

def test_capacity_and_disk(setup):
    config,s,c=setup
    config.max_jobs=0
    assert post(c).status_code==429
    config.max_jobs=200; config.max_disk=-1
    assert post(c).status_code==507

def test_artifact_only_ready_no_path(setup):
    _,s,c=setup
    jid=post(c).json()['id']; s.claim()
    folder=s.jobdir(jid); folder.mkdir(); (folder/'book.json').write_text('{"chapters":[]}')
    assert c.get('/api/reader/imports/'+jid,headers=headers()).json()['book'] is None
    s.finish(jid,'ready')
    assert c.get('/api/reader/imports/'+jid,headers=headers()).json()['book']=={'chapters':[]}
    assert c.get('/api/reader/imports/'+jid+'/book.json',headers=headers()).status_code==404
    (folder/'book.json').unlink(); (folder/'book.json').symlink_to('/etc/passwd')
    assert c.get('/api/reader/imports/'+jid,headers=headers()).status_code==500

def test_hourly_limit(setup):
    config,s,c=setup
    config.max_hour=1
    jid=post(c).json()['id']; c.post('/api/reader/imports/'+jid+'/cancel',headers=headers())
    r=post(c,key='other_000000000000000')
    assert r.status_code==429 and r.headers['Retry-After']=='60'

def test_no_raw_data_in_public_response(setup):
    _,_,c=setup
    raw=post(c).text
    for forbidden in [BODY['text'],TOKENS['a'],'request_hash','owner','key_00000000000000001']:
        assert forbidden not in raw

def test_r1_sqlite_additive_migration(tmp_path):
    import sqlite3
    path=tmp_path/'queue.sqlite3'
    with sqlite3.connect(path) as db:
        db.executescript('''CREATE TABLE jobs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,key TEXT NOT NULL,request_hash TEXT NOT NULL,age TEXT NOT NULL,text TEXT NOT NULL,status TEXT NOT NULL,error TEXT NOT NULL DEFAULT '',created REAL NOT NULL,updated REAL NOT NULL,UNIQUE(owner,key));CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT);''')
    s=Settings(tmp_path,{hashlib.sha256(TOKENS['a'].encode()).hexdigest():'a'})
    store=Store(s);row=store.create('a',BODY,'migration_key_00000001')
    assert row['source']=='text' and row['review_attempts']==0
    with store.db() as db:assert db.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()[0]=='2'
