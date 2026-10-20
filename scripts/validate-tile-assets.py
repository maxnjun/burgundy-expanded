"""Measure raster support against the shared mathematical inner hex (not its bbox)."""
from pathlib import Path
import hashlib
import json
import math
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'public/tiles/illustrations/manifest.json').read_text())
standard=json.loads((ROOT/'src/app/tile-standard.json').read_text())
assert manifest['frameInset']==standard['frameInset'] and manifest['canvas']==standard['rasterCanvas']
report={'illustrations':{},'resources':{},'warnings':[], 'originals':{}, 'sharedEdges':{}}
for path in (ROOT/'public/tiles').glob('*.png'):
    original=Image.open(path).convert('RGBA')
    report['originals'][path.name]={'size':original.size,'alphaBounds':original.getchannel('A').getbbox(),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
for name, spec in manifest['assets'].items():
    path=ROOT/f'public/tiles/illustrations/{name}.png'
    image=Image.open(path).convert('RGBA'); size=manifest['canvas']
    assert image.size==(size,size)
    assert hashlib.sha256(path.read_bytes()).hexdigest()==spec['outputSha256']
    a=image.getchannel('A'); bounds=a.getbbox()
    assert bounds and a.getextrema()==(0,255), ('missing artwork/transparency',name)
    support=0
    normals=[(math.cos(math.radians(60*i)),math.sin(math.radians(60*i))) for i in range(6)]
    for y in range(size):
        for x in range(size):
            if a.getpixel((x,y)):
                support=max(support,max(nx*(x+.5-size/2)+ny*(y+.5-size/2) for nx,ny in normals))
    limit=math.sqrt(3)*size/4*(1-2*manifest['frameInset']/100)
    assert support<=limit+1, (name,support,limit)
    report['illustrations'][name]={'size':image.size,'alphaBounds':bounds,'innerHexOutsidePx':max(0,support-limit),'AAAllowancePx':1}
    original=ROOT/f'public/tiles/{name}.png'
    if hashlib.sha256(original.read_bytes()).hexdigest()!=spec['sourceSha256']:
        report['warnings'].append(f'{name}: working original differs from reviewed extraction source; do not regenerate without contour review')
icons=json.loads((ROOT/'public/assets/icons/manifest.json').read_text())
center=json.loads((ROOT/'public/tiles/illustrations/center-manifest.json').read_text())
report['centerIllustrations']={}
for name,spec in center['assets'].items():
    path=ROOT/f'public/tiles/illustrations/{name}.png';image=Image.open(path).convert('RGBA')
    assert image.size==(standard['rasterCanvas'],)*2
    assert hashlib.sha256(path.read_bytes()).hexdigest()==spec['outputSha256']
    bounds=image.getchannel('A').getbbox();assert list(bounds)==spec['alphaBounds']
    assert image.getchannel('A').getextrema()==(0,255)
    assert min(bounds[0],bounds[1],image.width-bounds[2],image.height-bounds[3])>=30
    report['centerIllustrations'][name]=spec
approved=Image.open(ROOT/'public/assets/icons/source/resource-icons-approved.png').convert('RGB')
for name,spec in icons['assets'].items():
    path=ROOT/f'public/assets/icons/{name}.png'; image=Image.open(path).convert('RGBA')
    assert image.width==image.height and list(image.getchannel('A').getbbox())==spec['alphaBounds']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==spec['sha256']
    assert all(p==(0,0,0,0) for p in image.get_flattened_data() if p[3]==0)
    x0,y0,x1,y1=spec['sourceBounds']; left=(image.width-(x1-x0))//2; top=(image.height-(y1-y0))//2
    mismatches=0
    for y in range(y1-y0):
        for x in range(x1-x0):
            p=image.getpixel((left+x,top+y))
            if p[3] and p[:3]!=approved.getpixel((x0+x,y0+y)):mismatches+=1
    assert mismatches==0
    report['resources'][name]=spec
    report['resources'][name]['sourceRGBMismatches']=mismatches
for zoom in [100,160,200]:
    path=ROOT/f'.local-data/tile-standard/shared-rim-mask-{zoom}.png'
    if not path.exists():continue
    image=Image.open(path).convert('RGB'); scale=zoom/100; edge=round(100*scale)
    y=image.height//2
    width=sum(max(image.getpixel((x,y)))<128 for x in range(edge-math.ceil(6*scale),edge+math.ceil(6*scale)))
    expected=2*standard['frameInset']*scale
    assert abs(width-expected)<=2, ('duplicate rim/gap',zoom,width,expected)
    art=Image.open(ROOT/f'.local-data/tile-standard/mixed-pair-{zoom}.png').convert('RGB')
    gaps=sum(1 for y in range(math.ceil(art.height/4)+2,math.floor(art.height*3/4)-2)
             if (lambda c:c[0]>220 and c[1]<80 and c[2]>180)(art.getpixel((edge,y))))
    assert gaps==0, ('visible background gap',zoom,gaps)
    report['sharedEdges'][zoom]={'rimPixels':width,'expectedRimPixels':expected,'AAAllowancePixels':2,'visibleGapPixels':gaps}
target=ROOT/'.local-data/tile-standard';target.mkdir(parents=True,exist_ok=True)
(target/'asset-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'validatedIllustrations':len(report['illustrations']),'validatedIcons':len(report['resources']),'warnings':report['warnings']}))
if report['warnings']:raise SystemExit('Source review required; see asset-validation.json')
