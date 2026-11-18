from __future__ import annotations
import fcntl, hashlib, hmac, json, os, re, shutil, sqlite3, stat, grp, threading, time, uuid
from dataclasses import dataclass
from contextlib import contextmanager
from pathlib import Path

_DB_BOOTSTRAP_LOCK=threading.RLock()

TERMINAL = {'ready', 'failed', 'cancelled'}
ID = re.compile(r'^[a-f0-9]{32}$')
OWNER = re.compile(r'^[a-zA-Z0-9_-]{1,64}$')

class Fault(Exception):
    def __init__(self, status, code): self.status, self.code = status, code

@dataclass
class Settings:
    data: Path
    owners: dict[str, str]  # token SHA256 -> configured owner, never raw tokens
    origins: tuple[str, ...] = ()
    max_jobs: int = 200
    max_queue: int = 20
    max_hour: int = 3
    max_disk: int = 1024 * 1024 * 1024
    timeout: int = 900
    min_free: int = 256 * 1024 * 1024
    shared_gid: int | None = None
    require_shared_roots: bool = False

    def __post_init__(self):
        if not self.owners or any(not re.fullmatch('[a-f0-9]{64}', k) or not OWNER.fullmatch(v) for k,v in self.owners.items()):
            raise ValueError('invalid owner/token hash configuration')
        for origin in self.origins:
            if not re.fullmatch(r'https://[a-zA-Z0-9.:-]+', origin):
                raise ValueError('CORS requires exact HTTPS origins without paths')

    @classmethod
    def load(cls):
        path = Path(os.environ['READER_AUTH_FILE'])
        # Configuration must be prepared by operator; no secret is printed.
        if os.name == 'posix' and path.stat().st_mode & 0o007:
            raise RuntimeError('auth file must not be world accessible')
        return cls(Path(os.environ.get('READER_DATA', '/var/lib/reader')),
                   json.loads(path.read_text()),
                   tuple(filter(None, os.environ.get('READER_CORS_ORIGINS', '').split(','))),
                   shared_gid=grp.getgrnam(os.environ.get('READER_DATA_GROUP','reader-data')).gr_gid,require_shared_roots=True)

    def authenticate(self, header):
        if not header or not header.startswith('Bearer ') or len(header) > 256:
            raise Fault(401, 'unauthorized')
        token = header[7:]
        if len(token) < 32 or not token.isascii(): raise Fault(401, 'unauthorized')
        digest = hashlib.sha256(token.encode()).hexdigest()
        owner = None
        for candidate, value in self.owners.items():
            if hmac.compare_digest(digest, candidate): owner = value
        if owner is None: raise Fault(401, 'unauthorized')
        return owner

class Store:
    def __init__(self, settings):
        self.s = settings
        self.root = settings.data
        self.gid=settings.shared_gid if settings.shared_gid is not None else os.getegid()
        if self.gid not in {os.getegid(),*os.getgroups()}:raise RuntimeError('reader_data_group_required')
        self.shared_directory(self.root)
        self.shared_directory(self.root/'jobs')
        self.dbpath = self.root/'queue.sqlite3'
        # Cross-UID/process schema/bootstrap serialization uses a DIFFERENT inode,
        # never an extra descriptor on the SQLite DB/WAL/SHM itself.
        schema_lock=self.root/'.queue-schema.lock'
        with _DB_BOOTSTRAP_LOCK:self.shared_file(schema_lock,create=True)
        fd=os.open(schema_lock,os.O_RDWR|os.O_NOFOLLOW)
        try:
            fcntl.flock(fd,fcntl.LOCK_EX)
            with self.db() as db:
                db.executescript('''
                  PRAGMA journal_mode=WAL;
                  CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY, owner TEXT NOT NULL, key TEXT NOT NULL,
                    request_hash TEXT NOT NULL, age TEXT NOT NULL, text TEXT NOT NULL,
                    status TEXT NOT NULL, error TEXT NOT NULL DEFAULT '',
                    created REAL NOT NULL, updated REAL NOT NULL,
                    UNIQUE(owner,key));
                  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
                ''')
                columns={r[1] for r in db.execute('PRAGMA table_info(jobs)')}
                for name,decl in [('source',"TEXT NOT NULL DEFAULT 'text'"),('url',"TEXT NOT NULL DEFAULT ''"),('phase',"TEXT NOT NULL DEFAULT 'queued'"),('review_attempts','INTEGER NOT NULL DEFAULT 0'),('review_report',"TEXT NOT NULL DEFAULT ''")]:
                    if name not in columns: db.execute(f'ALTER TABLE jobs ADD COLUMN {name} {decl}')
                db.execute("INSERT OR REPLACE INTO meta VALUES ('schema_version','2')")
        finally:os.close(fd)
    def shared_directory(self,path):
        # RestrictSUIDSGID filters requested mode bits before the kernel checks
        # whether a path exists. Never mkdir/chmod with explicit set-ID bits here.
        try:st=path.lstat()
        except FileNotFoundError:
            if self.s.require_shared_roots:raise RuntimeError('root_precreated_shared_directories_required')
            path.mkdir(mode=0o770,exist_ok=True)  # private test/probe workspace only
            st=path.lstat()
        if not stat.S_ISDIR(st.st_mode) or path.is_symlink():raise RuntimeError('unsafe_shared_data_directory')
        mode=stat.S_IMODE(st.st_mode)
        if self.s.require_shared_roots:
            if st.st_uid!=0 or st.st_gid!=self.gid or mode!=0o2770:
                raise RuntimeError('reader_data_permissions_run_offline_migration')
            return
        if st.st_gid!=self.gid:raise RuntimeError('reader_data_group_required')
        # Preserve inherited SGID without re-requesting it. Only an ordinary,
        # caller-owned private directory may have its ordinary permission bits fixed.
        if st.st_uid==os.geteuid() and not mode & (stat.S_ISUID|stat.S_ISGID) and mode!=0o770:
            os.chmod(path,0o770);mode=stat.S_IMODE(path.stat().st_mode)
        if mode not in (0o770,0o2770):raise RuntimeError('reader_data_permissions_run_offline_migration')
    def shared_file(self,path,create=False):
        # Never open+close an existing SQLite inode: POSIX close would release this
        # process's unrelated SQLite fcntl locks, including WAL/SHM locks.
        for attempt in range(100):
            try:st=path.lstat()
            except FileNotFoundError:
                if not create:return
                try:fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o660)
                except FileExistsError:continue
                try:
                    os.fchown(fd,-1,self.gid);os.fchmod(fd,0o660)
                finally:os.close(fd)
                st=path.lstat()
            if not stat.S_ISREG(st.st_mode) or st.st_nlink!=1 or path.is_symlink():raise RuntimeError('unsafe_sqlite_file')
            if st.st_uid==os.geteuid():
                if st.st_gid!=self.gid:os.chown(path,-1,self.gid)
                if stat.S_IMODE(st.st_mode)!=0o660:os.chmod(path,0o660)
            st=path.stat()
            if st.st_gid==self.gid and stat.S_IMODE(st.st_mode)==0o660:return
            if not create or attempt==99:raise RuntimeError('sqlite_permissions_run_offline_migration')
            time.sleep(.01)
    def side_permissions(self):
        for suffix in ('-journal','-wal','-shm'):
            try:self.shared_file(Path(str(self.dbpath)+suffix))
            except FileNotFoundError:pass  # Last connection in another process may unlink a sidecar.
    @contextmanager
    def db(self):
        with _DB_BOOTSTRAP_LOCK:
            self.shared_file(self.dbpath,create=True)
            db = sqlite3.connect(self.dbpath, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA busy_timeout=10000')
        db.execute('PRAGMA secure_delete=ON')
        try:
            with db: yield db
        finally:
            try:self.side_permissions()
            finally:db.close()
    def heartbeat(self):
        with self.db() as db:
            db.execute('INSERT OR REPLACE INTO meta VALUES (?,?)', ('heartbeat', str(time.time())))
    def healthy(self):
        with self.db() as db: row = db.execute('SELECT value FROM meta WHERE key=?', ('heartbeat',)).fetchone()
        return bool(row and time.time() - float(row[0]) < 15)
    def disk_ok(self):
        # Count only this service tree. Never follow symlinks to other services.
        total = 0
        for root, dirs, files in os.walk(self.root, followlinks=False):
            dirs[:] = [d for d in dirs if not (Path(root)/d).is_symlink()]
            for f in files:
                p = Path(root)/f
                if p.is_symlink(): return False
                total += p.stat().st_size
                if total > self.s.max_disk: return False
        return shutil.disk_usage(self.root).free > self.s.min_free and shutil.disk_usage(self.root/'jobs').free > 32*1024*1024
    def create(self, owner, payload, key):
        if not isinstance(payload, dict): raise Fault(400, 'invalid_request')
        source=payload.get('source','text');age=payload.get('age','8-12');url='';text=''
        if age not in ('4-6','8-12'): raise Fault(400,'valid_age_required')
        if source=='text':
            if set(payload)-{'source','text','age'}: raise Fault(400,'invalid_request')
            text=payload.get('text')
            if not isinstance(text,str) or not 20<=len(text.strip())<=20000: raise Fault(400,'text_20_to_20000_required')
            digest=hashlib.sha256(json.dumps([text,age],ensure_ascii=False).encode()).hexdigest()
        elif source=='url':
            if set(payload)-{'source','url','age'}: raise Fault(400,'invalid_request')
            from .url_fetch import parse_url,FetchError
            try: url=parse_url(payload.get('url')).url
            except FetchError as exc: raise Fault(400,exc.code)
            digest=hashlib.sha256(json.dumps(['url',url,age],ensure_ascii=False).encode()).hexdigest()
        else: raise Fault(400,'invalid_request')
        if not key or not re.fullmatch(r'[a-zA-Z0-9_-]{16,100}',key): raise Fault(400,'idempotency_key_required')
        with self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            old = db.execute('SELECT * FROM jobs WHERE owner=? AND key=?', (owner,key)).fetchone()
            if old:
                if old['request_hash'] != digest: raise Fault(409, 'idempotency_conflict')
                return dict(old)
            if not self.disk_ok(): raise Fault(507, 'disk_budget_exhausted')
            if db.execute('SELECT count(*) FROM jobs').fetchone()[0] >= self.s.max_jobs: raise Fault(429, 'retention_capacity_reached')
            if db.execute("SELECT count(*) FROM jobs WHERE status IN ('queued','running','cancelling')").fetchone()[0] >= self.s.max_queue:
                raise Fault(429, 'queue_full')
            if db.execute("SELECT count(*) FROM jobs WHERE owner=? AND status IN ('queued','running','cancelling')", (owner,)).fetchone()[0]:
                raise Fault(429, 'owner_has_active_job')
            if db.execute('SELECT count(*) FROM jobs WHERE owner=? AND created>?', (owner,time.time()-3600)).fetchone()[0] >= self.s.max_hour:
                raise Fault(429, 'hourly_budget_exhausted')
            now, jid = time.time(), uuid.uuid4().hex
            db.execute('INSERT INTO jobs (id,owner,key,request_hash,age,text,status,error,created,updated,source,url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', (jid,owner,key,digest,age,text,'queued','',now,now,source,url))
            row = db.execute('SELECT * FROM jobs WHERE id=?', (jid,)).fetchone()
            return dict(row)
    def get(self, owner, jid):
        if not ID.fullmatch(jid): raise Fault(404, 'not_found')
        with self.db() as db: row = db.execute('SELECT * FROM jobs WHERE id=? AND owner=?', (jid,owner)).fetchone()
        if not row: raise Fault(404,'not_found')
        return dict(row)
    def cancel(self, owner, jid):
        self.get(owner,jid)
        with self.db() as db:
            db.execute("UPDATE jobs SET status=CASE WHEN status='queued' THEN 'cancelled' ELSE 'cancelling' END,text=CASE WHEN status='queued' THEN '' ELSE text END,url=CASE WHEN status='queued' THEN '' ELSE url END,updated=? WHERE id=? AND owner=? AND status IN ('queued','running')", (time.time(),jid,owner))
        return self.get(owner,jid)
    def recover(self):
        with self.db() as db:
            db.execute("UPDATE jobs SET status='failed',error='worker_restarted',text='',url='',updated=? WHERE status='running'", (time.time(),))
            db.execute("UPDATE jobs SET status='cancelled',text='',url='',updated=? WHERE status='cancelling'", (time.time(),))
    def claim(self):
        with self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute("UPDATE jobs SET status='failed',error='queue_timeout',text='',url='',updated=? WHERE status='queued' AND created<?", (time.time(),time.time()-self.s.timeout))
            row = db.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY created LIMIT 1").fetchone()
            if not row: return None
            db.execute("UPDATE jobs SET status='running',updated=? WHERE id=?", (time.time(),row['id']))
            return dict(row)
    def finish(self,jid,status,error=''):
        if status not in TERMINAL: raise ValueError('invalid terminal status')
        with self.db() as db:
            db.execute("UPDATE jobs SET status=CASE WHEN status='cancelling' THEN 'cancelled' ELSE ? END,error=?,text='',url='',updated=? WHERE id=? AND status IN ('running','cancelling')", (status,error,time.time(),jid))
    def phase(self,jid,phase):
        with self.db() as db: db.execute('UPDATE jobs SET phase=?,updated=? WHERE id=?',(phase,time.time(),jid))
    def record_review(self,jid,report,attempt):
        with self.db() as db: db.execute('UPDATE jobs SET review_report=?,review_attempts=?,updated=? WHERE id=?',(json.dumps(report,ensure_ascii=False),attempt,time.time(),jid))
    def jobdir(self, jid):
        if not ID.fullmatch(jid): raise Fault(404,'not_found')
        p = self.root/'jobs'/jid
        if p.is_symlink(): raise Fault(500,'unsafe_job_path')
        return p
    def public(self, row):
        result = dict(version=1,id=row['id'],status=row['status'],label={'queued':'读材料','running':'改写','cancelling':'正在终止','cancelled':'已取消','ready':'可预览','failed':'失败'}.get(row['status'],row['status']),detail=(row.get('phase') or ''),error=row['error'],book=None)
        if row['status']=='ready':
            path = self.jobdir(row['id'])/'book.json'
            if path.is_symlink() or not path.is_file() or path.stat().st_size > 2*1024*1024:
                raise Fault(500,'artifact_unavailable')
            result['book'] = json.loads(path.read_text(encoding='utf-8'))
        return result
