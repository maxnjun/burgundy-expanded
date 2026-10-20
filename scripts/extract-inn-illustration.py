"""Reviewed inner contour removes only the original inn's outer gold frame.
Original multi-colour internal separators and every scene remain part of the art.
All runtime sizing is the same square canvas and inner-hex fit as other tiles.
"""
from pathlib import Path
import hashlib
import json
import math
from collections import Counter
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT=Path(__file__).resolve().parents[1]
standard=json.loads((ROOT/'src/app/tile-standard.json').read_text())
path=ROOT/'public/tiles/inn.png'
image=Image.open(path).convert('RGBA')
assert image.size==(1312,1199), 'Changed source requires a new contour review'
manifest=ROOT/'public/tiles/illustrations/manifest.json';data=json.loads(manifest.read_text())
reviewed=data['assets'].get('inn',{}).get('sourceSha256')
assert not reviewed or reviewed==hashlib.sha256(path.read_bytes()).hexdigest(), 'Changed source requires a new contour review'
contour=[(652,68),(1147,349),(1147,873),(652,1152),(158,873),(158,349)]
mask=Image.new('L',image.size);ImageDraw.Draw(mask).polygon(contour,fill=255)
mask=ImageChops.darker(mask,mask.filter(ImageFilter.GaussianBlur(.7)))
image.putalpha(ImageChops.darker(mask,image.getchannel('A')))
cx=sum(x for x,y in contour)/6;cy=sum(y for x,y in contour)/6
normals=[(math.cos(math.radians(60*i)),math.sin(math.radians(60*i))) for i in range(6)]
support=max(max(nx*(x+.5-cx)+ny*(y+.5-cy) for nx,ny in normals)
            for y in range(image.height) for x in range(image.width) if image.getpixel((x,y))[3])
size=standard['rasterCanvas']; inset=standard['frameInset']
scale=(math.sqrt(3)*size/4*(1-2*inset/100)-3)/support
output=ROOT/'public/tiles/illustrations/inn.png'
image=image.transform((size,size),Image.Transform.AFFINE,(1/scale,0,cx-size/2/scale,0,1/scale,cy-size/2/scale),Image.Resampling.BICUBIC)
image.save(output)
# Actual source border RGB samples, shared three-band SVG proportions.
original=Image.open(path).convert('RGBA')
colors=Counter(original.getpixel((x,y))[:3] for y in range(original.height) for x in range(original.width)
               if original.getpixel((x,y))[3]>128 and mask.getpixel((x,y))==0
               and (lambda c:c[0]>c[1]*.95 and c[1]>c[2]*1.4)(original.getpixel((x,y))))
frequent=sorted(colors.most_common(256),key=lambda item:.2126*item[0][0]+.7152*item[0][1]+.0722*item[0][2])
def sample(q):
    count=0;total=sum(n for c,n in frequent)
    for color,n in frequent:
        count+=n
        if count>=q*total:return '#'+''.join(f'{v:02x}' for v in color)
palette={key:sample(q) for key,q in [('dark',.05),('base',.5),('light',.995)]}
data['assets']['inn']={'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
 'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'palette':palette,
 'surface':[palette['base']]*3,'innerContour':contour,'isotropicFitScale':scale,'measuredContourCenter':[cx,cy]}
manifest.write_text(json.dumps(data,indent=2)+'\n')
print('Inn artwork isolated; original preserved; common square/inner-hex fit.')
