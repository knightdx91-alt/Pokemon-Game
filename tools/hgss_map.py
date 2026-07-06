#!/usr/bin/env python3
"""
hgss_map.py — Pokémon HeartGold (IPKE) field-map parser.

All format facts below were reverse-engineered from the user's ROM extraction
(source/nds/IPKE, produced by nds_decomp.py) and verified by rendering + by the
matrix header-id cross-check (New Bark = header 60, matrix cell (23,12), land 0,
flanked by Route 29 west / Route 27 east — exactly its real geography).

KEY ARCHIVES
  fielddata/maptable/mapname.bin      540 x 16-byte ASCII internal map names
                                      (index = map header id; New Bark "T20"=60)
  a/0/4/1  (288)  map matrices        member 0 = 47x17 Johto/Kanto overworld
  a/0/6/5  (676)  overworld land cells (the matrix-0 land space)
  a/0/4/4  (288)  area texture sets (NSBTX) — terrain textures
  fielddata/build_model/bm_field.narc (340) building/prop models (embedded TEX0)
  fielddata/build_model/bm_room.narc  interior room models

MATRIX FORMAT (a/0/4/1/<id>.bin)
  u8 width, u8 height, u8 f1, u8 f2, then, for n=w*h cells:
    [n x u16 header-id][n x u8 altitude][n x u16 land-cell-id]
  (offsets: headers@4, altitude@4+2n, land@4+3n)

LAND-CELL FORMAT (a/0/6/5/<land>.bin)
  u32 size[4] = (permSize, buildSize, modelSize, bdhcSize), then those 4 sections:
    perm  : 32x32 u16 movement-permission grid  (permSize == 2048)
    build : building placements (see parse_buildings)
    model : NSBMD terrain model (geometry only; textures come from an a/0/4/4 set)
    bdhc  : terrain height data

COLLISION: a permission u16 is BLOCKED unless it is in WALKABLE below (grass /
  path / ledge variants). 0x8000 = trees/edges (blocked); rare values = signs /
  building footprints (blocked). Verified against New Bark's render.

BUILDINGS: after a run of 0x8006 filler the build section holds 48-byte records:
  u32 modelId (into bm_field), fx32 x,y,z (/4096, world units, 1 tile = 16u),
  then two u32, fx32 scale x,y,z, padding. Rotation is identity for New Bark.
"""
import os, struct, sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "source", "nds", "IPKE")
WALKABLE = {0x0000, 0x0001, 0x0002, 0x0003, 0x0400, 0x8006}


def rip(p):
    return open(os.path.join(ROOT, p), "rb").read()


def map_names():
    d = open(os.path.join(ROOT, "files/fielddata/maptable/mapname.bin"), "rb").read()
    return [d[i*16:i*16+16].split(b"\0")[0].decode("ascii", "replace")
            for i in range(len(d)//16)]


def load_matrix(idx):
    d = rip(f"unpacked/a/0/4/1/{idx:04d}.bin")
    w, h = d[0], d[1]
    n = w*h
    headers = struct.unpack_from(f"<{n}H", d, 4)
    land = struct.unpack_from(f"<{n}H", d, 4 + 3*n)
    return {"w": w, "h": h, "headers": headers, "land": land}


def find_map_cell(name):
    """Return (matrix_idx, col, row, land_id) for an internal map code in matrix 0."""
    names = map_names()
    hid = names.index(name)
    m = load_matrix(0)
    for i, h in enumerate(m["headers"]):
        if h == hid:
            return (0, i % m["w"], i // m["w"], m["land"][i], hid)
    return None


def parse_buildings(sec):
    """Building placements are 48-byte slots (u32 modelId, fx32 x/y/z, ...,
    fx32 scale x/y/z). Empty slots hold markers (0x8006/0x0015/0x8000) and the
    real records start at a per-cell alignment; scan all 48-byte alignments and
    keep the one yielding the most valid records (0 < modelId < 340, plausible
    position). See tools/collect_region_3d.py for the same logic."""
    def extract(start):
        out = []
        k = start
        while k + 48 <= len(sec):
            mid = struct.unpack_from("<I", sec, k)[0]
            x, y, z = (struct.unpack_from("<i", sec, k + o)[0] / 4096.0 for o in (4, 8, 12))
            sx, sy, sz = (struct.unpack_from("<i", sec, k + o)[0] / 4096.0 for o in (24, 28, 32))
            if 0 < mid < 340 and abs(x) < 2000 and abs(z) < 2000 and abs(y) < 400:
                out.append({"model": mid, "x": x, "y": y, "z": z,
                            "sx": sx or 1.0, "sy": sy or 1.0, "sz": sz or 1.0})
            k += 48
        return out

    best = []
    for start in range(0, 48, 4):
        recs = extract(start)
        if len(recs) > len(best):
            best = recs
    return best


def load_land(land_id, sub="a/0/6/5"):
    d = rip(f"unpacked/{sub}/{land_id:04d}.bin")
    sizes = struct.unpack_from("<4I", d, 0)
    off = 16
    perm = d[off:off+sizes[0]]; off += sizes[0]
    build = d[off:off+sizes[1]]; off += sizes[1]
    model_off = d.find(b"BMD0", off)
    grid = struct.unpack_from("<1024H", perm, 0)
    return {
        "raw": d,
        "collision": [0 if v in WALKABLE else 1 for v in grid],  # 32x32, 1=blocked
        "perm_values": grid,
        "buildings": parse_buildings(build),
        "model_off": model_off,
    }


if __name__ == "__main__":
    names = map_names()
    print("maps:", len(names))
    cell = find_map_cell("T20")
    print("New Bark T20 ->", cell)
    land = load_land(cell[3])
    print("buildings:", len(land["buildings"]),
          "blocked tiles:", sum(land["collision"]))
