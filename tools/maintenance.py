#!/usr/bin/env python3
"""Explicit operator-only lifecycle. No scheduler is installed automatically."""
import argparse, fcntl, json, os, shutil, sqlite3, time
from pathlib import Path
from reader_service.core import Settings,Store

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('action',choices=['backup','prune'])
    parser.add_argument('--destination',type=Path)
    parser.add_argument('--apply-prune-older-than-7-days',action='store_true')
    a=parser.parse_args()
    store=Store(Settings.load())
    with (store.root/'worker.lock').open('a') as lock:
        # Refuse while worker is running. Stop reader-worker first; API may remain available.
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if a.action=='backup':
            if not a.destination or a.destination.exists(): raise SystemExit('new private destination required')
            a.destination.mkdir(mode=0o700,parents=False)
            with store.db() as source, sqlite3.connect(a.destination/'queue.sqlite3') as dest: source.backup(dest)
            with sqlite3.connect(a.destination/'queue.sqlite3') as snap:
                ids=[r[0] for r in snap.execute("SELECT id FROM jobs WHERE status='ready'")]
            for jid in ids:
                p=store.jobdir(jid)/'book.json'
                if p.is_symlink(): raise SystemExit('unsafe artifact')
                folder=a.destination/'jobs'/jid; folder.mkdir(parents=True,mode=0o700)
                shutil.copyfile(p,folder/'book.json')
            print('Backup prepared in private destination; encrypt before off-host storage.')
        else:
            with store.db() as db:
                rows=db.execute("SELECT id FROM jobs WHERE status IN ('ready','failed','cancelled') AND updated<?",(time.time()-7*86400,)).fetchall()
                print('Eligible expired terminal jobs:',len(rows))
                if not a.apply_prune_older_than_7_days: return
                for row in rows:
                    folder=store.jobdir(row[0])
                    if folder.exists(): shutil.rmtree(folder)
                    db.execute('DELETE FROM jobs WHERE id=?',(row[0],))
            with store.db() as db: db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
if __name__=='__main__': main()
