# Approved estate bonus source and localized edits

원본 5파일은 `originals/`에 바이트 그대로 보존했다. 합본의 왼쪽=building, 오른쪽=monastery. `manifest.json`이 원본 및 중간 입력의 SHA256을 고정한다. 생성 원본을 직접 런타임에 사용하지 않고, 정규화/보호 마스크를 거친 별도 파생 PNG만 사용한다.

Built-in imagegen을 사용했다. CLI/API 키나 별도 유료 서비스를 사용하지 않았다. 게임의 다른 그림을 다시 생성하지 않았다.

## Numeral removal working plate

Reference/edit target: `number-removal-input.png` (one 3×2 working sheet; source-pixel registrations before common numeral replacement).
Output: `number-removal-plate.png`.

Prompt:

> Precise object removal edit of this single 1536x1024 working sprite sheet. Keep the exact 3 columns x 2 rows, six tile positions, widths and heights. Remove ONLY the large ivory numeral 5 and its black cast shadow from the center of each of the six tiles, restoring the tiny hidden portion of the respective background scene underneath. Top left mine rock and timber, top center pasture, top right blue ship, bottom left castle, bottom center sepia medieval market town fountain, bottom right yellow monastery garden. This is a clean background plate for later typesetting; DO NOT add any text, letters, digits, symbols, new objects or ornaments. Preserve every green stepped outer frame and gold inner border precisely. Preserve all visible scene details outside the footprint of each old numeral. No redesign, no recolor, no resizing, no rotation. Exterior must remain truly transparent. Return this same single sprite sheet in the same layout.

생성 결과의 외부 배경은 사용하지 않는다. 코드가 원본 중앙 직사각형 및 작은 페더 범위에서만 해당 보완을 합성하고 원래 공통 알파를 적용한다. 테두리는 생성 결과로 교체하지 않는다.

## Shared numeral assets

Reference: `numerals/5-body.png`, original mine ivory five extracted with a pixel mask. Extraction is recorded in `scripts/estate-bonus-numerals.py`.

For each n in **2,3,4,6,7**, one built-in edit call, saved as `numerals/{n}-generated.png`:

> Edit this single typography asset: replace the ivory numeral 5 with the single numeral {n}. Same bespoke medieval board game ivory carved type style, thick slightly slanted sculpted serif form, pale warm ivory, tiny natural cracked ivory surface texture, softly bevelled edge. Match the reference's stroke thickness, proportions, slight rightward slant, lighting and material. Just ONE numeral {n}, centered, isolated, truly transparent RGBA background. No tile, no scene, no frame, no other text. Keep shadows minimal because the game will composite one consistent dark outline and drop shadow separately. Do not substitute a plain system-font look.

The 5 alpha edge was cleaned with the same reference, saved as `numerals/5-generated.png`:

> Precise edge cleanup of this single ivory numeral 5 sprite. Preserve the same numeral 5 silhouette and sculpted serif shape, thick slightly rightward-slanted ivory stroke, exact cracked cream material, warmth and proportions. Repair the tiny jagged pixel-sized nicks in the alpha cutout edge into a smooth antialiased natural carved edge, preserving the reference glyph design. One isolated 5 only, centered, truly transparent RGBA. No tile, frame, scene or any other text. Match a bespoke medieval boardgame ivory carved numeral, NOT a plain system font. Keep shadows minimal; a shared outline/drop shadow is composited by the application.

## Reproduction

Run `python scripts/prepare-estate-bonus-assets.py --check` for read-only verification with Pillow. Without `--check`, it reproduces the derived outputs from the preserved, hash-checked inputs. No generation/network call runs in that script. One common numeral layer is composited at the gold-aperture center across all six colors, with shared stroke/shadow. The optional original reference extraction helper also uses the installed NumPy.

Preserved plate restores pixels hidden by the old numeral; those cannot be an exact recovery of an unavailable clean original. Review the comparison images before substituting a different plate or source. Source hashes changing require reviewing the masks, not silently reusing them.
