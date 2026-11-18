"""Operator acceptance gate. Fail closed; never inferred from a successful unit test."""
import hashlib, json, os
from pathlib import Path
from .sandbox import ROOT

def accepted(path=Path('/etc/reader/accepted.json')):
    try:
        st=path.stat()
        if st.st_uid != 0 or st.st_mode & 0o022: return False
        data=json.loads(path.read_text())
        manifest_hash=hashlib.sha256((ROOT/'TRUSTED-SHA256.json').read_bytes()).hexdigest()
        required=('source_parity_reviewed','namespace_negative_probes','filesystem_hard_quota',
                  'systemd_cgroup_limits','linux_py312_sdk_smoke','https_auth_checked')
        return data.get('trusted_manifest_sha256')==manifest_hash and all(data.get(k) is True for k in required)
    except Exception: return False
