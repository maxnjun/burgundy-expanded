"""Check an APK contains the current, byte-identical public game assets."""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

apk = Path(sys.argv[1])
with zipfile.ZipFile(apk) as bundle:
    files = sorted(p for p in Path('public').rglob('*') if p.is_file())
    for source in files:
        entry = 'assets/public/' + source.relative_to('public').as_posix()
        assert bundle.read(entry) == source.read_bytes(), f'Missing or changed asset: {source}'
    for page in ('index.html', 'online/index.html', 'updates/index.html', 'monastery-gallery/index.html'):
        assert bundle.read('assets/public/' + page), f'Missing offline screen: {page}'
    config = json.loads(bundle.read('assets/capacitor.config.json'))
    assert 'url' not in config['server'], 'APK must start from bundled assets, not a remote website'
    assert config['appId'] == 'com.maxnjun.burgundyexpanded'
    assert config['server']['androidScheme'] == 'https'
    build = json.loads(bundle.read('assets/public/android-build.json'))
print(json.dumps({'apk': str(apk.resolve()), 'bytes': apk.stat().st_size,
    'sha256': hashlib.file_digest(apk.open('rb'), 'sha256').hexdigest(),
    'public_assets_verified': len(files), 'build': build}, ensure_ascii=False, indent=2))
