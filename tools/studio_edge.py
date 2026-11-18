#!/usr/bin/env python3
"""Insert one import into the site block that already proxies the reader API."""
import sys
from pathlib import Path

def insert(text, fragment):
    needle='import '+fragment
    if needle in text:
        return text
    marker='127.0.0.1:6010'
    at=text.find(marker)
    if at<0:
        raise SystemExit('reader proxy 127.0.0.1:6010 was not found; refusing to guess a site block')
    depth=0
    close=None
    for index, char in enumerate(text):
        if char=='{':
            depth+=1
        elif char=='}':
            depth-=1
            if index>at and depth==0:
                close=index
                break
    if close is None:
        raise SystemExit('could not find the end of the reader site block')
    line='\n\timport '+fragment+'\n'
    return text[:close]+line+text[close:]

def main():
    action, path, fragment=sys.argv[1:]
    file=Path(path)
    if action!='insert':
        raise SystemExit('unknown action')
    file.write_text(insert(file.read_text(), fragment))

if __name__=='__main__':
    main()
