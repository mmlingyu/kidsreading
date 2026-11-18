"""Static pkg native-addon cache only: root-owned, bounded, immutable, never job/session data."""
import hashlib,json,os,stat
from pathlib import Path
MAX_BYTES=128*1024*1024
MAX_FILES=10000

def runtime_binary(runtime):
    # Same executable selected by the pinned runtime-bin package, without executing/importing it.
    matches=list(Path(runtime).glob('lib/python*/site-packages/deepseek_harness_runtime/runtime/deepseek-harness-sdk-runtime-linux-x64'))
    if len(matches)!=1:raise RuntimeError('pinned_linux_runtime_not_found')
    return matches[0]

def fingerprint(runtime):return hashlib.sha256(runtime_binary(runtime).read_bytes()).hexdigest()

def cache_root():return Path(os.environ.get('READER_RUNTIME_CACHE','/opt/reader-runtime-cache-0.2.2rc2'))

def verify_cache(root,runtime,require_root=True):
    root=Path(root)
    def check(p,kind):
        st=p.lstat()
        if not kind(st.st_mode) or p.is_symlink():raise RuntimeError('unsafe_runtime_cache_path')
        if require_root and (st.st_uid!=0 or st.st_mode & 0o022):raise RuntimeError('runtime_cache_must_be_root_readonly')
        return st
    check(root,stat.S_ISDIR);check(root/'home',stat.S_ISDIR);check(root/'CACHE-SHA256.json',stat.S_ISREG)
    if os.statvfs(root/'home').f_flag & os.ST_NOEXEC:raise RuntimeError('static_runtime_cache_is_noexec')
    record=json.loads((root/'CACHE-SHA256.json').read_text())
    if record['runtime_sha256']!=fingerprint(runtime):raise RuntimeError('runtime_cache_version_mismatch')
    expected=record['files'];total=0;seen=set()
    if not 1<=len(expected)<=MAX_FILES:raise RuntimeError('runtime_cache_capacity')
    for p in (root/'home').rglob('*'):
        if p.is_dir() and not p.is_symlink():check(p,stat.S_ISDIR);continue
        st=check(p,stat.S_ISREG);name=p.relative_to(root).as_posix()
        if st.st_nlink!=1 or name not in expected:raise RuntimeError('runtime_cache_extra_or_link')
        total+=st.st_size;seen.add(name)
        if total>MAX_BYTES or hashlib.sha256(p.read_bytes()).hexdigest()!=expected[name]:raise RuntimeError('runtime_cache_hash_or_capacity')
    if seen!=set(expected) or total!=record['bytes']:raise RuntimeError('runtime_cache_missing')
    return record
