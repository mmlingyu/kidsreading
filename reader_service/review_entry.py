"""Trusted post-agent review process. Original Python+Node checks and original report gate, then cloud safety/reader check."""
import json,os,stat,subprocess,sys
from pathlib import Path
from .original_quality import _report_gate,_review_book
from .sandbox import ROOT

def review(work,node):
    errors=[];evidence=[];outputs=work/'outputs'
    try:
        if outputs.is_symlink() or not outputs.is_dir(): raise ValueError('unsafe_outputs')
        for name,limit in [('book.json',2097152),('report.md',65536)]:
            p=outputs/name
            if not p.exists():
                errors.append('缺少 outputs/'+name);continue
            st=p.lstat()
            if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1 or st.st_size>limit: raise ValueError('unsafe_or_oversized_artifact')
        if not errors:
            _report_gate(outputs,errors,evidence)
            _review_book(outputs,errors,evidence)
        if not errors:
            checked=subprocess.run([str(node),str(ROOT/'reader_service/validate.mjs'),str(outputs/'book.json')],
                stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=15,env={'PATH':str(node.parent)+':/usr/bin:/bin'})
            if checked.returncode:errors.append('cloud_reader_safety_or_schema_failed')
    except Exception: errors.append('invalid_shape_or_unsafe_artifact')
    return {'status':'failed' if errors else 'passed','passed':not errors,'errors':[str(e)[:300] for e in errors[:13]],'warnings':[],'evidence':[str(e)[:200] for e in evidence[:8]],'skill':'adventure-reader'}

def encoded_report(report):
    raw=json.dumps(report,ensure_ascii=False)
    while len(raw.encode('utf-8'))>19000:
        report={**report,'errors':[e[:max(1,len(e)//2)] for e in report['errors']],
            'evidence':[e[:max(1,len(e)//2)] for e in report['evidence']]}
        raw=json.dumps(report,ensure_ascii=False)
    return raw

if __name__=='__main__':
    node=Path(sys.argv[2]);os.environ['PATH']=str(node.parent)+':/usr/bin:/bin'
    print(encoded_report(review(Path(sys.argv[1]),node)))
