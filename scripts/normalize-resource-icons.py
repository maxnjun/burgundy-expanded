"""Reproducible cutouts from approved source RGB; never redraw or edit the source."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
folder = ROOT / 'public/assets/icons'
source = folder / 'source/resource-icons-approved.png'
image = Image.open(source).convert('RGB')
assets = {}
for name, box in {'silver-coin': (90,35,930,845), 'worker': (930,35,1630,845)}.items():
    crop = image.crop(box)
    barrier = Image.new('L', crop.size)
    barrier.putdata([255 if max(pixel)<65 else 0 for pixel in crop.get_flattened_data()])
    ImageDraw.floodfill(barrier, (0,0), 128)
    alpha = barrier.point(lambda value: 0 if value==128 else 255)
    cutout = crop.convert('RGBA'); cutout.putalpha(alpha)
    bounds=alpha.getbbox()
    cutout = cutout.crop(bounds)
    # One square occupancy rule, preserving aspect ratio and source RGB exactly.
    # No resampling: retain native pixels; the browser scales the square uniformly.
    side = max(cutout.size)+32
    result = Image.new('RGBA', (side,side))
    result.paste(cutout, ((side-cutout.width)//2,(side-cutout.height)//2))
    result.putdata([p if p[3] else (0,0,0,0) for p in result.get_flattened_data()])
    output = folder/f'{name}.png'; result.save(output)
    assets[name] = {'canvas': list(result.size), 'alphaBounds': list(result.getchannel('A').getbbox()),
                    'sourceBounds':[box[0]+bounds[0],box[1]+bounds[1],box[0]+bounds[2],box[1]+bounds[3]],
                    'sha256': hashlib.sha256(output.read_bytes()).hexdigest()}
(folder/'manifest.json').write_text(json.dumps({'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'padding':16, 'mapping':'alpha-trim-square-native-rgb', 'assets':assets},indent=2)+'\n')
print('2 square RGBA cutouts; native RGB preserved; original untouched.')
