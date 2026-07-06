#!/usr/bin/env python3
"""
collect_region_3d.py — gather ALL of a region's 3D field-map assets from the
HeartGold (IPKE) ROM extraction into one self-contained per-region folder.

This is the "get the 3D map assets all in one place" collector. It resolves the
exact chain, per region, from the pokeheartgold decomp header table:

    map header (regionNo == KANTO/JOHTO)
      -> matrixId          (a/0/4/1 map-matrix)         -> land-cell ids
      -> areaDataBank       (a/0/4/2 area-data, field0)  -> texture-set id (a/0/4/4)
    land cell (a/0/6/5)
      -> embedded BMD0 terrain/room geometry (raw member copied verbatim)
      -> building placements                             -> bm_field / bm_room ids

Everything collected is a verbatim copy of the ROM's own asset members (binaries
and all), organised so a region folder is self-contained. See ATTRIBUTION.md in
each region folder: these assets are Nintendo / Game Freak / Creatures Inc.,
used with the user's stated permission and credited accordingly.

Matrix format (from pokeheartgold src/map_matrix.c MapMatrix_MapMatrixData_Load):
    u8 width, u8 height, u8 has_headers, u8 has_altitudes, u8 name_len,
    name[name_len],
    [has_headers : w*h u16 header ids],
    [has_altitudes: w*h u8 altitudes],
    w*h u16 models          <- land-cell ids (into a/0/6/5), always present

Usage:
    python3 tools/collect_region_3d.py kanto   [--rom source/nds/IPKE] [--decomp /home/user/pokeheartgold]
"""
import os, re, sys, json, struct, shutil, argparse, glob

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, HERE)


def parse_map_ids(decomp):
    ids = {}
    for l in open(os.path.join(decomp, "include/constants/maps.h")):
        m = re.match(r"#define\s+(MAP_\w+)\s+(\d+)", l)
        if m:
            ids[m.group(1)] = int(m.group(2))
    return ids


def parse_headers(decomp):
    """Return {MAP_NAME: {region, matrix_num, area, mapsec}} from the decomp."""
    txt = open(os.path.join(decomp, "src/data/map_headers.h")).read()
    blocks = re.split(r"\[(MAP_\w+)\]\s*=\s*\{", txt)
    out = {}
    for i in range(1, len(blocks), 2):
        name, body = blocks[i], blocks[i + 1]
        def f(k):
            m = re.search(r"\." + k + r"\s*=\s*([\w]+)", body)
            return m.group(1) if m else None
        mtx = f("matrixId") or ""
        mnum = re.search(r"map_matrix_(\d+)_", mtx)
        area = f("areaDataBank")
        out[name] = {
            "region": f("regionNo"),
            "matrix": int(mnum.group(1)) if mnum else None,
            "area": int(area) if area and area.isdigit() else None,
            "mapsec": f("mapsec"),
        }
    return out


class Rom:
    def __init__(self, root):
        self.root = root

    def path(self, rel):
        return os.path.join(self.root, "unpacked", rel)

    def member(self, narc, idx, ext="bin"):
        exact = self.path(f"{narc}/{idx:04d}.{ext}")
        if os.path.exists(exact):
            return exact
        hits = glob.glob(self.path(f"{narc}/{idx:04d}.*"))
        if not hits:
            raise FileNotFoundError(exact)
        return hits[0]

    def read(self, narc, idx, ext="bin"):
        return open(self.member(narc, idx, ext), "rb").read()

    def load_matrix(self, idx):
        d = self.read("a/0/4/1", idx)
        w, h, hasH, hasA, nl = d[0], d[1], d[2], d[3], d[4]
        off = 5 + nl
        n = w * h
        headers = None
        if hasH:
            headers = struct.unpack_from(f"<{n}H", d, off); off += 2 * n
        if hasA:
            off += n
        models = struct.unpack_from(f"<{n}H", d, off)
        return {"w": w, "h": h, "name": d[5:5 + nl].decode("ascii", "replace"),
                "headers": headers, "models": models}

    def area_texset(self, area):
        """a/0/4/2 record: the 2nd u16 (== the area index) is the FULL texture
        set id into a/0/4/4. (The 1st u16 is a partial/parent set that omits the
        shared road/grass/flower textures — using it leaves the ground grey.)"""
        d = self.read("a/0/4/2", area)
        return struct.unpack_from("<H", d, 2)[0]

    def cell_buildings(self, cell_id, max_model=340):
        """Parse building placements from a land cell (a/0/6/5) build section.

        Records are 48-byte slots: u32 modelId, fx32 x, fx32 y, fx32 z, ...
        Empty slots are filled with markers (0x8006 / 0x0015 / 0x8000 ...), and
        the real records begin at a per-cell alignment offset (New Bark aligns at
        slot 0, Pallet at slot+4). We scan all 48 alignments and keep the one that
        yields the most valid records (small modelId + plausible fx32 position)."""
        d = self.read("a/0/6/5", cell_id)
        sizes = struct.unpack_from("<4I", d, 0)
        build = d[16 + sizes[0]:16 + sizes[0] + sizes[1]]

        def extract(start):
            out = []
            k = start
            # Need only the model id + fx32 position (16 bytes); the final record
            # may have its trailing padding truncated by the section length.
            while k + 16 <= len(build):
                mid = struct.unpack_from("<I", build, k)[0]
                x, y, z = (struct.unpack_from("<i", build, k + o)[0] / 4096.0
                           for o in (4, 8, 12))
                if 0 < mid < max_model and abs(x) < 2000 and abs(z) < 2000 and abs(y) < 400:
                    out.append({"model": mid, "x": x, "y": y, "z": z})
                k += 48
            return out

        best = []
        for start in range(0, 48, 4):
            recs = extract(start)
            if len(recs) > len(best):
                best = recs
        return [r["model"] for r in best]


def collect(region, rom, decomp, out_root):
    region_const = {"kanto": "MAP_REGION_KANTO", "johto": "MAP_REGION_JOHTO"}[region]
    hdr = parse_headers(decomp)
    ids = parse_map_ids(decomp)
    maps = {n: h for n, h in hdr.items() if h["region"] == region_const}

    out = os.path.join(out_root, region)
    for sub in ("land", "textures", "buildings", "rooms"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)

    land_ids, texsets, build_ids = set(), set(), set()
    manifest_maps = {}

    for name, h in sorted(maps.items()):
        if h["matrix"] is None:
            continue
        m = rom.load_matrix(h["matrix"])
        n = m["w"] * m["h"]
        cells = []
        for i in range(n):
            cid = m["models"][i]
            if cid == 0xFFFF:
                continue
            # On the shared overworld (matrix 0) keep only THIS map's cells,
            # identified by the per-cell header id matching this map's numeric id.
            if h["matrix"] == 0 and m["headers"] is not None:
                if m["headers"][i] != ids.get(name):
                    continue
            cells.append(cid)
        cells = sorted(set(cells))
        texset = rom.area_texset(h["area"]) if h["area"] is not None else None
        binfo = []
        for cid in cells:
            land_ids.add(cid)
            try:
                bids = rom.cell_buildings(cid)
            except Exception:
                bids = []
            binfo += bids
        if texset is not None:
            texsets.add(texset)
        interior = h["matrix"] != 0
        for b in binfo:
            build_ids.add((b, interior))
        manifest_maps[name] = {
            "mapsec": h["mapsec"], "matrix": h["matrix"],
            "texset": texset, "cells": cells,
        }

    # copy verbatim binaries
    for cid in sorted(land_ids):
        shutil.copy(rom.member("a/0/6/5", cid), os.path.join(out, "land", f"{cid:04d}.bin"))
    for t in sorted(texsets):
        shutil.copy(rom.member("a/0/4/4", t, "nsbtx"),
                    os.path.join(out, "textures", f"{t:04d}.nsbtx"))
    bm_field = rom.path("fielddata/build_model/bm_field.narc")
    bm_room = rom.path("fielddata/build_model/bm_room.narc")
    n_field = len(os.listdir(bm_field))
    n_room = len(os.listdir(bm_room))
    def copy_model(narc_dir, bid, dest_dir, seen, limit):
        if bid >= limit or bid in seen:
            return
        hits = glob.glob(os.path.join(narc_dir, f"{bid:04d}.*"))
        if hits:
            ext = os.path.splitext(hits[0])[1]
            shutil.copy(hits[0], os.path.join(dest_dir, f"{bid:04d}{ext}"))
            seen.add(bid)

    copied_field, copied_room = set(), set()
    for bid, interior in sorted(build_ids):
        if interior:
            copy_model(bm_room, bid, os.path.join(out, "rooms"), copied_room, n_room)
        else:
            copy_model(bm_field, bid, os.path.join(out, "buildings"), copied_field, n_field)

    manifest = {
        "region": region, "source_rom": "Pokemon HeartGold (IPKE)",
        "counts": {"maps": len(manifest_maps), "land_cells": len(land_ids),
                   "texsets": len(texsets), "building_models": len(copied_field),
                   "room_models": len(copied_room)},
        "layout": {"land": "a/0/6/5 land-data cells (embedded BMD0 terrain/room geometry)",
                   "textures": "a/0/4/4 NSBTX texture sets",
                   "buildings": "fielddata/build_model/bm_field.narc models",
                   "rooms": "fielddata/build_model/bm_room.narc models"},
        "maps": manifest_maps,
    }
    json.dump(manifest, open(os.path.join(out, "MANIFEST.json"), "w"), indent=1)

    attribution = (
        "# Attribution\n\n"
        "All 3D map assets in this folder are extracted from **Pokemon HeartGold "
        "Version** (Nintendo DS).\n\n"
        "**(c) Nintendo / Creatures Inc. / GAME FREAK inc.**\n\n"
        "Pokemon and all related assets, models, textures, and map geometry are the "
        "property of Nintendo, Creatures Inc., and GAME FREAK inc. They are used here "
        "with permission and are credited to their owners. This project claims no "
        "ownership of any Nintendo/Game Freak/Creatures intellectual property.\n\n"
        f"Region: {region.title()}\n"
        "Source: Pokemon HeartGold (IPKE) ROM\n"
    )
    open(os.path.join(out, "ATTRIBUTION.md"), "w").write(attribution)

    print(json.dumps(manifest["counts"], indent=1))
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("region", choices=["kanto", "johto"])
    ap.add_argument("--rom", default=os.path.join(REPO, "source/nds/IPKE"))
    ap.add_argument("--decomp", default="/home/user/pokeheartgold")
    ap.add_argument("--out", default=os.path.join(REPO, "assets_3d"))
    a = ap.parse_args()
    out = collect(a.region, Rom(a.rom), a.decomp, a.out)
    print("collected ->", out)
