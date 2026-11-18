import ipaddress,socket,ssl,time
import pytest
from reader_service.url_fetch import *
PUBLIC='93.184.216.34'
def dns(*_):return [(socket.AF_INET,socket.SOCK_STREAM,6,'',(PUBLIC,80))]
class FakeTransport:
    def __init__(self,steps):self.steps=list(steps);self.calls=[]
    def request(self,target,address,deadline):
        self.calls.append((target,address));return self.steps.pop(0)
def good(body=b'A small fox lives in the forest and helps a friend every day.'):
    return 200,{'content-type':'text/plain; charset=utf-8'},body

@pytest.mark.parametrize('url',[
 'file:///etc/passwd','ftp://example.com/x','http://127.0.0.1','http://169.254.169.254/latest/meta-data',
 'http://[::1]','http://[::ffff:127.0.0.1]','http://2130706433','http://0x7f000001','http://127.1',
 'http://u:p@example.com','http://example.com:22','https://example.com:80','http://example.com:',
 'http://example.com./','http://example.com\\@evil.com','http://example%2ecom/','http://example.com/%0d%0aX',
 'http://example.com/%zz','http://example.com/%ff','http://example.com:0','http://metadata.google.internal/',
 'http://exa_mple.com/','http://example.com/has space'])
def test_url_syntax_denied(url):
    with pytest.raises(FetchError):parse_url(url)

@pytest.mark.parametrize('ip',[
 '127.0.0.1','10.0.0.1','172.16.0.1','192.168.0.1','169.254.169.254','100.100.100.200','0.0.0.0',
 '224.0.0.1','240.0.0.1','168.63.129.16','::1','::','fc00::1','fe80::1','ff02::1',
 '192.0.0.8','192.0.0.9','192.88.99.1','3fff::1','2001:1::1',
 '::ffff:93.184.216.34','64:ff9b::a00:1','64:ff9b:1::1','2002:7f00:1::','2001:0:1234::1'])
def test_nonpublic_and_transition_addresses_denied(ip):assert not public_address(ip)

def test_all_dns_answers_must_be_public():
    def mixed(*args):return dns()+[(socket.AF_INET6,socket.SOCK_STREAM,6,'',('::1',80,0,0))]
    t=FakeTransport([good()])
    with pytest.raises(FetchError,match='url_address_denied'):fetch_text('https://example.com',resolver=mixed,transport=t)
    assert not t.calls

def test_redirect_dns_checked_again_before_connection():
    n=0
    def rebind(*args):
        nonlocal n;n+=1
        return dns() if n==1 else [(socket.AF_INET,socket.SOCK_STREAM,6,'',('10.0.0.1',80))]
    t=FakeTransport([(302,{'location':'/next'},b'')])
    with pytest.raises(FetchError,match='url_address_denied'):fetch_text('https://example.com',resolver=rebind,transport=t)
    assert len(t.calls)==1 and n==2

def test_same_request_pins_checked_ip_without_second_dns():
    n=0
    def rebind(*args):
        nonlocal n;n+=1
        return dns() if n==1 else [(socket.AF_INET,socket.SOCK_STREAM,6,'',('127.0.0.1',80))]
    t=FakeTransport([good()]);assert 'fox' in fetch_text('https://example.com/story',resolver=rebind,transport=t)
    assert n==1 and t.calls[0][1]==(socket.AF_INET,PUBLIC)

def test_redirect_private_target_and_limit():
    for location in ['http://127.0.0.1/','http://u:p@example.com/','https://example.com:444/','file:///etc/passwd']:
        with pytest.raises(FetchError):fetch_text('https://example.com',resolver=dns,transport=FakeTransport([(302,{'location':location},b'')]))
    steps=[(302,{'location':'/r'+str(i)},b'') for i in range(4)]
    with pytest.raises(FetchError,match='url_redirect_limit'):fetch_text('https://example.com',resolver=dns,transport=FakeTransport(steps))

def test_html_extraction_no_title_fallback_and_limits():
    html=b'<head><title>A long fake story title without any body content</title></head><script>evil()</script>'
    with pytest.raises(FetchError,match='url_no_readable_text'):extract_text(html,'text/html')
    html=b'<nav>navigation</nav><article><p>The little fox lives in a tree house.</p><script>wrong instruction</script></article>'
    text=extract_text(html,'text/html');assert 'fox' in text and 'navigation' not in text and 'wrong' not in text
    for body,mime,code in [(b'x'*(MAX_BODY+1),'text/plain','url_body_too_large'),(b'x'*20001,'text/plain','url_text_too_long'),(b'png','image/png','url_content_type_denied')]:
        with pytest.raises(FetchError,match=code):extract_text(body,mime)
    with pytest.raises(FetchError,match='url_encoding_denied'):fetch_text('https://example.com',resolver=dns,transport=FakeTransport([(200,{'content-type':'text/plain','content-encoding':'gzip'},b'xx')]))
    with pytest.raises(FetchError,match='url_timeout'):fetch_text('https://example.com',resolver=dns,transport=FakeTransport([good()]),timeout=-1)

def test_public_v6_dns_supported():
    v6='2606:2800:220:1:248:1893:25c8:1946'
    def resolve(*args):return [(socket.AF_INET6,socket.SOCK_STREAM,6,'',(v6,443,0,0))]
    t=FakeTransport([good()]);fetch_text('https://example.com',resolver=resolve,transport=t)
    assert t.calls[0][1]==(socket.AF_INET6,v6)

def test_transport_numerical_connect_and_verified_sni(monkeypatch):
    import reader_service.url_fetch as m
    events={}
    class Raw:
        def settimeout(self,n):events['timeout']=n
        def connect(self,addr):events['connect']=addr
        def getpeername(self):return PUBLIC,443
        def close(self):pass
    class TLS:
        check_hostname=True;verify_mode=ssl.CERT_REQUIRED
        def wrap_socket(self,raw,server_hostname):events['sni']=server_hostname;return raw
    class Response:
        status=200
        def getheaders(self):return [('Content-Type','text/plain')]
        def read(self,n):
            if events.get('read'):return b''
            events['read']=True;return good()[2]
    class HTTP:
        def __init__(self,*args,**kwargs):pass
        def request(self,method,path,headers):events['host']=headers['Host'];events['path']=path
        def getresponse(self):return Response()
        def close(self):pass
    monkeypatch.setattr(m.http.client,'HTTPConnection',HTTP)
    monkeypatch.setenv('HTTPS_PROXY','http://127.0.0.1:9')
    target=parse_url('https://example.com/story?q=one')
    t=PinnedTransport(socket_factory=lambda *a:Raw(),tls_context=TLS())
    assert t.request(target,(socket.AF_INET,PUBLIC),time.monotonic()+25)[0]==200
    assert events['connect']==(PUBLIC,443) and events['sni']=='example.com' and events['host']=='example.com'

def test_fragment_is_not_sent_or_used_for_identity():
    assert parse_url('https://example.com/story#chapter-1').url=='https://example.com/story'

def test_unsafe_tls_configuration_refused():
    class Insecure:
        check_hostname=False;verify_mode=ssl.CERT_NONE
    with pytest.raises(ValueError):PinnedTransport(tls_context=Insecure())

def test_parser_depth_and_binary_text_are_bounded():
    with pytest.raises(FetchError,match='url_html_depth_exceeded'):extract_text(b'<div>'*200+b'A story lives in this tree house.','text/html')
    with pytest.raises(FetchError,match='url_binary_content_denied'):extract_text(b'a'*40+b'\x00','text/plain')

def test_checked_public_addresses_can_fallback_without_new_dns():
    def records(*args):return [(socket.AF_INET6,socket.SOCK_STREAM,6,'',('2606:2800:220:1:248:1893:25c8:1946',443,0,0))]+dns()
    class Fallback:
        def __init__(self):self.calls=[]
        def request(self,target,address,deadline):
            self.calls.append(address)
            if len(self.calls)==1:raise FetchError('url_connection_failed')
            return good()
    t=Fallback();assert 'fox' in fetch_text('https://example.com',resolver=records,transport=t)
    assert len(t.calls)==2 and t.calls[1]==(socket.AF_INET,PUBLIC)
