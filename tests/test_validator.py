import copy,json,shutil,subprocess
from pathlib import Path
from reader_service.sandbox import ROOT

def valid():
    return json.loads((ROOT/'skills/adventure-reader/references/example-book.json').read_text())

def check(tmp_path,book):
    path=tmp_path/'book.json'; path.write_text(json.dumps(book),encoding='utf-8')
    return subprocess.run([shutil.which('node'),str(ROOT/'reader_service/validate.mjs'),str(path)],capture_output=True).returncode

def test_valid_and_playtest(tmp_path):
    book=valid(); assert check(tmp_path,book)==0
    book['chapters'][0]['game']['recall'][0]['answer']='wrong'; assert check(tmp_path,book)!=0

def test_html_remote_media_prototype_and_shape(tmp_path):
    for key,value in [('cover','https://evil/image'),('hero','<img src=x onerror=alert(1)>'),('__proto__',{})]:
        book=valid(); book[key]=value; assert check(tmp_path,book)!=0
    book=valid(); book['chapters'][0]=None; assert check(tmp_path,book)!=0
