"""Offline protocol/security coverage. Only synthetic credentials and audio."""
import asyncio,io,json,time,wave
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from reader_service.api import create_app
from reader_service.core import Settings,Fault
from reader_service.tts_proxy import TtsProxy,MAX_AUDIO,until_disconnect

FAKE='OFFLINE-TTS-TOKEN-NOT-A-REAL-CREDENTIAL-12345'
PIPER={'voices':[{'voice':'en_US-joe-medium','name':'Joe','language':'en','licenseClass':'attribution','datasetLicense':'Synthetic-Test-License','path':'/PRIVATE/DO-NOT-EXPOSE','modelPath':'/private/model.onnx'}, {'voice':'zh_CN-chaowen-medium','language':'zh'}, {'voice':'ja_JP-hi_fi_captain-medium','language':'ja','licenseClass':'noncommercial'}]}
PHONON={'voices':[{'id':'default','voice':'Default','language':'en'}, {'id':'NbpkqMVS3CJeq2j8','voice':'Zoey','locale':'en-US','filename':'/private/voice.safetensors'}], 'license':'Apache-2.0'}
def wav_bytes(rate=24000,channels=1,width=2):
 b=io.BytesIO()
 with wave.open(b,'wb') as f:f.setnchannels(channels);f.setsampwidth(width);f.setframerate(rate);f.writeframes(b'\0'*(rate//20*channels*width))
 return b.getvalue()
def response(body,kind='application/json',status=200,headers=b''):
 if isinstance(body,dict):body=json.dumps(body).encode()
 return b'HTTP/1.1 '+str(status).encode()+b' Test\r\nContent-Type: '+kind.encode()+b'\r\nContent-Length: '+str(len(body)).encode()+b'\r\n'+headers+b'\r\n'+body
class Writer:
 def __init__(self):self.data=bytearray();self.closed=False
 def write(self,b):self.data.extend(b)
 async def drain(self):pass
 def close(self):self.closed=True
 async def wait_closed(self):pass
class Wire:
 def __init__(self,*responses):self.responses=list(responses);self.writers=[];self.destinations=[]
 async def __call__(self,*args,**kwargs):
  self.destinations.append(args);r=asyncio.StreamReader();r.feed_data(self.responses.pop(0));r.feed_eof();w=Writer();self.writers.append(w);return r,w
 def proxy(self):return TtsProxy(FAKE,connector=self)
def run(awaitable):return asyncio.run(awaitable)
def test_live_catalog_normalization_and_cache():
 wire=Wire(response(PIPER),response(PHONON));proxy=wire.proxy()
 async def work():
  rows=await proxy.voices('piper');assert rows[0]['id']=='en_US-joe-medium'
  assert set(rows[0])=={'engine','id','name','language','license'}
  assert '/private' not in json.dumps(rows).lower() and 'modelPath' not in json.dumps(rows)
  assert 'attribution' in rows[0]['license'] and 'noncommercial' in rows[-1]['license']
  assert await proxy.voices('piper')==rows
  phonon=await proxy.voices('phonon');assert phonon[1]['name']=='Zoey' and phonon[1]['license']=='Apache-2.0'
 run(work());assert wire.destinations==[('127.0.0.1',8800)]*2
 for w in wire.writers:
  assert w.closed and ('Authorization: Bearer '+FAKE).encode() in w.data and b'Proxy-Authorization' not in w.data
 assert b'/api/voices?engine=piper' in wire.writers[0].data
@pytest.mark.parametrize('payload,code',[
 ({'engine':'pocket','text':'Hello'},'tts_bad_engine'),
 ({'engine':[],'text':'Hello'},'tts_bad_engine'),
 ({'engine':'phonon','text':'你好'},'tts_han_text'),
 ({'engine':'phonon','text':'\U00020000'},'tts_han_text'),
 ({'engine':'phonon','text':'a'*1001},'tts_invalid_text'),
 ({'engine':'piper','text':'a'*2001},'tts_invalid_text'),
 ({'engine':'phonon','text':'hello\0'},'tts_invalid_text'),
 ({'engine':'piper','text':'  '},'tts_invalid_text'),
 ({'engine':'phonon','text':'Hello','language':'zh'},'tts_bad_language'),
 ({'engine':'piper','text':'Hello','language':[]},'tts_bad_language'),
 ({'engine':'piper','text':'Hello','url':'https://evil.test'},'tts_bad_request'),
 ({'engine':'piper','text':'Hello','speed':1},'tts_bad_request'),
 ({'engine':'piper','text':'Hello','variant':'x'},'tts_bad_request'),
 ({'engine':'piper','text':'Hello','voice':'../../x'},'tts_bad_voice'),
])
def test_reject_bad_input_before_network(payload,code):
 wire=Wire();p=wire.proxy()
 with pytest.raises(Fault) as e:run(p.synthesize(payload))
 assert e.value.code==code and not wire.destinations
@pytest.mark.parametrize('engine,voice,lang,catalog',[('piper','en_US-joe-medium','en',PIPER),('phonon','zOeY','en',PHONON),('piper','ja_JP-hi_fi_captain-medium','ja',PIPER)])
def test_exact_post_wav_and_canonical_id(engine,voice,lang,catalog):
 wav=wav_bytes(22050 if engine=='piper' else 24000)
 wire=Wire(response(catalog),response(wav,'audio/wav',headers=b'X-Engine: Safe\r\nX-Voice: voice\r\nX-Private-Path: /SECRET\r\nSet-Cookie: secret\r\n'));p=wire.proxy()
 payload={'engine':engine,'text':'Hello','voice':voice,'language':lang}
 if lang=='ja':payload['speaker']='male'
 data,headers=run(p.synthesize(payload));assert data==wav and headers=={'x-engine':'Safe','x-voice':'voice'}
 sent=json.loads(bytes(wire.writers[1].data).split(b'\r\n\r\n',1)[1]);assert set(sent)<= {'text','engine','voice','language','speaker'}
 if engine=='phonon':assert sent['voice']=='NbpkqMVS3CJeq2j8'
 assert wire.destinations==[('127.0.0.1',8800)]*2
@pytest.mark.parametrize('speaker',[True,0.0,[],{},'wrong'])
def test_bad_speaker(speaker):
 p=Wire(response(PIPER)).proxy()
 with pytest.raises(Fault) as e:run(p.synthesize({'engine':'piper','text':'Hello','language':'ja','speaker':speaker}))
 assert e.value.code=='tts_bad_speaker'
def test_phonon_cannot_take_speaker_or_unknown_voice():
 for extra in [{'speaker':'male'},{'voice':'unknown'},{'voice':'zoey','language':'fr'}]:
  with pytest.raises(Fault):run(Wire(response(PHONON)).proxy().synthesize({'engine':'phonon','text':'Hello',**extra}))
@pytest.mark.parametrize('status,expected,code',[(301,502,'tts_upstream_unavailable'),(400,400,'tts_request_rejected'),(401,502,'tts_upstream_auth_failed'),(403,502,'tts_upstream_auth_failed'),(429,429,'tts_upstream_busy'),(500,502,'tts_upstream_unavailable'),(504,504,'tts_timeout')])
def test_upstream_error_is_sanitized_not_retried(status,expected,code):
 wire=Wire(response({'error':'/SECRET '+FAKE},status=status));p=wire.proxy()
 with pytest.raises(Fault) as e:run(p.voices('piper'))
 assert (e.value.status,e.value.code)==(expected,code) and len(wire.writers)==1 and wire.writers[0].closed
@pytest.mark.parametrize('data,ctype',[(b'{}','audio/wav'),(b'RIFFxxxxWAVE'+b'\0'*60,'audio/wav'),(wav_bytes(channels=2),'audio/wav'),(wav_bytes(width=1),'audio/wav'),(wav_bytes(),'text/html')])
def test_invalid_audio_never_forwarded(data,ctype):
 wire=Wire(response(PIPER),response(data,ctype));p=wire.proxy()
 with pytest.raises(Fault) as e:run(p.synthesize({'engine':'piper','language':'en','text':'Hello'}))
 assert e.value.code=='tts_invalid_audio'
def test_oversized_audio_rejected_by_headers():
 raw=b'HTTP/1.1 200 OK\r\nContent-Type: audio/wav\r\nContent-Length: '+str(MAX_AUDIO+1).encode()+b'\r\n\r\n'
 wire=Wire(raw)
 with pytest.raises(Fault) as e:run(wire.proxy().exchange('POST','/api/tts',{},MAX_AUDIO))
 assert e.value.code=='tts_response_too_large' and wire.writers[0].closed
def test_chunked_and_no_proxy_environment(monkeypatch):
 monkeypatch.setenv('HTTP_PROXY','http://evil.invalid');monkeypatch.setenv('ALL_PROXY','socks://evil.invalid')
 body=json.dumps(PHONON).encode();raw=b'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n'+hex(len(body))[2:].encode()+b'\r\n'+body+b'\r\n0\r\n\r\n'
 wire=Wire(raw);assert len(run(wire.proxy().voices('phonon')))==2 and wire.destinations==[('127.0.0.1',8800)]
def test_timeout_and_global_busy_rate():
 async def timeout(*a,**k):raise TimeoutError()
 p=TtsProxy(FAKE,connector=timeout)
 with pytest.raises(Fault) as e:run(p.voices('piper'))
 assert e.value.status==504 and not p.active
 p=TtsProxy(FAKE);p.active=True
 with pytest.raises(Fault) as e:run(p.exchange('GET','/api/voices?engine=piper'))
 assert e.value.status==429
 p=TtsProxy(FAKE)
 for _ in range(60):p.authorize_budget('owner','audio')
 with pytest.raises(Fault) as e:p.authorize_budget('owner','audio')
 assert e.value.status==429
 p.authorize_budget('other-owner','audio')
def test_real_socket_disconnect_cancels_loopback_io():
 async def work():
  connected=asyncio.Event();closed=asyncio.Event()
  async def upstream(r,w):
   try:
    await r.readuntil(b'\r\n\r\n');connected.set();assert await r.read()==b'';closed.set()
   finally:w.close();await w.wait_closed()
  server=await asyncio.start_server(upstream,'127.0.0.1',0)
  async def connect(host,port,**kw):
   assert (host,port)==('127.0.0.1',8800)
   return await asyncio.open_connection('127.0.0.1',server.sockets[0].getsockname()[1],**kw)
  class Request:
   async def receive(self):
    await connected.wait();return {'type':'http.disconnect'}
  p=TtsProxy(FAKE,connector=connect)
  try:
   with pytest.raises(Fault) as e:await until_disconnect(Request(),p.exchange('GET','/api/voices?engine=piper'))
   assert e.value.status==499 and not p.active and p.cooldown>time.monotonic()
   with pytest.raises(Fault) as busy:await p.exchange('GET','/api/voices?engine=piper')
   assert busy.value.status==429 and busy.value.code=='tts_busy'
   await asyncio.wait_for(closed.wait(),1)
  finally:server.close();await server.wait_closed()
 run(work())
def client(tmp_path,proxy):
 import hashlib
 token='A'*48
 settings=Settings(tmp_path,{hashlib.sha256(token.encode()).hexdigest():'owner'})
 return TestClient(create_app(settings,tts_proxy=proxy)),{'Authorization':'Bearer '+token}
def test_reader_auth_and_no_anonymous_proxy(tmp_path):
 wire=Wire(response(PIPER));c,headers=client(tmp_path,wire.proxy())
 with c:
  assert c.get('/api/reader/tts/voices?engine=piper').status_code==401
  assert c.post('/api/reader/tts',json={'engine':'piper','text':'Hello'}).status_code==401
  assert not wire.destinations
  assert c.get('/api/reader/tts/voices?engine=all',headers=headers).status_code==400
  assert c.get('/api/reader/tts/voices?engine=piper&url=http://evil',headers=headers).status_code==400
  r=c.get('/api/reader/tts/voices?engine=piper',headers=headers)
  assert r.status_code==200 and r.json()['version']==1 and 'PRIVATE' not in r.text
  assert r.headers['cache-control']=='no-store'
def test_api_audio_missing_config_and_body_bound(tmp_path):
 c,headers=client(tmp_path,TtsProxy(''))
 with c:
  assert c.post('/api/reader/tts',json={'text':'hello','engine':'piper'},headers=headers).status_code==503
 c,headers=client(tmp_path,Wire(response(PIPER),response(wav_bytes(),'audio/wav')).proxy())
 with c:
  assert c.post('/api/reader/tts?url=http://evil',json={},headers=headers).status_code==400
  assert c.post('/api/reader/tts',content=b'x'*14001,headers={**headers,'Content-Type':'application/json'}).status_code==413
  r=c.post('/api/reader/tts',headers=headers,json={'engine':'piper','language':'en','text':'hello'})
  assert r.status_code==200 and r.headers['content-type']=='audio/wav' and r.content[:4]==b'RIFF'
def test_only_api_unit_can_load_tts_credential():
 root=Path(__file__).resolve().parents[1]
 api=(root/'deploy/reader-api.service').read_text();worker=(root/'deploy/reader-worker.service').read_text()
 assert 'EnvironmentFile=-/etc/reader/tts-client.env' in api
 assert 'tts-client' not in worker and 'UnsetEnvironment=TTS_API_TOKEN' in worker
 assert '/etc/local-tts-api.env' not in api
 assert 'RestrictSUIDSGID=true' in api

def test_exchange_path_allowlist_even_for_internal_callers():
 p=TtsProxy(FAKE)
 for path in ['http://169.254.169.254/','/api/health','/api/tts?url=evil','/api/voices?engine=all']:
  with pytest.raises(Fault) as e:run(p.exchange('GET',path))
  assert e.value.code=='tts_bad_request'

def test_piper_trimmed_limit_and_inferred_language():
 wire=Wire(response(PIPER),response(wav_bytes(),'audio/wav'));p=wire.proxy()
 run(p.synthesize({'engine':'piper','voice':'en_US-joe-medium','text':' '*1000+'a'*2000+' '*1000}))
 outgoing=json.loads(bytes(wire.writers[-1].data).split(b'\r\n\r\n',1)[1])
 assert len(outgoing['text'])==2000 and outgoing['language']=='en'

def test_catalog_rejects_filename_ids_and_type_errors():
 for row in [{'voice':'/etc/passwd','language':'en'},{'voice':'hello','language':[]},{'voice':'hello','language':'xx'}]:
  with pytest.raises(Fault) as e:run(Wire(response({'voices':[row]})).proxy().voices('piper'))
  assert e.value.code=='tts_invalid_catalog'

def test_public_phonon_metadata_snapshot_is_not_a_hardcoded_voice_count():
 root=Path(__file__).resolve().parent
 catalog=json.loads((root/'fixtures/phonon-public-catalog.json').read_text())
 rows=run(Wire(response(catalog)).proxy().voices('phonon'))
 assert len(rows)==len(catalog['voices']) and rows[1]['name']=='Zoey'
 assert all(set(row)=={'engine','id','name','language','license'} for row in rows)
 assert all('filename' not in row for row in rows)

def test_invalid_unicode_text_is_a_safe_input_error():
 with pytest.raises(Fault) as e:run(Wire().proxy().synthesize({'engine':'phonon','text':'bad\ud800'}))
 assert e.value.code=='tts_invalid_text'

def test_actual_asgi_disconnect_closes_pending_tts_and_releases_slot(tmp_path):
 async def work():
  connected=asyncio.Event();upstream_closed=asyncio.Event()
  async def upstream(r,w):
   try:
    head=await r.readuntil(b'\r\n\r\n')
    length=int(next(line.split(b':',1)[1] for line in head.split(b'\r\n') if line.lower().startswith(b'content-length:')))
    await r.readexactly(length);connected.set()
    assert await r.read()==b'';upstream_closed.set()
   finally:w.close();await w.wait_closed()
  server=await asyncio.start_server(upstream,'127.0.0.1',0)
  async def connector(host,port,**kwargs):
   assert (host,port)==('127.0.0.1',8800)
   return await asyncio.open_connection('127.0.0.1',server.sockets[0].getsockname()[1],**kwargs)
  import hashlib,time
  p=TtsProxy(FAKE,connector=connector)
  p.cache['phonon']=(time.monotonic()+60,[{'id':'default','name':'Default','language':'en','engine':'phonon','license':'Test'}])
  app=create_app(Settings(tmp_path,{hashlib.sha256(b'A'*48).hexdigest():'owner'}),tts_proxy=p)
  events=asyncio.Queue();body=json.dumps({'engine':'phonon','text':'Hello','voice':'default'}).encode()
  await events.put({'type':'http.request','body':body,'more_body':False})
  scope={'type':'http','asgi':{'version':'3.0'},'http_version':'1.1','method':'POST','scheme':'https','path':'/api/reader/tts','raw_path':b'/api/reader/tts','query_string':b'','root_path':'','headers':[(b'host',b'reader.test'),(b'authorization',b'Bearer '+b'A'*48),(b'content-type',b'application/json')],'client':('127.0.0.1',1234),'server':('reader.test',443)}
  async def send(message):pass
  task=asyncio.create_task(app(scope,events.get,send))
  try:
   await asyncio.wait_for(connected.wait(),2)
   await events.put({'type':'http.disconnect'})
   await asyncio.wait_for(upstream_closed.wait(),2)
   await asyncio.wait_for(task,2)
   assert not p.active
  finally:
   if not task.done():task.cancel()
   await asyncio.gather(task,return_exceptions=True)
   server.close();await server.wait_closed()
 run(work())

def test_chunked_body_budget_is_enforced_without_content_length():
 body=b'x'*33
 raw=b'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n21\r\n'+body+b'\r\n0\r\n\r\n'
 wire=Wire(raw)
 with pytest.raises(Fault) as e:run(wire.proxy().exchange('GET','/api/voices?engine=piper',limit=16))
 assert e.value.code=='tts_response_too_large' and wire.writers[0].closed

def test_upstream_response_header_budget():
 wire=Wire(response(PIPER,headers=b'X-Large: '+b'x'*20000+b'\r\n'))
 with pytest.raises(Fault):run(wire.proxy().voices('piper'))
 assert wire.writers[0].closed

def test_audio_lease_survives_slow_asgi_send_and_releases(tmp_path):
 async def work():
  import hashlib
  p=Wire(response(PIPER),response(wav_bytes(),'audio/wav')).proxy()
  app=create_app(Settings(tmp_path,{hashlib.sha256(b'A'*48).hexdigest():'owner'}),tts_proxy=p)
  sending=asyncio.Event();release=asyncio.Event();events=asyncio.Queue()
  await events.put({'type':'http.request','body':json.dumps({'engine':'piper','language':'en','text':'Hello'}).encode(),'more_body':False})
  scope={'type':'http','asgi':{'version':'3.0'},'http_version':'1.1','method':'POST','scheme':'https','path':'/api/reader/tts','raw_path':b'/api/reader/tts','query_string':b'','root_path':'','headers':[(b'host',b'reader.test'),(b'authorization',b'Bearer '+b'A'*48),(b'content-type',b'application/json')],'client':('127.0.0.1',1234),'server':('reader.test',443)}
  async def send(message):
   if message['type']=='http.response.body' and message.get('body'):
    sending.set();await release.wait()
  task=asyncio.create_task(app(scope,events.get,send))
  try:
   await asyncio.wait_for(sending.wait(),2)
   assert not p.active and p.audio_lease is not None,'lease must outlive upstream completion'
   # Independent rejected request must not release the first request's lease.
   from reader_service.tts_proxy import AudioTransferBoundary
   async def other(scope,receive,send):pass
   await AudioTransferBoundary(other,p)(dict(scope,**{'reader.tts.audio_lease':None}),events.get,send)
   assert p.audio_lease is not None
   release.set();await asyncio.wait_for(task,2);assert p.audio_lease is None
  finally:
   if not task.done():task.cancel()
   await asyncio.gather(task,return_exceptions=True)
 run(work())
