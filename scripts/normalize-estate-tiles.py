"""Presentation-only estate assets. Run with Python + Pillow; originals are never written.

Fit the six body edges from opaque alpha runs (not flags or bounding-box margins).
Uniformly cover a regular pointy hex, excluding the baked-in border by 1% of
body height. All three images use exactly this algorithm, canvas and mask.
"""
from pathlib import Path
from collections import Counter
from statistics import median
import hashlib
import json
import math
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SIZE = 1024


def line(points):
    slope = median((x2-x1)/(y2-y1) for i, (y1, x1) in enumerate(points)
                   for y2, x2 in points[i+1:] if y2 != y1)
    return slope, median(x-slope*y for y, x in points)


def intersection(a, b):
    y = (b[1]-a[1])/(a[0]-b[0])
    return a[0]*y+a[1], y


def normalize(name):
    source = ROOT / f"public/tiles/{name}.png"
    image = Image.open(source).convert("RGBA")
    w, h = image.size
    alpha = image.getchannel("A")
    rows = []
    for y in range(h):
        opaque = [x for x in range(w) if alpha.getpixel((x, y)) >= 250]
        if opaque:
            rows.append((y, min(opaque), max(opaque)))
    # The ship flag protrudes in the upper right. Sample the actual diagonal
    # below it; all sampling bands are identical fractions for every source.
    left = Counter(a for y, a, b in rows if .4*h < y < .7*h).most_common(1)[0][0]
    right = Counter(b for y, a, b in rows if .4*h < y < .7*h).most_common(1)[0][0]
    ul = line([(y, a) for y, a, b in rows if .14*h < y < .29*h])
    ur = line([(y, b) for y, a, b in rows if .27*h < y < .30*h])
    ll = line([(y, a) for y, a, b in rows if .76*h < y < .9*h])
    lr = line([(y, b) for y, a, b in rows if .76*h < y < .9*h])
    top, bottom = intersection(ul, ur), intersection(ll, lr)
    body = [top, (right, (right-ur[1])/ur[0]),
            (right, (right-lr[1])/lr[0]), bottom,
            (left, (left-ll[1])/ll[0]), (left, (left-ul[1])/ul[0])]
    cx, cy = (left+right)/2, (top[1]+bottom[1])/2
    inset = (bottom[1]-top[1])*.01
    vertices = [(SIZE/2*math.cos(math.radians(-90+60*i)),
                 SIZE/2*math.sin(math.radians(-90+60*i))) for i in range(6)]
    scale = 0
    for i, a in enumerate(body):
        b = body[(i+1) % 6]
        nx, ny = b[1]-a[1], a[0]-b[0]
        length = math.hypot(nx, ny)
        nx, ny = nx/length, ny/length
        distance = nx*(a[0]-cx)+ny*(a[1]-cy)-inset
        assert distance > 0, "Invalid measured hex body"
        scale = max(scale, max(nx*x+ny*y for x, y in vertices)/distance)
    # One isotropic scale: no independent x/y stretch or image-specific CSS.
    result = image.transform((SIZE, SIZE), Image.Transform.AFFINE,
                             (1/scale, 0, cx-SIZE/2/scale,
                              0, 1/scale, cy-SIZE/2/scale), Image.Resampling.BICUBIC)
    mask = Image.new("L", (SIZE*4, SIZE*4))
    ImageDraw.Draw(mask).polygon([((x+SIZE/2)*4, (y+SIZE/2)*4) for x, y in vertices], fill=255)
    mask = mask.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    # LANCZOS has a small ringing fringe; strictly clear every outside pixel.
    pixels = mask.load()
    for y in range(SIZE):
        for x in range(SIZE):
            dx, dy = abs(x+.5-SIZE/2), abs(y+.5-SIZE/2)
            if dx > math.sqrt(3)*SIZE/4 or dy+dx/math.sqrt(3) > SIZE/2:
                pixels[x, y] = 0
    # Source ship artwork is alpha 250..253 even in the solid body. Validate
    # coverage first, then give every asset the identical opaque body/mask.
    assert all(m < 250 or a >= 240 for m, a in
               zip(mask.get_flattened_data(), result.getchannel("A").get_flattened_data())), "Transparent hole inside measured body"
    result.putalpha(mask)
    output = ROOT / f"public/tiles/estate/{name}.png"
    result.save(output)
    return {"sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "sourceSize": [w, h], "bodyVertices": [[round(x, 3), round(y, 3)] for x, y in body],
            "uniformScale": round(scale, 8), "outputSha256": hashlib.sha256(output.read_bytes()).hexdigest()}


if __name__ == "__main__":
    target = ROOT / "public/tiles/estate"
    target.mkdir(exist_ok=True)
    assets = {name: normalize(name) for name in ("castle", "mine", "ship")}
    (target / "manifest.json").write_text(json.dumps({"canvas": SIZE, "radius": SIZE/2,
        "borderInsetRatio": .01, "assets": assets}, indent=2)+"\n", encoding="utf-8")
    print("Normalized 3 estate assets; original files preserved.")
