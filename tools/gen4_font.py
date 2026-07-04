#!/usr/bin/env python3
"""
gen4_font.py — decode Pokémon Platinum's system font (graphic/pl_font.narc
members 0000-0003, mislabeled .lz — they are NOT compressed).

Format (little-endian):
  0x00 u32  (0x10, type/version)
  0x04 u32  glyph-data size (= nGlyphs*64)
  0x08 u32  nGlyphs (509)
  0x0C u8   cell width  (16)
  0x0D u8   cell height (16)
  0x0E u8   bpp (2)
  0x0F u8   (2)
  0x10 ..   nGlyphs * 64 bytes  — each glyph = 16x16 @2bpp stored as four 8x8
            tiles (row-major TL,TR,BL,BR), each tile 16 bytes, 2bpp LSB-first.
  tail      nGlyphs bytes — per-glyph advance width (variable-width font).

Glyph index -> character comes from the Gen-4 charmap solved in gen4_text.py
(A-Z=0x12B.., a-z=0x145.., digits=0x121..). We emit a PNG atlas + a JSON of
per-glyph widths so the UI can render a pixel-exact bitmap font.

CLI: gen4_font.py <member.lz> <out.png> [out.json]
"""
import sys, struct, json
from PIL import Image

TILE = [(0, 0), (8, 0), (0, 8), (8, 8)]  # TL,TR,BL,BR


def decode(path):
    d = open(path, "rb").read()
    n = struct.unpack_from("<I", d, 8)[0]
    w, h, bpp = d[12], d[13], d[14]
    off = 16
    gbytes = w * h * bpp // 8
    glyphs = []
    for g in range(n):
        base = off + g * gbytes
        cell = [[0] * w for _ in range(h)]
        for ti, (tx, ty) in enumerate(TILE):
            tb = base + ti * 16
            for i in range(16):
                byte = d[tb + i]
                for k in range(4):
                    v = (byte >> (k * 2)) & 3
                    pix = i * 4 + k
                    cell[ty + pix // 8][tx + pix % 8] = v
        cell = [row[::-1] for row in cell]   # stored horizontally mirrored
        glyphs.append(cell)
    widths = list(d[off + n * gbytes: off + n * gbytes + n])
    return glyphs, widths, w, h


def atlas(glyphs, w, h, cols=32):
    n = len(glyphs); rows = (n + cols - 1) // cols
    im = Image.new("RGBA", (cols * w, rows * h), (0, 0, 0, 0))
    px = im.load()
    lvl = [(0, 0, 0, 0), (90, 90, 90, 255), (30, 30, 30, 255), (0, 0, 0, 255)]
    for g, cell in enumerate(glyphs):
        ox, oy = (g % cols) * w, (g // cols) * h
        for y in range(h):
            for x in range(w):
                v = cell[y][x]
                if v:
                    px[ox + x, oy + y] = lvl[v]
    return im


if __name__ == "__main__":
    glyphs, widths, w, h = decode(sys.argv[1])
    out = sys.argv[2]
    atlas(glyphs, w, h).save(out)
    print(f"{len(glyphs)} glyphs {w}x{h} -> {out}")
    if len(sys.argv) > 3:
        json.dump({"w": w, "h": h, "n": len(glyphs), "widths": widths}, open(sys.argv[3], "w"))
        print("widths ->", sys.argv[3])
