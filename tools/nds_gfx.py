#!/usr/bin/env python3
"""
nds_gfx.py — raw NDS 2D graphics decoder (NCLR palettes, NCGR tiles, NSCR
tilemaps) straight from ROM NARC members into PNG. Complements nds_bg_compose.py
(which expects already-decoded pret PNGs+JASC) by decoding the raw binaries the
nds_decomp.py `unpacked/` tree produces.

Formats (all little-endian, generic Nitro RES container: magic, 0xFEFF BOM,
version, filesize, headersize u16, nblocks u16; then blocks each = magic+size):
  NCLR (magic 'RLCN'), PLTT block: 16-bit BGR555 colors. bpp flag at +0x8
    (3=4bpp/16-col banks, 4=8bpp/256).
  NCGR (magic 'RGCN'), CHAR block: h(u16) w(u16 tiles; 0xFFFF=unknown),
    bpp(u32: 3=4bpp,4=8bpp), then flags; tile data at +0x18 of block body.
    8x8 tiles, row-major. 4bpp = 2 px/byte (low nibble first).
  NSCR (magic 'RCSN'), SCRN block: w(u16 px) h(u16 px), then u16 map entries
    (tile# bits0-9, palbank bits12-15, flipH bit10, flipV bit11).

CLI:
  nds_gfx.py pal   IN.nclr OUT.png                  # swatch of every palette
  nds_gfx.py tiles IN.ncgr PAL.nclr OUT.png [--bank N] [--width TILES]
  nds_gfx.py scrn  IN.nscr IN.ncgr PAL.nclr OUT.png # composed BG screen
"""
import sys, struct
from PIL import Image


def _blocks(data):
    """Yield (magic, body_bytes) for each block in a Nitro RES file."""
    nblocks = struct.unpack_from("<H", data, 0x0E)[0]
    off = 0x10
    for _ in range(nblocks):
        magic = data[off:off + 4]
        size = struct.unpack_from("<I", data, off + 4)[0]
        if size == 0:
            break
        yield magic, data[off + 8:off + size]
        off += size


def read_nclr(path):
    """Return list of palettes; each palette = list of (r,g,b) tuples of 16 or 256."""
    data = open(path, "rb").read()
    body = next(b for m, b in _blocks(data) if m in (b"TTLP", b"PLTT"))
    bpp = struct.unpack_from("<I", body, 0)[0]          # 3=4bpp,4=8bpp
    per = 256 if bpp == 4 else 16
    # color data starts at 0x10 of the PLTT body
    raw = body[0x10:]
    cols = []
    for i in range(len(raw) // 2):
        v = struct.unpack_from("<H", raw, i * 2)[0]
        r = (v & 0x1F) << 3; g = ((v >> 5) & 0x1F) << 3; b = ((v >> 10) & 0x1F) << 3
        cols.append((r | r >> 5, g | g >> 5, b | b >> 5))
    return [cols[i:i + per] for i in range(0, len(cols), per)] or [[(0, 0, 0)]]


def read_ncgr(path):
    """Return (tiles, bpp) where tiles is a list of 8x8 index grids."""
    data = open(path, "rb").read()
    body = next(b for m, b in _blocks(data) if m in (b"RAHC", b"CHAR"))
    h_t, w_t = struct.unpack_from("<HH", body, 0)
    bpp_flag = struct.unpack_from("<I", body, 4)[0]     # 3=4bpp,4=8bpp
    bpp = 8 if bpp_flag == 4 else 4
    # CHAR header is 0x18 bytes; the u32 at +0x10 is the tile-data *size*,
    # not an offset. Pixel data always begins at 0x18 of the block body.
    raw = body[0x18:]
    tiles = []
    if bpp == 4:
        per_tile = 32
        n = len(raw) // per_tile
        for t in range(n):
            b = raw[t * per_tile:(t + 1) * per_tile]
            grid = [[0] * 8 for _ in range(8)]
            for i, byte in enumerate(b):
                grid[(i * 2) // 8][(i * 2) % 8] = byte & 0xF
                grid[(i * 2 + 1) // 8][(i * 2 + 1) % 8] = byte >> 4
            tiles.append(grid)
    else:
        per_tile = 64
        n = len(raw) // per_tile
        for t in range(n):
            b = raw[t * per_tile:(t + 1) * per_tile]
            tiles.append([[b[y * 8 + x] for x in range(8)] for y in range(8)])
    return tiles, bpp


def _tile_img(tiles, pal, cols_per_row):
    n = len(tiles)
    rows = (n + cols_per_row - 1) // cols_per_row
    im = Image.new("RGBA", (cols_per_row * 8, rows * 8), (0, 0, 0, 0))
    px = im.load()
    for t, grid in enumerate(tiles):
        ox, oy = (t % cols_per_row) * 8, (t // cols_per_row) * 8
        for y in range(8):
            for x in range(8):
                idx = grid[y][x]
                if idx == 0:
                    continue  # index 0 = transparent (NDS convention)
                c = pal[idx] if idx < len(pal) else (255, 0, 255)
                px[ox + x, oy + y] = (c[0], c[1], c[2], 255)
    return im


def read_nscr(path):
    data = open(path, "rb").read()
    body = next(b for m, b in _blocks(data) if m in (b"NRCS", b"SCRN"))
    w, h = struct.unpack_from("<HH", body, 0)
    entries = body[0x0C:]
    return w, h, entries


def compose_scrn(nscr, ncgr, nclr, out):
    w, h, entries = read_nscr(nscr)
    tiles, bpp = read_ncgr(ncgr)
    pals = read_nclr(nclr)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = im.load()
    tw = w // 8
    for i in range(len(entries) // 2):
        v = struct.unpack_from("<H", entries, i * 2)[0]
        tnum = v & 0x3FF; flipH = (v >> 10) & 1; flipV = (v >> 11) & 1
        bank = (v >> 12) & 0xF
        if tnum >= len(tiles):
            continue
        grid = tiles[tnum]
        pal = pals[bank] if bank < len(pals) else pals[0]
        ox, oy = (i % tw) * 8, (i // tw) * 8
        for y in range(8):
            for x in range(8):
                sx = 7 - x if flipH else x; sy = 7 - y if flipV else y
                idx = grid[sy][sx]
                if idx == 0:
                    continue
                c = pal[idx] if idx < len(pal) else (255, 0, 255)
                px[ox + x, oy + y] = (c[0], c[1], c[2], 255)
    im.save(out)
    print(f"wrote {out} ({w}x{h})")


OBJ_SIZE = {  # (shape,size) -> (w,h) in 8px tiles
    (0, 0): (1, 1), (0, 1): (2, 2), (0, 2): (4, 4), (0, 3): (8, 8),
    (1, 0): (2, 1), (1, 1): (4, 1), (1, 2): (4, 2), (1, 3): (8, 4),
    (2, 0): (1, 2), (2, 1): (1, 4), (2, 2): (2, 4), (2, 3): (4, 8),
}


def read_ncer(path):
    """Return list of cells; each cell = list of OAM dicts (x,y,w,h,tile,pal,flipH,flipV)."""
    data = open(path, "rb").read()
    body = next(b for m, b in _blocks(data) if m in (b"KBEC", b"CEBK"))
    nBanks, bankType = struct.unpack_from("<HH", body, 0)
    bankDataOff = struct.unpack_from("<I", body, 4)[0]
    cell_sz = 16 if bankType == 1 else 8
    cells = []
    oam_base = 8 + bankDataOff  # OAM offsets are relative to end of the KBEC sub-header
    for i in range(nBanks):
        nOAM, _attr, oamOff = struct.unpack_from("<HHI", body, 8 + i * cell_sz)
        oams = []
        for j in range(nOAM):
            o = 8 + bankDataOff + oamOff + j * 6
            a0, a1, a2 = struct.unpack_from("<HHH", body, o)
            y = a0 & 0xFF; y = y - 256 if y >= 128 else y
            shape = (a0 >> 14) & 3
            x = a1 & 0x1FF; x = x - 512 if x >= 256 else x
            flipH = (a1 >> 12) & 1; flipV = (a1 >> 13) & 1; size = (a1 >> 14) & 3
            tile = a2 & 0x3FF; pal = (a2 >> 12) & 0xF
            w, h = OBJ_SIZE.get((shape, size), (1, 1))
            oams.append(dict(x=x, y=y, w=w, h=h, tile=tile, pal=pal, flipH=flipH, flipV=flipV))
        cells.append(oams)
    return cells


def build_cell(oams, tiles, pals, forced_pal=None):
    """Composite one NCER cell (OAM list) into an RGBA image."""
    xs = [o["x"] for o in oams] + [o["x"] + o["w"] * 8 for o in oams]
    ys = [o["y"] for o in oams] + [o["y"] + o["h"] * 8 for o in oams]
    minx, miny = min(xs), min(ys)
    im = Image.new("RGBA", (max(xs) - minx, max(ys) - miny), (0, 0, 0, 0))
    px = im.load()
    for o in oams:
        pal = pals[forced_pal if forced_pal is not None else o["pal"]]
        t = o["tile"]
        for ty in range(o["h"]):
            for tx in range(o["w"]):
                grid = tiles[t] if t < len(tiles) else None; t += 1
                if grid is None:
                    continue
                for yy in range(8):
                    for xx in range(8):
                        sx = 7 - xx if o["flipH"] else xx
                        sy = 7 - yy if o["flipV"] else yy
                        idx = grid[sy][sx]
                        if idx == 0:
                            continue
                        c = pal[idx] if idx < len(pal) else (255, 0, 255)
                        ox = o["x"] - minx + (o["w"] - 1 - tx if o["flipH"] else tx) * 8 + xx
                        oy = o["y"] - miny + (o["h"] - 1 - ty if o["flipV"] else ty) * 8 + yy
                        if 0 <= ox < im.width and 0 <= oy < im.height:
                            px[ox, oy] = (c[0], c[1], c[2], 255)
    return im


def main():
    a = sys.argv
    if a[1] == "pal":
        pals = read_nclr(a[2])
        sw = 12
        im = Image.new("RGB", (16 * sw, len(pals) * sw), (30, 30, 30))
        px = im.load()
        for pi, p in enumerate(pals):
            for ci, c in enumerate(p[:16]):
                for y in range(sw):
                    for x in range(sw):
                        px[ci * sw + x, pi * sw + y] = c
        im.save(a[3]); print(f"wrote {a[3]} ({len(pals)} pals)")
    elif a[1] == "tiles":
        bank = int(a[a.index("--bank") + 1]) if "--bank" in a else 0
        width = int(a[a.index("--width") + 1]) if "--width" in a else 16
        tiles, bpp = read_ncgr(a[2]); pals = read_nclr(a[3])
        pal = pals[bank] if bank < len(pals) else pals[0]
        _tile_img(tiles, pal, width).save(a[4])
        print(f"wrote {a[4]} ({len(tiles)} tiles, {bpp}bpp, bank {bank})")
    elif a[1] == "scrn":
        compose_scrn(a[2], a[3], a[4], a[5])
    else:
        print(__doc__); sys.exit(1)


if __name__ == "__main__":
    main()
