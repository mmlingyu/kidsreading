"""Independent HTML task API. It does not register reader import routes."""
import json, time
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from . import VERSION
from .core import Fault
from .studio_catalog import catalog
from .studio_store import StudioSettings, StudioStore, authenticate

PAGE=Path(__file__).resolve().parent.parent/'studio'

def create_app(settings=None):
    s=settings or StudioSettings.load()
    store=StudioStore(s)
    app=FastAPI(openapi_url=None, docs_url=None, redoc_url=None)
    app.state.store=store
    if s.origins:
        app.add_middleware(CORSMiddleware, allow_origins=list(s.origins), allow_methods=['GET','POST'],
                           allow_headers=['Authorization','Content-Type'], allow_credentials=False)
    @app.exception_handler(Fault)
    async def fault(_request, exc):
        headers={'Cache-Control':'no-store'}
        if exc.status==429:
            headers['Retry-After']='60'
        if exc.status==401:
            headers['WWW-Authenticate']='Bearer'
        return JSONResponse({'version':1,'detail':exc.code}, status_code=exc.status, headers=headers)
    @app.middleware('http')
    async def boundary(request, call_next):
        origin=request.headers.get('origin')
        if origin and origin not in s.origins:
            return JSONResponse({'detail':'origin_denied'}, status_code=403)
        response=await call_next(request)
        response.headers['Cache-Control']='no-store'
        response.headers['X-Content-Type-Options']='nosniff'
        return response
    def owner(request):
        return authenticate(s.owners, request.headers.get('authorization'))
    @app.get('/api/studio/health')
    def health():
        beat=store.root/'worker-heartbeat'
        alive=beat.is_file() and not beat.is_symlink() and time.time()-beat.stat().st_mtime<5
        from .studio_worker import accepted, generation_enabled
        return {'version':1,'release':VERSION,'studio':True,'reader_replaced':False,'worker':alive,
                'generation':bool(generation_enabled() and accepted())}
    @app.get('/api/studio/skills')
    def skills(request: Request):
        owner(request)
        data=catalog()
        return {'version':1,'phase':data['phase'],'images':data['images'],'url_fetch':data['url_fetch'],'skills':data['skills']}
    @app.post('/api/studio/jobs', status_code=202)
    async def create(request: Request):
        who=owner(request)
        if request.headers.get('content-type','').split(';')[0].strip()!='application/json':
            raise Fault(415,'json_required')
        body=await request.body()
        if len(body)>12000:
            raise Fault(413,'request_too_large')
        try:
            payload=json.loads(body)
        except (ValueError, UnicodeError):
            raise Fault(400,'invalid_json')
        return store.public(store.create(who, payload))
    @app.get('/api/studio/jobs/{job}')
    def get(job: str, request: Request):
        return store.public(store.get(owner(request), job))
    @app.post('/api/studio/jobs/{job}/cancel', status_code=202)
    def cancel(job: str, request: Request):
        return store.public(store.cancel(owner(request), job))
    @app.get('/api/studio/jobs/{job}/files/{name}')
    def artifact(job: str, name: str, request: Request):
        if name not in {'preview.html','report.md'}:
            raise Fault(404,'studio_not_found')
        row=store.get(owner(request), job)
        if row['status']!='ready':
            raise Fault(409,'studio_not_ready')
        path=store.jobdir(job)/'published'/name
        if path.is_symlink() or not path.is_file() or path.stat().st_nlink!=1:
            raise Fault(404,'studio_not_found')
        data=path.read_bytes()
        return Response(data, media_type='application/octet-stream', headers={
            'Content-Disposition':f'attachment; filename="{name}"',
            'Content-Security-Policy':'sandbox',
            'X-Content-Type-Options':'nosniff',
            'Cache-Control':'no-store',
        })
    @app.get('/studio/index.html')
    @app.get('/studio/')
    def page():
        return FileResponse(PAGE/'index.html', media_type='text/html', headers={
            'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'",
            'Cache-Control':'no-store',
        })
    @app.get('/studio/app.js')
    def script():
        return FileResponse(PAGE/'app.js', media_type='application/javascript', headers={'Cache-Control':'no-store'})
    @app.get('/studio/app.css')
    def style():
        return FileResponse(PAGE/'app.css', media_type='text/css', headers={'Cache-Control':'no-store'})
    return app
