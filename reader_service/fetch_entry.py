"""Trusted disposable fetch subprocess. No model key/env, no content in logs."""
import json,os,sys
from pathlib import Path
from .url_fetch import fetch_text,FetchError

def main():
    work=Path(sys.argv[1]);data=json.loads((work/'input.json').read_text())
    try:
        text=fetch_text(data['url'])
        (work/'assets/source.txt').write_text('来源：链接（云端已抽取正文）\n年龄带：'+data['age']+'\n\n'+text,encoding='utf-8')
        return 0
    except FetchError as exc:
        (work/'fetch-result.json').write_text(json.dumps({'error':exc.code}));return 20
    except Exception:
        (work/'fetch-result.json').write_text('{"error":"url_fetch_failed"}');return 20
if __name__=='__main__':raise SystemExit(main())
