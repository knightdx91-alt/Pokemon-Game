#!/usr/bin/env python3
"""Composite an NDS 2D BG screen (NSCR tilemap + tile PNG + JASC .pal) into a PNG.
Standalone tool for pret-decomp resource trees (pokeplatinum res/graphics/*).
"""
import sys, struct
from PIL import Image

def load_jasc_pal(path):
    with open(path) as f:
        lines = [l.strip() for l in f]
    assert lines[0] == 'JASC-PAL'
    n = int(lines[2])
    out = []
    for i in range(n):
        r, g, b = map(int, lines[3 + i].split())
        out.append((r, g, b))
    return out

def load_tiles(path):
    im = Image.open(path)
    is_l = im.mode == 'L'
    assert im.mode == 'P' or is_l, f'{path} is {im.mode}, expected P or L (indexed)'
    w, h = im.size
    tw, th = w // 8, h // 8
    px = im.load()
    def idx(v): return (v // 17) if is_l else v
    tiles = []
    for ty in range(th):
        for tx in range(tw):
            tile = [[idx(px[tx*8+x, ty*8+y]) for x in range(8)] for y in range(8)]
            tiles.append(tile)
    return tiles

def parse_nscr(path):
    with open(path, 'rb') as f:
        data = f.read()
    assert data[0:4] == b'RCSN', 'bad NSCR magic'
    # header: magic(4) bom(2) ver(2) filesize(4) headersize(2) numblocks(2)
    off = 0x10
    assert data[off:off+4] == b'NRCS'
    sect_size = struct.unpack_from('<I', data, off+4)[0]
    screen_w, screen_h = struct.unpack_from('<HH', data, off+8)
    # off+12: u32 bg-type/padding
    screen_data_size = struct.unpack_from('<I', data, off+16)[0]
    entries_off = off + 20
    n = screen_data_size // 2
    entries = []
    for i in range(n):
        v = struct.unpack_from('<H', data, entries_off + i*2)[0]
        entries.append({
            'tile': v & 0x3FF,
            'hflip': bool((v >> 10) & 1),
            'vflip': bool((v >> 11) & 1),
            'pal': (v >> 12) & 0xF,
        })
    return screen_w, screen_h, entries

def compose(tiles_png, pal_file, nscr_file, out_png):
    pal = load_jasc_pal(pal_file)
    tiles = load_tiles(tiles_png)
    sw, sh, entries = parse_nscr(nscr_file)
    tw, th = sw // 8, sh // 8
    out = Image.new('RGBA', (sw, sh))
    opx = out.load()
    for i, e in enumerate(entries):
        mx, my = i % tw, i // tw
        if e['tile'] >= len(tiles):
            continue
        tile = tiles[e['tile']]
        for y in range(8):
            for x in range(8):
                sx = 7 - x if e['hflip'] else x
                sy = 7 - y if e['vflip'] else y
                idx = tile[sy][sx]
                palidx = e['pal'] * 16 + idx
                if palidx >= len(pal):
                    color = (255, 0, 255, 255)
                else:
                    r, g, b = pal[palidx]
                    a = 0 if idx == 0 else 255  # index 0 of each sub-pal = transparent
                    color = (r, g, b, a)
                opx[mx*8 + x, my*8 + y] = color
    out.save(out_png)
    print(f'{out_png}: {sw}x{sh}')

if __name__ == '__main__':
    if len(sys.argv) != 5:
        print('usage: nds_bg_compose.py tiles.png pal.pal map.NSCR out.png')
        sys.exit(1)
    compose(*sys.argv[1:])
