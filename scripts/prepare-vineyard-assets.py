"""Extract approved source pixels only; never repaint illustrations or replace the source."""
from collections import deque
from io import BytesIO
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
parser.add_argument('--preview', type=Path)
args = parser.parse_args()
review = json.loads((ROOT / 'asset-inbox/vineyard-approved/manifest.json').read_text(encoding='utf8'))
source = ROOT / review['source']
digest = lambda data: hashlib.sha256(data).hexdigest()
assert digest(source.read_bytes()) == review['sourceSha256'], 'Changed source: review silhouettes first'
original = Image.open(source).convert('RGB')
assert list(original.size) == review['sourceCanvas']
assert {a['grape'] for a in review['assets']} == set('BKGORY') and len(review['assets']) == 6
folder = ROOT / 'public/assets/vineyards'
outputs, assets, samples = {}, [], []

def extract(box, canvas, target, axis):
    crop = original.crop(box)
    w, h = crop.size
    pixels = crop.load()
    outside = bytearray(w * h)
    queue = deque()
    def visit(x, y):
        i = y * w + x
        rgb = pixels[x, y]
        if not outside[i] and min(rgb) > review['background']['minChannelAbove'] and max(rgb)-min(rgb) < review['background']['chromaBelow']:
            outside[i] = 1
            queue.append((x, y))
    for x in range(w):
        visit(x, 0)
        visit(x, h-1)
    for y in range(h):
        visit(0, y)
        visit(w-1, y)
    while queue:
        x, y = queue.popleft()
        for nx, ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            if 0 <= nx < w and 0 <= ny < h:
                visit(nx, ny)
    mask = Image.frombytes('L', (w,h), bytes(0 if v else 255 for v in outside))
    bounds = mask.getbbox()
    assert bounds and 0 < bounds[0] < bounds[2] < w and 0 < bounds[1] < bounds[3] < h, 'Clipped/empty crop'
    rgba = crop.convert('RGBA')
    rgba.putalpha(mask)
    assert rgba.convert('RGB').tobytes() == crop.tobytes(), 'Source RGB must stay untouched'
    assert .25 < sum(mask.tobytes()) / (255*w*h) < .85, 'Inspect changed silhouette'
    art = rgba.crop(bounds)
    scale = target / art.size[axis]
    size = tuple(round(n * scale) for n in art.size)
    assert max(size) < canvas
    resized = art.resize(size, Image.Resampling.LANCZOS)
    result = Image.new('RGBA', (canvas,canvas))
    result.paste(resized, ((canvas-size[0])//2, (canvas-size[1])//2))
    alpha = result.getchannel('A')
    assert alpha.getextrema() == (0,255) and alpha.getbbox()
    assert all(result.getpixel(p)[3] == 0 for p in [(0,0),(canvas-1,0),(0,canvas-1),(canvas-1,canvas-1)])
    return result, [bounds[0]+box[0],bounds[1]+box[1],bounds[2]+box[0],bounds[3]+box[1]]

def register(name, image, source_bounds):
    stream = BytesIO()
    image.save(stream, 'PNG', optimize=True)
    data = stream.getvalue()
    path = folder / name
    if args.check:
        assert path.is_file(), ('Missing asset',path)
        saved = Image.open(path)
        assert saved.mode == 'RGBA' and saved.size == image.size and saved.tobytes() == image.tobytes(), ('Changed pixels',path)
        data = path.read_bytes()
    else:
        outputs[path] = data
    return {'file':name,'canvas':list(image.size),'sha256':digest(data),'alphaBounds':list(image.getchannel('A').getbbox()),'sourceBounds':source_bounds}

for a in review['assets']:
    fruit, fb = extract(a['fruitCrop'], review['fruitCanvas'], review['fruitArtHeight'], 1)
    candy, cb = extract(a['candyCrop'], review['candyCanvas'], review['candyArtWidth'], 0)
    assets.append({k:a[k] for k in ['grape','id','name','color']} | {'fruit':register('vineyard-'+a['id']+'.png',fruit,fb),'candy':register('candy-'+a['id']+'.png',candy,cb)})
    samples.append((a['id'],fruit,candy))
manifest = {'version':1,'sourceSha256':review['sourceSha256'],'fruitCanvas':768,'fruitArtHeight':720,'candyCanvas':512,'candyArtWidth':480,'assets':assets}
manifest_path = folder / 'manifest.json'
if args.check:
    assert json.loads(manifest_path.read_text(encoding='utf8')) == manifest, 'Changed mapping/metadata'
else:
    folder.mkdir(parents=True,exist_ok=True)
    for path, data in outputs.items():
        path.write_bytes(data)
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
if args.preview:
    sheet = Image.new('RGBA',(1020,340))
    draw = ImageDraw.Draw(sheet)
    for y in range(0,340,17):
        for x in range(0,1020,17):
            draw.rectangle((x,y,x+16,y+16),fill='#637082' if (x//17+y//17)%2 else '#d7dce1')
    for i, (name,fruit,candy) in enumerate(samples):
        sheet.alpha_composite(fruit.resize((160,160),Image.Resampling.LANCZOS),(i*170+5,10))
        sheet.alpha_composite(candy.resize((120,120),Image.Resampling.LANCZOS),(i*170+25,180))
        draw.text((i*170+6,315),name,fill='black')
    args.preview.parent.mkdir(parents=True,exist_ok=True)
    sheet.convert('RGB').save(args.preview)
print(json.dumps({'approvedSourceUnchanged':True,'sourceRGBChanges':0,'fruitPNGs':6,'candyPNGs':6,'canvases':[768,512],'check':args.check}))
