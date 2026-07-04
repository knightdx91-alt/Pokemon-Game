#!/usr/bin/env python3
"""Decode DS 2D UI graphics (NCLR/NCGR/NSCR) from Pokemon Platinum NARC members
into exact PNGs. Used to reconstruct the game's real menu/UI screens (party,
Poketch, PC box, bag, ...) pixel-for-pixel from the ROM's own asset layers —
NOT approximations.

Formats (little-endian; each file: generic NNS header then chunks):
  NCLR "RLCN": PLTT chunk -> BGR555 u16 colors. bitDepth 3=16col, 4=256col.
  NCGR "RGCN": CHAR chunk -> 8x8 tiles, 4bpp (32 B/tile) or 8bpp (64 B/tile).
  NSCR "RCSN": SCRN chunk -> u16 map entries: tile(0-9) hflip(10) vflip(11) pal(12-15).

This mirrors the role platinum_common/nitro_g3d play for maps, but for 2D BG/OBJ.
"""
import struct, sys, os
from PIL import Image


def _chunks(data):
    """Yield (magic, payload) for each chunk after the 0x10-byte NNS header."""
    n_chunks = struct.unpack_from('<H', data, 0x0E)[0]
    off = 0x10
    for _ in range(n_chunks):
        magic = data[off:off + 4]
        size = struct.unpack_from('<I', data, off + 4)[0]
        if size == 0:
            break
        yield magic, data[off + 8:off + size]
        off += size


def load_nclr(path):
    """Return list of palettes, each a list of (r,g,b,a) with index 0 transparent."""
    data = open(path, 'rb').read()
    pltt = None
    for magic, payload in _chunks(data):
        if magic == b'TTLP':  # 'PLTT' reversed
            pltt = payload
            break
    if pltt is None:
        raise ValueError('no PLTT in ' + path)
    bit_depth = struct.unpack_from('<I', pltt, 0)[0]  # 3=16col,4=256col
    per_pal = 16 if bit_depth == 3 else 256
    data_off = struct.unpack_from('<I', pltt, 0x0C)[0]
    # data_off is offset from start of PLTT data section; colors follow.
    coldata = pltt[0x10:] if data_off in (0x10, 0) else pltt[0x10:]
    ncolors = len(coldata) // 2
    cols = []
    for i in range(ncolors):
        v = struct.unpack_from('<H', coldata, i * 2)[0]
        r = (v & 0x1F) << 3
        g = ((v >> 5) & 0x1F) << 3
        b = ((v >> 10) & 0x1F) << 3
        r |= r >> 5; g |= g >> 5; b |= b >> 5
        cols.append((r, g, b, 255))
    pals = []
    for p in range(0, max(1, ncolors // per_pal)):
        sub = cols[p * per_pal:(p + 1) * per_pal]
        if sub:
            sub[0] = (sub[0][0], sub[0][1], sub[0][2], 0)  # index 0 transparent
            pals.append(sub)
    return pals, per_pal


def load_ncgr(path):
    """Return (tiles, bpp) where tiles is a list of 8x8 index arrays (64 ints)."""
    data = open(path, 'rb').read()
    char = None
    for magic, payload in _chunks(data):
        if magic == b'RAHC':  # 'CHAR'
            char = payload
            break
    if char is None:
        raise ValueError('no CHAR in ' + path)
    bit_depth = struct.unpack_from('<I', char, 0x04)[0]  # 3=4bpp,4=8bpp
    bpp = 4 if bit_depth == 3 else 8
    data_size = struct.unpack_from('<I', char, 0x0C)[0]
    data_off = struct.unpack_from('<I', char, 0x10)[0]
    pix = char[0x10 + (data_off - 0x18 if data_off >= 0x18 else 0):]
    pix = char[0x10:]  # tile data starts right after the 0x10-byte CHAR header body
    tiles = []
    if bpp == 4:
        tsize = 32
        for t in range(len(pix) // tsize):
            base = t * tsize
            idx = []
            for by in pix[base:base + tsize]:
                idx.append(by & 0x0F)
                idx.append((by >> 4) & 0x0F)
            tiles.append(idx)
    else:
        tsize = 64
        for t in range(len(pix) // tsize):
            base = t * tsize
            tiles.append(list(pix[base:base + tsize]))
    return tiles, bpp


def load_nscr(path):
    """Return (width_px, height_px, entries) where each entry=(tile,hflip,vflip,pal)."""
    data = open(path, 'rb').read()
    scrn = None
    for magic, payload in _chunks(data):
        if magic == b'NRCS':  # 'SCRN'
            scrn = payload
            break
    if scrn is None:
        raise ValueError('no SCRN in ' + path)
    w = struct.unpack_from('<H', scrn, 0)[0]
    h = struct.unpack_from('<H', scrn, 2)[0]
    data_size = struct.unpack_from('<I', scrn, 8)[0]
    md = scrn[0x0C:0x0C + data_size]
    entries = []
    for i in range(len(md) // 2):
        v = struct.unpack_from('<H', md, i * 2)[0]
        entries.append((v & 0x3FF, (v >> 10) & 1, (v >> 11) & 1, (v >> 12) & 0xF))
    return w, h, entries


def render_tile(img, px, py, tile, bpp, pal, hflip, vflip):
    for y in range(8):
        sy = 7 - y if vflip else y
        for x in range(8):
            sx = 7 - x if hflip else x
            ci = tile[sy * 8 + sx]
            if bpp == 4:
                color = pal[ci] if ci < len(pal) else (0, 0, 0, 0)
            else:
                color = pal[ci] if ci < len(pal) else (0, 0, 0, 0)
            if ci == 0:
                continue  # transparent
            img.putpixel((px + x, py + y), color)


def render_nscr(nscr_path, ncgr_path, nclr_path, out_path):
    w, h, entries = load_nscr(nscr_path)
    tiles, bpp = load_ncgr(ncgr_path)
    pals, per_pal = load_nclr(nclr_path)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    tiles_x = w // 8
    for i, (tid, hf, vf, palnum) in enumerate(entries):
        if tid >= len(tiles):
            continue
        pal = pals[palnum] if palnum < len(pals) else pals[0]
        cx = (i % tiles_x) * 8
        cy = (i // tiles_x) * 8
        render_tile(img, cx, cy, tiles[tid], bpp, pal, hf, vf)
    img.save(out_path)
    return w, h, len(entries), len(tiles), bpp, len(pals)


def dump_ncgr_sheet(ncgr_path, nclr_path, out_path, cols=16, palnum=0):
    tiles, bpp = load_ncgr(ncgr_path)
    pals, per_pal = load_nclr(nclr_path)
    pal = pals[palnum] if palnum < len(pals) else pals[0]
    rows = (len(tiles) + cols - 1) // cols
    img = Image.new('RGBA', (cols * 8, rows * 8), (40, 40, 48, 255))
    for t, tile in enumerate(tiles):
        cx = (t % cols) * 8
        cy = (t // cols) * 8
        render_tile(img, cx, cy, tile, bpp, pal, 0, 0)
    img.save(out_path)
    return len(tiles), bpp


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'nscr':
        print(render_nscr(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]))
    elif cmd == 'sheet':
        pn = int(sys.argv[5]) if len(sys.argv) > 5 else 0
        print(dump_ncgr_sheet(sys.argv[2], sys.argv[3], sys.argv[4], palnum=pn))
    else:
        print('usage: nscr <nscr> <ncgr> <nclr> <out.png> | sheet <ncgr> <nclr> <out.png> [pal]')
