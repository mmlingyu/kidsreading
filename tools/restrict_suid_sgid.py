"""Real native-arch seccomp equivalent of systemd v255 RestrictSUIDSGID.
Test launcher, not a replacement for production systemd. No Python syscall mocks.
Reference: systemd/v255/src/shared/seccomp-util.c:seccomp_restrict_sxid.
"""
import ctypes,errno,json,os,platform,runpy,sys
class Compare(ctypes.Structure):
    _fields_=[('arg',ctypes.c_uint),('op',ctypes.c_int),('mask',ctypes.c_uint64),('value',ctypes.c_uint64)]
def install():
    if platform.machine()!='x86_64':raise RuntimeError('regression launcher currently Linux x86_64 only')
    libc=ctypes.CDLL(None,use_errno=True)
    if libc.prctl(38,1,0,0,0):raise OSError(ctypes.get_errno(),'PR_SET_NO_NEW_PRIVS')
    lib=ctypes.CDLL('libseccomp.so.2',use_errno=True)
    lib.seccomp_init.argtypes=[ctypes.c_uint32];lib.seccomp_init.restype=ctypes.c_void_p
    lib.seccomp_syscall_resolve_name.argtypes=[ctypes.c_char_p];lib.seccomp_syscall_resolve_name.restype=ctypes.c_int
    lib.seccomp_rule_add_array.argtypes=[ctypes.c_void_p,ctypes.c_uint32,ctypes.c_int,ctypes.c_uint,ctypes.POINTER(Compare)]
    lib.seccomp_load.argtypes=[ctypes.c_void_p];lib.seccomp_release.argtypes=[ctypes.c_void_p]
    ctx=lib.seccomp_init(0x7fff0000)
    if not ctx:raise RuntimeError('seccomp_init_failed')
    names=[]
    def rule(name,action,conditions,number=None):
        nr=lib.seccomp_syscall_resolve_name(name.encode()) if number is None else number
        if nr<0:raise RuntimeError('seccomp syscall unknown: '+name)
        args=(Compare*len(conditions))(*(Compare(i,7,m,v) for i,m,v in conditions))
        rc=lib.seccomp_rule_add_array(ctx,action,nr,len(args),args)
        if rc<0:raise RuntimeError('seccomp_rule_failed:'+name+':'+str(rc))
        names.append(name)
    try:
        for bit in (0o4000,0o2000):
            for name,index in [('chmod',1),('fchmod',1),('fchmodat',2),('mkdir',1),('mkdirat',2),('mknod',1),('mknodat',2),('creat',1)]:
                rule(name,0x50000|errno.EPERM,[(index,bit,bit)])
            rule('open',0x50000|errno.EPERM,[(1,os.O_CREAT,os.O_CREAT),(2,bit,bit)])
            rule('openat',0x50000|errno.EPERM,[(2,os.O_CREAT,os.O_CREAT),(3,bit,bit)])
            if lib.seccomp_syscall_resolve_name(b'fchmodat2')>=0:rule('fchmodat2',0x50000|errno.EPERM,[(2,bit,bit)])
        if lib.seccomp_syscall_resolve_name(b'fchmodat2')<0:rule('fchmodat2',0x50000|errno.ENOSYS,[],number=452)
        rule('openat2',0x50000|errno.ENOSYS,[])
        if lib.seccomp_load(ctx)<0:raise RuntimeError('seccomp_load_failed')
    finally:lib.seccomp_release(ctx)
    return {'kernel_seccomp_loaded':True,'native_arch':'x86_64','mode_syscalls':sorted(set(names)),'full_systemd_unit':False}
if __name__=='__main__':
    if len(sys.argv)<3 or sys.argv[1]!='--module':raise SystemExit('Usage: python -m tools.restrict_suid_sgid --module MODULE ...')
    module=sys.argv[2];sys.argv=sys.argv[2:];install();runpy.run_module(module,run_name='__main__')
