"""Host review for untrusted HTML. Original skill text is not replaced here."""
import os, re, stat
from pathlib import Path
from .html_scan import scan

MAX_HTML=1_500_000
MAX_REPORT=65536

def _regular(path, limit):
    if path.is_symlink() or not path.is_file():
        return False
    st=path.lstat()
    return stat.S_ISREG(st.st_mode) and st.st_nlink==1 and 80<=st.st_size<=limit

def review(work, skill):
    errors=[]; warnings=[]; evidence=[]
    outputs=work/'outputs'
    if outputs.is_symlink() or not outputs.is_dir():
        return _result(False, ['unsafe_outputs'], warnings, evidence)
    for child in outputs.iterdir():
        if child.is_symlink() or child.is_dir():
            errors.append('unsafe_output_entry')
    report=outputs/'report.md'
    preview=outputs/'preview.html'
    if not _regular(report, MAX_REPORT):
        errors.append('report_too_small_or_unsafe')
    else:
        evidence.append(f'report {report.stat().st_size}')
    if not _regular(preview, MAX_HTML):
        errors.append('preview_too_small_or_unsafe')
        document=''
    else:
        document=preview.read_bytes().decode('utf-8','replace')
        evidence.append(f'html {preview.stat().st_size}')
        if not re.search(r'<html[\s>]', document, re.I):
            errors.append('html_incomplete')
        if re.search(r'''(?:src|href)\s*=\s*['"]file:''', document, re.I):
            errors.append('file_url')
        if re.search(r'''(?:src|href)\s*=\s*['"]javascript:''', document, re.I):
            errors.append('javascript_url')
        if 'window.parent' in document or 'parent.postMessage' in document:
            errors.append('parent_bridge')
        scanned=scan(document)
        evidence.append('scan '+scanned['level'])
        if scanned['level']=='danger':
            errors.append('html_scan_danger')
        elif scanned['level']=='warning':
            warnings.append('html_scan_warning')
        if skill=='html-builder':
            banned=sorted(set(re.findall(r'\b(?:vite|react|partykit|sqlite)\b', document, re.I)))
            if banned:
                errors.append('banned_runtime')
        if skill=='zdog':
            for token in ('Zdog.Illustration','dragRotate','requestAnimationFrame'):
                if token not in document:
                    errors.append('zdog_'+token)
            if re.search(r'\bTHREE\b|three\.js', document, re.I):
                errors.append('zdog_three')
            if re.search(r'''<script[^>]+src\s*=\s*['"]https?://(?:unpkg\.com|cdn\.jsdelivr\.net)/''', document, re.I):
                errors.append('zdog_cdn')
            marker=(Path(__file__).resolve().parent.parent/'skills'/'html-skills'/'zdog'/'vendor'/'zdog.dist.min.js').read_text(encoding='utf-8', errors='replace')
            if 'Zdog v1.1.3' not in document or 'Copyright 2020 Metafizzy' not in document or marker[200:260] not in document:
                errors.append('zdog_not_inlined')
        if skill=='knowledge-travel':
            for token, code in (('id="game-spec"','kt_spec'),('<canvas','kt_canvas'),('requestAnimationFrame','kt_raf'),
                                ('levelHasKnowledge','kt_knowledge'),('ArrowRight','kt_keys')):
                if token not in document:
                    errors.append(code)
            if 'localStorage' in document:
                errors.append('kt_storage')
            if re.search(r'\b(?:vite|react|npm)\b', document, re.I):
                errors.append('kt_build')
    return _result(not errors, errors, warnings, evidence)

def _result(passed, errors, warnings, evidence):
    return {'passed':passed,'errors':errors[:12],'warnings':warnings[:8],'evidence':evidence[:8]}
