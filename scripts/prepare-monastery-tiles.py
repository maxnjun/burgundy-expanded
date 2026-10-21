"""Import approved monastery 1-29 without repainting, stretching or runtime offsets.

Requires Pillow. Original ZIP/PNG bytes are immutable. --check writes nothing.
Uses the existing full-face registration/alpha geometry from approved beige tiles.
"""
from pathlib import Path
from io import BytesIO
import argparse
import hashlib
import importlib.util
import json
import math
import re
import sys
import zipfile
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "asset-inbox/monastery-approved"
OUTPUT = ROOT / "public/assets/tiles/monastery/final"
ARCHIVE = ROOT / "수도원 타일.zip"
ZIP_SHA = "81ad011a09699ef0012fdb697a6f0c7d9e3772e2231cedece6c86a72aba1705e"
spec = importlib.util.spec_from_file_location("beige_geometry", ROOT / "scripts/prepare-beige-tiles.py")
geometry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geometry)
SIZE = geometry.SIZE


def digest(data):
    return hashlib.sha256(data).hexdigest()


def originals(check):
    manifest_path = INPUT / "manifest.json"
    if ARCHIVE.exists():
        assert digest(ARCHIVE.read_bytes()) == ZIP_SHA, "Changed ZIP: inspect new originals before importing"
        assets = []
        with zipfile.ZipFile(ARCHIVE) as archive:
            entries = [n for n in archive.namelist() if not n.endswith("/")]
            assert len(entries) == 29, "Unexpected archive files"
            numbers = set()
            for entry in entries:
                match = re.fullmatch(r"수도원 타일/([1-9]|1[0-9]|2[0-9])번\.png", entry)
                assert match, f"Ambiguous number: {entry}"
                number = int(match[1])
                assert number not in numbers, f"Duplicate monastery {number}"
                numbers.add(number)
                data = archive.read(entry)
                source = f"asset-inbox/monastery-approved/originals/monastery-{number:02}.png"
                path = ROOT / source
                if path.exists():
                    assert path.read_bytes() == data, f"Never overwrite changed original: {source}"
                elif check:
                    raise AssertionError(f"Missing preserved original: {source}")
                else:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(data)
                image = Image.open(BytesIO(data))
                assets.append({"number": number, "zipEntry": entry, "source": source,
                               "sourceSha256": digest(data), "sourceSize": list(image.size)})
            assert numbers == set(range(1, 30))
        manifest = {"zipSha256": ZIP_SHA, "count": 29, "assets": sorted(assets, key=lambda a: a["number"])}
        if manifest_path.exists():
            assert json.loads(manifest_path.read_text(encoding="utf-8")) == manifest, "Changed source mapping"
        elif check:
            raise AssertionError("Missing source manifest")
        else:
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    else:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        assert manifest["zipSha256"] == ZIP_SHA and manifest["count"] == 29
    assert [a["number"] for a in manifest["assets"]] == list(range(1, 30))
    return manifest


def measure(source):
    r, g, b, _ = source.split()
    silhouette = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v > 45 else 0)
    bounds = silhouette.getbbox()
    top, bottom = bounds[1], bounds[3]-1
    height = bottom-top
    rows = [(y, *silhouette.crop((0, y, source.width, y+1)).getbbox()[::2]) for y in range(top, bottom+1)]
    lines = [geometry.line_fit([(y, row[side]) for row in rows
             if top+height*start <= (y := row[0]) <= top+height*end])
             for side in (1, 2) for start, end in ((.08, .20), (.36, .64), (.80, .92))]
    lt, lv, lb, rt, rv, rb = lines
    vertices = [geometry.intersection(lt, rt), geometry.intersection(rt, rv),
                geometry.intersection(rv, rb), geometry.intersection(rb, lb),
                geometry.intersection(lb, lv), geometry.intersection(lv, lt)]
    center = tuple(sum(p[i] for p in vertices)/6 for i in (0, 1))
    unit = [(math.cos(math.radians(-90+60*i)), math.sin(math.radians(-90+60*i))) for i in range(6)]
    limits = []
    for a, b in zip(vertices, vertices[1:]+vertices[:1]):
        nx, ny = b[1]-a[1], a[0]-b[0]
        length = math.hypot(nx, ny)
        nx, ny = nx/length, ny/length
        distance = nx*(a[0]-center[0])+ny*(a[1]-center[1])
        limits.append(distance/max(nx*ux+ny*uy for ux, uy in unit))
    radius = min(limits)-4
    assert all(math.isfinite(v) for p in vertices for v in p)
    assert .4*source.height < radius < .55*source.height
    # Only exterior gold is trimmed; the protected artwork/number area is retained.
    assert radius/max(limits) >= .90, "Changed source contour: inspect artwork protection"
    for x, y in vertices:
        dx, dy = abs(x-center[0])*.90, abs(y-center[1])*.90
        assert dx <= math.sqrt(3)*radius/2 and dy+dx/math.sqrt(3) <= radius, "Protected inner hex was clipped"
    return center, radius, vertices, radius/max(limits)


def preview(catalog):
    sheet = Image.new("RGB", (1800, 1500), "#efe2c3")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 18)
    for i, asset in enumerate(catalog):
        x, y = i % 6 * 300, i // 6 * 300
        image = Image.open(OUTPUT / asset["file"])
        for size, dx, dy in ((228, 0, 0), (76, 224, 165)):
            thumb = image.resize((size, size), Image.Resampling.LANCZOS)
            sheet.paste(thumb, (x+dx, y+dy), thumb)
        draw.text((x+10, y+248), f'수도원 {asset["number"]:02} · 실제 66px / 확대', font=font, fill="#49331d")
    sheet.save(OUTPUT / "_preview_sheet.png")


def verify_browser_edges():
    """Check captured production TileArt neighbours; ignore subpixel AA on the edge."""
    height = 200/math.sqrt(3)
    points = [(100, height/4), (100, height*.75), (50, height),
              (0, height*.75), (0, height/4), (50, 0)]
    edges = {}
    for i in range(29):
        row, column = divmod(i, 6)
        x, y = column*100+(row % 2)*50, row*height*.75
        for j in range(6):
            pair = tuple(sorted(tuple(round(c, 6) for c in (x+points[k][0], y+points[k][1]))
                                for k in (j, (j+1) % 6)))
            edges[pair] = edges.get(pair, 0)+1
    for zoom in (100, 160, 200):
        path = ROOT / f".local-data/monastery-import/neighbours-{zoom}.png"
        if not path.exists():
            continue
        image = Image.open(path).convert("RGB")
        scale = 48*math.sqrt(3)*zoom/10000
        max_distance = 0
        for (a, b), count in edges.items():
            if count != 2:
                continue
            ax, ay, bx, by = a[0]*scale, a[1]*scale, b[0]*scale, b[1]*scale
            dx, dy = bx-ax, by-ay
            for t in (.15, .25, .35, .45, .55, .65, .75, .85):
                for oy in range(-2, 3):
                    for ox in range(-2, 3):
                        x, y = math.floor(ax+dx*t)+ox, math.floor(ay+dy*t)+oy
                        r, g, blue = image.getpixel((x, y))
                        if r > 200 and blue > 200 and g < 40:
                            distance = abs(dy*(x+.5-ax)-dx*(y+.5-ay))/math.hypot(dx, dy)
                            max_distance = max(max_distance, distance)
        assert max_distance < .5, f"Visible background gap at {zoom}%: {max_distance}px from shared edge"
        print(f"Browser {zoom}%: 66 shared edges, exposed AA max distance {max_distance:.4f}px (<0.5px).")


def main(check):
    inputs = originals(check)
    alpha = geometry.common_alpha()
    edge = ImageChops.subtract(alpha, alpha.filter(ImageFilter.MinFilter(3)))
    catalog = []
    if not check:
        OUTPUT.mkdir(parents=True, exist_ok=True)
    for asset in inputs["assets"]:
        data = (ROOT / asset["source"]).read_bytes()
        assert digest(data) == asset["sourceSha256"], "Preserved original changed"
        source = Image.open(BytesIO(data)).convert("RGBA")
        assert list(source.size) == asset["sourceSize"]
        center, radius, vertices, protection = measure(source)
        image = geometry.registered(source, center, SIZE/2/radius, alpha)
        r, g, b, _ = image.split()
        dark = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v <= 25 else 0)
        # Approved number ribbons touch the lower rim; their black ink is not matte.
        ink = ImageChops.multiply(edge, dark).getbbox()
        assert ink is None or (ink[0] > SIZE*.2 and ink[2] < SIZE*.8
                               and ink[1] > SIZE*.8 and ink[3] < SIZE*.93), f'Unexpected dark edge: {asset["number"]}'
        for x, y in ((70, SIZE//2), (SIZE-71, SIZE//2), (SIZE//2, 2), (SIZE//2, SIZE-3)):
            assert max(image.getpixel((x, y))[:3]) > 25, f'Exterior matte: {asset["number"]}'
        assert image.getchannel("A").tobytes() == alpha.tobytes()
        name = f'monastery-{asset["number"]:02}.png'
        output = OUTPUT / name
        if check:
            actual = Image.open(output)
            assert actual.format == "PNG" and actual.mode == "RGBA" and actual.size == (SIZE, SIZE)
            assert actual.tobytes() == image.tobytes(), f"Registration changed: {name}"
        else:
            image.save(output)
        catalog.append({**asset, "file": name, "outputSha256": digest(output.read_bytes()),
                        "measuredSourceCenter": center, "measuredSourceVertices": vertices,
                        "registeredSourceRadius": radius, "isotropicScale": SIZE/2/radius,
                        "protectedFraction": protection, "alphaBounds": alpha.getbbox()})
    manifest = {"canvas": SIZE, "geometry": "pointy-regular-hex", "center": [SIZE/2, SIZE/2],
                "radius": SIZE/2, "viewBox": [0, 0, 100, 200/math.sqrt(3)],
                "imageRect": [(100-200/math.sqrt(3))/2, 0, 200/math.sqrt(3), 200/math.sqrt(3)],
                "renderMode": "full-face-approved-baked-border-no-svg-overlay", "count": 29,
                "zipSha256": ZIP_SHA, "registration": "measured-inscribed-hex-isotropic-4px-matte-guard",
                "protectedInnerFraction": .90, "assets": catalog}
    path = OUTPUT / "manifest.json"
    if check:
        assert json.loads(path.read_text(encoding="utf-8")) == json.loads(json.dumps(manifest))
        assert len(list(OUTPUT.glob("monastery-*.png"))) == 29
        assert (OUTPUT / "_preview_sheet.png").exists()
    else:
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        preview(catalog)
    verify_browser_edges()
    print(f'{"Verified" if check else "Prepared"} 29/29 monastery PNGs, {SIZE}x{SIZE} RGBA, identical alpha, originals preserved.')


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    main(parser.parse_args().check)
