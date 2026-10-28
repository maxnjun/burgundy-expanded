"""Make alpha-only illustration masks; approved fruit/candy PNGs remain byte-identical."""
from collections import deque
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
folder = ROOT/'public/assets/vineyards'
approved = json.loads((folder/'manifest.json').read_text(encoding='utf8'))
target = folder/'illustration-masks'
assets = []
for a in approved['assets']:
    source = folder/a['fruit']['file']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == a['fruit']['sha256']
    image = Image.open(source).convert('RGBA')
    w,h = image.size
    left,top,right,bottom = a['fruit']['alphaBounds']
    cx,cy = (left+right)/2,(top+bottom)/2
    vertices = [(cx,top),(right,top+(bottom-top)/4),(right,bottom-(bottom-top)/4),(cx,bottom),(left,bottom-(bottom-top)/4),(left,top+(bottom-top)/4)]
    inside = Image.new('L',image.size)
    ImageDraw.Draw(inside).polygon([(cx+(x-cx)*.87,cy+(y-cy)*.87) for x,y in vertices],fill=255)
    pixels,allowed = image.load(),inside.load()
    # The approved black fruit contours are closed; discard the separate outer hex rim first.
    barrier = bytearray(bool(allowed[x,y]) and max(pixels[x,y][:3])<115 for y in range(h) for x in range(w))
    seen = bytearray(w*h)
    queue = deque([0]);seen[0] = 1
    while queue:
        i = queue.popleft();x,y = i%w,i//w
        for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
            if 0<=nx<w and 0<=ny<h:
                j = ny*w+nx
                if not seen[j] and not barrier[j]:seen[j]=1;queue.append(j)
    mask = Image.frombytes('L',image.size,bytes(0 if v else 255 for v in seen)).filter(ImageFilter.MaxFilter(3))
    bounds = mask.getbbox()
    assert bounds and .15<sum(mask.tobytes())/(255*w*h)<.55, ('Broken fruit contour',a['id'])
    assert bounds[0]>left+20 and bounds[1]>top+20 and bounds[2]<right-20 and bounds[3]<bottom-20, ('Rim retained/clipped',a['id'])
    file = a['id']+'.png'
    path = target/file
    rgba = Image.new('RGBA',image.size,'white');rgba.putalpha(mask)
    if args.check:
        saved = Image.open(path)
        assert saved.mode=='RGBA' and saved.tobytes()==rgba.tobytes(), ('Changed mask',file)
    else:
        target.mkdir(parents=True,exist_ok=True);rgba.save(path,optimize=True)
    assets.append({'grape':a['grape'],'file':file,'sourceSha256':a['fruit']['sha256'],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'alphaBounds':list(bounds)})
manifest = {'canvas':768,'assets':assets}
path = target/'manifest.json'
if args.check:assert json.loads(path.read_text())==manifest
else:path.write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'illustrationMasks':len(assets),'approvedPNGsModified':0,'check':args.check}))
