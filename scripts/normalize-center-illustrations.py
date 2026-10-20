"""Trim alpha padding, preserve ratio, fit all central art with one padding rule."""
from pathlib import Path
import hashlib
import json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
standard=json.loads((ROOT/'src/app/tile-standard.json').read_text())
size=standard['rasterCanvas']; assets={}
for name in ['crane','goose']:
    source=ROOT/f'public/tiles/{name}.png'; image=Image.open(source).convert('RGBA')
    bounds=image.getchannel('A').getbbox(); image=image.crop(bounds)
    scale=(size-64)/max(image.size)
    image=image.resize((round(image.width*scale),round(image.height*scale)),Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',(size,size)); canvas.paste(image,((size-image.width)//2,(size-image.height)//2))
    output=ROOT/f'public/tiles/illustrations/{name}.png';canvas.save(output)
    assets[name]={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'sourceAlphaBounds':bounds,'alphaBounds':canvas.getchannel('A').getbbox()}
(ROOT/'public/tiles/illustrations/center-manifest.json').write_text(json.dumps({'canvas':size,'mapping':'alpha-trim-center-isotropic','assets':assets},indent=2)+'\n')
print('2 central illustrations normalized; originals untouched.')
