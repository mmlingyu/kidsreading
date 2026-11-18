"""Real two-UID, one-group SQLite regression. Root orchestrator only; child DB clients are nonroot.
Creates/removes only a new synthetic subdirectory, never opens live queue/credentials.
"""
import argparse,grp,hashlib,json,os,pwd,shutil,sqlite3,stat,subprocess,sys,tempfile
from pathlib import Path
from reader_service.core import Store,Settings

def inspect(store):
    seen={}
    for suffix in ('','-wal','-shm','-journal'):
        p=Path(str(store.dbpath)+suffix)
        if p.exists():
            st=p.stat();assert st.st_gid==os.getegid() and stat.S_IMODE(st.st_mode)==0o660,(p.name,oct(st.st_mode),st.st_gid)
            seen[p.name]=oct(stat.S_IMODE(st.st_mode))
    return seen

def child(data,step):
    from tools.restrict_suid_sgid import install
    install()
    assert os.geteuid()!=0
    os.umask(0o007);data=Path(data)
    if step=='legacy':
        # Old positional schema, corrected offline mode before a real other-UID migration.
        fd=os.open(data/'queue.sqlite3',os.O_CREAT|os.O_EXCL|os.O_RDWR,0o660);os.fchmod(fd,0o660);os.close(fd)
        with sqlite3.connect(data/'queue.sqlite3') as db:
            db.execute("CREATE TABLE jobs (id TEXT PRIMARY KEY,owner TEXT,key TEXT,request_hash TEXT,age TEXT,text TEXT,status TEXT,error TEXT DEFAULT '',created REAL,updated REAL,UNIQUE(owner,key))")
        return {'legacy_uid':os.geteuid()}
    store=Store(Settings(data,{hashlib.sha256(b'A'*48).hexdigest():'probe'},shared_gid=os.getegid(),require_shared_roots=True))
    if step=='bootstrap-only':store.heartbeat();return {'uid':os.geteuid(),'concurrent_bootstrap':True}
    if step=='create':store.create('probe',{'text':'Synthetic shared SQLite story. '*4},'permission_probe_0001')
    elif step=='claim':
        row=store.claim();assert row and row['status']=='queued';store.cancel('probe',row['id'])
    elif step=='recover':
        store.recover()
        with store.db() as db:assert db.execute('SELECT status FROM jobs').fetchone()[0]=='cancelled'
    store.heartbeat()
    with store.db() as db:
        db.execute('BEGIN IMMEDIATE');db.execute("INSERT OR REPLACE INTO meta VALUES('permissions','probe')");modes=inspect(store)
        assert 'queue.sqlite3-wal' in modes and 'queue.sqlite3-shm' in modes,modes
    # SQLite rollback journal inherits the corrected DB mode as well.
    with sqlite3.connect(store.dbpath) as db:
        db.execute('PRAGMA journal_mode=DELETE');db.execute('BEGIN IMMEDIATE');db.execute("INSERT OR REPLACE INTO meta VALUES('journal','probe')")
        modes.update(inspect(store));assert 'queue.sqlite3-journal' in modes;db.rollback()
    return {'uid':os.geteuid(),'gid':os.getegid(),'modes':modes}

def verify(parent,runtime,uid_a,uid_b,gid):
    if os.geteuid()!=0 or 0 in (uid_a,uid_b) or uid_a==uid_b:raise RuntimeError('root_orchestrator_two_nonroot_uids_required')
    outputs=[]
    with tempfile.TemporaryDirectory(prefix='r3-sqlite-uids-',dir=parent) as tmp:
        base=Path(tmp);os.chmod(base,0o711)
        for order,legacy in [((uid_a,uid_b),False),((uid_b,uid_a),False),((uid_a,uid_b),True),((uid_b,uid_a),True)]:
            data=base/('case-'+str(order[0])+'-'+str(legacy));data.mkdir();os.chown(data,0,gid);os.chmod(data,0o2770)
            (data/'jobs').mkdir();os.chown(data/'jobs',0,gid);os.chmod(data/'jobs',0o2770)
            for uid,step in [(order[0],'legacy' if legacy else 'touch'),(order[1],'create'),(order[0],'claim'),(order[1],'recover'),(order[0],'touch')]:
                proc=subprocess.run([str(Path(runtime)/'bin/python'),'-m','tools.sqlite_permissions','--child',str(data),'--step',step],
                    cwd=Path(__file__).resolve().parent.parent,user=uid,group=gid,extra_groups=[gid],
                    env={'PATH':'/usr/bin:/bin','PYTHONDONTWRITEBYTECODE':'1'},stdin=subprocess.DEVNULL,capture_output=True,text=True,timeout=30)
                if proc.returncode:raise RuntimeError('permission_child_failed: '+proc.stderr[-2500:])
                outputs.append(json.loads(proc.stdout))
                if step=='legacy':os.chown(data/'queue.sqlite3',0,gid);os.chmod(data/'queue.sqlite3',0o660)
            pending=[subprocess.Popen([str(Path(runtime)/'bin/python'),'-m','tools.sqlite_permissions','--child',str(data),'--step','bootstrap-only'],
                cwd=Path(__file__).resolve().parent.parent,user=uid,group=gid,extra_groups=[gid],
                env={'PATH':'/usr/bin:/bin','PYTHONDONTWRITEBYTECODE':'1'},stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True) for uid in order]
            for process in pending:
                out,err=process.communicate(timeout=30)
                if process.returncode:raise RuntimeError('concurrent_uid_bootstrap_failed: '+err[-1000:])
                outputs.append(json.loads(out))
            outsider=65530 if 65530 not in order and gid!=65530 else 65529
            denied="try:\n open(__import__('sys').argv[1],'rb').read(1)\nexcept PermissionError:\n raise SystemExit(0)\nraise SystemExit(2)"
            r=subprocess.run([str(Path(runtime)/'bin/python'),'-c',denied,str(data/'queue.sqlite3')],user=outsider,group=outsider,extra_groups=[],env={'PATH':'/usr/bin:/bin'},timeout=10)
            assert r.returncode==0,'unrelated UID/group can read shared SQLite'

    return {'different_real_uids':True,'children_kernel_restrict_suid_sgid':True,'shared_roots_precreated_by_root':True,'both_bootstrap_orders':True,'concurrent_cross_uid_bootstrap':True,'fresh_and_legacy_databases':True,'outsider_uid_denied':True,'migration_and_restarts':True,'wal_shm_journal_0660':True,'operations':outputs}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--child');p.add_argument('--step');p.add_argument('--parent',default='/var/lib/reader');p.add_argument('--runtime',default='/opt/reader-runtime');p.add_argument('--api-user',default='reader-api');p.add_argument('--worker-user',default='reader-worker');p.add_argument('--gid',type=int)
    a=p.parse_args()
    if a.child:print(json.dumps(child(a.child,a.step)))
    else:
        def uid(value):return int(value) if value.isdecimal() else pwd.getpwnam(value).pw_uid
        gid=a.gid if a.gid is not None else grp.getgrnam('reader-data').gr_gid
        print(json.dumps(verify(a.parent,a.runtime,uid(a.api_user),uid(a.worker_user),gid),indent=2))
