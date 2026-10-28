"""Validate committed game outputs; source-authoring checks remain in validate-tile-assets.py."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
standard=json.loads((ROOT/'src/app/tile-standard.json').read_text())
checked=0
def validate(path,sha,canvas,bounds=None):
    global checked
    assert path.is_file(), ('missing deployment asset',path)
    assert hashlib.sha256(path.read_bytes()).hexdigest()==sha, ('changed deployment asset',path)
    image=Image.open(path)
    expected=tuple(canvas) if isinstance(canvas,list) else (canvas,canvas)
    assert image.format=='PNG' and image.mode=='RGBA' and image.size==expected, ('invalid canvas/format',path)
    alpha=image.getchannel('A')
    assert alpha.getextrema()==(0,255) and alpha.getbbox(), ('missing transparency/art',path)
    if bounds is not None: assert list(alpha.getbbox())==bounds, ('changed alpha bounds',path)
    checked+=1

for family,count in [('beige',10),('animals',13),('monastery',29)]:
    folder=ROOT/f'public/assets/tiles/{family}/final';m=json.loads((folder/'manifest.json').read_text())
    assert m['canvas']==standard['rasterCanvas'] and len(m['assets'])==count
    assert len({a['file'] for a in m['assets']})==count
    for a in m['assets']: validate(folder/a['file'],a['outputSha256'],m['canvas'],a['alphaBounds'])
folder=ROOT/'public/tiles/illustrations'
for manifest in ['manifest.json','center-manifest.json']:
    m=json.loads((folder/manifest).read_text())
    for name,a in m['assets'].items(): validate(folder/f'{name}.png',a['outputSha256'],standard['rasterCanvas'],a.get('alphaBounds'))
folder=ROOT/'public/assets/icons';m=json.loads((folder/'manifest.json').read_text())
for name,a in m['assets'].items():
    with Image.open(folder/f'{name}.png') as image: size=image.width
    validate(folder/f'{name}.png',a['sha256'],size,a['alphaBounds'])
folder=ROOT/'public/shields';m=json.loads((folder/'manifest.json').read_text())
assert m['canvas']==[1200,1480] and len(m['assets'])==18
assert {a['number'] for a in m['assets']}==set(range(1,19))
for a in m['assets']:
    assert a['file']==f"shield-{a['number']:02d}.png"
    validate(folder/a['file'],a['outputSha256'],m['canvas'])
folder=ROOT/'public/assets/vineyards';m=json.loads((folder/'manifest.json').read_text(encoding='utf8'))
assert len(m['assets'])==6 and {a['grape'] for a in m['assets']}==set('BKGORY')
for a in m['assets']:
    for kind,canvas in [('fruit',768),('candy',512)]:
        item=a[kind]
        assert item['canvas']==[canvas,canvas]
        validate(folder/item['file'],item['sha256'],canvas,item['alphaBounds'])
fruits={a['grape']:a['fruit'] for a in m['assets']}
mask_folder=folder/'illustration-masks';m=json.loads((mask_folder/'manifest.json').read_text())
assert m['canvas']==768 and len(m['assets'])==6 and {a['grape'] for a in m['assets']}==set('BKGORY')
for a in m['assets']:
    assert a['sourceSha256']==fruits[a['grape']]['sha256']
    validate(mask_folder/a['file'],a['sha256'],m['canvas'],a['alphaBounds'])
print(json.dumps({'validatedDeploymentPNGs':checked,'sourceAuthoring':'separate strict check; no regeneration in deployment'}))
