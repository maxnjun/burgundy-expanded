"""Register the nine approved custom faces without changing the legacy artwork."""
import argparse
import importlib.util
import json
import sys
from hashlib import sha256
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("monastery", ROOT / "scripts/prepare-monastery-tiles.py")
monastery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monastery)

SOURCE_HASHES = {
    "monastery-30": "593948433feadafbfee9a0354e43a853bf1ac939384a88b5ac4106be7c400998",
    "monastery-31": "c1bee2a0d5a1c8d27f7b149b661a2fc21239d9ef942bdbf8887dcf900bcfb1ad",
    "monastery-32": "d48169686166051c1a85663ffddbcacc52e6c8d55ffa6daf564b75cdd3bc82db",
    "shield-19": "e945bb6365ba17ab1c5590ef38be4c7f48587ed2680587d2da377e68225e8dec",
    "shield-20": "4a99f41441e3a021507c07b127977e9b9eb2f9240e60a61b6ba0880817145b57",
    "shield-21": "91e65b79b2f3f06ae7d1192bd288572e8fc3bf90c78ba7391ee50b8406ae14f7",
    "shield-22": "198f78fd17272143efcc429743867d57c858efd56b08f15419f160b14b087ed9",
    "shield-23": "d26eb500689ee178c53dc44902f959ef83707a05d0bba2cdc70569472c2a7b83",
    "shield-24": "e8fa16571ab693b4d7ef657f5b247158eeeee098d1dfb91c61d3c630618af3ef",
}
MONASTERY_CANVAS = 768
SHIELD_CANVAS = (1200, 1480)


def register_monastery(original, alpha):
    center, radius, vertices, protected = monastery.measure(original.convert("RGBA"))
    scale = alpha.width / (2 * radius)
    image = monastery.geometry.registered(original, center, scale, alpha)
    r, g, b, _ = image.split()
    dark = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v <= 25 else 0)
    rim = ImageChops.subtract(alpha, alpha.filter(ImageFilter.MinFilter(3)))
    ink = ImageChops.multiply(rim, dark).getbbox()
    size = alpha.width
    # The number ribbon can touch the lower slopes, just as on the legacy faces.
    assert ink is None or (ink[0] > size*.2 and ink[2] < size*.8
                           and ink[1] > size*.8 and ink[3] < size*.93), "Inspect dark exterior residue"
    for x, y in ((round(size*.069), size//2), (round(size*.93), size//2), (size//2, 2), (size//2, size-3)):
        assert max(image.getpixel((x, y))[:3]) > 25, "Exterior matte on the gold rim"
    assert image.getchannel("A").tobytes() == alpha.tobytes()
    return image, {"canvas": alpha.width, "measuredSourceCenter": center, "measuredSourceVertices": vertices,
                   "registeredSourceRadius": radius, "isotropicScale": scale, "protectedFraction": protected,
                   "alphaBounds": alpha.getbbox()}


def register_shield(original):
    rgba = original.convert("RGBA")
    center = (rgba.width // 2, rgba.height // 2)
    if original.mode == "RGBA":
        supplied = rgba.getchannel("A").point(lambda v: 255 if v >= 250 else v)
        body = supplied.point(lambda v: 255 if v >= 128 else 0)
        assert body.getpixel(center) == 255
        ImageDraw.floodfill(body, center, 128)
        silhouette = body.point(lambda v: 255 if v == 128 else 0)
        # Remove loose pixels while keeping the supplied soft edge around the face.
        alpha = ImageChops.darker(supplied, silhouette.filter(ImageFilter.MaxFilter(5)))
    else:
        r, g, b, _ = rgba.split()
        darkest = ImageChops.lighter(ImageChops.lighter(r, g), b).point(lambda v: 255 if v <= 34 else 0)
        mask = ImageOps.expand(darkest, border=1, fill=255)
        ImageDraw.floodfill(mask, (0, 0), 128)
        silhouette = mask.crop((1, 1, rgba.width + 1, rgba.height + 1)).point(lambda v: 0 if v == 128 else 255)
        # Feather inward so pixels from the black matte cannot colour the feather.
        alpha = ImageChops.darker(silhouette, silhouette.filter(ImageFilter.GaussianBlur(.45)))
    assert alpha.getpixel(center) == 255
    rgba.putalpha(alpha)
    bounds = alpha.getbbox()
    art = rgba.crop(bounds)
    # Older shields reserve ten pixels at the top and bottom. Use a single scale.
    scale = min(1180 / art.width, 1460 / art.height)
    art = art.resize((round(art.width * scale), round(art.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", SHIELD_CANVAS)
    canvas.paste(art, ((canvas.width - art.width) // 2, (canvas.height - art.height) // 2))
    art_bounds = canvas.getchannel("A").getbbox()
    assert art_bounds[3] - art_bounds[1] >= 1440 and art_bounds[2] - art_bounds[0] >= 975
    return canvas, {"sourceBounds": bounds, "artBounds": art_bounds}


def update_family(family, folder, first, last, check):
    manifest_path = folder / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    existing = [a for a in manifest["assets"] if a["number"] < first]
    assert [a["number"] for a in existing] == list(range(1, first))
    alpha = monastery.geometry.common_alpha(MONASTERY_CANVAS) if family == "monastery" else None
    assets = []
    for number in range(first, last + 1):
        name = f"{family}-{number}"
        filename = f"{name}.png"
        source = f"asset-inbox/{family}-approved/originals/{filename}"
        data = (ROOT / source).read_bytes()
        digest = sha256(data).hexdigest()
        assert digest == SOURCE_HASHES[name], f"Unreviewed source: {source}"
        original = Image.open(BytesIO(data))
        assert original.format == "PNG"
        image, geometry = register_monastery(original, alpha) if alpha else register_shield(original)
        output = folder / filename
        if check:
            actual = Image.open(output)
            assert actual.format == "PNG" and actual.mode == "RGBA" and actual.size == image.size
            assert actual.tobytes() == image.tobytes(), f"Rebuild {filename}"
        else:
            image.save(output, optimize=True)
        assets.append({"number": number, "file": filename, "source": source, "sourceSha256": digest,
                       "sourceSize": original.size, "sourceMode": original.mode,
                       "zipEntry": f"{'수도원' if alpha else '방패'} 타일/{number}번.png",
                       "outputSha256": sha256(output.read_bytes()).hexdigest(), **geometry})
        print(f"{filename}: {original.size} {original.mode} → {image.size} RGBA")
    expected = {**manifest, "assets": [*existing, *assets]}
    if alpha:
        expected["count"] = last
    else:
        expected["mapping"] = "approved-number-1-to-24"
    normalized = json.dumps(expected, ensure_ascii=False, indent=2) + "\n"
    if check:
        assert manifest == json.loads(normalized), f"Stale manifest: {manifest_path}"
    else:
        manifest_path.write_text(normalized, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    check = parser.parse_args().check
    update_family("monastery", monastery.OUTPUT, 30, 32, check)
    update_family("shield", ROOT / "public/shields", 19, 24, check)
