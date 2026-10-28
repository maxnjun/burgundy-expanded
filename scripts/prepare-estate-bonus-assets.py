"""Preserve approved originals; register one silhouette and source-pixel frame for bonus art."""
from collections import deque
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
INBOX = ROOT / 'asset-inbox/estate-bonus-approved'
OUT = ROOT / 'public/assets/tokens/estate'
QA = ROOT / '.local-data/estate-bonus-assets'
NAMES = {'mine': '광산 보너스.png', 'livestock': '동물 보너스.png',
         'ship': '선박 보너스.png', 'castle': '성 보너스.png',
         'building': '베이지, 수도원 보너스.png', 'monastery': '베이지, 수도원 보너스.png'}
parser = argparse.ArgumentParser()
parser.add_argument('--import-from', type=Path)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
if args.import_from:
    (INBOX / 'originals').mkdir(parents=True, exist_ok=True)
    records = []
    for filename in dict.fromkeys(NAMES.values()):
        source, target = args.import_from / filename, INBOX / 'originals' / filename
        if target.exists():
            assert sha(source) == sha(target), 'Never overwrite a different original'
        else:
            target.write_bytes(source.read_bytes())
        records.append({'file': filename, 'sha256': sha(target)})
    metadata=json.loads((INBOX/'manifest.json').read_text(encoding='utf8')) if (INBOX/'manifest.json').exists() else {}
    (INBOX / 'manifest.json').write_text(json.dumps({**metadata,'originals': records,
        'mapping': NAMES, 'canonicalFrame': 'mine', 'canvas': 1024,
        'artWidth': 960}, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
review = json.loads((INBOX / 'manifest.json').read_text(encoding='utf8'))
for record in review['originals']:
    assert sha(INBOX / 'originals' / record['file']) == record['sha256'], 'Changed source: review masks first'
for record in review['derivationInputs']:
    assert sha(INBOX / record['file']) == record['sha256'], 'Changed edit input: review before importing'

def original(color):
    return Image.open(INBOX / 'originals' / NAMES[color]).convert('RGBA')

def silhouette(image):
    rgb = image.convert('RGB'); w, h = rgb.size; pixels = rgb.load()
    outside = bytearray(w*h); queue = deque()
    def visit(x, y):
        i = y*w+x
        if not outside[i] and max(pixels[x, y]) < 24:
            outside[i] = 1; queue.append((x, y))
    for x in range(w): visit(x, 0); visit(x, h-1)
    for y in range(h): visit(0, y); visit(w-1, y)
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if 0 <= nx < w and 0 <= ny < h: visit(nx, ny)
    return Image.frombytes('L', (w,h), bytes(0 if p else 255 for p in outside))

canonical = original('mine')
alpha = silhouette(canonical)
bounds = alpha.getbbox()
assert bounds and 50 < bounds[0] < 100 and 120 < bounds[1] < 170, bounds
# The gold inner edge stays in the source frame, not in the replacement scene.
aperture = Image.new('L', canonical.size)
ImageDraw.Draw(aperture).polygon([(561,320),(696,320),(766,403),(927,403),
    (927,451),(1005,512),(1005,685),(928,740),(928,808),(768,808),
    (697,889),(561,889),(491,808),(328,808),(328,739),(248,684),
    (248,515),(328,453),(328,403),(490,403)], fill=255)
OUT.mkdir(parents=True, exist_ok=True); QA.mkdir(parents=True, exist_ok=True)
assets = []
images = {}
for color in NAMES:
    source = original(color)
    art = source.copy()
    if color in ('building', 'monastery'):
        # One uniform scale for the original scene; the reference frame supplies geometry.
        half = source.crop((0 if color == 'building' else 887, 0,
                            887 if color == 'building' else 1774, 887))
        scene = half.resize((1180,1180), Image.Resampling.LANCZOS)
        art = canonical.copy()
        positioned = Image.new('RGBA', canonical.size)
        positioned.paste(scene, (9,16))
        art.paste(positioned, (0,0), aperture)
    art.putalpha(alpha)
    crop = art.crop(bounds)
    target = (960, round(crop.height*960/crop.width))
    result = Image.new('RGBA', (1024,1024))
    result.paste(crop.resize(target, Image.Resampling.LANCZOS),
                 ((1024-target[0])//2,(1024-target[1])//2))
    images[color] = result

mask = images['mine'].getchannel('A')
for color, image in images.items():
    assert ImageChops.difference(mask, image.getchannel('A')).getbbox() is None, color
    assert image.getpixel((0,0))[3] == 0

plate=Image.open(INBOX/'number-removal-plate.png').convert('RGBA').resize((1536,1024),Image.Resampling.LANCZOS)
# A bounded central edit preserves every frame pixel and all scene pixels outside it.
patch_box=(355,370,645,724)
patch=Image.new('L',(1024,1024))
ImageDraw.Draw(patch).rectangle(patch_box,fill=255)
patch=patch.filter(ImageFilter.GaussianBlur(5))
backgrounds={}
for i,(color,source) in enumerate(images.items()):
    clean=plate.crop(((i%3)*512,(i//3)*512,(i%3+1)*512,(i//3+1)*512)).resize((1024,1024),Image.Resampling.LANCZOS)
    backgrounds[color]=Image.composite(clean,source,patch)
    backgrounds[color].putalpha(mask)
    changed=ImageChops.difference(backgrounds[color].convert('RGB'),source.convert('RGB')).getbbox()
    assert changed and changed[0]>=330 and changed[1]>=345 and changed[2]<=671 and changed[3]<=750, changed

# Pixel-area center of the gold frame's aperture, transformed with the shared uniform scale.
pixels=aperture.load();sx=sy=count=0
for y in range(aperture.height):
    for x in range(aperture.width):
        if pixels[x,y]: sx+=x;sy+=y;count+=1
scale=960/(bounds[2]-bounds[0])
center=(round((sx/count-bounds[0])*scale+32),round((sy/count-bounds[1])*scale+(1024-round((bounds[3]-bounds[1])*scale))//2))
numerals={};measurements={}
def clean_digit(digit):
    """Keep the one connected glyph, excluding stray transparent-cutout specks."""
    alpha=digit.getchannel('A'); binary=alpha.point(lambda a:255 if a>=64 else 0)
    w,h=binary.size;data=binary.load();seen=bytearray(w*h);largest=[]
    for y in range(h):
        for x in range(w):
            if not data[x,y] or seen[y*w+x]: continue
            queue=deque([(x,y)]);seen[y*w+x]=1;points=[]
            while queue:
                px,py=queue.popleft();points.append((px,py))
                for nx,ny in ((px-1,py),(px+1,py),(px,py-1),(px,py+1)):
                    if 0<=nx<w and 0<=ny<h and data[nx,ny] and not seen[ny*w+nx]:
                        seen[ny*w+nx]=1;queue.append((nx,ny))
            if len(points)>len(largest): largest=points
    connected=Image.new('L',digit.size)
    for point in largest: connected.putpixel(point,255)
    digit.putalpha(ImageChops.darker(alpha,connected.filter(ImageFilter.MaxFilter(3))))
    return digit
for number in [2,3,4,5,6,7]:
    file=INBOX/'numerals'/f'{number}-generated.png'
    digit=clean_digit(Image.open(file).convert('RGBA'))
    body=digit.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()
    assert body
    digit=digit.crop(body)
    digit=digit.resize((round(digit.width*300/digit.height),300),Image.Resampling.LANCZOS)
    layer=Image.new('RGBA',(1024,1024))
    position=(round(center[0]-digit.width/2),round(center[1]-digit.height/2))
    # Pad before dilating so neither the outline nor shadow is cut at the numeral box.
    body_layer=Image.new('RGBA',(1024,1024));body_layer.alpha_composite(digit,position)
    full_alpha=body_layer.getchannel('A')
    shadow=Image.new('RGBA',(1024,1024),'#130e08');shadow.putalpha(ImageChops.offset(full_alpha,5,7).filter(ImageFilter.GaussianBlur(5)).point(lambda a:round(a*.85)))
    stroke=Image.new('RGBA',(1024,1024),'#33291c');stroke.putalpha(full_alpha.filter(ImageFilter.MaxFilter(9)))
    layer.alpha_composite(shadow);layer.alpha_composite(stroke);layer.alpha_composite(body_layer)
    numerals[number]=layer
    numeral_path=OUT/'numerals'/f'{number}.png'
    if args.check:
        assert Image.open(numeral_path).convert('RGBA').tobytes()==layer.tobytes(),numeral_path
    else:
        numeral_path.parent.mkdir(parents=True,exist_ok=True);layer.save(numeral_path,optimize=True)
    bbox=full_alpha.point(lambda a:255 if a>=128 else 0).getbbox()
    measurements[number]={'bodyBounds':bbox,'bodyCenter':[(bbox[0]+bbox[2])/2,(bbox[1]+bbox[3])/2],
                          'bodySize':[bbox[2]-bbox[0],bbox[3]-bbox[1]],'layerSha256':hashlib.sha256(layer.tobytes()).hexdigest()}
    assert abs(measurements[number]['bodyCenter'][0]-center[0])<=.5
    assert abs(measurements[number]['bodyCenter'][1]-center[1])<=.5

outputs={}
for color,background in backgrounds.items():
    for number,layer in numerals.items():
        image=Image.alpha_composite(background,layer);image.putalpha(mask)
        path=OUT/f'{color}-{number}.png'
        if args.check:
            assert path.exists() and Image.open(path).convert('RGBA').tobytes()==image.tobytes(),path
        else: image.save(path,optimize=True)
        assert ImageChops.difference(mask,image.getchannel('A')).getbbox() is None
        outputs[color,number]=image
        assets.append({'color':color,'points':number,'file':path.name,'sha256':sha(path)})
for number,layer in numerals.items():
    opaque=layer.getchannel('A').point(lambda a:255 if a==255 else 0)
    for color in backgrounds:
        difference=ImageChops.difference(outputs[color,number].convert('RGB'),layer.convert('RGB')).convert('L')
        assert ImageChops.multiply(difference,opaque).getbbox() is None, (color,number,'changed numeral pixels')
if not args.check:
    sheet = Image.new('RGB', (1536,1024), '#f6edd4')
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 20)
    for i,color in enumerate(images):
        image=outputs[color,5]
        thumb=image.resize((512,512), Image.Resampling.LANCZOS)
        sheet.paste(thumb, ((i%3)*512,(i//3)*512), thumb)
        ImageDraw.Draw(sheet).text(((i%3)*512+12,(i//3)*512+12), color, font=font, fill='#49381d')
    sheet.save(QA / 'five-point-comparison.png')
    overlay=Image.new('RGBA', (1024,1024), '#f6edd4')
    edge=ImageChops.subtract(mask,mask.filter(ImageFilter.MinFilter(3)))
    for color in ['#df3b3b','#35a768','#3676dc','#b851c4','#ce9221','#212121']:
        layer=Image.new('RGBA',mask.size,color); layer.putalpha(edge); overlay.alpha_composite(layer)
    overlay.save(QA / 'silhouette-overlay.png')
    crops=Image.new('RGB',(1800,400),'#f6edd4')
    for i,color in enumerate(images):
        digit_crop=outputs[color,5].crop((350,330,674,730)).resize((300,370))
        crops.paste(digit_crop,(i*300,30),digit_crop)
        ImageDraw.Draw(crops).text((i*300+10,5),color,font=font,fill='#49381d')
    crops.save(QA/'number-crops.png')
    numeral_edge=ImageChops.subtract(numerals[5].getchannel('A'),numerals[5].getchannel('A').filter(ImageFilter.MinFilter(3)))
    proof=Image.new('RGBA',(1024,1024),'#f6edd4')
    for color in ['#df3b3b','#35a768','#3676dc','#b851c4','#ce9221','#212121']:
        edge_layer=Image.new('RGBA',mask.size,color);edge_layer.putalpha(numeral_edge);proof.alpha_composite(edge_layer)
    ImageDraw.Draw(proof).line((center[0]-180,center[1],center[0]+180,center[1]),fill='#c7b98c')
    ImageDraw.Draw(proof).line((center[0],center[1]-190,center[0],center[1]+190),fill='#c7b98c')
    proof.save(QA/'number-outline-overlay.png')
    variants=Image.new('RGB',(1536,1536),'#f6edd4')
    for row,color in enumerate(images):
        for col,n in enumerate(numerals):
            thumb=outputs[color,n].resize((256,256),Image.Resampling.LANCZOS)
            variants.paste(thumb,(col*256,row*256),thumb)
    variants.save(QA/'all-36-variants.png')
    (QA/'alignment.json').write_text(json.dumps({'apertureCenter':center,'numerals':measurements,
        'commonAlphaSha256':hashlib.sha256(mask.tobytes()).hexdigest(),'silhouetteDifferences':0,
        'numeralLayerDifferencesAcrossColors':0,'secondDisplayScale':.75},indent=2)+'\n')
    (OUT / 'manifest.json').write_text(json.dumps({'canvas':[1024,1024],
        'source': 'asset-inbox/estate-bonus-approved/manifest.json',
        'silhouette': 'mine alpha; identical for every color and points variant',
        'numberCenter':center,'alphaBounds':mask.getbbox(),'secondDisplayScale':.75,
        'assets':assets}, ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(f'Validated {len(outputs)} images; identical alpha, 1024x1024, exterior transparent. Numeral center {center}, per-color numeral differences 0; canonical bounds {bounds}')
