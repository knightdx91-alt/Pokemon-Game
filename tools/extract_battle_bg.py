"""
Assemble FireRed battle-terrain backgrounds (tileset + tilemap + palette banks)
into full RGBA PNGs for the web battle scene.
Usage: python3 tools/extract_battle_bg.py
Output: data/ui/battle/<terrain>.png
"""
import os
import struct

from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, "source", "pokefirered", "graphics", "battle_terrain")
OUT = os.path.join(REPO, "data", "ui", "battle")

MAP_W, MAP_H = 32, 64     # tilemap is 32x64 tiles (256x512), visible 240x160
CROP_W, CROP_H = 240, 160


def _read_pal_banks(path):
    lines = [l.strip() for l in open(path) if l.strip()]
    colors = []
    for line in lines[3:]:
        p = line.split()
        if len(p) >= 3:
            colors.append((int(p[0]), int(p[1]), int(p[2])))
    # group into 16-colour banks
    banks = [colors[i:i + 16] for i in range(0, len(colors), 16)]
    return banks


def _tile_indices(sheet):
    """Return sheet as a 2D list of 8x8 tiles (each tile = list of 64 palette idx)."""
    w, h = sheet.size
    px = list(sheet.getdata())
    cols = w // 8
    tiles = []
    n = (w // 8) * (h // 8)
    for t in range(n):
        tx, ty = (t % cols) * 8, (t // cols) * 8
        cell = []
        for yy in range(8):
            for xx in range(8):
                cell.append(px[(ty + yy) * w + (tx + xx)])
        tiles.append(cell)
    return tiles


def assemble(terrain):
    tdir = os.path.join(SRC, terrain)
    binp = os.path.join(tdir, "terrain.bin")
    pngp = os.path.join(tdir, "terrain.png")
    palp = os.path.join(tdir, "terrain.pal")
    if not (os.path.isfile(binp) and os.path.isfile(pngp) and os.path.isfile(palp)):
        return False

    ents = struct.unpack("<%dH" % (os.path.getsize(binp) // 2), open(binp, "rb").read())
    banks = _read_pal_banks(palp)
    sheet = Image.open(pngp).convert("P")
    tiles = _tile_indices(sheet)

    # battle_bg.c loads the terrain palette into HW banks 2..4, so a tilemap
    # palette field of N maps to terrain.pal bank (N-2). Field 0/1 belong to the
    # shared battle backdrop palette (not in the terrain files) -> left transparent
    # here and painted as a backdrop gradient by the battle scene.
    used = sorted(set((e >> 12) & 0xF for e in ents))
    bankmap = {}
    for b in used:
        i = b - 2
        if 0 <= i < len(banks):
            bankmap[b] = banks[i]

    out = Image.new("RGBA", (MAP_W * 8, MAP_H * 8), (0, 0, 0, 0))
    op = out.load()
    for idx, e in enumerate(ents):
        if idx >= MAP_W * MAP_H:
            break
        tile = e & 0x3FF
        hflip = (e >> 10) & 1
        vflip = (e >> 11) & 1
        pal = bankmap.get((e >> 12) & 0xF)
        if pal is None or tile >= len(tiles):
            continue  # backdrop-palette tile (drawn by the scene) or out of range
        cell = tiles[tile]
        bx, by = (idx % MAP_W) * 8, (idx // MAP_W) * 8
        for yy in range(8):
            sy = 7 - yy if vflip else yy
            for xx in range(8):
                sx = 7 - xx if hflip else xx
                ci = cell[sy * 8 + sx]
                if ci == 0:
                    continue  # index 0 is transparent
                r, g, b = pal[ci] if ci < len(pal) else (0, 0, 0)
                op[bx + xx, by + yy] = (r, g, b, 255)

    crop = out.crop((0, 0, CROP_W, CROP_H))
    os.makedirs(OUT, exist_ok=True)
    crop.save(os.path.join(OUT, f"{terrain}.png"))
    print(f"[battle] {terrain}: banks={used} -> data/ui/battle/{terrain}.png")
    return True


if __name__ == "__main__":
    terrains = sorted(d for d in os.listdir(SRC) if os.path.isdir(os.path.join(SRC, d)))
    for t in terrains:
        assemble(t)
