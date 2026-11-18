"""Inside namespace only. No host credentials. Model HTTP relays only to fixed Unix broker."""
import http.server, json, os, socket, threading
from pathlib import Path

class Relay(http.server.BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_POST(self):
        try:
            if self.path not in ('/v1/messages',) or self.headers.get('Transfer-Encoding'):
                self.send_error(403); return
            n=int(self.headers.get('Content-Length','0'))
            if not 1<=n<=512000: self.send_error(413); return
            body=self.rfile.read(n)
            with socket.socket(socket.AF_UNIX) as s:
                s.settimeout(130); s.connect('/run/model.sock')
                s.sendall((f'POST {self.path} HTTP/1.0\r\nHost: broker\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\n\r\n').encode()+body)
                while True:
                    data=s.recv(65536)
                    if not data: break
                    self.connection.sendall(data)
            self.close_connection=True
        except Exception:
            self.close_connection=True

OUTPUT_CAPS=(8192, 16384)

def requested_cap(control):
    value=control.get('max_tokens', 8192) if isinstance(control, dict) else 8192
    return value if value in OUTPUT_CAPS else 8192

def main():
    from deepseek_harness import DeepSeekHarness
    server=http.server.ThreadingHTTPServer(('127.0.0.1',18080),Relay)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    params=json.loads(Path('/work/input.json').read_text())
    control=json.loads(Path('/work/control.json').read_text())
    session='reader-'+params['id']
    try:
        with DeepSeekHarness(profile='sdk-minimal',cwd='/work',runtime_cwd='/work',dsh_home='/work/.dsh',
                             base_url='http://127.0.0.1:18080',api_key='job-broker-not-a-provider-key',
                             model='deepseek-flash',max_tokens=requested_cap(control),
                             request_timeout_seconds=120,initialize_timeout_seconds=30) as harness:
            if control['resume']:
                result=harness.resume_session(session).run(control['prompt'])
            else:
                result=harness.run(control['prompt'],session_id=session)
            # Only used as a bounded continuation hint. Host independently checks every artifact.
            Path('/work/agent-result.json').write_text(json.dumps({'finish_reason':result.finish_reason}))
        return 0
    finally: server.shutdown()

if __name__=='__main__':
    try: raise SystemExit(main())
    except Exception: raise SystemExit(5)  # no prompt/key-bearing tracebacks
