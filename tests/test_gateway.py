import json, socket, threading
from reader_service.gateway import Broker
class Response:
    headers={'Content-Type':'application/json'}
    def __enter__(self): return self
    def __exit__(self,*_): pass
    def read(self,_): return b'{"choices":[]}'
class FakeOpener:
    def __init__(self): self.calls=[]
    def open(self,request,timeout): self.calls.append(request); return Response()

def request(path,route,body):
    with socket.socket(socket.AF_UNIX) as s:
        s.connect(str(path)); data=json.dumps(body).encode()
        s.sendall(f'POST {route} HTTP/1.0\r\nHost: anything\r\nContent-Length: {len(data)}\r\n\r\n'.encode()+data)
        out=b''
        while True:
            chunk=s.recv(65536)
            if not chunk: break
            out+=chunk
        return out

def test_fixed_destination_and_budget(tmp_path):
    path=tmp_path/'model.sock'; opener=FakeOpener()
    with Broker(path,'FAKE-TEST-KEY',opener=opener) as broker:
        thread=threading.Thread(target=broker.serve_forever,daemon=True); thread.start()
        try:
            assert b'403' in request(path,'http://169.254.169.254/latest/meta-data',{})
            assert not opener.calls
            assert b'403' in request(path,'/v1/messages',{'messages':[],'tools':[{'type':'deepseek_read_url','name':'read_url'}]})
            assert b'403' in request(path,'/v1/messages',{'messages':[{'role':'user','content':[{'type':'image','source':{'type':'url','url':'http://169.254.169.254'}}]}]})
            broker.budget.calls=12
            payload={'messages':[],'model':'evil','api_key':'stolen','base_url':'http://evil','max_tokens':999999}
            for i in range(12): assert b'200 OK' in request(path,'/v1/messages',payload)
            assert b'429' in request(path,'/v1/messages',payload)
            for req in opener.calls:
                assert req.full_url=='https://api.deepseek.com/anthropic/v1/messages'
                data=json.loads(req.data)
                assert data['model']=='deepseek-flash' and data['max_tokens']==8192
                assert 'api_key' not in data and 'base_url' not in data
                assert req.get_header('Authorization')=='Bearer FAKE-TEST-KEY'
        finally: broker.shutdown(); thread.join()
