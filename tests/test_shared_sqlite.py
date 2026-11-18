import hashlib,json,os,stat,subprocess,sys
from pathlib import Path
import pytest
from reader_service.core import Store,Settings

def test_shared_modes_bootstrap_sidecars_and_posix_locks(tmp_path):
    store=Store(Settings(tmp_path/'data',{hashlib.sha256(b'A'*48).hexdigest():'a'}))
    assert stat.S_IMODE(store.root.stat().st_mode)==0o770
    assert stat.S_IMODE(store.dbpath.stat().st_mode)==0o660
    with store.db() as db:
        db.execute('BEGIN IMMEDIATE');db.execute("INSERT OR REPLACE INTO meta VALUES('lock-test','on')")
        store.shared_file(store.dbpath);store.side_permissions()
        for suffix in ('-wal','-shm'):assert stat.S_IMODE(Path(str(store.dbpath)+suffix).stat().st_mode)==0o660
        code="""import sqlite3,sys
try:
 c=sqlite3.connect(sys.argv[1],timeout=.1);c.execute('BEGIN IMMEDIATE')
except sqlite3.OperationalError:sys.exit(0)
sys.exit(2)
"""
        r=subprocess.run([sys.executable,'-c',code,str(store.dbpath)],env={'PATH':'/usr/bin:/bin'},timeout=5)
        assert r.returncode==0,'permissions helper released a live SQLite lock'

def test_sqlite_link_rejected(tmp_path):
    data=tmp_path/'data';data.mkdir();outside=tmp_path/'outside';outside.write_text('not a db')
    (data/'queue.sqlite3').symlink_to(outside)
    with pytest.raises(RuntimeError,match='unsafe_sqlite_file'):Store(Settings(data,{hashlib.sha256(b'A'*48).hexdigest():'a'}))


def test_concurrent_sidecar_unlink_is_benign(tmp_path,monkeypatch):
    store=Store(Settings(tmp_path/'data',{hashlib.sha256(b'A'*48).hexdigest():'a'}))
    monkeypatch.setattr(store,'shared_file',lambda *a,**k:(_ for _ in ()).throw(FileNotFoundError()))
    store.side_permissions()


def test_concurrent_process_bootstrap_and_migration(tmp_path):
    data=tmp_path/'data';data.mkdir(mode=0o2770)
    code="import hashlib,sys;from pathlib import Path;from reader_service.core import Settings,Store;s=Store(Settings(Path(sys.argv[1]),{hashlib.sha256(b'A'*48).hexdigest():'a'}));s.heartbeat()"
    procs=[subprocess.Popen([sys.executable,'-c',code,str(data)],env={'PATH':'/usr/bin:/bin'}) for _ in range(4)]
    assert all(p.wait(timeout=15)==0 for p in procs)
