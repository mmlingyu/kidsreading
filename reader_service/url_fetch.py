"""Bounded public-web text fetcher. DNS validated once per hop; sockets pin checked IP, HTTPS verifies original hostname."""
from __future__ import annotations
import http.client, ipaddress, re, socket, ssl, time
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urlsplit,urlunsplit,urljoin,quote,unquote
import idna

MAX_BODY=1024*1024
MAX_REDIRECTS=3
BAD_SUFFIXES=('.localhost','.local','.internal','.invalid','.test','.onion')
# Explicit special-use prefixes avoid Python3.12/3.13 ipaddress classification differences.
DENY_V4=tuple(ipaddress.ip_network(x) for x in ('0.0.0.0/8','10.0.0.0/8','100.64.0.0/10','127.0.0.0/8','169.254.0.0/16','172.16.0.0/12','192.0.0.0/24','192.0.2.0/24','192.88.99.0/24','192.168.0.0/16','198.18.0.0/15','198.51.100.0/24','203.0.113.0/24','224.0.0.0/4','240.0.0.0/4'))
DENY_NETWORKS=tuple(ipaddress.ip_network(x) for x in ('64:ff9b::/96','64:ff9b:1::/48','2002::/16','2001::/23','2001:db8::/32','3fff::/20'))
GLOBAL_V6=ipaddress.ip_network('2000::/3')
class FetchError(Exception):
    def __init__(self,code): self.code=code; super().__init__(code)
@dataclass(frozen=True)
class Target:
    url:str
    scheme:str
    host:str
    port:int
    path:str

def parse_url(value):
    if not isinstance(value,str) or not 1<=len(value)<=2000 or any(ord(c)<33 or ord(c)==127 for c in value) or '\\' in value:
        raise FetchError('url_invalid')
    if re.search(r'%(?![0-9A-Fa-f]{2})',value): raise FetchError('url_invalid_encoding')
    try: decoded=unquote(value,encoding='utf-8',errors='strict')
    except UnicodeError: raise FetchError('url_invalid_encoding')
    if any(ord(c)<32 or ord(c)==127 for c in decoded) or '\\' in decoded: raise FetchError('url_invalid_encoding')
    try:
        p=urlsplit(value)
        if p.scheme not in ('http','https') or not p.netloc: raise FetchError('url_scheme_invalid')
        if p.username is not None or p.password is not None: raise FetchError('url_credentials_denied')
        host=p.hostname or ''
        if '%' in p.netloc or host.endswith('.'): raise FetchError('url_host_invalid')
        try: ipaddress.ip_address(host)
        except ValueError: pass
        else: raise FetchError('url_literal_ip_denied')
        host=idna.encode(host,uts46=False,std3_rules=True).decode('ascii').lower()
        if len(host)>253 or '.' not in host or not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?',host): raise FetchError('url_host_invalid')
        if not re.search(r'\.[a-z][a-z0-9-]*$',host) or host.endswith(BAD_SUFFIXES): raise FetchError('url_host_denied')
        parsed_port=p.port
        port=(443 if p.scheme=='https' else 80) if parsed_port is None else parsed_port
        if port != (443 if p.scheme=='https' else 80): raise FetchError('url_port_denied')
        # Reject ambiguous empty port and multiple colons (IPv6 literals are intentionally unsupported).
        if p.netloc.endswith(':') or p.netloc.count(':')>1: raise FetchError('url_port_invalid')
        path=quote(p.path or '/',safe="/%:@!$&'()*+,;=-._~")
        query=quote(p.query,safe="/%?:@!$&'()*+,;=-._~")
        target=path+('?' + query if query else '')
        canonical=urlunsplit((p.scheme,host,path,query,''))
        if len(canonical)>2000:raise FetchError('url_too_long')
        return Target(canonical,p.scheme,host,port,target)
    except FetchError: raise
    except (ValueError,UnicodeError,idna.IDNAError): raise FetchError('url_invalid')

def public_address(value):
    if '%' in value:return False
    try: ip=ipaddress.ip_address(value)
    except ValueError: return False
    if not ip.is_global or ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified: return False
    if isinstance(ip,ipaddress.IPv4Address) and any(ip in n for n in DENY_V4):return False
    if str(ip)=='168.63.129.16': return False  # Azure platform/metadata virtual IP
    if isinstance(ip,ipaddress.IPv6Address):
        if ip not in GLOBAL_V6:return False
        if ip.ipv4_mapped is not None or ip.sixtofour is not None or ip.teredo is not None: return False
        if any(ip in n for n in DENY_NETWORKS): return False
    return True

def resolve_all(target,resolver=socket.getaddrinfo):
    try: answers=resolver(target.host,target.port,socket.AF_UNSPEC,socket.SOCK_STREAM)
    except OSError: raise FetchError('url_dns_failed')
    addresses=[]
    for family,kind,proto,canon,addr in answers:
        if family not in (socket.AF_INET,socket.AF_INET6) or kind!=socket.SOCK_STREAM or not public_address(addr[0]):
            raise FetchError('url_address_denied')
        ip=str(ipaddress.ip_address(addr[0]))
        if (family,ip) not in addresses: addresses.append((family,ip))
    if not addresses or len(addresses)>32: raise FetchError('url_dns_invalid')
    return addresses

class PinnedTransport:
    def __init__(self,socket_factory=socket.socket,tls_context=None):
        self.socket_factory=socket_factory
        self.tls=tls_context or ssl.create_default_context()
        if not self.tls.check_hostname or self.tls.verify_mode!=ssl.CERT_REQUIRED:
            raise ValueError('verified TLS required')
    def request(self,target,address,deadline):
        family,ip=address
        raw=None;conn=None
        try:
            remaining=deadline-time.monotonic()
            if remaining<=0: raise FetchError('url_timeout')
            raw=self.socket_factory(family,socket.SOCK_STREAM)
            raw.settimeout(min(5,remaining))
            # No getaddrinfo/create_connection here; numerical sockaddr only.
            raw.connect((ip,target.port) if family==socket.AF_INET else (ip,target.port,0,0))
            peer=ipaddress.ip_address(raw.getpeername()[0])
            if peer!=ipaddress.ip_address(ip): raise FetchError('url_peer_mismatch')
            wire=self.tls.wrap_socket(raw,server_hostname=target.host) if target.scheme=='https' else raw
            conn=http.client.HTTPConnection(target.host,target.port,timeout=min(5,remaining))
            conn.sock=wire
            conn.request('GET',target.path,headers={'Host':target.host,'User-Agent':'ReaderImport/1.0','Accept':'text/html,text/plain,application/xhtml+xml','Accept-Encoding':'identity','Connection':'close'})
            response=conn.getresponse()
            headers={k.lower():v for k,v in response.getheaders()}
            if response.status in (301,302,303,307,308): return response.status,headers,b''
            if response.status!=200: raise FetchError('url_http_'+str(response.status))
            if headers.get('content-encoding','identity').lower() not in ('identity',''): raise FetchError('url_encoding_denied')
            mime=headers.get('content-type','').split(';',1)[0].strip().lower()
            if mime not in ('text/plain','text/html','application/xhtml+xml'): raise FetchError('url_content_type_denied')
            if headers.get('content-length'):
                try: length=int(headers['content-length'])
                except ValueError: raise FetchError('url_length_invalid')
                if not 0<=length<=MAX_BODY: raise FetchError('url_body_too_large')
            body=bytearray()
            while True:
                if time.monotonic()>=deadline: raise FetchError('url_timeout')
                chunk=response.read(min(65536,MAX_BODY+1-len(body)))
                if not chunk: break
                body.extend(chunk)
                if len(body)>MAX_BODY: raise FetchError('url_body_too_large')
            return response.status,headers,bytes(body)
        except FetchError: raise
        except (socket.timeout,TimeoutError): raise FetchError('url_timeout')
        except (OSError,ssl.SSLError,http.client.HTTPException): raise FetchError('url_connection_failed')
        finally:
            if conn is not None: conn.close()
            elif raw is not None: raw.close()

class ArticleParser(HTMLParser):
    SKIP={'head','script','style','nav','header','footer','form','iframe','object','svg','canvas','template','noscript'}
    VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
    def __init__(self):
        super().__init__(convert_charrefs=True);self.stack=[];self.all=[];self.main=[]
    def handle_starttag(self,tag,attrs):
        if len(self.stack)>=128:raise FetchError('url_html_depth_exceeded')
        attrs=dict(attrs)
        parent_hidden=any(x[1] for x in self.stack)
        hidden=parent_hidden or tag in self.SKIP or 'hidden' in attrs or attrs.get('aria-hidden')=='true'
        if tag not in self.VOID:self.stack.append((tag,hidden))
        if tag in ('p','div','br','article','main','section','li'): self.handle_data('\n')
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,-1,-1):
            if self.stack[i][0]==tag:self.stack=self.stack[:i];break
        if tag in ('p','div','article','main','section','li'): self.handle_data('\n')
    def handle_data(self,data):
        if any(x[1] for x in self.stack):return
        self.all.append(data)
        if any(x[0] in ('article','main') for x in self.stack):self.main.append(data)
    def text(self):return ''.join(self.main or self.all)

def extract_text(body,content_type):
    if len(body)>MAX_BODY: raise FetchError('url_body_too_large')
    mime=content_type.split(';',1)[0].strip().lower()
    if mime not in ('text/plain','text/html','application/xhtml+xml'): raise FetchError('url_content_type_denied')
    match=re.search(r'charset\s*=\s*["\']?([\w-]+)',content_type,re.I)
    charset=match.group(1).lower() if match else 'utf-8'
    if charset not in ('utf-8','utf8','iso-8859-1','latin1','windows-1252','gbk','gb18030'): raise FetchError('url_charset_denied')
    text=body.decode(charset,errors='replace')
    if '\x00' in text:raise FetchError('url_binary_content_denied')
    if mime!='text/plain':
        parser=ArticleParser();parser.feed(text);parser.close();text=parser.text()
    text='\n'.join(' '.join(line.split()) for line in text.splitlines() if line.strip()).strip()
    if len(text)<20: raise FetchError('url_no_readable_text')
    if len(text)>20000: raise FetchError('url_text_too_long')
    return text

def fetch_text(url,resolver=socket.getaddrinfo,transport=None,timeout=25):
    deadline=time.monotonic()+timeout;transport=transport or PinnedTransport();seen=set()
    for hop in range(MAX_REDIRECTS+1):
        target=parse_url(url)
        if target.url in seen: raise FetchError('url_redirect_loop')
        seen.add(target.url)
        addresses=resolve_all(target,resolver)
        if time.monotonic()>=deadline: raise FetchError('url_timeout')
        # Pin the checked address; never pass a hostname to the connection resolver.
        last_error=None
        for address in addresses:
            try:
                status,headers,body=transport.request(target,address,deadline);break
            except FetchError as exc:
                if exc.code not in ('url_connection_failed','url_timeout'):raise
                last_error=exc
                if time.monotonic()>=deadline:raise FetchError('url_timeout')
        else:raise last_error or FetchError('url_connection_failed')
        if status in (301,302,303,307,308):
            if hop==MAX_REDIRECTS: raise FetchError('url_redirect_limit')
            location=headers.get('location')
            if not location or len(location)>2000: raise FetchError('url_redirect_invalid')
            url=urljoin(target.url,location)
            continue
        if status!=200: raise FetchError('url_http_'+str(status))
        if headers.get('content-encoding','identity').lower() not in ('identity',''): raise FetchError('url_encoding_denied')
        return extract_text(body,headers.get('content-type',''))
    raise FetchError('url_redirect_limit')
