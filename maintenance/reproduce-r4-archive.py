#!/usr/bin/env python3
"""Check and repack the accepted r4 release from a git checkout.

This does not rewrite SHA256MANIFEST.txt or TRUSTED-SHA256.json.
Maintenance files, the historical Phonon/Kokoro tools, and git metadata
stay outside the archive. The accepted tar hash is a property of the
452 release bytes plus the original archive headers, not of the whole
git tree.
"""
import gzip
import hashlib
import sys
import tarfile
from pathlib import Path

RELEASE_NAME = "reader-phase1-20261117-r4"
GZIP_NAME = "reader-phase1-20261117-r4.tar"
EXPECTED_TAR_SHA256 = "03728d3994a54bf88563958b513fcb2e304c3a98d215053f5985c9c8b2ae3b39"
EXPECTED_TAR_BYTES = 23740090
EXPECTED_MANIFEST_SHA256 = "49617553d0fc2bef3e13677e971cf5bb1ce662f89b4f4a6311475860103a7f27"
EXPECTED_TRUSTED_SHA256 = "f098c07bd78f4d21b81a9cd1bc9851fd4e2e5f8b899a2be8c51bd578ecd84f0d"
MANIFEST_ENTRIES = 451

ROOT = Path(__file__).resolve().parent.parent


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(1)


def release_paths():
    manifest_path = ROOT / "SHA256MANIFEST.txt"
    trusted_path = ROOT / "TRUSTED-SHA256.json"
    if not manifest_path.is_file() or manifest_path.is_symlink():
        fail("SHA256MANIFEST.txt missing")
    if not trusted_path.is_file() or trusted_path.is_symlink():
        fail("TRUSTED-SHA256.json missing")
    manifest_bytes = manifest_path.read_bytes()
    trusted_bytes = trusted_path.read_bytes()
    manifest_sha = hashlib.sha256(manifest_bytes).hexdigest()
    trusted_sha = hashlib.sha256(trusted_bytes).hexdigest()
    if manifest_sha != EXPECTED_MANIFEST_SHA256:
        fail("SHA256MANIFEST.txt hash differs from the accepted release")
    if trusted_sha != EXPECTED_TRUSTED_SHA256:
        fail("TRUSTED-SHA256.json hash differs from the accepted release")
    text = manifest_bytes.decode("utf-8")
    if text.endswith("\n"):
        lines = text.splitlines()
    else:
        fail("SHA256MANIFEST.txt has no trailing newline")
    if len(lines) != MANIFEST_ENTRIES:
        fail(f"SHA256MANIFEST.txt has {len(lines)} entries, accepted release has {MANIFEST_ENTRIES}")
    paths = []
    for line in lines:
        digest, rel = line.split("  ", 1)
        path = ROOT / rel
        if path.is_symlink() or not path.is_file():
            fail(f"release path is not a regular file: {rel}")
        got = hashlib.sha256(path.read_bytes()).hexdigest()
        if got != digest:
            fail(f"byte mismatch: {rel}")
        paths.append(path)
    if "SHA256MANIFEST.txt" in {p.relative_to(ROOT).as_posix() for p in paths}:
        fail("SHA256MANIFEST.txt must stay outside its own entry list")
    paths.append(manifest_path)
    # Same order as tools/build_release.py: pathlib.Path ordering, not raw string order.
    # '-' sorts after '/' in a path component, so frontend/app precedes frontend-overlay.
    return sorted(paths)


def pack(paths, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("wb") as raw, gzip.GzipFile(
        filename=GZIP_NAME, fileobj=raw, mode="wb", mtime=0, compresslevel=9
    ) as gz, tarfile.open(fileobj=gz, mode="w", format=tarfile.USTAR_FORMAT) as tar:
        for path in paths:
            arcname = RELEASE_NAME + "/" + path.relative_to(ROOT).as_posix()
            info = tar.gettarinfo(str(path), arcname=arcname)
            info.uid = 0
            info.gid = 0
            info.uname = "root"
            info.gname = "root"
            info.mtime = 0
            info.mode = 0o755 if path.suffix == ".sh" else 0o644
            info.type = tarfile.REGTYPE
            info.linkname = ""
            with path.open("rb") as source:
                tar.addfile(info, source)


def main(argv):
    if argv not in ([], ["--check"]) and not (len(argv) == 2 and argv[0] == "--output"):
        fail("usage: reproduce-r4-archive.py [--check | --output ARCHIVE.tar.gz]")
    paths = release_paths()
    if len(paths) != MANIFEST_ENTRIES + 1:
        fail("release file count is not 452")
    print(f"release files {len(paths)}")
    print(f"SHA256MANIFEST.txt {EXPECTED_MANIFEST_SHA256}")
    print(f"TRUSTED-SHA256.json {EXPECTED_TRUSTED_SHA256}")
    if argv == ["--check"] or argv == []:
        print("check ok; archive not written")
        return
    dest = Path(argv[1])
    if dest.resolve().is_relative_to(ROOT.resolve()):
        fail("refusing to write the archive inside the checkout")
    pack(paths, dest)
    data = dest.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    print(f"bytes {len(data)}")
    print(f"sha256 {digest}")
    if len(data) != EXPECTED_TAR_BYTES or digest != EXPECTED_TAR_SHA256:
        fail(
            "archive bytes differ from the accepted tar. "
            "This script was verified with CPython 3.12.3 gzip/tarfile. "
            "Do not replace SHA256MANIFEST.txt to explain the difference."
        )
    print("accepted tar hash reproduced")


if __name__ == "__main__":
    main(sys.argv[1:])
