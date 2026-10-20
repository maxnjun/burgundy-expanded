"""Register approved full-face artwork without repainting or stretching it.

Requires Pillow. Generate with no arguments; --check verifies without writing.
Only the new final/ directory is written. Source hashes gate every operation.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "asset-inbox/beige-approved"
OUTPUT = ROOT / "public/assets/tiles/beige/final"
STANDARD = json.loads((ROOT / "src/app/tile-standard.json").read_text())
SIZE = STANDARD["rasterCanvas"]
# Catalog spellings differ from the supplied file names in these two cases.
BUILDINGS = {"market": "market", "carpenter_workshop": "carpenters-workshop",
            "church": "church", "warehouse": "warehouse", "crane": "crane",
            "boarding_house": "boarding-house", "bank": "bank",
            "city_hall": "town-hall", "watchtower": "watchtower",
            "white_castle": "white-castle"}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def line_fit(points):
    # x = a*y+b. Use straight edge middles, away from rounded tips/shadows.
    cy = sum(y for y, x in points) / len(points)
    cx = sum(x for y, x in points) / len(points)
    a = sum((y-cy)*(x-cx) for y, x in points) / sum((y-cy)**2 for y, x in points)
    return a, cx-a*cy


def intersection(a, b):
    y = (b[1]-a[1]) / (a[0]-b[0])
    return a[0]*y+a[1], y


def measure(source):
    pixels = source.load()
    lines = []
    for left in (True, False):
        for start, end in ((70, 260), (410, 830), (1000, 1170)):
            points = []
            for y in range(start, end):
                xs = range(source.width) if left else range(source.width-1, -1, -1)
                x = next(x for x in xs if pixels[x, y][3] > 128 and max(pixels[x, y][:3]) > 38)
                points.append((y, x))
            lines.append(line_fit(points))
    lt, lv, lb, rt, rv, rb = lines
    vertices = [intersection(lt, rt), intersection(rt, rv), intersection(rv, rb),
                intersection(rb, lb), intersection(lb, lv), intersection(lv, lt)]
    center = tuple(sum(p[i] for p in vertices)/6 for i in (0, 1))
    unit = [(math.cos(math.radians(-90+60*i)), math.sin(math.radians(-90+60*i))) for i in range(6)]
    limits = []
    for (x, y), (xx, yy) in zip(vertices, vertices[1:]+vertices[:1]):
        nx, ny = yy-y, x-xx
        length = math.hypot(nx, ny)
        nx, ny = nx/length, ny/length
        distance = nx*(x-center[0])+ny*(y-center[1])
        limits.append(distance / max(nx*ux+ny*uy for ux, uy in unit))
    # A 4-source-pixel guard clears matte fringes; only outer wood is trimmed.
    radius = min(limits)-4
    assert .45*source.height < radius < .5*source.height, "Changed source geometry; inspect before importing"
    scale = SIZE/2/radius
    # Preserve the complete inner 92%, including all building illustrations.
    for x, y in vertices:
        dx, dy = (x-center[0])*.92, (y-center[1])*.92
        assert abs(dx) <= math.sqrt(3)*radius/2 and abs(dy)+abs(dx)/math.sqrt(3) <= radius
    return center, radius, scale, vertices


def common_alpha():
    radius = SIZE/2
    points = [(radius+radius*math.cos(math.radians(-90+60*i)),
               radius+radius*math.sin(math.radians(-90+60*i))) for i in range(6)]
    mask = Image.new("L", (SIZE*4, SIZE*4))
    ImageDraw.Draw(mask).polygon([(x*4, y*4) for x, y in points], fill=255)
    mask = mask.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    p = mask.load()
    for y in range(SIZE):
        for x in range(SIZE):
            dx, dy = abs(x+.5-radius), abs(y+.5-radius)
            if dx > math.sqrt(3)*radius/2 or dy+dx/math.sqrt(3) > radius:
                p[x, y] = 0
    return mask


def registered(source, center, scale, alpha):
    # One uniform affine resampling. No per-side warp, recolour or generated art.
    cx, cy = center
    rgb = source.convert("RGB").transform((SIZE, SIZE), Image.Transform.AFFINE,
        (1/scale, 0, cx-SIZE/2/scale, 0, 1/scale, cy-SIZE/2/scale), Image.Resampling.BICUBIC)
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    result.paste((0, 0, 0, 0), mask=alpha.point(lambda a: 255 if a == 0 else 0))
    return result


def preview(tiles):
    sheet = Image.new("RGB", (1500, 980), "#efe2c3")
    draw = ImageDraw.Draw(sheet)
    font_path = Path("C:/Windows/Fonts/malgun.ttf")
    font = ImageFont.truetype(str(font_path), 18) if font_path.exists() else ImageFont.load_default()
    small = ImageFont.truetype(str(font_path), 15) if font_path.exists() else ImageFont.load_default()
    draw.text((20, 10), "Approved beige tiles / 83px game size + 249px detail (3x)", font=font, fill="#4a3420")
    for i, tile in enumerate(tiles):
        x, y = (i % 5)*300, (i//5)*460+45
        image = Image.open(OUTPUT / tile["file"]).convert("RGBA")
        # The content width is sqrt(3)/2 of the square canvas width.
        for width, px, py in ((288, x+6, y), (96, x+102, y+290)):
            thumb = image.resize((width, width), Image.Resampling.LANCZOS)
            sheet.paste(thumb, (px, py), thumb)
        draw.text((x+150, y+398), tile["nameKo"], font=font, fill="#4a3420", anchor="mt")
        draw.text((x+150, y+425), tile["file"], font=small, fill="#4a3420", anchor="mt")
    sheet.save(OUTPUT / "_preview_sheet.png")


def main(check):
    source_manifest = json.loads((INPUT / "manifest.json").read_text(encoding="utf-8"))
    assert source_manifest["count"] == len(source_manifest["tiles"]) == len(BUILDINGS) == 10
    assert {t["id"] for t in source_manifest["tiles"]} == set(BUILDINGS)
    alpha = common_alpha()
    catalog = []
    if not check:
        OUTPUT.mkdir(parents=True, exist_ok=True)
    for tile in source_manifest["tiles"]:
        path = INPUT / tile["zip_path"]
        assert sha(path) == tile["sha256"], f"Unreviewed original: {tile['id']}"
        source = Image.open(path).convert("RGBA")
        assert source.size == (tile["width"], tile["height"]) == (1254, 1254)
        center, radius, scale, vertices = measure(source)
        image = registered(source, center, scale, alpha)
        name = tile["id"].replace("_", "-")+".png"
        output = OUTPUT / name
        if check:
            actual = Image.open(output)
            assert actual.format == "PNG" and actual.mode == "RGBA" and actual.size == (SIZE, SIZE)
            assert actual.tobytes() == image.tobytes(), f"Output differs from deterministic registration: {name}"
        else:
            image.save(output)
        # The alpha support is identical for all ten; black exterior is gone.
        assert image.getchannel("A").tobytes() == alpha.tobytes()
        edge_mask = ImageChops.subtract(alpha, alpha.filter(ImageFilter.MinFilter(3)))
        r, g, b, _ = image.split()
        brightest = ImageChops.lighter(ImageChops.lighter(r, g), b)
        matte = ImageChops.multiply(edge_mask, brightest.point(lambda v: 255 if v <= 25 else 0))
        assert matte.getbbox() is None, f"Black background at outer edge: {name}"
        edge = image.load()
        for x, y in ((70, SIZE//2), (SIZE-71, SIZE//2), (SIZE//2, 2), (SIZE//2, SIZE-3)):
            assert edge[x, y][3] and max(edge[x, y][:3]) > 25, f"Matte fringe: {name}"
        catalog.append({"id": tile["id"], "nameKo": tile["name_ko"], "buildingType": BUILDINGS[tile["id"]],
            "source": "asset-inbox/beige-approved/"+tile["zip_path"], "sourceSha256": sha(path),
            "file": name, "outputSha256": sha(output), "measuredSourceCenter": center,
            "measuredSourceVertices": vertices, "registeredSourceRadius": radius,
            "isotropicScale": scale, "alphaBounds": alpha.getbbox()})
    manifest = {"canvas": SIZE, "geometry": "pointy-regular-hex", "center": [SIZE/2, SIZE/2],
        "radius": SIZE/2, "viewBox": [0, 0, 100, 200/math.sqrt(3)],
        "imageRect": [(100-200/math.sqrt(3))/2, 0, 200/math.sqrt(3), 200/math.sqrt(3)],
        "renderMode": "full-face-with-approved-baked-border-no-additional-svg-rim",
        "registration": "measured-inscribed-hex-isotropic-with-4-source-pixel-matte-guard",
        "protectedInnerFraction": .92, "assets": catalog}
    if check:
        assert json.loads((OUTPUT / "manifest.json").read_text(encoding="utf-8")) == json.loads(json.dumps(manifest))
        assert len([p for p in OUTPUT.glob("*.png") if not p.name.startswith("_")]) == 10
        assert (OUTPUT / "_preview_sheet.png").is_file()
    else:
        (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
        preview(catalog)
    print(f"{'Verified' if check else 'Prepared'} 10 RGBA tiles, {SIZE}x{SIZE}, identical alpha mask; source hashes unchanged.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    main(parser.parse_args().check)
