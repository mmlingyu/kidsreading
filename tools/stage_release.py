#!/usr/bin/env python3
"""Build the deployable archive from a clean version-named directory.

The git checkout may also contain MAINTENANCE notes, docs/, and the historical
Kokoro/Phonon files (tts/, speech.js, phonon-sw.js). Those are not part of the
reader release. This copies the product tree, then runs tools/build_release.py
only inside that copy. It does not rewrite the checkout unless asked.
"""
import argparse, ast, hashlib, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_FILES = {'.gitignore', 'README.md', 'MAINTENANCE.zh-CN.md', 'speech.js', 'phonon-sw.js', 'test-speech-plan.mjs', 'test-synth-queue.mjs'}
SKIP_DIRS = {'docs', 'maintenance', 'tts', '.git', '__pycache__', '.pytest_cache'}


def version():
    return next(ast.literal_eval(n.value) for n in ast.parse((ROOT/'reader_service/__init__.py').read_text()).body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'VERSION' for t in n.targets))


def ignore(directory, names):
    rel = Path(directory).resolve().relative_to(ROOT.resolve())
    skipped = {'__pycache__', '.pytest_cache'}
    if rel == Path('.'):
        skipped |= SKIP_FILES | SKIP_DIRS
    return [name for name in names if name in skipped or name.endswith('.pyc')]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True, help='path for the deployable tar.gz; must be outside the checkout')
    parser.add_argument('--update-checkout-manifests', action='store_true', help='copy SHA256MANIFEST.txt and TRUSTED-SHA256.json back to the checkout')
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if output.is_relative_to(ROOT.resolve()):
        raise SystemExit('refusing to write the archive inside the checkout')
    name = version()
    parent = Path(tempfile.mkdtemp(prefix='reader-stage-'))
    dest = parent / name
    shutil.copytree(ROOT, dest, ignore=ignore, symlinks=False)
    run = subprocess.run([sys.executable, str(dest/'tools'/'build_release.py')], cwd=dest)
    if run.returncode:
        raise SystemExit(run.returncode)
    tar = parent / (name + '.tar.gz')
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(tar, output)
    data = output.read_bytes()
    trusted = (dest/'TRUSTED-SHA256.json').read_bytes()
    manifest = (dest/'SHA256MANIFEST.txt').read_bytes()
    if args.update_checkout_manifests:
        (ROOT/'SHA256MANIFEST.txt').write_bytes(manifest)
        (ROOT/'TRUSTED-SHA256.json').write_bytes(trusted)
    print('stage', dest)
    print(output, len(data), hashlib.sha256(data).hexdigest())
    print('trusted_manifest_sha256', hashlib.sha256(trusted).hexdigest())
    print('manifest_sha256', hashlib.sha256(manifest).hexdigest(), 'entries', manifest.count(b'\n'))


if __name__ == '__main__':
    main()
