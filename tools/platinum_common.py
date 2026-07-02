#!/usr/bin/env python3
"""
platinum_common.py — Shared helpers for converting Pokémon Platinum (pokeplatinum
decomp) map data into the 2D browser-game formats.

Platinum maps are a 2D/3D hybrid (see source/pokeplatinum/docs/maps/). Each map is
a 32x32 grid of tiles; the geometry is a 3D NSBMD model, but the *collision and
behavior* of every tile lives in a plain 32x32 array of 16-bit "terrain
attributes". This module resolves the data chain that ties a map name to that
tile data:

    MAP_HEADER_<NAME>  (include/data/map_headers.h : sMapHeaders[])
        ├─ eventsArchiveID  = events_<mapname>      → the map's short name
        ├─ mapMatrixID      = map_matrix_<NNN>      → which matrix places it
        └─ areaDataArchiveID= area_data_<NNN>       → textures / props / lighting

    map_matrix_<NNN>.json
        ├─ headers[r][c] = MAP_HEADER_<NAME>        → which cell belongs to a map
        └─ maps[r][c]    = MAP_<LLL> / MAP_NONE     → land-data file for that cell

    map_data_<LLL>.bin (land data)
        ├─ terrainAttributes  32x32 u16  (bit15 = collision, low byte = behavior)
        ├─ mapProps[]         3D model instances (buildings, trees, …)
        ├─ mapModel           NSBMD (the 3D geometry)
        └─ bdhc               height data

All offsets/encodings are taken from
source/pokeplatinum/docs/maps/file_format_specifications.md and the game source.
"""

import json
import os
import re
import struct

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
TOOLS_DIR   = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT   = os.path.dirname(TOOLS_DIR)
PLAT_ROOT   = os.path.join(REPO_ROOT, "source", "pokeplatinum")

HEADERS_H   = os.path.join(PLAT_ROOT, "include", "data", "map_headers.h")
MATRIX_DIR  = os.path.join(PLAT_ROOT, "res", "field", "matrices")
LANDDATA_DIR= os.path.join(PLAT_ROOT, "res", "field", "maps", "data")
EVENTS_DIR  = os.path.join(PLAT_ROOT, "res", "field", "events")
AREADATA_DIR= os.path.join(PLAT_ROOT, "res", "field", "area_data")

# ---------------------------------------------------------------------------
# Land-data binary format constants (file_format_specifications.md)
# ---------------------------------------------------------------------------
MAP_TILES_X = 32
MAP_TILES_Z = 32
TILE_UNITS  = 16          # 3D units per tile (512 units / 32 tiles)
MAP_UNITS   = MAP_TILES_X * TILE_UNITS  # 512

TERRAIN_ATTRIBUTES_OFFSET = 0x10
TERRAIN_ATTRIBUTES_SIZE   = 0x800       # 2 * 32 * 32
COLLISION_MASK            = 0x8000      # bit 15 → impassable
BEHAVIOR_MASK             = 0x00FF      # low byte → TileBehavior

MAPPROP_STRUCT_SIZE = 0x30              # 48 bytes per MapProp
FX32 = 4096.0                           # 1.19.12 fixed point divisor


# ---------------------------------------------------------------------------
# Map headers
# ---------------------------------------------------------------------------
def parse_map_headers(path=HEADERS_H):
    """
    Parse the `sMapHeaders[]` designated-initializer table from
    include/data/map_headers.h.

    Returns dict: MAP_HEADER_<NAME> -> { field: value_symbol, ... }
    """
    txt = open(path, encoding="utf-8").read()
    headers = {}
    # Each entry looks like:  [MAP_HEADER_X] = { .field = VALUE, ... },
    for m in re.finditer(r"\[(MAP_HEADER_[A-Z0-9_]+)\]\s*=\s*\{(.*?)\}\s*,", txt, re.S):
        name = m.group(1)
        body = m.group(2)
        fields = {}
        for fm in re.finditer(r"\.(\w+)\s*=\s*([A-Za-z0-9_]+)", body):
            fields[fm.group(1)] = fm.group(2)
        headers[name] = fields
    return headers


def events_symbol_to_mapname(sym):
    """`events_twinleaf_town` -> `twinleaf_town`. Returns None for empty/dummy."""
    if not sym or not sym.startswith("events_"):
        return None
    name = sym[len("events_"):]
    if name in ("empty", "dummy"):
        return None
    return name


# ---------------------------------------------------------------------------
# Map matrices
# ---------------------------------------------------------------------------
_matrix_cache = {}


def load_matrix(matrix_id):
    """Load and cache a map_matrix_<NNN>.json by symbol (e.g. 'map_matrix_000')."""
    if matrix_id in _matrix_cache:
        return _matrix_cache[matrix_id]
    path = os.path.join(MATRIX_DIR, matrix_id + ".json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    _matrix_cache[matrix_id] = data
    return data


def land_ref_to_index(ref):
    """`MAP_000` -> 0, `MAP_NONE`/`MAP_DYNAMIC` -> None."""
    if ref in ("MAP_NONE", "MAP_DYNAMIC"):
        return None
    m = re.match(r"MAP_(\d+)$", ref)
    return int(m.group(1)) if m else None


def matrix_cells_for_header(matrix, header_name):
    """
    Return the list of (row, col) cells in `matrix` whose header == header_name.
    """
    headers = matrix.get("headers")
    if not headers:
        return []
    cells = []
    for r, row in enumerate(headers):
        for c, h in enumerate(row):
            if h == header_name:
                cells.append((r, c))
    return cells


# ---------------------------------------------------------------------------
# Land data (map_data_<LLL>.bin)
# ---------------------------------------------------------------------------
_landdata_cache = {}


def load_land_data(index):
    """
    Parse map_data_<index>.bin. Returns dict with:
      terrain   : list[1024] of raw u16 terrain attributes (row-major, 32x32)
      collision : list[1024] of 0/1  (1 = impassable)
      behavior  : list[1024] of 0-255 (TileBehavior)
      props     : list of {model_id, x, y, z, rot, scale} in map-local 3D units
      has_model : bool
      has_bdhc  : bool
      model_bytes / bdhc_bytes offsets (for downstream NSBMD extraction)
    """
    if index in _landdata_cache:
        return _landdata_cache[index]

    path = os.path.join(LANDDATA_DIR, f"map_data_{index:03d}.bin")
    data = open(path, "rb").read()

    ta_size, props_size, model_size, bdhc_size = struct.unpack_from("<4I", data, 0)

    # Terrain attributes: 32x32 u16
    n = ta_size // 2
    terrain = list(struct.unpack_from(f"<{n}H", data, TERRAIN_ATTRIBUTES_OFFSET))
    collision = [1 if (a & COLLISION_MASK) else 0 for a in terrain]
    behavior  = [a & BEHAVIOR_MASK for a in terrain]

    # Map props
    props_off = TERRAIN_ATTRIBUTES_OFFSET + ta_size
    props = []
    for i in range(props_size // MAPPROP_STRUCT_SIZE):
        base = props_off + i * MAPPROP_STRUCT_SIZE
        model_id = struct.unpack_from("<I", data, base)[0]
        px, py, pz = struct.unpack_from("<3i", data, base + 0x04)
        rx, ry, rz = struct.unpack_from("<3i", data, base + 0x10)
        sx, sy, sz = struct.unpack_from("<3i", data, base + 0x1C)
        props.append({
            "model_id": model_id,
            "x": px / FX32, "y": py / FX32, "z": pz / FX32,
            "rot": [rx, ry, rz],
            "scale": [sx / FX32, sy / FX32, sz / FX32],
        })

    model_off = props_off + props_size
    bdhc_off  = model_off + model_size

    result = {
        "index": index,
        "terrain": terrain,
        "collision": collision,
        "behavior": behavior,
        "props": props,
        "has_model": model_size > 0 and data[model_off:model_off + 4] == b"BMD0",
        "has_bdhc": bdhc_size > 0 and data[bdhc_off:bdhc_off + 4] == b"BDHC",
        "model_range": (model_off, model_off + model_size),
        "bdhc_range": (bdhc_off, bdhc_off + bdhc_size),
        "raw": data,
    }
    _landdata_cache[index] = result
    return result


def prop_tile_position(prop):
    """
    Convert a map prop's local 3D position to fractional (tile_x, tile_z).
    Map-local origin is the centre of the map; x/z run -256..256 units,
    16 units per tile → tile = (pos + 256) / 16.
    """
    tx = (prop["x"] + MAP_UNITS / 2) / TILE_UNITS
    tz = (prop["z"] + MAP_UNITS / 2) / TILE_UNITS
    return tx, tz


# ---------------------------------------------------------------------------
# Tile appearance categories
# ---------------------------------------------------------------------------
# The Platinum map is 3D, so a tile's *look* really comes from the NSBMD model.
# For a 2D top-down projection we approximate the look from the tile's behavior
# (what the game logically treats the tile as: grass, water, ledge, door, …),
# falling back to the map type for the very common "generic" behavior 0.
#
# Each category is one tile in the generated `sinnoh_overworld` spritesheet.
# The list order defines the tile index used in layout `metatiles[]`.
CATEGORIES = [
    "void",            # 0  outside the playable footprint
    "floor_indoor",    # 1  building floor
    "ground",          # 2  outdoor dirt/path
    "grass",           # 3  normal outdoor grass (walkable)
    "tall_grass",      # 4  encounter grass
    "water",           # 5  river / swimmable
    "sea",             # 6  deep sea water
    "shallow_water",   # 7  puddle / shallow
    "sand",            # 8
    "snow",            # 9
    "ice",             # 10
    "cave_floor",      # 11
    "mountain",        # 12 rocky ground
    "mud",             # 13
    "wall",            # 14 impassable (tree / rock / building edge)
    "ledge_south",     # 15 jump-down ledges
    "ledge_north",     # 16
    "ledge_east",      # 17
    "ledge_west",      # 18
    "door",            # 19
    "warp",            # 20 stairs / warp panel / entrance
    "bridge",          # 21
    "flowers",         # 22 decorative (berry patch)
]
CATEGORY_INDEX = {name: i for i, name in enumerate(CATEGORIES)}

# RGB used both for the generated tileset and the baked preview PNGs.
CATEGORY_COLORS = {
    "void":          (18, 18, 28),
    "floor_indoor":  (196, 178, 150),
    "ground":        (200, 176, 130),
    "grass":         (104, 168, 88),
    "tall_grass":    (64, 128, 64),
    "water":         (72, 128, 216),
    "sea":           (48, 96, 192),
    "shallow_water": (128, 184, 232),
    "sand":          (224, 208, 152),
    "snow":          (238, 242, 248),
    "ice":           (176, 216, 232),
    "cave_floor":    (120, 100, 84),
    "mountain":      (150, 132, 110),
    "mud":           (128, 100, 72),
    "wall":          (44, 72, 48),
    "ledge_south":   (150, 150, 96),
    "ledge_north":   (150, 150, 96),
    "ledge_east":    (150, 150, 96),
    "ledge_west":    (150, 150, 96),
    "door":          (150, 96, 56),
    "warp":          (230, 190, 90),
    "bridge":        (170, 130, 86),
    "flowers":       (206, 132, 178),
}

# Direct behavior → category mappings (behavior id from map_tile_behaviors.h).
_BEHAVIOR_CATEGORY = {
    0x02: "tall_grass",       # TALL_GRASS
    0x03: "tall_grass",       # VERY_TALL_GRASS
    0x08: "cave_floor",       # CAVE_FLOOR
    0x0B: "floor_indoor",     # OLD_CHATEAU_FLOOR
    0x0C: "mountain",         # MOUNTAIN_FLOOR
    0x10: "water",            # WATER_RIVER
    0x13: "water",            # WATERFALL
    0x15: "sea",              # WATER_SEA
    0x16: "shallow_water",    # PUDDLE
    0x17: "shallow_water",    # SHALLOW_WATER
    0x1D: "shallow_water",    # PUDDLE_NO_SPLASHING
    0x20: "ice",              # ICE
    0x21: "sand",             # SAND
    0x38: "ledge_east",       # JUMP_EAST
    0x39: "ledge_west",       # JUMP_WEST
    0x3A: "ledge_north",      # JUMP_NORTH
    0x3B: "ledge_south",      # JUMP_SOUTH
    0x5C: "ledge_north",      # JUMP_NORTH_TWICE
    0x5D: "ledge_south",      # JUMP_SOUTH_TWICE
    0x5E: "ledge_west",       # JUMP_WEST_TWICE
    0x5F: "ledge_east",       # JUMP_EAST_TWICE
    0x62: "warp", 0x63: "warp", 0x64: "warp", 0x65: "warp",  # WARP_ENTRANCE_*
    0x67: "warp",             # WARP_PANEL
    0x69: "door",             # DOOR
    0x6A: "warp", 0x6B: "warp",  # ESCALATOR*
    0x5A: "warp", 0x5B: "warp",  # WARP_STAIRS_E/W
    0x6C: "warp", 0x6D: "warp", 0x6E: "warp", 0x6F: "warp",  # WARP_E/W/N/S
    0x70: "bridge", 0x71: "bridge", 0x72: "bridge", 0x73: "bridge",
    0x74: "bridge", 0x75: "bridge",
    0x76: "bridge", 0x77: "bridge", 0x78: "bridge", 0x79: "bridge",
    0x7A: "bridge", 0x7B: "bridge", 0x7C: "bridge", 0x7D: "bridge",
    0xA0: "flowers",          # BERRY_PATCH
    0xA1: "snow", 0xA2: "snow", 0xA3: "snow",  # SNOW_DEEP/ER/EST
    0xA4: "mud", 0xA5: "mud", 0xA6: "mud", 0xA7: "mud",
    0xA8: "snow",              # SNOW_SHALLOW
    # NB: 0xA9 (enum "SNOW_WITH_SHADOWS") is NOT used by any snow route; it
    # appears as walkable decorative ground in towns (e.g. Twinleaf), so it is
    # deliberately left unmapped to fall through to the map-type default.
}

# Outdoor map types where generic behavior-0 ground should read as grass.
_OUTDOOR_TYPES = {"MAP_TYPE_TOWN_CITY", "MAP_TYPE_OUTDOORS"}
_CAVE_TYPES = {"MAP_TYPE_CAVE", "MAP_TYPE_UNDERGROUND"}


def behavior_to_category(behavior, collision, map_type):
    """
    Map a (behavior, collision, map_type) triple to an appearance category name.
    """
    cat = _BEHAVIOR_CATEGORY.get(behavior)
    if cat is not None:
        return cat

    # Generic / unclassified behavior: choose by whether it blocks + map type.
    if collision:
        if map_type in _CAVE_TYPES:
            return "mountain"
        if map_type in _OUTDOOR_TYPES:
            return "wall"          # trees / cliffs / building edges
        return "wall"             # indoor walls
    # Walkable generic ground
    if map_type in _CAVE_TYPES:
        return "cave_floor"
    if map_type in _OUTDOOR_TYPES:
        return "grass"
    return "floor_indoor"


# ---------------------------------------------------------------------------
# Build the master map catalog: name -> everything needed to build a 2D map
# ---------------------------------------------------------------------------
def build_catalog():
    """
    Walk every map header and produce, per playable map name, a record describing
    its matrix footprint and per-cell land-data ids.

    Returns:
      catalog: dict mapname -> {
        header, matrix_id, area_data_id, map_type, weather, music, flags,
        rows, cols,                # footprint size in matrix cells
        min_row, min_col,          # matrix origin of the footprint
        cells: [ {row, col, land_index, altitude} ],
      }
      header_to_name: dict MAP_HEADER_<NAME> -> mapname (for warp resolution)
    """
    headers = parse_map_headers()
    catalog = {}
    header_to_name = {}

    for header_name, fields in headers.items():
        mapname = events_symbol_to_mapname(fields.get("eventsArchiveID"))
        if not mapname:
            continue
        # A given map name is defined once; keep the first header that owns it.
        header_to_name.setdefault(header_name, mapname)
        if mapname in catalog:
            continue

        matrix_id = fields.get("mapMatrixID")
        if not matrix_id:
            continue
        try:
            matrix = load_matrix(matrix_id)
        except FileNotFoundError:
            continue

        cells_rc = matrix_cells_for_header(matrix, header_name)
        if not cells_rc:
            # Dedicated matrices (interiors, caves, small areas) omit the
            # optional `headers` grid — the whole matrix belongs to this map.
            # If the matrix DOES have a headers grid but this header isn't in
            # it, the header is a dummy/unused one, so skip it.
            if matrix.get("headers"):
                continue
            maps_grid = matrix.get("maps", [])
            cells_rc = [(r, c)
                        for r, row in enumerate(maps_grid)
                        for c in range(len(row))]
            if not cells_rc:
                continue

        rows = [r for r, _ in cells_rc]
        cols = [c for _, c in cells_rc]
        min_row, max_row = min(rows), max(rows)
        min_col, max_col = min(cols), max(cols)

        maps_grid = matrix.get("maps", [])
        alt_grid  = matrix.get("altitudes")

        cells = []
        for (r, c) in cells_rc:
            land_index = land_ref_to_index(maps_grid[r][c]) if maps_grid else None
            altitude = alt_grid[r][c] if alt_grid else 0
            cells.append({
                "row": r, "col": c,
                "land_index": land_index,
                "altitude": altitude,
            })

        catalog[mapname] = {
            "header": header_name,
            "matrix_id": matrix_id,
            "area_data_id": fields.get("areaDataArchiveID"),
            "map_type": fields.get("mapType"),
            "weather": fields.get("weather"),
            "day_music": fields.get("dayMusicID"),
            "night_music": fields.get("nightMusicID"),
            "is_bike_allowed": fields.get("isBikeAllowed") == "TRUE",
            "is_running_allowed": fields.get("isRunningAllowed") == "TRUE",
            "is_fly_allowed": fields.get("isFlyAllowed") == "TRUE",
            "rows": max_row - min_row + 1,
            "cols": max_col - min_col + 1,
            "min_row": min_row,
            "min_col": min_col,
            "cells": cells,
        }

    # Resolve every header (even dummies) to a name if its events map is known,
    # so warps that target e.g. a house interior can be resolved.
    for header_name, fields in headers.items():
        mapname = events_symbol_to_mapname(fields.get("eventsArchiveID"))
        if mapname:
            header_to_name[header_name] = mapname

    return catalog, header_to_name


if __name__ == "__main__":
    cat, h2n = build_catalog()
    print(f"catalog: {len(cat)} playable maps, {len(h2n)} header→name links")
    for name in ("twinleaf_town", "jubilife_city", "route_201", "eterna_forest"):
        if name in cat:
            e = cat[name]
            land = [c["land_index"] for c in e["cells"]]
            print(f"  {name}: {e['cols']}x{e['rows']} cells, type={e['map_type']}, "
                  f"matrix={e['matrix_id']}, land={land}")
