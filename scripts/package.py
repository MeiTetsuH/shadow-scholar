"""Build a deterministic store ZIP from an explicit runtime allowlist."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'manifest.json').read_text())
files = [
    'manifest.json', 'background.js', 'settings.js', 'stream.js', 'prompts.js',
    'i18n.js', 'ui-icons.js', 'extractors.js', 'content.js', 'anti-detect.js', 'markdown.js',
    'sidepanel.html', 'sidepanel.js', 'sidepanel.css', 'popup.html', 'popup.js',
    'popup.css', 'PRIVACY.md', 'LICENSE', 'lib/marked.min.js', 'lib/marked.LICENSE',
    '_locales/en/messages.json', '_locales/zh_CN/messages.json',
    'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png', 'icons/logo.svg',
]
output = root / 'dist' / f'shadow-scholar-{manifest["version"]}.zip'
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name in sorted(files):
        info = zipfile.ZipInfo(name, (2026, 10, 11, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, (root / name).read_bytes())
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(files)
    assert json.loads(archive.read('manifest.json')) == manifest
    for name in files:
        assert archive.read(name) == (root / name).read_bytes()
digest = hashlib.sha256(output.read_bytes()).hexdigest()
output.with_suffix('.zip.sha256').write_text(f'{digest}  {output.name}\n')
print(f'{output}\n{output.stat().st_size} bytes; {len(files)} verified files\nSHA-256: {digest}')
