"""Separate existing artwork from baked rims; never write source PNGs.

Measured inner-rim contours are asset metadata, not rendering offsets. Foreground
flags/ribbons crossing a contour have explicit preservation masks. A shared
isotropic fitting algorithm fits each measured contour inside the same hex.
No inpainting, generated art, hand-tuned scaling, or source overwrite is used.
Run with Python + Pillow.
"""
from pathlib import Path
from collections import Counter
import hashlib
import json
import math
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parents[1]
SIZE = 1024
NAMES = ['castle', 'mine', 'ship', 'monastery-27', 'monastery-28']
# A changed original needs a fresh contour review; never silently crop new art.
REVIEWED_SOURCES = {'castle': '12fb2086e791b3cd83220fb146b9100d7e1462628802ca1c5a05b0c0cb298296', 'mine': '66903b15f33fa8b9fd58fa927d344d3bbe75dfe9bb05bb0fe484090d9047dc35', 'ship': 'ec7a2fc3e7bb2a9b78692d9959fb882e9afac3ea808a23d0e90294865e4bab3f', 'monastery-27': '91f5624fa44ea8b0855a087e6bbea4a92f3a9e0c1315ae25ba53c267a7b71dbb', 'monastery-28': 'ad1b723c7b7ad4359d2c082b9b58e5c2ffcf79dab8bc885a2de945b8066cfc37'}
CONTOURS = {
    'castle': [(384,61),(669,224),(669,534),(384,698),(87,534),(87,224)],
    'mine': [(398,59),(694,223),(694,532),(400,703),(103,532),(103,223)],
    'ship': [(401,64),(695,224),(695,540),(401,702),(118,540),(118,224)],
    'monastery-27': [(384,49),(706,230),(706,544),(384,718),(62,544),(62,230)],
    'monastery-28': [(384,49),(706,230),(706,544),(384,718),(62,544),(62,230)],
}


def polygon(points):
    m = Image.new('L', (768,768)); ImageDraw.Draw(m).polygon(points, fill=255)
    return m


def prepare(name):
    path = ROOT/f'public/tiles/{name}.png'
    assert hashlib.sha256(path.read_bytes()).hexdigest()==REVIEWED_SOURCES[name], 'Source changed: review artwork masks before extraction'
    source = Image.open(path).convert('RGBA')
    assert source.size == (768,768), 'Inspect changed source size before extracting'
    mask = polygon(CONTOURS[name]).filter(ImageFilter.MinFilter(15 if name.startswith('monastery') else 5))
    if name == 'castle':
        feature = Image.new('L', source.size)
        for y in range(45,145):
            for x in range(350,445):
                r,g,b,a = source.getpixel((x,y))
                if a and ((b>r*1.4 and b>g*.9) or (r>100 and g>60 and b<100 and r>g)):
                    feature.putpixel((x,y),255)
        mask = ImageChops.lighter(mask,feature.filter(ImageFilter.MaxFilter(3)))
    if name == 'ship':
        flag = polygon([(396,69),(416,76),(447,86),(474,88),(492,92),(515,101),
                        (530,104),(552,117),(559,128),(540,128),(526,124),(509,124),
                        (499,117),(475,119),(454,113),(438,108),(418,108),(400,111)])
        mask = ImageChops.lighter(mask,flag.filter(ImageFilter.MaxFilter(5)))
        bow = Image.new('L',source.size)
        for y in range(320,403):
            for x in range(650,716):
                r,g,b,a=source.getpixel((x,y))
                if a and ((r>g*1.1 and r>b*1.2) or .2126*r+.7152*g+.0722*b<60):
                    bow.putpixel((x,y),255)
        mask=ImageChops.lighter(mask,bow.filter(ImageFilter.MaxFilter(3)))
    if name.startswith('monastery'):
        feature = Image.new('L',source.size)
        for y in range(48,100):
            for x in range(365,405):
                r,g,b,a=source.getpixel((x,y))
                if a and max(r,g,b)<100:
                    feature.putpixel((x,y),255)
        for y in range(555,686):
            for x in range(205,595):
                r,g,b,a = source.getpixel((x,y))
                if a and (b>40 or .2126*r+.7152*g+.0722*b<90 or r>g*1.6):
                    feature.putpixel((x,y),255)
        mask = ImageChops.lighter(mask,feature.filter(ImageFilter.MaxFilter(3)))
    mask = ImageChops.darker(mask,source.getchannel('A'))
    # Source rim samples exclude illustration and checkerboard outside its hex.
    outer = polygon([(384,24),(716,216),(716,552),(384,744),(52,552),(52,216)]
                    if not name.startswith('monastery') else
                    [(384,8),(734,211),(734,560),(384,760),(34,560),(34,211)])
    mask = ImageChops.darker(mask,outer)
    rim = ImageChops.subtract(outer,mask)
    colors = Counter(source.getpixel((x,y))[:3] for y in range(768) for x in range(768)
                     if rim.getpixel((x,y)) == 255 and source.getpixel((x,y))[3] == 255)
    def same_family(c):
        r,g,b=c
        if name=='castle':return g>r*1.1 and g>b*1.1
        if name=='mine':return max(c)-min(c)<40
        if name=='ship':return b>r*1.4 and b>g*1.05
        return r>g*.95 and g>b*1.4
    common = [(c,n) for c,n in colors.most_common(1024) if same_family(c)][:256]
    # Select ACTUAL frequent source RGBs at luminance quantiles, not new hues.
    common.sort(key=lambda item: .2126*item[0][0]+.7152*item[0][1]+.0722*item[0][2])
    total = sum(count for color,count in common)
    def sample(q):
        cumulative=0
        for color,count in common:
            cumulative+=count
            if cumulative>=q*total:
                return '#'+''.join(f'{v:02x}' for v in color)
    palette={'dark':sample(.05),'base':sample(.5),'light':sample(.995)}
    # Sample the existing scene just INSIDE the removed rim. The SVG backdrop
    # uses these terrain colours, so transparent margin is not a second rim.
    interior_edge=ImageChops.subtract(mask,mask.filter(ImageFilter.MinFilter(15)))
    surface=[]
    top=CONTOURS[name][0];bottom=CONTOURS[name][3]
    for px,py in [(top[0],top[1]+20),(CONTOURS[name][5][0]+20,384),(bottom[0],bottom[1]-20)]:
        samples=[source.getpixel((x,y))[:3] for y in range(py-7,py+8) for x in range(px-7,px+8)
                 if source.getpixel((x,y))[3]==255 and (same_family(source.getpixel((x,y))[:3]) if name!='mine' else True)]
        if not samples:
            surface.append(palette['base']);continue
        samples.sort(key=lambda c:.2126*c[0]+.7152*c[1]+.0722*c[2])
        surface.append('#'+''.join(f'{v:02x}' for v in samples[len(samples)//2]))
    # Feather only INSIDE the retained contour. Never bring old rim pixels back.
    mask=ImageChops.darker(mask,mask.filter(ImageFilter.GaussianBlur(.7)))
    source.putalpha(mask)
    return path,source,palette,surface


if __name__ == '__main__':
    prepared={name:prepare(name) for name in NAMES}
    normals=[(math.cos(math.radians(60*i)),math.sin(math.radians(60*i))) for i in range(6)]
    supports={}
    centers={name:(sum(x for x,y in CONTOURS[name])/6,sum(y for x,y in CONTOURS[name])/6) for name in NAMES}
    for name,(path,image,palette,surface) in prepared.items():
        support=0
        cx,cy=centers[name]
        for y in range(768):
            for x in range(768):
                if image.getpixel((x,y))[3]:
                    support=max(support,max(nx*(x+.5-cx)+ny*(y+.5-cy) for nx,ny in normals))
        supports[name]=support
    # Frame inner edge is 2.2/100 of tile width. The same fit formula puts every
    # retained pixel into that inner hex, with a 3px interpolation allowance.
    apothem=math.sqrt(3)*SIZE/4
    target=ROOT/'public/tiles/illustrations';target.mkdir(exist_ok=True)
    assets={}
    for name,(path,image,palette,surface) in prepared.items():
        scale=(apothem*(1-2*2.2/100)-3)/supports[name]
        output=target/f'{name}.png'
        cx,cy=centers[name]
        image=image.transform((SIZE,SIZE),Image.Transform.AFFINE,
                              (1/scale,0,cx-SIZE/2/scale,0,1/scale,cy-SIZE/2/scale),
                              Image.Resampling.BICUBIC)
        image.save(output)
        assets[name]={'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                      'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
                      'palette':palette,'surface':surface,'innerContour':CONTOURS[name],'isotropicFitScale':scale,'measuredContourCenter':[cx,cy]}
    (target/'manifest.json').write_text(json.dumps({'canvas':SIZE,
        'frameInset':2.2,'mapping':'same-measured-isotropic-fit-algorithm','assets':assets},indent=2)+'\n',encoding='utf-8')
    print('Extracted five illustrations with common isotropic fit algorithm; originals untouched.')
