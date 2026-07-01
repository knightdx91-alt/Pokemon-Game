#!/usr/bin/env python3
"""
extract_hns_johto.py — Convert the Pokémon Heart & Soul (HnS) decomp into the
game's **Johto** region.

HnS (https://github.com/PokemonHnS-Development/pokemonHnS) is a pokeemerald-based
GBA ROM hack, so its overworld maps are true 2D metatile tilemaps — identical in
format to Hoenn. That makes it the practical, pixel-perfect source for a playable
Johto/Kanto region (unlike the DS Gen-4 decomps, whose field maps are 3D geometry).

This driver reuses the metatile/layout rendering in extract_tilesets_emerald.py
and adds the map-metadata + index output the engine needs, producing everything
in the exact formats GameMap/GameRenderer already consume:

  data/tilesets/hns_<name>.png + .json   — 16x16 metatile spritesheets (16/row)
  data/layouts/johto/<LAYOUT_ID>.json    — metatile grid + collision
  data/maps/johto/<MapName>.json         — layout ref, warps, connections, npcs, signs
  data/maps/johto_index.json             — MAP_CONST -> MapName (warp/connection resolution)

Leftover pokeemerald base maps (the gMapGroup_Emerald* groups that ship unused in
HnS) are skipped so the region stays Johto/Kanto content only.

Prereq: HnS source present at source/pokemonhns/ (submodule, or an extracted
release tarball). Then:

  python3 tools/extract_hns_johto.py
"""

import importlib.util
import json
import os
import struct
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
GAME_ROOT  = SCRIPT_DIR.parent
SRC        = GAME_ROOT / "source" / "pokemonhns"

OUT_TILESETS = GAME_ROOT / "data" / "tilesets"
OUT_LAYOUTS  = GAME_ROOT / "data" / "layouts" / "johto"
OUT_MAPS     = GAME_ROOT / "data" / "maps" / "johto"
OUT_INDEX    = GAME_ROOT / "data" / "maps" / "johto_index.json"

REGION = "johto"


def pair_name(primary: str, secondary: str) -> str:
    """Tileset output name keyed on the FULL (primary, secondary) pair.

    HnS reuses a single secondary tileset (e.g. CherrygroveCity) against several
    different primaries (Johto_General vs the seasonal Johto_NorthEast/NorthWest
    variants), which produce genuinely different metatile sheets. Naming by the
    secondary alone would let one overwrite the other and render half the maps
    with the wrong primary tiles, so the primary is folded into the name.
    """
    p = em._camel_to_snake(primary.replace("gTileset_", ""))
    s = em._camel_to_snake(secondary.replace("gTileset_", ""))
    return f"hns_{p}__{s}"

# ---------------------------------------------------------------------------
# Load the Emerald extractor as a module and retarget it at the HnS source.
# We call its helpers directly so we control exactly which layouts are built.
# ---------------------------------------------------------------------------
_spec = importlib.util.spec_from_file_location(
    "em_extract", SCRIPT_DIR / "extract_tilesets_emerald.py")
em = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(em)

em.SOURCE_ROOT   = SRC
em.LAYOUTS_JSON  = SRC / "data" / "layouts" / "layouts.json"
em.OUT_TILESETS  = OUT_TILESETS
em.OUT_LAYOUTS   = OUT_LAYOUTS
em.REGION_PREFIX = "hns_"
# HnS expands the primary tileset to 640 tiles and 640 metatiles (pokeemerald
# defaults are 512). See source/pokemonhns/include/fieldmap.h:
#   #define NUM_TILES_IN_PRIMARY 640
#   #define NUM_METATILES_IN_PRIMARY 640
em.PRIMARY_TILE_COUNT     = 640
em.PRIMARY_METATILE_COUNT = 640
# A few HnS tilesets have graphics folders renamed away from their symbol name.
em.TILESET_DIR_ALIASES = {
    "GoldenrodCity_TrainStation":  "goldenrod_station",
    "SaffronCity_FightingDojoVIP": "saffron_city_dojo_vip",
    "TrainerHill_Courtyard":       "trainer_hill",
}


# ---------------------------------------------------------------------------
# Which maps belong to the region (exclude leftover Emerald base maps)
# ---------------------------------------------------------------------------

def included_map_names():
    """Return the set of HnS map folder names to convert (Johto/Kanto content),
    excluding the unused gMapGroup_Emerald* leftover base maps."""
    groups = json.loads((SRC / "data" / "maps" / "map_groups.json").read_text())
    excluded = set()
    for gname in groups.get("group_order", []):
        if "Emerald" in gname:
            excluded.update(groups.get(gname, []))
    names = set()
    maps_dir = SRC / "data" / "maps"
    for d in sorted(maps_dir.iterdir()):
        if not d.is_dir():
            continue
        if not (d / "map.json").is_file():
            continue
        if d.name in excluded:
            continue
        names.add(d.name)
    return names


# ---------------------------------------------------------------------------
# Map metadata (pokeemerald map.json -> engine unified format)
# ---------------------------------------------------------------------------

def convert_map_json(raw: dict, name: str) -> dict:
    return {
        "id":            raw.get("id"),
        "name":          raw.get("name", name),
        "region":        REGION,
        "source":        "hns",
        "layout":        raw.get("layout"),
        "music":         raw.get("music"),
        "weather":       raw.get("weather"),
        "map_type":      raw.get("map_type"),
        "region_map_section": raw.get("region_map_section"),
        "allow_running": raw.get("allow_running", False),
        "allow_cycling": raw.get("allow_cycling", False),
        "show_map_name": raw.get("show_map_name", False),
        "connections": [
            {
                "map":       c.get("map"),
                "offset":    c.get("offset", 0),
                "direction": c.get("direction"),
            }
            for c in raw.get("connections", []) or []
        ],
        "npcs": [
            {
                "local_id":      e.get("local_id"),
                "graphics_id":   e.get("graphics_id"),
                "x":             e.get("x"),
                "y":             e.get("y"),
                "elevation":     e.get("elevation"),
                "movement_type": e.get("movement_type"),
                "trainer_type":  e.get("trainer_type"),
                "script":        e.get("script"),
                "flag":          e.get("flag"),
            }
            for e in raw.get("object_events", []) or []
        ],
        "warps": [
            {
                "x":            w.get("x"),
                "y":            w.get("y"),
                "elevation":    w.get("elevation"),
                "dest_map":     w.get("dest_map"),
                "dest_warp_id": w.get("dest_warp_id"),
            }
            for w in raw.get("warp_events", []) or []
        ],
        "signs": [
            {
                "x":      b.get("x"),
                "y":      b.get("y"),
                "script": b.get("script"),
            }
            for b in raw.get("bg_events", []) or []
            if b.get("type") == "sign"
        ],
        "triggers": [
            {
                "x":         c.get("x"),
                "y":         c.get("y"),
                "var":       c.get("var"),
                "var_value": c.get("var_value"),
                "script":    c.get("script"),
            }
            for c in raw.get("coord_events", []) or []
        ],
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not em.LAYOUTS_JSON.exists():
        raise SystemExit(
            "HnS source not found at source/pokemonhns/.\n"
            "  git submodule update --init source/pokemonhns\n"
            "  (or extract a release tarball into that directory)")

    OUT_TILESETS.mkdir(parents=True, exist_ok=True)
    OUT_LAYOUTS.mkdir(parents=True, exist_ok=True)
    OUT_MAPS.mkdir(parents=True, exist_ok=True)

    layouts_by_id = {L["id"]: L for L in json.loads(em.LAYOUTS_JSON.read_text())["layouts"]}
    names = included_map_names()
    print(f"[hns] {len(names)} Johto/Kanto maps to convert "
          f"(excluded leftover Emerald base maps)")

    # --- Pass 1: read every included map, collect which layouts we actually need
    maps = {}          # name -> raw map.json
    needed_layouts = set()
    for name in sorted(names):
        raw = json.loads((SRC / "data" / "maps" / name / "map.json").read_text())
        maps[name] = raw
        lid = raw.get("layout")
        if lid and lid in layouts_by_id:
            needed_layouts.add(lid)

    # --- Pass 2: build the unique tileset pairs those layouts use
    tileset_pairs = {}
    for lid in needed_layouts:
        L = layouts_by_id[lid]
        pri, sec = L.get("primary_tileset", ""), L.get("secondary_tileset", "")
        if pri and sec:
            tileset_pairs[(pri, sec)] = pair_name(pri, sec)

    print(f"[hns] building {len(tileset_pairs)} tilesets …")
    built_ts = 0
    for (pri, sec), out_name in sorted(tileset_pairs.items()):
        pri_dir = em.tileset_name_to_path(pri, "primary")
        sec_dir = em.tileset_name_to_path(sec, "secondary")
        if not pri_dir.exists() or not sec_dir.exists():
            print(f"  [skip] {out_name}: missing tileset dir")
            continue
        try:
            sheet, meta = em.process_tileset_pair(pri, sec)
            sheet.save(str(OUT_TILESETS / f"{out_name}.png"))
            (OUT_TILESETS / f"{out_name}.json").write_text(json.dumps(meta, separators=(",", ":")))
            built_ts += 1
        except Exception as e:
            print(f"  [error] {out_name}: {e}")

    # --- Pass 3: layouts (metatile grid + collision)
    print(f"[hns] building {len(needed_layouts)} layouts …")
    built_ly = 0
    for lid in sorted(needed_layouts):
        L = layouts_by_id[lid]
        if not L.get("blockdata_filepath"):
            continue
        layout_id, layout_json = em.process_layout(L)
        if layout_id is None:
            continue
        # Point the layout at the pair-named tileset (see pair_name docstring).
        pri, sec = L.get("primary_tileset", ""), L.get("secondary_tileset", "")
        if pri and sec:
            layout_json["tileset"] = pair_name(pri, sec)
        (OUT_LAYOUTS / f"{layout_id}.json").write_text(json.dumps(layout_json, separators=(",", ":")))
        built_ly += 1

    # --- Pass 4: map metadata + index
    print(f"[hns] writing {len(maps)} maps + index …")
    index = {}
    for name, raw in maps.items():
        unified = convert_map_json(raw, name)
        (OUT_MAPS / f"{name}.json").write_text(json.dumps(unified, separators=(",", ":")))
        mid = raw.get("id")
        if mid:
            index[mid] = name
    OUT_INDEX.write_text(json.dumps(index, indent=1))

    print(f"\n[hns] done: {built_ts} tilesets, {built_ly} layouts, "
          f"{len(maps)} maps, {len(index)} index entries")
    print(f"       tilesets → data/tilesets/hns_*")
    print(f"       layouts  → data/layouts/johto/")
    print(f"       maps     → data/maps/johto/")
    print(f"       index    → data/maps/johto_index.json")


if __name__ == "__main__":
    main()
