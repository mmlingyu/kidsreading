from pathlib import Path
from reader_service import VERSION
from reader_service.sandbox import ROOT

def test_canonical_package_version_matches_release_folder():
    assert VERSION==ROOT.name
    assert VERSION=='reader-phase1-20261117-r5-html7'
    page=(ROOT/'frontend/app/index.html').read_text()
    assert 'app.js?v=reader-phase1-r5' in page
    assert 'html7' not in page

def test_health_identifies_current_release():
    import hashlib,tempfile
    from fastapi.testclient import TestClient
    from reader_service.api import create_app
    from reader_service.core import Settings
    with tempfile.TemporaryDirectory() as tmp:
        app=create_app(Settings(Path(tmp),{hashlib.sha256(b'A'*48).hexdigest():'a'}))
        with TestClient(app) as client:
            response=client.get('/api/reader/health')
            assert response.json()['release']==VERSION


def test_builder_refuses_mismatched_release_version(tmp_path):
    import os,shutil,subprocess,sys
    release=tmp_path/'not-the-package-version'
    (release/'tools').mkdir(parents=True)
    (release/'reader_service').mkdir()
    shutil.copyfile(ROOT/'tools/build_release.py',release/'tools/build_release.py')
    (release/'reader_service/__init__.py').write_text("VERSION = 'reader-phase1-20261117-r5'\n")
    run=subprocess.run([sys.executable,str(release/'tools/build_release.py')],capture_output=True,text=True,env={'PATH':'/usr/bin:/bin','PYTHONDONTWRITEBYTECODE':'1'})
    assert run.returncode!=0 and 'VERSION mismatch' in run.stderr
    assert not (release/'SHA256MANIFEST.txt').exists()
    assert not release.with_suffix('.zip').exists()
