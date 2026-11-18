"""Host-side scan for untrusted HTML. Danger blocks publication.

Adapted from the uploaded html-share security.scan checks. It does not make
a self-contained page trusted.
"""
import re

def _count(pattern, html):
    return len(re.findall(pattern, html, re.I))

def scan(html):
    findings=[]
    def add(severity, text):
        findings.append({'severity':severity,'text':text})
    if _count(r'\batob\s*\(', html) and _count(r'\beval\s*\(|new\s+Function\s*\(', html):
        add('danger','atob_eval')
    if _count(r'coinhive|cryptonight|coinimp|webminer|deepminer|jsecoin|cryptoloot', html):
        add('danger','miner')
    password=_count(r'<input[^>]+type\s*=\s*["\']password', html)
    phish=_count(r'密码|银行|信用卡|身份证|验证码|verify your account|confirm your password', html)
    if password and phish:
        add('danger','password_phish')
    if _count(r'<form[^>]+action\s*=\s*["\']https?://', html) and password:
        add('danger','password_form_remote')
    if _count(r'\beval\s*\(', html):
        add('warning','eval')
    if _count(r'<script[^>]+src\s*=\s*["\']https?://', html):
        add('warning','remote_script')
    if _count(r'new\s+WebSocket\s*\(|\bfetch\s*\(|XMLHttpRequest', html):
        add('warning','network')
    if _count(r'window\.open\s*\(', html):
        add('warning','popup')
    if _count(r'<meta[^>]+http-equiv\s*=\s*["\']refresh', html) or _count(r'\btop\.location|parent\.location', html):
        add('warning','navigation')
    level='danger' if any(item['severity']=='danger' for item in findings) else ('warning' if findings else 'safe')
    return {'level':level,'findings':findings}
