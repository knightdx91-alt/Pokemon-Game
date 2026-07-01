#!/usr/bin/env python3
"""
extract_platinum_maps.py — Convert Pokémon Platinum's 3D maps into the 2D
browser-game format.

Platinum stores each map as a 3D NSBMD model plus a 32x32 grid of terrain
attributes (collision + behavior). This tool resolves the full map-header →
matrix → land-data chain (see tools/platinum_common.py), stitches multi-cell
maps together, and emits, for every playable Sinnoh map:

  data/layouts/sinnoh/<name>.json   width/height, per-tile appearance
                                    (`metatiles`), `collision`, `behavior`,
                                    building-prop footprints, and metadata.
  data/maps/sinnoh/<name>.json      the event map (npcs / warps / signs) with
                                    coordinates corrected to map-local tiles and
                                    a `layout` reference so the engine can draw
                                    the terrain.
  data/maps/sinnoh_index.json       MAP_HEADER_<NAME> → map filename, used by the
                                    engine to resolve warp destinations.

Run: python3 tools/extract_platinum_maps.py
"""

import json
import os

import platinum_common as pc

OUT_LAYOUT_DIR = os.path.join(pc.REPO_ROOT, "data", "layouts", "sinnoh")
OUT_MAP_DIR    = os.path.join(pc.REPO_ROOT, "data", "maps", "sinnoh")
OUT_INDEX      = os.path.join(pc.REPO_ROOT, "data", "maps", "sinnoh_index.json")
OUT_MATRIX_DIR = os.path.join(pc.REPO_ROOT, "data", "maps", "sinnoh_matrix")

TILESET_NAME = "sinnoh_overworld"


def build_matrix_grids(catalog, header_to_name):
    """
    For every matrix that places more than one playable map, emit a grid mapping
    each cell to the map that owns it (or null). The engine uses this to walk
    seamlessly from one map to an adjacent one across the shared global tile grid.
    """
    os.makedirs(OUT_MATRIX_DIR, exist_ok=True)
    # Which matrices are actually used by playable maps.
    matrix_ids = sorted({e["matrix_id"] for e in catalog.values() if e.get("matrix_id")})
    count = 0
    for matrix_id in matrix_ids:
        try:
            matrix = pc.load_matrix(matrix_id)
        except FileNotFoundError:
            continue
        headers = matrix.get("headers")
        if not headers:
            continue  # dedicated single-map matrix (interiors) — warps handle it
        grid = [[None] * len(row) for row in headers]
        distinct = set()
        for r, row in enumerate(headers):
            for c, h in enumerate(row):
                name = header_to_name.get(h)
                if name in catalog:
                    grid[r][c] = name
                    distinct.add(name)
        if len(distinct) < 2:
            continue  # nothing to connect
        out = {
            "id": matrix_id,
            "height": len(grid),
            "width": len(grid[0]) if grid else 0,
            "tile_size": pc.MAP_TILES_X,   # tiles per cell edge (32)
            "cells": grid,
        }
        with open(os.path.join(OUT_MATRIX_DIR, f"{matrix_id}.json"), "w") as f:
            json.dump(out, f, separators=(",", ":"))
        count += 1
    return count


# ---------------------------------------------------------------------------
# Layout building
# ---------------------------------------------------------------------------
def build_layout(name, entry):
    """
    Stitch every land-data cell of a map into flat width*height arrays of
    collision, behavior and appearance-category (`metatiles`).
    """
    cols, rows = entry["cols"], entry["rows"]
    width  = cols * pc.MAP_TILES_X
    height = rows * pc.MAP_TILES_Z
    n = width * height

    # Default: void / impassable (covers matrix cells with no land data).
    collision = [1] * n
    behavior  = [0] * n
    metatiles = [pc.CATEGORY_INDEX["void"]] * n

    map_type = entry["map_type"]
    props = []

    for cell in entry["cells"]:
        land_index = cell["land_index"]
        if land_index is None:
            continue
        try:
            land = pc.load_land_data(land_index)
        except FileNotFoundError:
            print(f"  [WARN] {name}: missing land data {land_index}")
            continue

        cell_ox = (cell["col"] - entry["min_col"]) * pc.MAP_TILES_X
        cell_oz = (cell["row"] - entry["min_row"]) * pc.MAP_TILES_Z

        for z in range(pc.MAP_TILES_Z):
            for x in range(pc.MAP_TILES_X):
                src = z * pc.MAP_TILES_X + x
                dst = (cell_oz + z) * width + (cell_ox + x)
                col = land["collision"][src]
                beh = land["behavior"][src]
                collision[dst] = col
                behavior[dst]  = beh
                metatiles[dst] = pc.CATEGORY_INDEX[
                    pc.behavior_to_category(beh, col, map_type)
                ]

        # Building / tree / furniture props → 2D footprint markers.
        for prop in land["props"]:
            tx, tz = pc.prop_tile_position(prop)
            props.append({
                "model_id": prop["model_id"],
                "x": round(cell_ox + tx, 2),
                "y": round(cell_oz + tz, 2),
            })

    layout = {
        "id": f"sinnoh/{name}",
        "region": "sinnoh",
        "source": "platinum",
        "width": width,
        "height": height,
        "tileset": TILESET_NAME,
        # Textured top-down render of the 3D map model (16 px/tile, grid-aligned),
        # produced by tools/render_platinum_maps.py. Drawn as the map background;
        # the behavior tileset above is the fallback when it is absent.
        "background": f"data/maps/sinnoh_textured/{name}.png",
        "map_type": map_type,
        "categories": pc.CATEGORIES,
        "metatiles": metatiles,
        "collision": collision,
        "behavior": behavior,
        "props": props,
    }
    return layout


# ---------------------------------------------------------------------------
# Event map building (npcs / warps / signs with local tile coordinates)
# ---------------------------------------------------------------------------
def build_event_map(name, entry, header_to_name):
    """
    Read res/field/events/events_<name>.json and re-emit it with coordinates
    translated from global matrix tiles to map-local tiles, warp destinations
    resolved to header ids, and a layout reference attached.
    """
    ox = entry["min_col"] * pc.MAP_TILES_X
    oz = entry["min_row"] * pc.MAP_TILES_Z

    events_path = os.path.join(pc.EVENTS_DIR, f"events_{name}.json")
    raw = {}
    if os.path.isfile(events_path):
        with open(events_path, encoding="utf-8") as f:
            raw = json.load(f)

    def lx(v): return v - ox
    def lz(v): return v - oz

    npcs = [
        {
            "local_id": e.get("id"),
            "graphics_id": e.get("graphics_id"),
            "x": lx(e.get("x", 0)),
            "y": lz(e.get("z", 0)),
            "elevation": e.get("y", 0),
            "movement_type": e.get("movement_type"),
            "trainer_type": e.get("trainer_type"),
            "script": e.get("script"),
            "hidden_flag": e.get("hidden_flag"),
            "initial_dir": e.get("initial_dir"),
        }
        for e in raw.get("object_events", [])
    ]

    warps = [
        {
            "x": lx(w.get("x", 0)),
            "y": lz(w.get("z", 0)),
            "dest_map": w.get("dest_header_id"),
            "dest_warp_id": w.get("dest_warp_id"),
        }
        for w in raw.get("warp_events", [])
    ]

    signs = [
        {
            "x": lx(b.get("x", 0)),
            "y": lz(b.get("z", 0)),
            "script": b.get("script"),
            "type": b.get("type"),
            "player_facing_dir": b.get("player_facing_dir"),
        }
        for b in raw.get("bg_events", [])
    ]

    triggers = [
        {
            "x": lx(t.get("x", 0)),
            "y": lz(t.get("z", 0)),
            "width": t.get("width", 1),
            "height": t.get("length", 1),
            "var": t.get("var"),
            "var_value": t.get("value"),
            "script": t.get("script"),
        }
        for t in raw.get("coord_events", [])
    ]

    return {
        "id": name,
        "name": name.replace("_", " ").title(),
        "region": "sinnoh",
        "source": "platinum",
        "header": entry["header"],
        "layout": name,
        # Matrix placement: all maps in a matrix share one global tile grid, so
        # the engine can walk seamlessly between adjacent maps. `matrix_origin`
        # is this map's top-left cell in global tiles (32 px per cell).
        "matrix": entry["matrix_id"],
        "matrix_origin": [entry["min_col"] * pc.MAP_TILES_X,
                          entry["min_row"] * pc.MAP_TILES_Z],
        "map_type": entry["map_type"],
        "weather": entry["weather"],
        "day_music": entry["day_music"],
        "night_music": entry["night_music"],
        "allow_running": entry["is_running_allowed"],
        "allow_cycling": entry["is_bike_allowed"],
        "allow_fly": entry["is_fly_allowed"],
        "npcs": npcs,
        "warps": warps,
        "signs": signs,
        "triggers": triggers,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    os.makedirs(OUT_LAYOUT_DIR, exist_ok=True)
    os.makedirs(OUT_MAP_DIR, exist_ok=True)

    catalog, header_to_name = pc.build_catalog()
    print(f"Building {len(catalog)} Sinnoh maps from Platinum land data …")

    # Index: MAP_HEADER_<NAME> → map filename (for warp resolution in-engine).
    index = {}
    for header_name, mapname in header_to_name.items():
        if mapname in catalog:
            index[header_name] = mapname

    n_layouts = n_maps = 0
    stats = {"with_model": 0, "with_bdhc": 0, "total_props": 0, "multi_cell": 0}

    for name, entry in sorted(catalog.items()):
        layout = build_layout(name, entry)
        with open(os.path.join(OUT_LAYOUT_DIR, f"{name}.json"), "w") as f:
            json.dump(layout, f, separators=(",", ":"))
        n_layouts += 1

        event_map = build_event_map(name, entry, header_to_name)
        with open(os.path.join(OUT_MAP_DIR, f"{name}.json"), "w") as f:
            json.dump(event_map, f, indent=2)
        n_maps += 1

        stats["total_props"] += len(layout["props"])
        if entry["cols"] * entry["rows"] > 1:
            stats["multi_cell"] += 1
        for cell in entry["cells"]:
            if cell["land_index"] is not None:
                land = pc.load_land_data(cell["land_index"])
                stats["with_model"] += 1 if land["has_model"] else 0
                stats["with_bdhc"] += 1 if land["has_bdhc"] else 0
                break

    with open(OUT_INDEX, "w") as f:
        json.dump(index, f, indent=2, sort_keys=True)

    n_matrix = build_matrix_grids(catalog, header_to_name)

    print(f"  → {n_layouts} layouts  → data/layouts/sinnoh/")
    print(f"  → {n_maps} event maps → data/maps/sinnoh/")
    print(f"  → {len(index)} header→name links → data/maps/sinnoh_index.json")
    print(f"  → {n_matrix} matrix grids → data/maps/sinnoh_matrix/")
    print(f"  props placed: {stats['total_props']}, multi-cell maps: {stats['multi_cell']}, "
          f"maps with 3D model: {stats['with_model']}")


if __name__ == "__main__":
    main()
