#!/usr/bin/env python3
"""Build a proper TrueType pixel font (src/assets/fonts/gen3.ttf) from the
repo's authentic Gen-3 GBA font atlas (src/assets/party/font_normal.png +
party_meta.json — red pixels = glyph, blue = shadow, baseline at row 8).

The two TTFs previously bundled (pokefirered.ttf / gba_font.ttf) are broken
conversions: their contours use mixed winding, so glyphs render striped or as
solid blocks. This generator emits one counter-clockwise rectangle per
horizontal pixel run (non-zero winding => solid), which renders pixel-perfect
at any integer multiple of font-size 16px (1 atlas px = 1 CSS px @ 16px).

Run from repo root:  python3 tools/gen_gen3_font.py
Requires: pillow, fonttools.
"""
import json
from PIL import Image
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ATLAS = 'src/assets/party/font_normal.png'
META = 'src/assets/party/party_meta.json'
OUT = 'src/assets/fonts/gen3.ttf'

UPM = 1024
PPU = UPM // 16          # font units per atlas pixel (16px em)
BASELINE_ROW = 8         # glyph rows 0..7 sit above the baseline
CELL = 16


def glyph_runs(im, idx):
    """Yield (x0, x1, y) horizontal runs of red (foreground) pixels."""
    gx, gy = (idx % 16) * CELL, (idx // 16) * CELL
    for y in range(CELL):
        x = 0
        while x < CELL:
            p = im.getpixel((gx + x, gy + y))
            if p[3] > 0 and p[0] > 150 and p[2] < 100:
                x0 = x
                while x < CELL:
                    p = im.getpixel((gx + x, gy + y))
                    if not (p[3] > 0 and p[0] > 150 and p[2] < 100):
                        break
                    x += 1
                yield x0, x, y
            else:
                x += 1


def build_glyph(im, idx):
    pen = TTGlyphPen(None)
    for x0, x1, y in glyph_runs(im, idx):
        top = (BASELINE_ROW - y) * PPU
        bot = (BASELINE_ROW - y - 1) * PPU
        # counter-clockwise rectangle
        pen.moveTo((x0 * PPU, bot))
        pen.lineTo((x1 * PPU, bot))
        pen.lineTo((x1 * PPU, top))
        pen.lineTo((x0 * PPU, top))
        pen.closePath()
    return pen.glyph()


def main():
    meta = json.load(open(META))
    im = Image.open(ATLAS).convert('RGBA')
    charmap = meta['charmap']
    widths = meta['normalWidths']

    glyphs, cmap, metrics = {'.notdef': TTGlyphPen(None).glyph()}, {}, {}
    metrics['.notdef'] = (6 * PPU, 0)
    order = ['.notdef']
    for ch, idx in sorted(charmap.items(), key=lambda kv: kv[1]):
        cp = ord(ch)
        name = 'uni%04X' % cp
        if name in glyphs:
            cmap[cp] = name
            continue
        glyphs[name] = build_glyph(im, idx)
        w = widths[idx] if idx < len(widths) and widths[idx] else 6
        metrics[name] = (w * PPU, 0)
        cmap[cp] = name
        order.append(name)

    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=UPM * 13 // 16, descent=-UPM * 3 // 16)
    fb.setupNameTable({'familyName': 'PokeGen3', 'styleName': 'Regular',
                       'fullName': 'PokeGen3', 'psName': 'PokeGen3-Regular'})
    fb.setupOS2(sTypoAscender=UPM * 13 // 16, sTypoDescender=-UPM * 3 // 16,
                usWinAscent=UPM * 13 // 16, usWinDescent=UPM * 3 // 16)
    fb.setupPost()
    fb.save(OUT)
    print('wrote %s (%d glyphs)' % (OUT, len(order)))


if __name__ == '__main__':
    main()
