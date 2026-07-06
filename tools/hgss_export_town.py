#!/usr/bin/env python3
"""
hgss_export_town.py — export a HeartGold overworld town as a self-contained
WebGL scene for the Pokemon Unleashed viewer: terrain + placed building models +
collision grid, plus a verification top-down PNG.

Usage: python3 tools/hgss_export_town.py T20 newbark <a04_4_texset_index>
"""
import os, sys, json, base64, io
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
import nitro_g3d as g
import render_platinum_maps as R
import hgss_map as H

BM = "unpacked/fielddata/build_model/bm_field.narc"


def png_uri(rgba):
    buf = io.BytesIO(); Image.fromarray(rgba, "RGBA").save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def model_meshes(model, texset, up, transform, texcache):
    """Return list of {texture,color,positions,uvs} for a model under transform."""
    out = []
    for mat_idx, tris in model.triangles():
        if not tris:
            continue
        tex_arr = None
        tname = model.mat_texture.get(mat_idx)
        if tname and texset and tname in texset.textures:
            pname = model.mat_palette.get(mat_idx)
            if pname not in texset.palettes:
                pname = texset.default_palette_for(tname)
            key = (id(texset), tname, pname)
            if key not in texcache:
                try:
                    texcache[key] = R.texture_rgba(texset, tname, pname)
                except Exception:
                    texcache[key] = None
            tex_arr = texcache[key]
        pos = []; uv = []
        for t in tris:
            for v in t:
                x, y, z = transform(v.x, v.y, v.z)
                pos += [x, y, z]
                if tex_arr is not None:
                    th, tw = tex_arr.shape[0], tex_arr.shape[1]
                    uv += [v.s / tw, v.t / th]
                else:
                    uv += [0.0, 0.0]
        m = {"positions": pos, "uvs": uv}
        if tex_arr is not None:
            m["texture"] = png_uri(tex_arr); m["color"] = [255, 255, 255]
        else:
            m["texture"] = None; m["color"] = [150, 150, 160]
        out.append(m)
    return out


WATER = ("pond", "swave", "sea", "river")
BLOCK_MAT = WATER + ("fence", "tree")


def terrain_collision(terr, minx, minz, tile, up, perm):
    """Per-tile blocked flag derived from terrain geometry (water/tree/fence)
    plus the 0x8000 building-pad permission. Guaranteed to align with what is
    drawn, sidestepping the fiddly DS permission table."""
    def matclass(nm):
        n = nm.lower()
        return "block" if any(k in n for k in BLOCK_MAT) else "walk"
    kind = {i: matclass(nm) for i, nm in enumerate(terr.mat_names)}
    tally = [{"walk": 0, "block": 0} for _ in range(1024)]
    for mat, tris in terr.triangles():
        k = kind.get(mat, "walk")
        for t in tris:
            cx = sum(v.x for v in t)/3*up; cz = sum(v.z for v in t)/3*up
            c = int((cx-minx)/tile); r = int((cz-minz)/tile)
            if 0 <= c < 32 and 0 <= r < 32:
                tally[r*32+c][k] += 1
    coll = []
    for i in range(1024):
        w, b = tally[i]["walk"], tally[i]["block"]
        blocked = (b > w) or (w == 0 and b == 0)          # water/tree tile, or empty (border)
        if perm[i] == 0x8000:                              # building pad
            blocked = True
        coll.append(1 if blocked else 0)
    return coll


def export(code, name, texset_idx):
    cell = H.find_map_cell(code)
    _, col, row, land_id, hid = cell
    land = H.load_land(land_id)
    terr = g.find_model(land["raw"], land["model_off"])
    up = terr.up_scale
    texset = g.find_tex0(H.rip(f"unpacked/a/0/4/4/{texset_idx:04d}.nsbtx"))
    texcache = {}

    meshes = []
    meshes += model_meshes(terr, texset, up, lambda x, y, z: (x*up, y*up, z*up), texcache)
    n_terrain = len(meshes)

    allx = [p for m in meshes for p in m["positions"][0::3]]
    allz = [p for m in meshes for p in m["positions"][2::3]]
    minx, maxx, minz, maxz = min(allx), max(allx), min(allz), max(allz)
    tile = (maxx - minx) / 32.0

    for b in land["buildings"]:
        bd = H.rip(f"{BM}/{b['model']:04d}.nsbmd")
        bm = g.find_model(bd, 0); btex = g.find_tex0(bd)
        bup = bm.up_scale or 1.0
        def tf(x, y, z, b=b, bup=bup):
            return (x*bup*b["sx"] + b["x"], y*bup*b["sy"] + b["y"], z*bup*b["sz"] + b["z"])
        for msh in model_meshes(bm, btex, bup, tf, texcache):
            msh["building"] = True
            meshes.append(msh)

    coll = terrain_collision(terr, minx, minz, tile, up, land["perm_values"])
    out = {
        "name": name, "code": code, "header": hid,
        "bounds": {"minx": minx, "maxx": maxx, "minz": minz, "maxz": maxz},
        "tile": tile,
        "collision": coll,          # 32x32, 1 = blocked (row*32+col)
        "meshes": meshes,
    }
    os.makedirs("data/unleashed", exist_ok=True)
    p = f"data/unleashed/{name}.json"
    json.dump(out, open(p, "w"))
    tris = sum(len(m["positions"])//9 for m in meshes)
    print(f"wrote {p}: {len(meshes)} meshes, {tris} tris, {os.path.getsize(p)//1024} KB")
    return out, land


def bake_2d(code, name, texset_idx, out):
    """Textured top-down bake (terrain + placed buildings) -> the 2.5D image,
    plus a /tmp collision-overlay for verification."""
    cell = H.find_map_cell(code); land = H.load_land(cell[3])
    terr = g.find_model(land["raw"], land["model_off"]); up = terr.up_scale
    texset = g.find_tex0(H.rip(f"unpacked/a/0/4/4/{texset_idx:04d}.nsbtx"))
    b = out["bounds"]; S = 512
    span = max(b["maxx"]-b["minx"], b["maxz"]-b["minz"]); sc = (S-8)/span
    ox = S/2 - R.HALF_UNITS - (b["minx"]+b["maxx"])/2*sc
    oy = S/2 - R.HALF_UNITS - (b["minz"]+b["maxz"])/2*sc
    fb = np.zeros((S, S, 4), np.uint8); yb = np.full((S, S), -1e9, np.float32)
    R._draw_model_triangles(fb, yb, terr, texset, sc*up, ox, oy)
    for bd in land["buildings"]:
        d = H.rip(f"{BM}/{bd['model']:04d}.nsbmd")
        bm = g.find_model(d, 0); btex = g.find_tex0(d); bup = bm.up_scale or 1.0
        def tf(tri, bd=bd, bup=bup):
            out2 = []
            for v in tri:
                out2.append(g.Vertex(v.x*bup*bd["sx"]+bd["x"], v.y*bup*bd["sy"]+bd["y"],
                                     v.z*bup*bd["sz"]+bd["z"], v.s, v.t))
            return out2
        R._draw_model_triangles(fb, yb, bm, btex, sc, ox, oy, transform=tf)
    Image.fromarray(fb, "RGBA").save(f"data/unleashed/{name}_2d.png")
    # collision overlay
    im = Image.fromarray(fb, "RGBA").convert("RGB")
    dr = ImageDraw.Draw(im, "RGBA"); tw = out["tile"]*sc
    for r in range(32):
        for c in range(32):
            if out["collision"][r*32+c]:
                px = (b["minx"]+(c+0.5)*out["tile"])*sc + R.HALF_UNITS + ox
                py = (b["minz"]+(r+0.5)*out["tile"])*sc + R.HALF_UNITS + oy
                dr.rectangle([px-tw/2, py-tw/2, px+tw/2, py+tw/2], fill=(255, 0, 0, 80))
    im.save(f"/tmp/verify_{name}.png")
    print(f"baked data/unleashed/{name}_2d.png ; overlay /tmp/verify_{name}.png "
          f"({sum(out['collision'])} blocked)")


def all_cells_for_code(code):
    """Every matrix-0 cell (col, row, land_id) that belongs to this map code.
    Overworld towns can span several cells (e.g. Celadon 2x2, Goldenrod 3x2)."""
    names = H.map_names()
    hid = names.index(code)
    m = H.load_matrix(0)
    cells = [(i % m["w"], i // m["w"], m["land"][i])
             for i, h in enumerate(m["headers"]) if h == hid]
    return cells, hid


def bake_full(code, name, texset_idx, out_path=None, S=512):
    """Render a whole town by stitching ALL its matrix cells at fixed scale, so
    multi-cell cities render complete (not just their first cell). Each cell is a
    32-tile / 512-unit footprint centred on its local origin; we place cell
    (col,row) into its S-px grid slot and share one depth buffer, so cells tile
    seamlessly and border geometry overlaps naturally."""
    cells, _ = all_cells_for_code(code)
    if not cells:
        c = H.find_map_cell(code)
        cells = [(c[1], c[2], c[3])]
    texset = g.find_tex0(H.rip(f"unpacked/a/0/4/4/{texset_idx:04d}.nsbtx"))
    mincol = min(c[0] for c in cells); minrow = min(c[1] for c in cells)
    ncol = max(c[0] for c in cells) - mincol + 1
    nrow = max(c[1] for c in cells) - minrow + 1
    fb = np.zeros((nrow * S, ncol * S, 4), np.uint8)
    yb = np.full((nrow * S, ncol * S), -1e9, np.float32)
    for col, row, land in cells:
        L = H.load_land(land)
        terr = g.find_model(L["raw"], L["model_off"]); up = terr.up_scale
        ox = ((col - mincol) + 0.5) * S - R.HALF_UNITS
        oy = ((row - minrow) + 0.5) * S - R.HALF_UNITS
        R._draw_model_triangles(fb, yb, terr, texset, up, ox, oy)
        for bd in L["buildings"]:
            d = H.rip(f"{BM}/{bd['model']:04d}.nsbmd")
            bm = g.find_model(d, 0); btex = g.find_tex0(d); bup = bm.up_scale or 1.0
            def tf(tri, bd=bd, bup=bup):
                return [g.Vertex(v.x * bup * bd["sx"] + bd["x"],
                                 v.y * bup * bd["sy"] + bd["y"],
                                 v.z * bup * bd["sz"] + bd["z"], v.s, v.t) for v in tri]
            R._draw_model_triangles(fb, yb, bm, btex, 1.0, ox, oy, transform=tf)
    out_path = out_path or f"data/unleashed/{name}_full.png"
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    Image.fromarray(fb, "RGBA").convert("RGB").save(out_path)
    print(f"baked {out_path}: {len(cells)} cell(s), {ncol}x{nrow} grid, "
          f"{ncol*S}x{nrow*S}px")
    return out_path


from PIL import ImageDraw
if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    opts = [a for a in sys.argv[1:] if a.startswith("--")]
    code, name, tset = args[0], args[1], int(args[2])
    out_path = None
    for o in opts:
        if o.startswith("--out="):
            out_path = o.split("=", 1)[1]
    if "--full" in opts:
        # Whole-town stitched render (all cells). This is the default for the
        # committed verification renders.
        bake_full(code, name, tset, out_path)
    else:
        out, land = export(code, name, tset)
        bake_2d(code, name, tset, out)
