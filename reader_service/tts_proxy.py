"""Reader-authenticated, bounded async bridge to ONE fixed loopback TTS service.
No arbitrary upstream, credentials file reads, redirects, proxy env, or model process.
"""
import asyncio, contextlib, io, json, os, re, time, wave
from collections import deque
import h11
from .core import Fault

UPSTREAM=('127.0.0.1',8800)
MAX_AUDIO=12*1024*1024
MAX_META=128*1024
VOICE_ID=re.compile(r'[A-Za-z0-9_-]{1,100}')
HAN=re.compile(r'[\u3400-\u9fff\uf900-\ufaff\U00020000-\U000323af]')
LANGS={'en','zh','fr','ja','ko'}
# x-streaming is intentionally absent: the upstream body is one complete WAV, not an inference stream.
SAFE_HEADERS={'x-engine','x-voice','x-language','x-sample-rate','x-audio-duration','x-synth-seconds','x-rtf'}

class TtsProxy:
    def __init__(self,token=None,connector=None):
        self.token=os.environ.get('TTS_API_TOKEN','') if token is None else token
        self.connector=connector or asyncio.open_connection
        self.active=False;self.cooldown=0;self.rates={};self.cache={};self.audio_lease=None
    @property
    def configured(self):
        return bool(re.fullmatch(r'[A-Za-z0-9._~+/=-]{16,512}',self.token))
    def authorize_budget(self,owner,kind):
        if not self.configured:raise Fault(503,'tts_not_configured')
        now=time.monotonic();key=(owner,kind);bucket=self.rates.setdefault(key,deque())
        while bucket and bucket[0]<=now-60:bucket.popleft()
        if len(bucket)>=(60 if kind=='audio' else 20):raise Fault(429,'tts_rate_limited')
        bucket.append(now)
    async def exchange(self,method,path,payload=None,limit=MAX_META):
        if (method,path) not in {('GET','/api/voices?engine=piper'),('GET','/api/voices?engine=phonon'),('POST','/api/tts')}:raise Fault(400,'tts_bad_request')
        if self.active or time.monotonic()<self.cooldown:raise Fault(429,'tts_busy')
        self.active=True;writer=None
        try:
            async with asyncio.timeout(210):
                reader,writer=await asyncio.wait_for(self.connector(*UPSTREAM,limit=32768),10)
                conn=h11.Connection(h11.CLIENT,max_incomplete_event_size=16384)
                data=b'' if payload is None else json.dumps(payload,ensure_ascii=False).encode('utf-8')
                headers=[('Host','127.0.0.1:8800'),('Authorization','Bearer '+self.token),('Connection','close'),('Accept','audio/wav, application/json')]
                if payload is not None:headers.extend([('Content-Type','application/json'),('Content-Length',str(len(data)))])
                writer.write(conn.send(h11.Request(method=method,target=path,headers=headers)))
                if data:writer.write(conn.send(h11.Data(data=data)))
                writer.write(conn.send(h11.EndOfMessage()));await writer.drain()
                body=bytearray();out_headers=None;info=0
                while True:
                    event=conn.next_event()
                    if event is h11.NEED_DATA:
                        chunk=await asyncio.wait_for(reader.read(16384),200)
                        conn.receive_data(chunk)
                    elif isinstance(event,h11.InformationalResponse):
                        info+=1
                        if info>4:raise Fault(502,'tts_invalid_response')
                    elif isinstance(event,h11.Response):
                        if sum(len(k)+len(v)+4 for k,v in event.headers)+32>16384:raise Fault(502,'tts_invalid_response')
                        status=event.status_code
                        if status!=200:
                            if status==429:self.cooldown=time.monotonic()+2;raise Fault(429,'tts_upstream_busy')
                            if status in (401,403):raise Fault(502,'tts_upstream_auth_failed')
                            if status in (408,504):raise Fault(504,'tts_timeout')
                            if status==400:raise Fault(400,'tts_request_rejected')
                            raise Fault(502,'tts_upstream_unavailable')
                        out_headers={k.decode('ascii').lower():v.decode('ascii') for k,v in event.headers}
                        if int(out_headers.get('content-length','0'))>limit:raise Fault(502,'tts_response_too_large')
                    elif isinstance(event,h11.Data):
                        if len(body)+len(event.data)>limit:raise Fault(502,'tts_response_too_large')
                        body.extend(event.data)
                    elif isinstance(event,h11.EndOfMessage):
                        if out_headers is None:raise Fault(502,'tts_invalid_response')
                        return bytes(body),out_headers
                    elif isinstance(event,h11.ConnectionClosed):raise Fault(502,'tts_invalid_response')
                    else:raise Fault(502,'tts_invalid_response')
        except asyncio.CancelledError:
            self.cooldown=time.monotonic()+2
            raise
        except TimeoutError:
            self.cooldown=time.monotonic()+2;raise Fault(504,'tts_timeout') from None
        except Fault:raise
        except Exception:raise Fault(502,'tts_upstream_unavailable') from None
        finally:
            if writer is not None:
                writer.close()
                with contextlib.suppress(Exception,asyncio.CancelledError):await asyncio.wait_for(writer.wait_closed(),1)
            self.active=False
    async def voices(self,engine):
        if not isinstance(engine,str) or engine not in {'piper','phonon'}:raise Fault(400,'tts_bad_engine')
        cached=self.cache.get(engine)
        if cached and cached[0]>time.monotonic():return cached[1]
        body,headers=await self.exchange('GET','/api/voices?engine='+engine)
        if headers.get('content-type','').split(';')[0].lower()!='application/json':raise Fault(502,'tts_invalid_catalog')
        try:
            catalog=json.loads(body)
            rows=catalog['voices']
            if not isinstance(rows,list) or len(rows)>128:raise ValueError()
            clean=[];seen=set()
            for row in rows:
                if not isinstance(row,dict):raise ValueError()
                ident=row.get('voice') if engine=='piper' else row.get('id')
                if not isinstance(ident,str) or not VOICE_ID.fullmatch(ident) or ident in seen:raise ValueError()
                seen.add(ident)
                language=row.get('language',row.get('locale','en' if engine=='phonon' else ''))
                language=language.lower().replace('_','-').split('-')[0] if isinstance(language,str) else ''
                if language not in LANGS:raise ValueError()
                name=row.get('name') or (row.get('voice') if engine=='phonon' else None) or ident
                if not isinstance(name,str) or not re.fullmatch(r'[\w .()\-·]{1,100}',name):name=ident
                license_parts=[]
                for field in ['licenseClass','datasetLicense','license']:
                    value=row.get(field,catalog.get(field) if field=='license' else None)
                    if isinstance(value,dict):value=value.get('name') or value.get('spdx') or value.get('id')
                    if isinstance(value,str) and re.fullmatch(r'[A-Za-z0-9 ._+()\-]{1,120}',value):license_parts.append(value)
                clean.append({'engine':engine,'id':ident,'name':name,'language':language,'license':' · '.join(dict.fromkeys(license_parts)) or '未提供授权标识'})
        except (ValueError,KeyError,TypeError,UnicodeError):raise Fault(502,'tts_invalid_catalog') from None
        self.cache[engine]=(time.monotonic()+60,clean)
        return clean
    async def synthesize(self,payload):
        if not isinstance(payload,dict) or set(payload)-{'text','engine','language','voice','speaker'}:raise Fault(400,'tts_bad_request')
        engine=payload.get('engine');text=payload.get('text');language=payload.get('language')
        if not isinstance(engine,str) or engine not in {'piper','phonon'}:raise Fault(400,'tts_bad_engine')
        if not isinstance(text,str) or not text.strip() or '\x00' in text or len(text.strip() if engine=='piper' else text)>(2000 if engine=='piper' else 1000):raise Fault(400,'tts_invalid_text')
        try:text.encode('utf-8')
        except UnicodeError:raise Fault(400,'tts_invalid_text') from None
        if language is not None and (not isinstance(language,str) or language not in LANGS or (engine=='phonon' and language!='en')):raise Fault(400,'tts_bad_language')
        if engine=='phonon' and HAN.search(text):raise Fault(400,'tts_han_text')
        voice=payload.get('voice')
        if voice is not None and (not isinstance(voice,str) or len(voice)>100 or not re.fullmatch(r'[\w .()\-]{1,100}',voice)):raise Fault(400,'tts_bad_voice')
        rows=await self.voices(engine);chosen=None
        if voice is not None:
            chosen=next((r for r in rows if (r['id']==voice if engine=='piper' else voice.casefold() in {r['id'].casefold(),r['name'].casefold()})),None)
            if chosen is None:raise Fault(400,'tts_bad_voice')
            voice=chosen['id']  # Canonical public ID only, never a free-form upstream parameter.
        if language is None:language=chosen['language'] if chosen is not None else ('en' if engine=='phonon' else 'zh')
        if chosen is not None and chosen['language']!=language:raise Fault(400,'tts_bad_voice')
        if 'speaker' in payload and (engine!='piper' or language!='ja' or type(payload['speaker']) not in (str,int) or payload['speaker'] not in ['female','male',0,1]):raise Fault(400,'tts_bad_speaker')
        outgoing={'text':text.strip(),'engine':engine,'language':language}
        if voice is not None:outgoing['voice']=voice
        if 'speaker' in payload:outgoing['speaker']=payload['speaker']
        body,headers=await self.exchange('POST','/api/tts',outgoing,MAX_AUDIO)
        if headers.get('content-type','').split(';')[0].lower()!='audio/wav':raise Fault(502,'tts_invalid_audio')
        try:
            if len(body)<44 or body[:4]!=b'RIFF' or body[8:12]!=b'WAVE' or int.from_bytes(body[4:8],'little')+8!=len(body):raise ValueError()
            with wave.open(io.BytesIO(body),'rb') as wav:
                if wav.getnchannels()!=1 or wav.getsampwidth()!=2 or wav.getcomptype()!='NONE' or not 8000<=wav.getframerate()<=48000 or not 0<wav.getnframes()/wav.getframerate()<=200 or len(wav.readframes(wav.getnframes()))!=wav.getnframes()*2:raise ValueError()
        except Exception:raise Fault(502,'tts_invalid_audio') from None
        safe={k:v for k,v in headers.items() if k in SAFE_HEADERS and re.fullmatch(r'[A-Za-z0-9_. :+\-]{1,100}',v)}
        return body,safe

async def until_disconnect(request,awaitable):
    """Cancel loopback I/O promptly. Existing TTS has no inference-cancel API."""
    task=asyncio.create_task(awaitable)
    async def watch():
        # After body consumption, block on ASGI receive. Polling is_disconnected()
        # uses an immediately-cancelled scope and can miss events through BaseHTTPMiddleware.
        while True:
            message=await request.receive()
            if message['type']=='http.disconnect':return
    monitor=asyncio.create_task(watch())
    try:
        done,_=await asyncio.wait({task,monitor},return_when=asyncio.FIRST_COMPLETED)
        if task in done:return await task
        raise Fault(499,'tts_client_disconnected')
    finally:
        for pending in (task,monitor):
            if not pending.done():pending.cancel()
        await asyncio.gather(task,monitor,return_exceptions=True)


class AudioTransferBoundary:
    """Outermost ASGI lease includes response transfer, not only upstream generation.
    Otherwise several slow receivers could retain many complete WAV buffers.
    """
    def __init__(self,app,proxy):self.app=app;self.proxy=proxy
    async def __call__(self,scope,receive,send):
        if scope['type']!='http' or scope.get('path')!='/api/reader/tts' or scope.get('method')!='POST':
            return await self.app(scope,receive,send)
        try:
            async with asyncio.timeout(230):await self.app(scope,receive,send)
        finally:
            lease=scope.get('reader.tts.audio_lease')
            if lease is not None and self.proxy.audio_lease is lease:self.proxy.audio_lease=None
