"""Register approved custom faces and apply the shield balance artwork."""
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
    "monastery-31": "a8c7cb8a0617e5742064f6dd4f81e0242564a5cb1cd4efe91ca17c41c5d7d04f",
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


def update_shield_score(image, donor, number):
    # Reuse shield 23's approved numeral. Only the red field behind the score is touched.
    field = donor.crop((482, 310, 716, 520))
    top = 281 if number == 21 else 284
    existing = image.crop((482, top, 716, top + field.height))

    def numeral_mask(crop, bounds):
        _, green, blue, _ = crop.split()
        light = ImageChops.multiply(green.point(lambda v: 255 if v > 95 else 0),
                                    blue.point(lambda v: 255 if v > 65 else 0))
        inset = Image.new("L", crop.size)
        ImageDraw.Draw(inset).rectangle(bounds, fill=255)
        return ImageChops.multiply(inset, light)

    numeral = ImageChops.lighter(numeral_mask(existing, (40, 10, 193, 195)),
                                numeral_mask(field, (12, 15, 221, 197)))
    mask = numeral.filter(ImageFilter.MaxFilter(21)).filter(ImageFilter.GaussianBlur(2))
    original_alpha = image.getchannel("A")
    image.paste(field, (482, top), mask)
    assert image.getchannel("A").tobytes() == original_alpha.tobytes()


def approved_art(path, digest):
    data = (ROOT / path).read_bytes()
    assert sha256(data).hexdigest() == digest, f"Unreviewed artwork: {path}"
    return Image.open(BytesIO(data)).convert("RGBA")


def restore_parchment(image, sample, cover, bounds, left, right):
    # Keep the donor's paper texture and match the target's falloff toward the rim.
    size = (bounds[2] - bounds[0], bounds[3] - bounds[1])
    texture = sample.convert("RGB").resize(size, Image.Resampling.LANCZOS)
    detail = ImageChops.subtract(texture, texture.filter(ImageFilter.GaussianBlur(24)), offset=128)
    lighting = Image.new("RGB", (size[0], 1))
    lighting.putdata([tuple(round(a + (b - a) * x / (size[0] - 1)) for a, b in zip(left, right))
                      for x in range(size[0])])
    patch = ImageChops.add(detail, lighting.resize(size), offset=-128)
    image.paste(patch, bounds[:2], cover.filter(ImageFilter.GaussianBlur(7)).crop(bounds))


def update_shield_effect(image, parchment, number):
    original_alpha = image.getchannel("A")
    cover = Image.new("L", image.size)
    draw = ImageDraw.Draw(cover)
    if number == 19:
        # Cover the old large coin and its shadow while keeping the arrowhead.
        draw.ellipse((787, 656, 1058, 946), fill=255)
        draw.polygon([(777, 729), (805, 794), (777, 857), (777, 700)], fill=0)
        sample = parchment.crop((813, 569, 1041, 947))
        coin = approved_art("public/assets/icons/silver-coin.png",
                            "6556abb727ef1998005dc4cca0bbca1ac52720efcd09dd9945b01d6080f506ad")
        coin = coin.crop(coin.getbbox())
        coin.thumbnail((129, 129), Image.Resampling.LANCZOS)
        restore_parchment(image, sample, cover, (784, 635, 1060, 965), (228, 204, 181), (181, 150, 125))
        image.alpha_composite(coin, (816, 723))
        image.alpha_composite(coin, (914, 753))
    else:
        # Only mask the old recipient; retain the coins, arrow and lower transfer.
        draw.polygon([(765, 533), (788, 507), (840, 497), (891, 519), (904, 571),
                      (931, 585), (943, 617), (929, 649), (900, 674), (934, 732),
                      (924, 758), (718, 763), (707, 741), (722, 690), (735, 657),
                      (710, 645), (705, 619), (724, 586), (764, 573)], fill=255)
        draw.polygon([(882, 549), (894, 465), (936, 465), (970, 495), (990, 537),
                      (995, 582), (914, 588)], fill=255)
        sample = parchment.crop((822, 494, 1020, 945))
        # Coordinates measured in the approved 1024px beige bank tile.
        bank = approved_art("public/assets/tiles/beige/final/bank.png",
                            "25234addf9d489c6bdd9663479b7ded1f13feb487203389a5f9d961333d37166")
        mask = Image.new("L", bank.size)
        ImageDraw.Draw(mask).polygon([(229, 549), (280, 471), (278, 423), (335, 376), (391, 313),
                                      (391, 215), (445, 190), (469, 209), (466, 258), (529, 280),
                                      (581, 232), (609, 232), (630, 267), (660, 297), (691, 276),
                                      (714, 293), (715, 351), (794, 420), (782, 470), (805, 489),
                                      (845, 563), (845, 686), (801, 729), (708, 766), (660, 775),
                                      (573, 741), (476, 712), (383, 680), (296, 661), (236, 609)], fill=255)
        bank.putalpha(ImageChops.multiply(bank.getchannel("A"), mask.filter(ImageFilter.GaussianBlur(2))))
        bank = bank.crop(bank.getbbox())
        bank.thumbnail((263, 256), Image.Resampling.LANCZOS)
        restore_parchment(image, sample, cover, (703, 445, 1015, 790), (240, 217, 193), (200, 172, 146))
        image.alpha_composite(bank, (716, 505))
    assert image.getchannel("A").tobytes() == original_alpha.tobytes()


def update_family(family, folder, first, last, check):
    manifest_path = folder / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    existing = [a for a in manifest["assets"] if a["number"] < first]
    assert [a["number"] for a in existing] == list(range(1, first))
    alpha = monastery.geometry.common_alpha(MONASTERY_CANVAS) if family == "monastery" else None
    if family == "shield":
        donor, parchment = (
            register_shield(approved_art(f"asset-inbox/shield-approved/originals/shield-{n}.png",
                                         SOURCE_HASHES[f"shield-{n}"]))[0] for n in (23, 20))
    assets = []
    for number in range(first, last + 1):
        name = f"{family}-{number}"
        filename = f"{name}.png"
        source_filename = "monastery-31-revised.png" if name == "monastery-31" else filename
        source = f"asset-inbox/{family}-approved/originals/{source_filename}"
        data = (ROOT / source).read_bytes()
        digest = sha256(data).hexdigest()
        assert digest == SOURCE_HASHES[name], f"Unreviewed source: {source}"
        original = Image.open(BytesIO(data))
        assert original.format == "PNG"
        image, geometry = register_monastery(original, alpha) if alpha else register_shield(original)
        if family == "shield" and number in (21, 24):
            update_shield_score(image, donor, number)
        if family == "shield" and number in (19, 21):
            update_shield_effect(image, parchment, number)
        output = folder / filename
        if check:
            actual = Image.open(output)
            assert actual.format == "PNG" and actual.mode == "RGBA" and actual.size == image.size
            assert actual.tobytes() == image.tobytes(), f"Rebuild {filename}"
        else:
            png = BytesIO()
            image.save(png, format="PNG", optimize=True)
            if not output.exists() or output.read_bytes() != png.getvalue():
                output.write_bytes(png.getvalue())
        provenance = {"zipEntry": f"{'수도원' if alpha else '방패'} 타일/{number}번.png"} if source_filename == filename else {}
        assets.append({"number": number, "file": filename, "source": source, "sourceSha256": digest,
                       "sourceSize": original.size, "sourceMode": original.mode,
                       **provenance,
                       **({"scoreArtwork": {"points": 12, "numeralFromShield": 23}}
                          if family == "shield" and number in (21, 24) else {}),
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
    elif manifest != json.loads(normalized):
        manifest_path.write_text(normalized, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    check = parser.parse_args().check
    update_family("monastery", monastery.OUTPUT, 30, 32, check)
    update_family("shield", ROOT / "public/shields", 19, 24, check)
