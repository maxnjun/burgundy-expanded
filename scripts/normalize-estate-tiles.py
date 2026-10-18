"""Register the final shared 768px hex artwork to the board without cropping.
Run with Python + Pillow. Originals are read-only. Six triangles map the measured
source vertices to a regular pointy hex; one common transform preserves the rims.
"""
from pathlib import Path
import hashlib
import json
import math
from PIL import Image, ImageDraw, ImageChops

ROOT = Path(__file__).resolve().parents[1]
SIZE = 1024
SOURCE_SIZE = 768
SOURCE_CENTER = (384, 384)
# Shared final alpha-mask vertices, measured from all three originals.
SOURCE_VERTICES = [(384, 24), (716, 216), (716, 552), (384, 744), (52, 552), (52, 216)]
TARGET_VERTICES = [(SIZE/2+SIZE/2*math.cos(math.radians(-90+60*i)),
                    SIZE/2+SIZE/2*math.sin(math.radians(-90+60*i))) for i in range(6)]


def affine(destination, source):
    (x0,y0),(x1,y1),(x2,y2) = destination
    determinant = (x1-x0)*(y2-y0)-(x2-x0)*(y1-y0)
    def coefficients(values):
        a = ((values[1]-values[0])*(y2-y0)-(values[2]-values[0])*(y1-y0))/determinant
        b = ((x1-x0)*(values[2]-values[0])-(x2-x0)*(values[1]-values[0]))/determinant
        return a,b,values[0]-a*x0-b*y0
    return (*coefficients([p[0] for p in source]), *coefficients([p[1] for p in source]))


def mask():
    result = Image.new("L", (SIZE*4,SIZE*4))
    ImageDraw.Draw(result).polygon([(x*4,y*4) for x,y in TARGET_VERTICES],fill=255)
    result = result.resize((SIZE,SIZE),Image.Resampling.LANCZOS)
    pixels=result.load()
    for y in range(SIZE):
        for x in range(SIZE):
            dx,dy=abs(x+.5-SIZE/2),abs(y+.5-SIZE/2)
            if dx>math.sqrt(3)*SIZE/4 or dy+dx/math.sqrt(3)>SIZE/2:
                pixels[x,y]=0
    return result


def normalize(name, common_alpha):
    source=ROOT/f"public/tiles/{name}.png"
    image=Image.open(source).convert("RGBA")
    assert image.size==(SOURCE_SIZE,SOURCE_SIZE), "Unexpected final source size"
    assert image.getchannel("A").getbbox()==(52,24,717,745), "Source vertices changed; inspect artwork first"
    assert image.getchannel("A").tobytes()==common_alpha, "Source masks differ; inspect new artwork first"
    # Extend RGB just outside the alpha edge for interpolation only. This adds
    # no visible area: the final exact board mask still clears everything outside.
    rgb=image.convert("RGB")
    alpha=image.getchannel("A")
    for _ in range(2):
        for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            moved=Image.new("RGB",image.size);moved.paste(rgb,(dx,dy))
            moved_alpha=Image.new("L",image.size);moved_alpha.paste(alpha,(dx,dy))
            fill=Image.eval(alpha,lambda a:255-a)
            fill=ImageChops.multiply(fill,moved_alpha)
            rgb.paste(moved,(0,0),fill)
            alpha=ImageChops.lighter(alpha,moved_alpha)
    result=Image.new("RGB",(SIZE,SIZE))
    for i in range(6):
        destination=[(SIZE/2,SIZE/2),TARGET_VERTICES[i],TARGET_VERTICES[(i+1)%6]]
        original=[SOURCE_CENTER,SOURCE_VERTICES[i],SOURCE_VERTICES[(i+1)%6]]
        part=rgb.transform((SIZE,SIZE),Image.Transform.AFFINE,affine(destination,original),Image.Resampling.BICUBIC)
        triangle=Image.new("L",(SIZE,SIZE));ImageDraw.Draw(triangle).polygon(destination,fill=255)
        result.paste(part,(0,0),triangle)
    result.putalpha(mask())
    output=ROOT/f"public/tiles/estate/{name}.png";result.save(output)
    return {"sourceSha256":hashlib.sha256(source.read_bytes()).hexdigest(),
            "sourceSize":[SOURCE_SIZE,SOURCE_SIZE],"outputSha256":hashlib.sha256(output.read_bytes()).hexdigest()}


if __name__=="__main__":
    target=ROOT/"public/tiles/estate";target.mkdir(exist_ok=True)
    common=Image.open(ROOT/"public/tiles/castle.png").convert("RGBA").getchannel("A").tobytes()
    assets={name:normalize(name,common) for name in ("castle","mine","ship")}
    (target/"manifest.json").write_text(json.dumps({"canvas":SIZE,"radius":SIZE/2,
        "mapping":"shared-six-vertex-registration","borderInsetRatio":0,
        "sourceVertices":SOURCE_VERTICES,"assets":assets},indent=2)+"\n",encoding="utf-8")
    print("Registered 3 final estate assets, rims retained; originals preserved.")
