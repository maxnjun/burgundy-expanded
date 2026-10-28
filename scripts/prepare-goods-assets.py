"""Extract approved pixels; one uniform scale, transparent padding, no repainting."""
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
args = parser.parse_args()
review = json.loads((ROOT / 'asset-inbox/goods-approved/manifest.json').read_text(encoding='utf8'))
digest = lambda data: hashlib.sha256(data).hexdigest()
sources = {}
for name, meta in review['sources'].items():
    path = ROOT / meta['file']
    assert digest(path.read_bytes()) == meta['sha256'], 'Changed source: review crop first'
    sources[name] = Image.open(path).convert('RGB')
    assert list(sources[name].size) == meta['canvas']

def pip_count(image, box):
    p = image.crop(box)
    dark = {(x,y) for y in range(p.height) for x in range(p.width) if max(p.getpixel((x,y))) < 80}
    count = 0
    while dark:
        queue, size = [dark.pop()], 0
        while queue:
            x,y = queue.pop()
            size += 1
            for pos in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
                if pos in dark:
                    dark.remove(pos)
                    queue.append(pos)
        count += size > 15
    return count

def extract(image, box):
    crop = image.crop(box)
    w,h = crop.size
    outside = bytearray(w*h)
    queue = deque()
    def visit(x,y):
        rgb = crop.getpixel((x,y))
        if not outside[y*w+x] and min(rgb) > 170 and max(rgb)-min(rgb) < 70:
            outside[y*w+x] = 1
            queue.append((x,y))
    for x in range(w):
        visit(x,0)
        visit(x,h-1)
    for y in range(h):
        visit(0,y)
        visit(w-1,y)
    while queue:
        x,y = queue.popleft()
        for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            if 0 <= nx < w and 0 <= ny < h:
                visit(nx,ny)
    mask = Image.frombytes('L',(w,h),bytes(0 if p else 255 for p in outside))
    bounds = mask.getbbox()
    assert bounds and 0 < bounds[0] < bounds[2] < w and 0 < bounds[1] < bounds[3] < h, 'Clipped crop'
    rgba = crop.convert('RGBA')
    rgba.putalpha(mask)
    assert rgba.convert('RGB').tobytes() == crop.tobytes(), 'Source RGB changed'
    art = rgba.crop(bounds)
    scale = 744/max(art.size)
    size = tuple(round(n*scale) for n in art.size)
    result = Image.new('RGBA',(768,768))
    result.paste(art.resize(size,Image.Resampling.LANCZOS),((768-size[0])//2,(768-size[1])//2))
    assert result.getchannel('A').getextrema() == (0,255)
    assert all(result.getpixel(p)[3] == 0 for p in [(0,0),(767,0),(0,767),(767,767)])
    return result, [box[0]+bounds[0],box[1]+bounds[1],box[0]+bounds[2],box[1]+bounds[3]], scale, [(768-size[0])//2,(768-size[1])//2]

folder = ROOT / 'public/assets/goods'
outputs, assets, samples = {}, [], []
for item in review['assets']:
    source = sources[item['source']]
    if 'value' in item:
        assert pip_count(source,item['pipCrop']) == item['value'], 'Wrong printed die face'
    image,bounds,scale,offset = extract(source,item['crop'])
    stream = BytesIO()
    image.save(stream,'PNG',optimize=True)
    data = stream.getvalue()
    path = folder / item['file']
    if args.check:
        saved = Image.open(path)
        assert saved.mode == 'RGBA' and saved.size == (768,768) and saved.tobytes() == image.tobytes(), path
        data = path.read_bytes()
    else:
        outputs[path] = data
    entry = {k:item[k] for k in ['file','name','value','color'] if k in item} | {'sha256':digest(data),'sourceBounds':bounds,'alphaBounds':list(image.getchannel('A').getbbox())}
    if 'value' in item:
        entry['printedPips'] = pip_count(source,item['pipCrop'])
        entry['pipBounds'] = [round((p-bounds[i%2])*scale+offset[i%2],3) for i,p in enumerate(item['pipCrop'])]
    assets.append(entry)
    samples.append((item['name'],image))
assert [a['value'] for a in assets if 'value' in a] == [1,2,3,4,5,6]
assert len(assets) == 7 and assets[-1]['file'] == 'goods_back.png'
manifest = {'version':1,'canvas':768,'artMaxExtent':744,'assets':assets}
if args.check:
    assert json.loads((folder/'manifest.json').read_text(encoding='utf8')) == manifest
else:
    folder.mkdir(parents=True,exist_ok=True)
    for path,data in outputs.items():
        path.write_bytes(data)
    (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    sheet = Image.new('RGB',(960,550),'#f8efd7')
    draw = ImageDraw.Draw(sheet)
    for i,(name,image) in enumerate(samples):
        x,y = (i%4)*240,(i//4)*275
        # Two contrasting backgrounds make the transparent margin visible.
        draw.rectangle((x+8,y+8,x+231,y+231),fill='#48433a' if i%2 else '#ffffff')
        thumb = image.resize((224,224),Image.Resampling.LANCZOS)
        sheet.paste(thumb,(x+8,y+8),thumb)
        draw.text((x+14,y+241),assets[i]['file'],fill='#493522')
    sheet.save(folder/'_preview_sheet.png',optimize=True)
print('PASS: 6 printed die faces, 7 mappings, RGBA canvases, original pixels, uniform scaling and reproducibility')
