#!/usr/bin/env python3
"""Least-privilege access for studio users.

/etc/reader is 0750 root:reader-data. A read ACL on owners.json does nothing
until those users can search the directory. Search is x, not r, so the
directory still cannot be listed. Studio users are not added to reader-data,
because that group can write /var/lib/reader.

Rollback restores the getfacl snapshot taken before the first change. It does
not run setfacl -b and it does not delete an ACL entry that was already there.
"""
import argparse, hashlib, os, subprocess, sys
from pathlib import Path

DEFAULT_USERS=('studio-api','studio-worker')

def run(args, check=True):
    result=subprocess.run(args, check=False, text=True, capture_output=True)
    if check and result.returncode!=0:
        sys.stderr.write(result.stderr or result.stdout)
        raise SystemExit(result.returncode or 1)
    return result

def snapshot(path, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return
    result=run(['getfacl','-p','--absolute-names',str(path)])
    dest.write_text(result.stdout)

def snap_file(snap_dir, path):
    name=hashlib.sha256(str(path).encode()).hexdigest()+'.acl'
    return Path(snap_dir)/name

def apply_acl(reader_dir, owners, snap_dir, users):
    reader_dir, owners, snap_dir=Path(reader_dir), Path(owners), Path(snap_dir)
    if not reader_dir.is_dir() or not owners.is_file() or owners.parent!=reader_dir:
        raise SystemExit('reader directory or owners.json is missing')
    snapshot(reader_dir, snap_dir/'reader-dir.acl')
    snapshot(owners, snap_dir/'owners.acl')
    run(['setfacl','-m',','.join(f'u:{name}:x' for name in users),str(reader_dir)])
    run(['setfacl','-m',','.join(f'u:{name}:r' for name in users),str(owners)])

def grant_tree(user, root, snap_dir):
    root=Path(root)
    if not root.exists():
        raise SystemExit('missing '+str(root))
    script=r'''
import os, stat, sys
root=sys.argv[1]
for dirpath, dirs, files in os.walk(root, followlinks=False):
    mode=os.stat(dirpath).st_mode
    perms=''
    if not os.access(dirpath, os.R_OK):
        perms+='r'
    if not os.access(dirpath, os.X_OK):
        perms+='x'
    if perms:
        print(perms+' '+dirpath)
        dirs[:]=[]
        continue
    for name in files:
        path=os.path.join(dirpath, name)
        if os.path.islink(path):
            continue
        try:
            st=os.stat(path)
        except OSError:
            print('r '+path)
            continue
        if not stat.S_ISREG(st.st_mode):
            continue
        perms=''
        if not os.access(path, os.R_OK):
            perms+='r'
        if (st.st_mode & 0o111) and not os.access(path, os.X_OK):
            perms+='x'
        if perms:
            print(perms+' '+path)
'''
    for _ in range(12):
        result=run(['runuser','-u',user,'--',sys.executable,'-c',script,str(root)])
        lines=[line for line in result.stdout.splitlines() if line.strip()]
        if not lines:
            return
        for line in lines:
            perms, path=line.split(' ',1)
            if any(ch not in 'rx' for ch in perms):
                raise SystemExit('refusing to grant '+perms)
            target=Path(path)
            snapshot(target, snap_file(snap_dir, target))
            run(['setfacl','-m',f'u:{user}:{perms}',str(target)])
    raise SystemExit('still cannot read '+str(root)+' as '+user)

def restore(snap_dir):
    snap_dir=Path(snap_dir)
    files=sorted(snap_dir.glob('*.acl'))
    if not files:
        raise SystemExit('missing ACL snapshot; refusing to delete ACLs blindly')
    parts=[]
    for src in files:
        body=src.read_text()
        if '# file:' not in body:
            raise SystemExit('ACL snapshot '+src.name+' has no file record')
        parts.append(body.rstrip('\n'))
    payload='\n\n'.join(parts)+'\n'
    result=subprocess.run(['setfacl','--restore=-'], input=payload, text=True, capture_output=True)
    if result.returncode!=0:
        sys.stderr.write(result.stderr or result.stdout)
        raise SystemExit(result.returncode)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('action', choices=('apply','grant-tree','restore'))
    parser.add_argument('--reader-dir', default='/etc/reader')
    parser.add_argument('--owners', default='/etc/reader/owners.json')
    parser.add_argument('--snapshot-dir', default='/etc/studio/acl-before')
    parser.add_argument('--users', default=','.join(DEFAULT_USERS))
    parser.add_argument('--user', default='')
    parser.add_argument('--root', default='')
    args=parser.parse_args()
    if os.geteuid()!=0:
        raise SystemExit('root required')
    if args.action=='apply':
        users=tuple(name for name in args.users.split(',') if name)
        if len(users)<1:
            raise SystemExit('users required')
        apply_acl(args.reader_dir, args.owners, args.snapshot_dir, users)
    elif args.action=='grant-tree':
        if not args.user or not args.root:
            raise SystemExit('grant-tree requires --user and --root')
        grant_tree(args.user, args.root, args.snapshot_dir)
    else:
        restore(args.snapshot_dir)

if __name__=='__main__':
    main()
