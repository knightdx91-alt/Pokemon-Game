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

What's still unknown (see CLAUDE.md task list for this investigation):
    - warp destination data (target map / coordinates)
    - NPC / scripted event placement
    - land-cell index -> human map name (text bank 89 is only the coarse
      117-entry Town Map region list, not a 1:1 per-land-cell name table)
    - texture/area data for real 3D->2D rendering (Platinum's
      render_platinum_maps.py equivalent)
"""

import os
import struct

TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(TOOLS_DIR)
IRBO_ROOT = os.path.join(REPO_ROOT, "source", "nds", "IRBO", "unpacked")

LAND_NARC = os.path.join(IRBO_ROOT, "a", "0", "0", "8")
MATRIX_NARC = os.path.join(IRBO_ROOT, "a", "0", "0", "9")

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


if __name__ == "__main__":
    print(f"land cells: {land_cell_count()}, matrices: {matrix_count()}")
    for i in (0, 1, 10):
        c = load_land_cell(i)
        blocked = sum(c["collision"])
        specials = sum(c["special"])
        print(f"  land-cell {i}: {c['width']}x{c['height']}, "
              f"blocked={blocked}/{len(c['collision'])}, special={specials}")
