"""Non-systemd regression harness; full kernel v255 mode filter retained.
Optional root-approved target bwrap allows testing Ubuntu24.04 on a newer box.
Production smoke unit uses its actual /usr/bin/bwrap and systemd restrictions instead.
"""
import argparse,hashlib,json,os,stat,subprocess
from pathlib import Path
from reader_service import worker
from reader_service.sandbox import command
from tools.noexec_smoke import run_probe
from tools.restrict_suid_sgid import install

def main():
    p=argparse.ArgumentParser();p.add_argument('--parent',required=True);p.add_argument('--data',required=True);p.add_argument('--runtime',required=True);p.add_argument('--cache',required=True);p.add_argument('--bwrap',default='/usr/bin/bwrap');a=p.parse_args()
    if os.geteuid()==0:raise RuntimeError('SDK regression must be nonroot')
    binary=Path(a.bwrap);st=binary.lstat()
    if not stat.S_ISREG(st.st_mode) or st.st_uid!=0 or st.st_mode & 0o022 or binary.is_symlink():raise RuntimeError('test bwrap must be root-owned readonly regular binary')
    version=subprocess.run([str(binary),'--version'],capture_output=True,text=True,check=True,env={'PATH':'/usr/bin:/bin'}).stdout.strip()
    old=worker.command;worker.command=lambda *args,**kwargs:command(*args,**kwargs,bwrap=str(binary))
    try:
        filter_evidence=install()
        result=run_probe(a.parent,a.runtime,a.cache,prepared_data=a.data,check_setid_filter=True)
        result.update({'syscall_filter':filter_evidence,'bwrap_version':version,'bwrap_sha256':hashlib.sha256(binary.read_bytes()).hexdigest(),'formal_systemd_unit':False})
        print(json.dumps(result,sort_keys=True))
    finally:worker.command=old
if __name__=='__main__':main()
