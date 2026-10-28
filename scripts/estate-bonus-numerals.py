"""Extract the approved ivory five as the shared, pixel-textured numeral reference."""
from pathlib import Path
from collections import deque
import numpy as np
from PIL import Image, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'asset-inbox/estate-bonus-approved/numerals'
OUT.mkdir(parents=True,exist_ok=True)
raw=Image.open(ROOT/'asset-inbox/estate-bonus-approved/originals/광산 보너스.png').convert('RGBA')
source=Image.new('RGBA',(1024,1024))
source.paste(raw.crop((70,147,1183,1066)).resize((960,793),Image.Resampling.LANCZOS),(32,115))
box=(375,375,620,710)
crop=source.crop(box); rgb=np.asarray(crop).astype(int)
candidate=(rgb[:,:,0]>225)&(rgb[:,:,1]>205)&(rgb[:,:,2]>155)&(rgb[:,:,0]-rgb[:,:,2]>16)&(rgb[:,:,0]-rgb[:,:,1]<55)
h,w=candidate.shape
visited=np.zeros((h,w),bool); components=[]
for y in range(h):
    for x in range(w):
        if not candidate[y,x] or visited[y,x]: continue
        queue=deque([(x,y)]); visited[y,x]=True; component=[]
        while queue:
            px,py=queue.popleft(); component.append((px,py))
            for nx,ny in ((px-1,py),(px+1,py),(px,py-1),(px,py+1)):
                if 0<=nx<w and 0<=ny<h and candidate[ny,nx] and not visited[ny,nx]:
                    visited[ny,nx]=True; queue.append((nx,ny))
        components.append(component)
mask=Image.new('L',(w,h))
for x,y in max(components,key=len): mask.putpixel((x,y),255)
# Close only the tiny cracks in the silhouette; their RGB texture is untouched.
mask=mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
from PIL import ImageDraw
filled=mask.copy(); ImageDraw.floodfill(filled,(0,0),128)
filled=filled.point(lambda p:0 if p==128 else 255)
crop.putalpha(filled)
bounds=filled.getbbox(); assert bounds and 180<bounds[2]-bounds[0]<245
crop=crop.crop(bounds)
canvas=Image.new('RGBA',(512,512))
canvas.alpha_composite(crop,((512-crop.width)//2,(512-crop.height)//2))
canvas.save(OUT/'5-body.png')
print('Common approved five body:',bounds,'RGB preserved; 512x512 reference')
