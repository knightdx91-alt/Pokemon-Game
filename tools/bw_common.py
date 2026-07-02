#!/usr/bin/env python3
"""
bw_common.py — Shared helpers for converting Pokémon Black (BW) map data into
this game's 2D browser formats.

Unlike Platinum, there is no decomp source tree for Black/White reachable from
this environment — everything here was reverse-engineered directly from the
raw ROM NARCs extracted by tools/nds_decomp.py (see source/nds/IRBO/unpacked/).
Treat every offset below as a working hypothesis, empirically validated by
rendering the collision grid and eyeballing it for map-shaped output (see
tools/render_bw_landcell_preview.py) — NOT as a documented spec the way
tools/platinum_common.py's offsets are.

Container format ("WB" land-data cell, a/0/0/8/<NNNN>.bin):
    offset 0   "WB"           magic
    offset 2   u16            version (observed: 3)
    offset 4   u32 modelOff   offset of the embedded BMD0 model (Nitro G3D,
                               decodable by tools/nitro_g3d.py)
    offset 8   u32 gridOff    offset of the 32x32 per-tile grid block
    offset 12  u32 tailOff    offset of a small trailing block (observed
                               "count(u32) + count*16 bytes" — likely object/
                               prop placements; NOT yet decoded)
    offset 16  u32 fileSize   total file size (sanity check)
    [modelOff:gridOff]   BMD0 model bytes
    [gridOff:tailOff]    grid block: u16 width, u16 height, then width*height
                          8-byte tile records (+ a handful of trailing records
                          that don't fit width*height exactly — cause unknown,
                          currently just ignored)
    [tailOff:fileSize]   tail block: u32 count, then count 16-byte records

Tile record (8 bytes, 4x u16 LE): (field0, field1, field2, field3)
    field0, field1: appearance-related (texture/variant ids) — NOT decoded
                    (no texture/area-data archive identified yet), so the
                    converter currently ignores them and uses a flat
                    placeholder tileset.
    field3 low byte  (byte6): bit0 = collision (1 = blocked). Validated by
                    rendering it for several land-cells and getting
                    recognizable map shapes (building footprints, route
                    paths, cave layouts) — see the scratch renders from the
                    investigation session.
    field3 high byte (byte7): bit7 (0x80) set marks a "special" tile
                    (observed on a handful of tiles per map, consistent with
                    warp/door placement) but the destination/target data has
                    NOT been located — these render as a distinct placeholder
                    tile and are NOT wired up as functional warps yet.

Map matrix (a/0/0/9/<NNNN>.bin):
    offset 0  u16 unk0, u16 unk1, u16 width, u16 height
    then width*height cell records (8 bytes, 4x u16 LE):
        field0/field2: land-data cell index (a/0/0/8 member) — mostly equal,
                       diverge at map-seam cells (adjacent land-cells);
                       0xFFFF = empty cell
        field1/field3: 0 if the cell is occupied, 0xFFFF if empty (redundant
                       occupancy flag)
    NOTE: stitching matrix cells by (row, col) into a single contiguous
    playable region did NOT produce coherent overworld geography when tried
    (see investigation notes) — the matrix looks more like a bookkeeping grid
    mixing interior and exterior land-cells than a literal world map. Treat
    each land-cell as an independent standalone map for now; do not assume
    matrix adjacency implies walkable adjacency.

Zone headers (a/0/1/2, single member, 427 records x 48 bytes) — the BW
equivalent of Platinum's sMapHeaders[]. Decoded fields (u16 LE unless noted;
offsets within each 48-byte record):
    off  2  u16  texture-set id   -> a/0/1/4/<id>.nsbtx  (282 sets)
    off  4  u16  matrix id        -> a/0/0/9/<id>.bin    (255 matrices)
    off  6  u16  \  per-zone script/text archive indices (unique per zone,
    off  8  u16  /  off8 == off6+1 in every record — consecutive pairs)
    off 10  u16  another per-zone archive index (unique per zone; candidate
                 for the events archive — untested)
    off 12..18  4x u16  music ids ~1001..1170 (four SEASONAL variants —
                 BW has spring/summer/autumn/winter)
    off 22  u16  the zone's own id (== record index)
    off 24  u16  parent zone id (93 distinct — city a zone's interiors
                 belong to)
    off 26  u8   location-name id -> text bank 89 (117 names)
VALIDATED end-to-end: zone 389 = matrix 0 + texset 2 + name "Nuvema Town";
its interiors (zones 390-395) = dedicated matrices 35-40 + interior texset
212. Rendering land-cell 0's BMD0 with texset 2 through the (unchanged!)
Platinum rasterizer (render_platinum_maps.rasterize_triangle et al.)
produced a pixel-real Nuvema Town terrain render — geometry, texture
lookup, palette binding all correct. Land-cell BMD0s are geometry-only
(MDL0, no TEX0), same split as Platinum.

This also explains the earlier "matrix stitching looks incoherent" note:
matrix 0 is the one real contiguous Unova overworld; most of the other 254
matrices are small dedicated interior matrices (houses/labs/gates), so
stitching an arbitrary matrix was never going to look like an overworld.

What's still unknown (see CLAUDE.md task list for this investigation):
    - warp destination data (target map / coordinates); zone header off 10
      (or the off6/off8 pair) likely points at the events archive — untested
    - NPC / scripted event placement (same lead as above)
    - prop placement (the WB tail block's 16-byte records) + prop model
      archive -> buildings/trees are missing from textured renders
    - the GC/NG/RD-magic land-cells (~266 of 649)
"""

import os
import struct

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(TOOLS_DIR)
IRBO_ROOT = os.path.join(REPO_ROOT, "source", "nds", "IRBO", "unpacked")

LAND_NARC = os.path.join(IRBO_ROOT, "a", "0", "0", "8")
MATRIX_NARC = os.path.join(IRBO_ROOT, "a", "0", "0", "9")
ZONE_HEADER_FILE = os.path.join(IRBO_ROOT, "a", "0", "1", "2", "0000.bin")
TEXSET_NARC = os.path.join(IRBO_ROOT, "a", "0", "1", "4")

ZONE_RECORD_SIZE = 48
TEXT_LOCATION_NAMES = 89  # a/0/0/2 member holding the 117 location names

TILE_GRID_SIZE = 32   # width/height observed on every land-cell so far
COLLISION_BIT = 0x01  # field3 low byte, bit 0
SPECIAL_BIT = 0x8000  # field3, bit 15 (high byte bit 7) -> warp/door candidate


def land_cell_count():
    return len(os.listdir(LAND_NARC))


def matrix_count():
    return len(os.listdir(MATRIX_NARC))


def load_land_cell(index):
    """
    Parse a/0/0/8/<index>.bin. Returns dict with:
      width, height       : grid dims (observed always 32x32)
      collision           : list[width*height] of 0/1 (1 = blocked)
      special              : list[width*height] of 0/1 ("warp-like" marker,
                              function not yet confirmed)
      raw_records          : the full list of (field0,field1,field2,field3)
                              tuples, in case downstream code wants the
                              unclassified appearance fields
      model_bytes           : the embedded BMD0 model, raw bytes (for
                              tools/nitro_g3d.py)
    """
    path = os.path.join(LAND_NARC, f"{index:04d}.bin")
    d = open(path, "rb").read()
    if d[0:2] != b"WB":
        raise ValueError(f"land-cell {index}: bad magic {d[0:2]!r}")
    model_off, grid_off, tail_off = struct.unpack_from("<3I", d, 4)

    grid_block = d[grid_off:tail_off]
    w, h = struct.unpack_from("<2H", grid_block, 0)
    rest = grid_block[4:]
    n = min(w * h, len(rest) // 8)
    records = [struct.unpack_from("<4H", rest, i * 8) for i in range(n)]

    collision = [1 if (r[3] & COLLISION_BIT) else 0 for r in records]
    special = [1 if (r[3] & SPECIAL_BIT) else 0 for r in records]

    return {
        "index": index,
        "width": w,
        "height": h,
        "collision": collision,
        "special": special,
        "raw_records": records,
        "model_bytes": d[model_off:grid_off],
    }


def load_matrix(index):
    """
    Parse a/0/0/9/<index>.bin. Returns dict with:
      width, height
      cells: list[width*height] of {land_index, occupied} (land_index=None
             for empty cells)
    """
    path = os.path.join(MATRIX_NARC, f"{index:04d}.bin")
    d = open(path, "rb").read()
    if len(d) < 8:
        return {"width": 0, "height": 0, "cells": []}
    _unk0, _unk1, w, h = struct.unpack_from("<4H", d, 0)
    rest = d[8:]
    n = min(w * h, len(rest) // 8)
    cells = []
    for i in range(n):
        f0, f1, f2, f3 = struct.unpack_from("<4H", rest, i * 8)
        land_index = f2 if f2 != 0xFFFF else (f0 if f0 != 0xFFFF else None)
        cells.append({"land_index": land_index, "occupied": land_index is not None})
    return {"width": w, "height": h, "cells": cells}


def load_zone_headers():
    """
    Parse a/0/1/2 (427 zone-header records; see module docstring for the
    decoded field map). Returns list of dicts, index == zone id.
    """
    d = open(ZONE_HEADER_FILE, "rb").read()
    n = len(d) // ZONE_RECORD_SIZE
    zones = []
    for i in range(n):
        rec = d[i * ZONE_RECORD_SIZE:(i + 1) * ZONE_RECORD_SIZE]
        zones.append({
            "zone": i,
            "texset": struct.unpack_from("<H", rec, 2)[0],
            "matrix": struct.unpack_from("<H", rec, 4)[0],
            "script_a": struct.unpack_from("<H", rec, 6)[0],
            "script_b": struct.unpack_from("<H", rec, 8)[0],
            "archive_c": struct.unpack_from("<H", rec, 10)[0],
            "music_seasons": list(struct.unpack_from("<4H", rec, 12)),
            "parent_zone": struct.unpack_from("<H", rec, 24)[0],
            "name_id": rec[26],
        })
    return zones


def load_location_names():
    """The 117 location names from text bank 89 (needs tools/rom_to_2d.py)."""
    import rom_to_2d as r2d
    from pathlib import Path
    return r2d.load_text(Path(IRBO_ROOT), TEXT_LOCATION_NAMES)


if __name__ == "__main__":
    print(f"land cells: {land_cell_count()}, matrices: {matrix_count()}")
    for i in (0, 1, 10):
        c = load_land_cell(i)
        blocked = sum(c["collision"])
        specials = sum(c["special"])
        print(f"  land-cell {i}: {c['width']}x{c['height']}, "
              f"blocked={blocked}/{len(c['collision'])}, special={specials}")
    zones = load_zone_headers()
    names = load_location_names()
    print(f"zones: {len(zones)}")
    for z in zones[:3] + [zones[389]]:
        nm = names[z["name_id"]] if z["name_id"] < len(names) else "?"
        print(f"  zone {z['zone']}: matrix={z['matrix']} texset={z['texset']} name={nm!r}")
