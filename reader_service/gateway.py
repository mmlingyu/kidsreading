"""Per-job fixed-destination credential broker; never run inside agent namespace."""
import http.server, json, socketserver, threading, urllib.request


def safe_blocks(value):
    if isinstance(value,str): return True
    if not isinstance(value,list): return False
    for block in value:
        if not isinstance(block,dict): return False
        kind=block.get('type')
        if kind not in ('text','thinking','redacted_thinking','tool_use','tool_result'): return False
        if kind=='tool_result' and not safe_blocks(block.get('content','')): return False
    return True

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None

# Per request, not per turn. deepseek-flash allows up to 384K output; thinking mode
# defaults to 64K. These two caps are the only values the broker will forward.
OUTPUT_CAPS=(8192, 16384)
MODEL_CALLS=12

class Budget:
    def __init__(self, calls=MODEL_CALLS, request_bytes=512000, response_bytes=2*1024*1024):
        self.calls, self.request_bytes, self.response_bytes = calls, request_bytes, response_bytes
        self.lock = threading.Lock()
    def take(self, size):
        with self.lock:
            if size > self.request_bytes or self.calls <= 0: return False
            self.calls -= 1
            return True

class Broker(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    daemon_threads=True
    def __init__(self,path,key,model='deepseek-flash',opener=None,max_tokens=8192):
        self.key,self.model,self.budget=key,model,Budget()
        self.max_tokens=max_tokens if max_tokens in OUTPUT_CAPS else 8192
        self.opener=opener or urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
        super().__init__(str(path), Handler)

class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version='HTTP/1.0'
    def log_message(self,*args): pass
    def fail(self,code):
        self.send_response(code); self.end_headers()
    def do_POST(self):
        self.connection.settimeout(5)
        if self.path not in ('/v1/messages',): return self.fail(403)
        try:
            if self.headers.get('Transfer-Encoding'): return self.fail(400)
            n=int(self.headers.get('Content-Length','0'))
            if not 1 <= n <= self.server.budget.request_bytes: return self.fail(413)
            raw=self.rfile.read(n)
            if len(raw)!=n: return self.fail(400)
            if not self.server.budget.take(n): return self.fail(429)
            payload=json.loads(raw)
            if not isinstance(payload,dict) or not isinstance(payload.get('messages'),list): return self.fail(400)
            # Never permit provider-side web tools, MCP connectors or URL image fetches.
            if not safe_blocks(payload.get('system','')): return self.fail(403)
            if any(not isinstance(m,dict) or not safe_blocks(m.get('content','')) for m in payload['messages']): return self.fail(403)
            tools=payload.get('tools',[])
            if not isinstance(tools,list) or any(not isinstance(t,dict) or t.get('type') not in (None,'custom') or 'input_schema' not in t for t in tools): return self.fail(403)
            allowed={'messages','system','tools','tool_choice','stream','temperature','top_p','thinking','stop_sequences'}
            payload={k:v for k,v in payload.items() if k in allowed}
            payload.update(model=self.server.model,max_tokens=self.server.max_tokens)
            if isinstance(payload.get('thinking'),dict) and 'budget_tokens' in payload['thinking']:
                payload['thinking']['budget_tokens']=2048
            req=urllib.request.Request('https://api.deepseek.com/anthropic/v1/messages',
                data=json.dumps(payload).encode(),method='POST',
                headers={'Authorization':'Bearer '+self.server.key,'Content-Type':'application/json','anthropic-version':'2023-06-01'})
            # No proxy env, redirects or client-specified URL. TLS verified by urllib.
            with self.server.opener.open(req,timeout=120) as response:
                body=response.read(self.server.budget.response_bytes+1)
                if len(body)>self.server.budget.response_bytes: return self.fail(502)
                mime=response.headers.get('Content-Type','application/json')
            self.send_response(200)
            self.send_header('Content-Type',mime)
            self.send_header('Content-Length',str(len(body)))
            self.end_headers(); self.wfile.write(body)
        except Exception:
            # Never return provider diagnostics, credentials, request bodies or prompts.
            self.fail(502)

if __name__=='__main__':
    import os, sys
    from pathlib import Path
    os.umask(0o077)
    raw=json.loads(sys.stdin.buffer.read(4096))
    key=raw['key']
    cap=raw.get('max_tokens', 8192)
    path=Path(sys.argv[1])
    with Broker(path,key,max_tokens=cap if cap in OUTPUT_CAPS else 8192) as server: server.serve_forever()
