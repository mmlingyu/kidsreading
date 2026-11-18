"""Capability catalog. Original SKILL.md bytes stay beside this file; status is ours."""
import json
from pathlib import Path
from .sandbox import ROOT

def catalog():
    data=json.loads((ROOT/'skills'/'html-skills'/'CATALOG.json').read_text(encoding='utf-8'))
    return data

def skill(name):
    for item in catalog()['skills']:
        if item['id']==name:
            return item
    return None

def skill_root(name):
    path=ROOT/'skills'/'html-skills'/name
    if not (path/'SKILL.md').is_file() or (path/'SKILL.md').is_symlink():
        raise FileNotFoundError(name)
    return path
