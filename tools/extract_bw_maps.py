#!/usr/bin/env python3
"""
extract_bw_maps.py — Convert Pokémon Black land-data cells into standalone
2D browser-game maps (region "unova").

Reverse-engineered directly from the ROM (see tools/bw_common.py docstring
for the full format writeup and its unknowns). Each of the 649 a/0/0/8
land-data cells is emitted as an INDEPENDENT standalone map — matrix
stitching into contiguous overworld geography was attempted and did not
produce coherent results (see bw_common.py), so maps do NOT connect to each
other yet, and there are no warps/NPCs (not yet located in the ROM data).

This is a first-pass, honestly-labeled placeholder conversion: map names are
"Unova Area <index>" (no confirmed land-cell -> real-name mapping exists
yet), and appearance uses the flat unova_placeholder tileset (no decoded
texture/behavior data yet). Collision is real, reverse-engineered ROM data,
validated by visual inspection (see investigation notes / bw_common.py).

Outputs:
  data/layouts/unova/area_<NNNN>.json
  data/maps/unova/area_<NNNN>.json
  data/maps/unova_index.json

Usage:
  python3 tools/extract_bw_maps.py [--limit N] [--min-ratio F] [--max-ratio F]
"""
import argparse
import json
import os

import bw_common as bw

REPO_ROOT = bw.REPO_ROOT
OUT_LAYOUT_DIR = os.path.join(REPO_ROOT, "data", "layouts", "unova")
OUT_MAP_DIR = os.path.join(REPO_ROOT, "data", "maps", "unova")
OUT_INDEX = os.path.join(REPO_ROOT, "data", "maps", "unova_index.json")

TILESET_NAME = "unova_placeholder"
FLOOR, WALL, SPECIAL = 0, 1, 2


def convert_one(index):
    cell = bw.load_land_cell(index)
    w, h = cell["width"], cell["height"]
    n = w * h
    metatiles = []
    collision = []
    for i in range(n):
        blocked = cell["collision"][i] if i < len(cell["collision"]) else 1
        special = cell["special"][i] if i < len(cell["special"]) else 0
        if special:
            metatiles.append(SPECIAL)
        else:
            metatiles.append(WALL if blocked else FLOOR)
        collision.append(blocked)

    name = f"area_{index:04d}"
    layout = {
        "id": name,
        "region": "unova",
        "source": "black_rom_re",
        "width": w,
        "height": h,
        "tileset": TILESET_NAME,
        "metatiles": metatiles,
        "collision": collision,
    }
    map_json = {
        "id": name,
        "name": f"Unova Area {index}",
        "region": "unova",
        "source": "black_rom_re",
        "land_cell_index": index,
        "layout": name,
        "map_type": "MAP_TYPE_UNKNOWN",
        "npcs": [],
        "warps": [],
        "signs": [],
        "connections": [],
    }
    return layout, map_json


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None,
                     help="convert only the first N eligible land-cells")
    ap.add_argument("--min-ratio", type=float, default=0.15,
                     help="skip land-cells with collision ratio below this (near-empty)")
    ap.add_argument("--max-ratio", type=float, default=0.9,
                     help="skip land-cells with collision ratio above this (near-solid)")
    args = ap.parse_args()

    os.makedirs(OUT_LAYOUT_DIR, exist_ok=True)
    os.makedirs(OUT_MAP_DIR, exist_ok=True)

    index = {}
    written = 0
    total = bw.land_cell_count()
    for i in range(total):
        try:
            cell = bw.load_land_cell(i)
        except Exception as e:
            print(f"  [skip] land-cell {i}: {e}")
            continue
        n = len(cell["collision"])
        if n == 0:
            continue
        ratio = sum(cell["collision"]) / n
        if not (args.min_ratio <= ratio <= args.max_ratio):
            continue

        layout, map_json = convert_one(i)
        name = map_json["id"]
        with open(os.path.join(OUT_LAYOUT_DIR, f"{name}.json"), "w") as f:
            json.dump(layout, f)
        with open(os.path.join(OUT_MAP_DIR, f"{name}.json"), "w") as f:
            json.dump(map_json, f, indent=2)
        index[f"LAND_CELL_{i:04d}"] = name
        index[name] = name
        written += 1
        if args.limit and written >= args.limit:
            break

    with open(OUT_INDEX, "w") as f:
        json.dump(index, f, indent=2)

    print(f"Wrote {written} maps (of {total} land-cells) to {OUT_MAP_DIR}")
    print(f"Index: {OUT_INDEX}")


if __name__ == "__main__":
    main()
