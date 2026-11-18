"""Separate HTML-job queue. Does not open the reader SQLite database."""
import hashlib, hmac, json, os, sqlite3, time, uuid
from pathlib import Path
from .core import Fault

ENABLED_FIELDS={'skill','brief'}

class StudioSettings:
    def __init__(self, data, owners, origins=(), enable=False):
        self.data=Path(data)
        self.owners=owners
        self.origins=tuple(origins)
        self.enable=enable
        self.max_jobs=50
        self.max_hour=3
        self.max_running=1
        for origin in self.origins:
            if not __import__('re').fullmatch(r'https://[a-zA-Z0-9.:-]+', origin):
                raise ValueError('CORS requires exact HTTPS origins without paths')

    @classmethod
    def load(cls):
        path=Path(os.environ['STUDIO_AUTH_FILE'])
        if os.name=='posix' and path.stat().st_mode & 0o007:
            raise RuntimeError('auth file must not be world accessible')
        return cls(os.environ.get('STUDIO_DATA','/var/lib/studio'),
                   json.loads(path.read_text()),
                   filter(None, os.environ.get('STUDIO_CORS_ORIGINS','').split(',')),
                   os.environ.get('STUDIO_ENABLE_GENERATION')=='1')

def authenticate(owners, header):
    if not header or not header.startswith('Bearer ') or len(header)>256:
        raise Fault(401,'unauthorized')
    token=header[7:]
    if len(token)<32 or not token.isascii():
        raise Fault(401,'unauthorized')
    digest=hashlib.sha256(token.encode()).hexdigest()
    owner=None
    for candidate, value in owners.items():
        if hmac.compare_digest(digest, candidate):
            owner=value
    if owner is None:
        raise Fault(401,'unauthorized')
    return owner

class StudioStore:
    def __init__(self, settings):
        self.s=settings
        self.root=settings.data
        self.root.mkdir(mode=0o2770, exist_ok=True)
        self.dbpath=self.root/'studio.sqlite3'
        with self.db() as db:
            db.execute('PRAGMA journal_mode=DELETE')
            db.execute('''CREATE TABLE IF NOT EXISTS jobs(
                id TEXT PRIMARY KEY, owner TEXT, skill TEXT, brief TEXT,
                status TEXT, error TEXT, created REAL, updated REAL, review TEXT)''')
        if self.dbpath.exists():
            os.chmod(self.dbpath, 0o660)

    def db(self):
        conn=sqlite3.connect(self.dbpath, timeout=5)
        conn.row_factory=sqlite3.Row
        return _Closing(conn)

    def create(self, owner, payload):
        if not isinstance(payload, dict) or set(payload)-ENABLED_FIELDS:
            raise Fault(400,'studio_bad_request')
        skill=payload.get('skill')
        brief=payload.get('brief')
        if not isinstance(skill,str) or not isinstance(brief,str):
            raise Fault(400,'studio_bad_request')
        if '\x00' in brief or not brief.strip() or len(brief)>4000:
            raise Fault(400,'studio_bad_brief')
        from .studio_catalog import skill as lookup
        item=lookup(skill)
        if item is None:
            raise Fault(404,'studio_unknown_skill')
        if item['status']!='enabled':
            raise Fault(403,'studio_skill_blocked')
        now=time.time()
        with self.db() as db:
            running=db.execute("SELECT COUNT(*) c FROM jobs WHERE owner=? AND status IN ('queued','running')",(owner,)).fetchone()['c']
            if running>=self.s.max_running:
                raise Fault(429,'studio_busy')
            hour=db.execute('SELECT COUNT(*) c FROM jobs WHERE owner=? AND created>?',(owner, now-3600)).fetchone()['c']
            if hour>=self.s.max_hour:
                raise Fault(429,'studio_quota')
            total=db.execute('SELECT COUNT(*) c FROM jobs WHERE owner=?',(owner,)).fetchone()['c']
            if total>=self.s.max_jobs:
                raise Fault(429,'studio_quota')
            job=uuid.uuid4().hex
            db.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?)',
                       (job, owner, skill, brief.strip(), 'queued', '', now, now, ''))
        return self.get(owner, job)

    def get(self, owner, job):
        with self.db() as db:
            row=db.execute('SELECT * FROM jobs WHERE id=?',(job,)).fetchone()
        if row is None or row['owner']!=owner:
            raise Fault(404,'studio_not_found')
        return dict(row)

    def public(self, row):
        return {'version':1,'id':row['id'],'skill':row['skill'],'status':row['status'],'error':row['error'],
                'files':['preview.html','report.md'] if row['status']=='ready' else []}

    def claim(self):
        with self.db() as db:
            row=db.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY created LIMIT 1").fetchone()
            if row is None:
                return None
            cur=db.execute("UPDATE jobs SET status='running', updated=? WHERE id=? AND status='queued'",(time.time(), row['id']))
            if cur.rowcount!=1:
                return None
        return dict(row)

    def finish(self, job, status, error='', review=''):
        with self.db() as db:
            db.execute('UPDATE jobs SET status=?, error=?, review=?, updated=? WHERE id=?',
                       (status, error, review, time.time(), job))

    def finish_if_running(self, job, status, error='', review=''):
        """Do not let a late success overwrite cancel."""
        return self.finish_if_status(job, 'running', status, error, review)

    def finish_if_status(self, job, expected, status, error='', review=''):
        with self.db() as db:
            cur=db.execute('UPDATE jobs SET status=?, error=?, review=?, updated=? WHERE id=? AND status=?',
                           (status, error, review, time.time(), job, expected))
            return cur.rowcount==1

    def recover_orphans(self):
        with self.db() as db:
            db.execute("UPDATE jobs SET status='failed', error='studio_worker_restarted', updated=? WHERE status='running'", (time.time(),))

    def cancel(self, owner, job):
        row=self.get(owner, job)
        if row['status'] in ('ready','failed','cancelled'):
            return row
        self.finish(job,'cancelled','cancelled')
        return self.get(owner, job)

    def jobdir(self, job):
        if len(job)!=32 or any(c not in '0123456789abcdef' for c in job):
            raise Fault(400,'studio_bad_request')
        path=self.root/'jobs'/job
        if path.is_symlink():
            raise Fault(400,'studio_bad_request')
        return path

class _Closing:
    def __init__(self, conn):
        self.conn=conn
    def __enter__(self):
        return self.conn
    def __exit__(self, *args):
        self.conn.commit()
        self.conn.close()
