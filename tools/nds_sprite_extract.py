#!/usr/bin/env python3
"""Extract individual OAM-cell sprites from a pret-decomp NDS sprite sheet PNG
using its _cell.json (tile/shape/palette info) + a JASC .pal palette.
Assumes: simple single-OAM cells, tiles stored as a linear 1D array reshaped
at the sheet's own pixel width (standard pret nitrogfx/graphics convention).
"""
import sys, json
from PIL import Image

# GBA/NDS OBJ shape+size -> (width_tiles, height_tiles)
SIZE_TABLE = {
    (0,0):(1,1), (0,1):(2,1), (0,2):(4,1), (0,3):(4,2),  # wait fixed below
}
# Correct OBJ size table (Shape, Size) -> (w,h) in 8px tiles
OBJ_SIZE = {
    (0,0):(1,1), (0,1):(2,2), (0,2):(4,4), (0,3):(8,8),   # square
    (1,0):(2,1), (1,1):(4,1), (1,2):(4,2), (1,3):(8,4),   # wide
    (2,0):(1,2), (2,1):(1,4), (2,2):(2,4), (2,3):(4,8),   # tall
}

def load_jasc_pal(path):
    with open(path) as f:
        lines = [l.strip() for l in f]
    n = int(lines[2])
    return [tuple(map(int, lines[3+i].split())) for i in range(n)]

def load_linear_tiles(png_path):
    im = Image.open(png_path)
    is_l = im.mode == 'L'
    assert im.mode == 'P' or is_l, f'{png_path} mode={im.mode}'
    w, h = im.size
    tpr = w // 8  # tiles per row in the sheet
    px = im.load()
    def idx(v): return (v // 17) if is_l else v
    tiles = []
    for ty in range(h // 8):
        for tx in range(tpr):
            tiles.append([[idx(px[tx*8+x, ty*8+y]) for x in range(8)] for y in range(8)])
    return tiles

def render_cell(tiles, cell, pal):
    oam = cell['OAM'][0]
    shape = oam['Attr0']['Shape']
    size = oam['Attr1']['Size']
    wt, ht = OBJ_SIZE[(shape, size)]
    char = oam['Attr2']['CharName']
    palnum = oam['Attr2']['Palette']
    colours16 = oam['Attr0']['Colours'] == 16
    out = Image.new('RGBA', (wt*8, ht*8))
    opx = out.load()
    for ti in range(wt*ht):
        idx = char + ti
        if idx >= len(tiles):
            continue
        tile = tiles[idx]
        gx, gy = ti % wt, ti // wt
        for y in range(8):
            for x in range(8):
                v = tile[y][x]
                if colours16:
                    palidx = palnum*16 + v
                else:
                    palidx = v
                if palidx >= len(pal) or v == 0:
                    color = (0,0,0,0)
                else:
                    r,g,b = pal[palidx]
                    color = (r,g,b,255)
                opx[gx*8+x, gy*8+y] = color
    return out

def extract_all(png_path, cell_json_path, pal_path, out_prefix):
    tiles = load_linear_tiles(png_path)
    pal = load_jasc_pal(pal_path)
    cells = json.load(open(cell_json_path))['cells']
    for i, cell in enumerate(cells):
        img = render_cell(tiles, cell, pal)
        img.save(f'{out_prefix}_{i}.png')
    print(f'{out_prefix}: {len(cells)} cells extracted')

if __name__ == '__main__':
    if len(sys.argv) != 5:
        print('usage: nds_sprite_extract.py sheet.png sheet_cell.json sheet.pal out_prefix')
        sys.exit(1)
    extract_all(*sys.argv[1:])
