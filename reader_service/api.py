import asyncio, json, os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import ClientDisconnect
from .core import Settings, Store, Fault
from . import VERSION
from .acceptance import accepted

def create_app(settings=None, tts_proxy=None):
    s = settings or Settings.load()
    store = Store(s)
    from .tts_proxy import TtsProxy, until_disconnect, AudioTransferBoundary
    tts = tts_proxy if tts_proxy is not None else TtsProxy()
    app = FastAPI(openapi_url=None, docs_url=None, redoc_url=None)
    app.state.store = store
    app.state.tts = tts
    if s.origins:
        app.add_middleware(CORSMiddleware, allow_origins=list(s.origins), allow_methods=['GET','POST'],
                           allow_headers=['Authorization','Content-Type','Idempotency-Key'], allow_credentials=False)
    @app.exception_handler(Fault)
    async def fault(_request, exc):
        headers = {'Cache-Control':'no-store'}
        if exc.status == 429: headers['Retry-After']='2' if exc.code in {'tts_busy','tts_upstream_busy'} else '60'
        if exc.status == 401: headers['WWW-Authenticate']='Bearer'
        return JSONResponse({'version':1,'detail':exc.code},status_code=exc.status,headers=headers)
    @app.middleware('http')
    async def boundary(request, call_next):
        origin = request.headers.get('origin')
        # Non-browser clients do not send Origin. CORS is not authentication.
        # HTTPS same-origin must also be explicitly configured by operator.
        if origin and origin not in s.origins:
            return JSONResponse({'detail':'origin_denied'},status_code=403)
        response = await call_next(request)
        response.headers['Cache-Control']='no-store'
        response.headers['X-Content-Type-Options']='nosniff'
        return response
    def owner(request): return s.authenticate(request.headers.get('authorization'))
    @app.get('/api/reader/health')
    def health():
        ready = store.healthy() and os.environ.get('READER_ENABLE_GENERATION')=='1' and accepted()
        return JSONResponse({'version':1,'release':VERSION,'status':'ok' if ready else 'degraded','worker':ready,'url_import':True},status_code=200 if ready else 503)
    @app.post('/api/reader/imports',status_code=202)
    async def create(request: Request):
        who = owner(request)
        if request.headers.get('content-type','').split(';')[0].strip() != 'application/json': raise Fault(415,'json_required')
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body)>100000: raise Fault(413,'request_too_large')
        try: payload=json.loads(body)
        except (ValueError,UnicodeError): raise Fault(400,'invalid_json')
        row=store.create(who,payload,request.headers.get('idempotency-key'))
        return store.public(row)
    @app.get('/api/reader/imports/{jid}')
    def get(jid: str, request: Request): return store.public(store.get(owner(request),jid))
    @app.post('/api/reader/imports/{jid}/cancel',status_code=202)
    def cancel(jid: str, request: Request): return store.public(store.cancel(owner(request),jid))
    @app.get('/api/reader/tts/voices')
    async def tts_voices(request: Request):
        who=owner(request)
        if set(request.query_params)-{'engine'} or len(request.query_params.getlist('engine'))!=1:raise Fault(400,'tts_bad_engine')
        engine=request.query_params.get('engine')
        tts.authorize_budget(who,'catalog')
        rows=await until_disconnect(request,tts.voices(engine))
        return {'version':1,'engine':engine,'voices':rows}
    @app.post('/api/reader/tts')
    async def tts_audio(request: Request):
        who=owner(request)
        if request.query_params:raise Fault(400,'tts_bad_request')
        tts.authorize_budget(who,'audio')
        if request.headers.get('content-type','').split(';')[0].strip()!='application/json':raise Fault(415,'json_required')
        body=bytearray()
        try:
            async with asyncio.timeout(10):
                async for chunk in request.stream():
                    if len(body)+len(chunk)>14000:raise Fault(413,'request_too_large')
                    body.extend(chunk)
        except TimeoutError:raise Fault(408,'tts_request_timeout') from None
        except ClientDisconnect:raise Fault(499,'tts_client_disconnected') from None
        try:payload=json.loads(body)
        except (ValueError,UnicodeError):raise Fault(400,'invalid_json') from None
        if tts.audio_lease is not None:raise Fault(429,'tts_busy')
        lease=object();tts.audio_lease=lease;request.scope['reader.tts.audio_lease']=lease
        audio,headers=await until_disconnect(request,tts.synthesize(payload))
        async def chunks():
            for offset in range(0,len(audio),32768):yield audio[offset:offset+32768]
        return StreamingResponse(chunks(),media_type='audio/wav',headers={**headers,'Content-Length':str(len(audio)),'Cache-Control':'no-store','Content-Disposition':'inline'})
    app.add_middleware(AudioTransferBoundary,proxy=tts)
    return app
