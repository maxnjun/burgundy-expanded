"""Import the 13 approved animal faces without warping or repainting animals.

Requires Pillow. --check regenerates in memory and checks every output pixel.
The approved ZIP and extracted originals are never written.
"""
from pathlib import Path
from io import BytesIO
import argparse
import hashlib
import importlib.util
import json
import math
import sys
import zipfile
from PIL import Image, ImageDraw, ImageFont

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("beige_geometry", ROOT / "scripts/prepare-beige-tiles.py")
geometry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geometry)
SIZE = geometry.SIZE
INPUT = ROOT / "asset-inbox/animal-approved"
OUTPUT = ROOT / "public/assets/tiles/animals/final"
ZIP_SHA = "15426e019d925d35c7b63070e02dbf747341c267183a6413d073722610ce8c65"
KINDS = {"pig": ("pigs", "돼지"), "guinea-pig": ("chickens", "기니피그"),
         "cow": ("cattle", "소"), "sheep": ("sheep", "양"), "harp-seal": ("geese", "하프물범")}
FACES = [(kind, count, f"{kind}-{count}.png") for kind in list(KINDS)[:4] for count in (2, 3, 4)]
FACES.append(("harp-seal", 2, "하프물범 2.png"))


def measure(source):
    # Fit six edge middles; only the exterior is thresholded, never animal pixels.
    p = source.load()
    rows = []
    for y in range(source.height):
        xs = [x for x in range(source.width) if p[x, y][3] > 128 and max(p[x, y][:3]) > 38]
        if xs:
            rows.append((y, xs[0], xs[-1]))
    top, bottom = rows[0][0], rows[-1][0]
    height = bottom-top
    lines = []
    for side in (1, 2):
        for start, end in ((.08, .20), (.36, .64), (.80, .92)):
            lines.append(geometry.line_fit([(y, row[side]) for row in rows
                         if top+height*start <= (y := row[0]) <= top+height*end]))
    lt, lv, lb, rt, rv, rb = lines
    vertices = [geometry.intersection(lt, rt), geometry.intersection(rt, rv),
                geometry.intersection(rv, rb), geometry.intersection(rb, lb),
                geometry.intersection(lb, lv), geometry.intersection(lv, lt)]
    center = tuple(sum(p[i] for p in vertices)/6 for i in (0, 1))
    assert all(math.isfinite(n) for point in vertices for n in point)
    assert 950 < vertices[3][1]-vertices[0][1] < source.height*1.05, "Inspect changed source geometry"
    # Locate the rim/grass transition along each straight edge, including the
    # thicker lower bevel. Colour thresholds never touch the central artwork.
    edges = []
    for a, b in zip(vertices, vertices[1:]+vertices[:1]):
        nx, ny = b[1]-a[1], a[0]-b[0]
        length = math.hypot(nx, ny)
        nx, ny = nx/length, ny/length
        samples = []
        for d in range(0, round(height*.08)):
            colors = []
            for t in (.25, .35, .45, .55, .65, .75):
                x, y = (a[i]*(1-t)+b[i]*t for i in (0, 1))
                x, y = round(x-nx*d), round(y-ny*d)
                if 0 <= x < source.width and 0 <= y < source.height:
                    rgb = source.getpixel((x, y))
                    colors.append(.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2])
            samples.append(sum(colors)/len(colors) if colors else 0)
        distance = min(range(round(height*.025), len(samples)-6),
            key=lambda d: sum(samples[d+1:d+6])-sum(samples[d-5:d]))+2
        edges.append((nx, ny, nx*a[0]+ny*a[1]-distance))
    inner = []
    for previous, current in zip(edges[-1:]+edges[:-1], edges):
        a, b, c = previous
        d, e, f = current
        determinant = a*e-b*d
        inner.append(((c*e-b*f)/determinant, (a*f-c*d)/determinant))
    assert all(0 <= x < source.width and 0 <= y < source.height for x, y in inner)
    assert all(abs(inner[i][0]-center[0]) < 15 for i in (0, 3)), "Rim detector reached artwork; inspect contour"
    radius = max(max(abs(x-center[0])*2/math.sqrt(3), abs(y-center[1])+abs(x-center[0])/math.sqrt(3)) for x, y in inner)
    return center, vertices, inner, (SIZE/2-28)/radius


def normalize(source, center, inner, scale, alpha):
    mask = Image.new("L", (source.width*4, source.height*4))
    ImageDraw.Draw(mask).polygon([(x*4, y*4) for x, y in inner], fill=255)
    source = source.copy()
    source.putalpha(mask.resize(source.size, Image.Resampling.LANCZOS))
    cx, cy = center
    layer = source.transform((SIZE, SIZE), Image.Transform.AFFINE,
        (1/scale, 0, cx-SIZE/2/scale, 0, 1/scale, cy-SIZE/2/scale), Image.Resampling.BICUBIC)
    # Grass-coloured margins adapt the non-regular source to the regular game hex.
    # No animal/grass pixels are stretched, recoloured, inpainted or generated.
    result = Image.new("RGBA", (SIZE, SIZE), "#8eaf46")
    result.alpha_composite(layer)
    result.putalpha(alpha)
    result.paste((0, 0, 0, 0), mask=alpha.point(lambda a: 255 if a == 0 else 0))
    return result


def preview(assets):
    sheet = Image.new("RGB", (1500, 1440), "#efe2c3")
    draw = ImageDraw.Draw(sheet)
    font_path = Path("C:/Windows/Fonts/malgun.ttf")
    font = ImageFont.truetype(str(font_path), 17) if font_path.exists() else ImageFont.load_default()
    draw.text((18, 12), "Approved animals · original illustration / common SVG frame rendered in game", font=font, fill="#493522")
    for i, asset in enumerate(assets):
        x, y = i % 5*300, i//5*460+42
        im = Image.open(OUTPUT/asset["file"])
        for size, dx, dy in ((288, 6, 0), (96, 102, 292)):
            thumb = im.resize((size, size), Image.Resampling.LANCZOS)
            sheet.paste(thumb, (x+dx, y+dy), thumb)
        draw.text((x+150, y+398), f'{asset["nameKo"]} {asset["count"]}마리', anchor="mt", font=font, fill="#493522")
        draw.text((x+150, y+426), asset["file"], anchor="mt", font=font, fill="#493522")
    sheet.save(OUTPUT/"_preview_sheet.png")


def main(check):
    archive = INPUT/"동물 타일.zip"
    assert geometry.sha(archive) == ZIP_SHA, "Unreviewed archive; inspect before importing"
    alpha = geometry.common_alpha()
    catalog = []
    rim_colors = []
    if not check:
        OUTPUT.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as zipped:
        members = {Path(i.filename).name: i for i in zipped.infolist() if i.filename.lower().endswith(".png")}
        assert len(members) == len(FACES) == 13 and set(members) == {f[2] for f in FACES}
        for kind, count, original in FACES:
            data = zipped.read(members[original])
            source = Image.open(BytesIO(data)).convert("RGBA")
            assert source.size == (1254, 1254)
            extracted = INPUT/"originals"/original
            if extracted.exists():
                assert extracted.read_bytes() == data, f"Changed extracted original: {original}"
            center, vertices, inner, scale = measure(source)
            for a, b in zip(vertices, vertices[1:]+vertices[:1]):
                for t in (.3, .5, .7):
                    x, y = (a[i]*(1-t)+b[i]*t for i in (0, 1))
                    rim_colors.append(source.getpixel((round(center[0]+.96*(x-center[0])), round(center[1]+.96*(y-center[1]))))[:3])
            im = normalize(source, center, inner, scale, alpha)
            name = f"{kind}-{count}.png"
            path = OUTPUT/name
            if check:
                actual = Image.open(path)
                assert actual.format == "PNG" and actual.mode == "RGBA" and actual.size == (SIZE, SIZE)
                assert actual.tobytes() == im.tobytes(), f"Non-deterministic output: {name}"
            else:
                im.save(path)
            assert im.getchannel("A").tobytes() == alpha.tobytes()
            for x, y in ((70, 512), (953, 512), (512, 2), (512, 1021)):
                assert min(im.getpixel((x, y))[:3]) > 25, f"Exterior matte: {name}"
            catalog.append({"species": KINDS[kind][0], "count": count, "nameKo": KINDS[kind][1],
                "file": name, "source": f"asset-inbox/animal-approved/originals/{original}",
                "sourceSha256": hashlib.sha256(data).hexdigest(), "outputSha256": geometry.sha(path),
                "sourceCenter": center, "sourceVertices": vertices, "innerContour": inner,
                "isotropicScale": scale, "alphaBounds": alpha.getbbox()})
    rim_colors.sort(key=lambda c: .2126*c[0]+.7152*c[1]+.0722*c[2])
    palette = {name: "#"+"".join(f"{v:02x}" for v in rim_colors[round((len(rim_colors)-1)*q)])
               for name, q in (("dark", .05), ("base", .5), ("light", .95))}
    manifest = {"canvas": SIZE, "geometry": "pointy-regular-hex", "archiveSha256": ZIP_SHA,
        "renderMode": "illustration-with-common-svg-frame", "sourceInnerContour": "measured-rim-grass-transition",
        "palette": palette,
        "surface": "#8eaf46", "assets": catalog}
    if check:
        assert json.loads((OUTPUT/"manifest.json").read_text(encoding="utf-8")) == json.loads(json.dumps(manifest))
        assert len([p for p in OUTPUT.glob("*.png") if not p.name.startswith("_")]) == 13
    else:
        (OUTPUT/"manifest.json").write_bytes((json.dumps(manifest, ensure_ascii=False, indent=2)+"\n").encode())
        preview(catalog)
    print(f"{'Verified' if check else 'Prepared'} 13 {SIZE}x{SIZE} RGBA faces; uniform scaling, common alpha, originals unchanged.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    main(parser.parse_args().check)
