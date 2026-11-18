#!/usr/bin/env python3
"""Mark leftover Studio running jobs failed. Does not touch the reader database.

Idempotent. A second run reports an empty list. Rows are never set to ready.
"""
import json, os, sqlite3, sys, time
from pathlib import Path

def recover(dbpath, reason='studio_orphan_recovered'):
    dbpath=Path(dbpath)
    if reason in ('', 'ready') or 'ready' in reason:
        raise SystemExit('refusing to record the orphan as a success')
    resolved=dbpath.resolve()
    if resolved==Path('/var/lib/reader/queue.sqlite3') or resolved.parent==Path('/var/lib/reader'):
        raise SystemExit('refusing to open the reader database')
    if dbpath.name!='studio.sqlite3':
        raise SystemExit('refusing a database that is not studio.sqlite3')
    if not dbpath.is_file():
        return []
    conn=sqlite3.connect(dbpath)
    try:
        rows=conn.execute("SELECT id FROM jobs WHERE status='running' ORDER BY created").fetchall()
        ids=[row[0] for row in rows]
        if ids:
            conn.execute("UPDATE jobs SET status='failed', error=?, review='', updated=? WHERE status='running'", (reason, time.time()))
            conn.commit()
        return ids
    finally:
        conn.close()

def main():
    data=Path(os.environ.get('STUDIO_DATA','/var/lib/studio'))
    ids=recover(data/'studio.sqlite3')
    print(json.dumps({'recovered':ids,'error':'studio_orphan_recovered','ready':False,'signed':False}))

if __name__=='__main__':
    main()
