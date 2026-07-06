#!/usr/bin/env python3
"""
collect_sinnoh_3d.py — gather all of Sinnoh's 3D field-map assets from the
pokeplatinum decomp into one self-contained folder, the SAME way the HeartGold
collector (collect_region_3d.py) does for Kanto/Johto.

Unlike HeartGold (extracted from the ROM), Pokémon Platinum's assets ship
decoded in the pokeplatinum decomp's `res/field/` tree, so no ROM extraction is
needed. The resolved chain (see tools/platinum_common.py):

    map header (regionNo is always Sinnoh) -> matrix -> land-cell indices
      land cell   = res/field/maps/data/map_data_<NNN>.bin  (terrain + embedded
                    BMD0 geometry + prop placements)
      texture set = area_data.mapTextureSet -> res/field/maps/texture_sets/
                    map_texture_set_<MMM>.nsbtx
      prop models = land-cell prop records' model_id -> global prop order ->
                    res/field/props/models/<name>.nsbmd
      prop texset = area_data.mapPropSet index -> res/field/props/texture_sets/
                    prop_texture_set_<III>.nsbtx

Output (mirrors assets_3d/<region>/):
    assets_3d/sinnoh/{land,textures,buildings}/  + MANIFEST.json + ATTRIBUTION.md

Usage:
    python3 tools/collect_sinnoh_3d.py   [--decomp /home/user/pokeplatinum]
"""
import os, sys, json, shutil, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import platinum_common as pc
import render_platinum_maps as R


def collect(out_root):
    catalog, _ = pc.build_catalog()

    out = os.path.join(out_root, "sinnoh")
    for sub in ("land", "textures", "buildings"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)

    land_ids, texsets, prop_texsets, prop_models = set(), set(), set(), set()
    manifest_maps = {}
    order = R.prop_order()

    for name, e in sorted(catalog.items()):
        area = e["area_data_id"]
        texset = R.area_texture_set(area) if area else None
        prop_idx = R.area_prop_set_index(area) if area else None
        cells = sorted({c["land_index"] for c in e["cells"]
                        if c["land_index"] is not None})
        for cid in cells:
            land_ids.add(cid)
            try:
                land = pc.load_land_data(cid)
            except FileNotFoundError:
                continue
            for p in land["props"]:
                mid = p["model_id"]
                if 0 <= mid < len(order):
                    prop_models.add(order[mid])
        if texset:
            texsets.add(texset)
        if prop_idx is not None:
            prop_texsets.add(prop_idx)
        manifest_maps[name] = {
            "matrix": e["matrix_id"], "area_data": area,
            "map_type": e["map_type"], "texset": texset,
            "prop_set": prop_idx, "cells": cells,
        }

    # copy verbatim binaries -------------------------------------------------
    for cid in sorted(land_ids):
        src = os.path.join(pc.LANDDATA_DIR, f"map_data_{cid:03d}.bin")
        if os.path.isfile(src):
            shutil.copy(src, os.path.join(out, "land", f"{cid:03d}.bin"))
    for t in sorted(texsets):
        src = os.path.join(R.TEXSET_DIR, t + ".nsbtx")
        if os.path.isfile(src):
            shutil.copy(src, os.path.join(out, "textures", t + ".nsbtx"))
    for i in sorted(prop_texsets):
        src = os.path.join(R.PROP_TEXSET_DIR, f"prop_texture_set_{i:03d}.nsbtx")
        if os.path.isfile(src):
            shutil.copy(src, os.path.join(out, "textures", f"prop_texture_set_{i:03d}.nsbtx"))
    n_models = 0
    for fn in sorted(prop_models):
        src = os.path.join(R.PROP_MODEL_DIR, fn)
        if os.path.isfile(src):
            shutil.copy(src, os.path.join(out, "buildings", fn))
            n_models += 1

    manifest = {
        "region": "sinnoh", "source": "Pokemon Platinum (CPUE) via pokeplatinum decomp",
        "counts": {"maps": len(manifest_maps), "land_cells": len(land_ids),
                   "map_texsets": len(texsets), "prop_texsets": len(prop_texsets),
                   "prop_models": n_models},
        "layout": {"land": "res/field/maps/data land cells (embedded BMD0 terrain geometry)",
                   "textures": "map_texture_set + prop_texture_set NSBTX",
                   "buildings": "res/field/props/models prop NSBMD (buildings/trees/doors)"},
        "maps": manifest_maps,
    }
    json.dump(manifest, open(os.path.join(out, "MANIFEST.json"), "w"), indent=1)

    open(os.path.join(out, "ATTRIBUTION.md"), "w").write(
        "# Attribution\n\n"
        "All 3D map assets in this folder are from **Pokemon Platinum Version** "
        "(Nintendo DS).\n\n"
        "**(c) Nintendo / Creatures Inc. / GAME FREAK inc.**\n\n"
        "Pokemon and all related assets, models, textures, and map geometry are the "
        "property of Nintendo, Creatures Inc., and GAME FREAK inc. They are used here "
        "with permission and are credited to their owners. This project claims no "
        "ownership of any Nintendo/Game Freak/Creatures intellectual property.\n\n"
        "Region: Sinnoh\nSource: Pokemon Platinum (CPUE)\n")

    print(json.dumps(manifest["counts"], indent=1))
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--decomp", default="/home/user/pokeplatinum")
    ap.add_argument("--out", default=os.path.join(REPO, "assets_3d"))
    a = ap.parse_args()
    d = a.decomp
    pc.PLAT_ROOT = d
    pc.HEADERS_H = os.path.join(d, "include", "data", "map_headers.h")
    pc.MATRIX_DIR = os.path.join(d, "res", "field", "matrices")
    pc.LANDDATA_DIR = os.path.join(d, "res", "field", "maps", "data")
    pc.AREADATA_DIR = os.path.join(d, "res", "field", "area_data")
    # render_platinum_maps computed its asset paths at import time; rebind them.
    R.PROP_MODEL_DIR = os.path.join(d, "res", "field", "props", "models")
    R.PROP_TEXSET_DIR = os.path.join(d, "res", "field", "props", "texture_sets")
    R.PROP_ORDER_FILE = os.path.join(R.PROP_MODEL_DIR, "map_prop_models.order")
    R.TEXSET_DIR = os.path.join(d, "res", "field", "maps", "texture_sets")
    R.AREA_DIR = pc.AREADATA_DIR
    R._prop_order = None
    # parse_map_headers captured HEADERS_H as a default arg at def time; rebind.
    _orig_pmh = pc.parse_map_headers
    pc.parse_map_headers = lambda path=pc.HEADERS_H: _orig_pmh(path)
    print("collected ->", collect(a.out))
