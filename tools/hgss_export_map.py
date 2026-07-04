#!/usr/bin/env python3
"""
hgss_export_map.py — Export one HeartGold land-data cell (a/0/6/*) as a
self-contained WebGL scene JSON for the Pokémon Unleashed 3D viewer.

Terrain 3D models live in a/0/6 (per-cell BMD0, geometry only, no textures).
Their materials reference an area texture set (NSBTX) in a/0/4/4. This tool
pairs a cell with a texset, decodes every textured triangle via nitro_g3d, and
emits data/unleashed/<name>.json:

  { "name", "up_scale", "bounds":{minx,maxx,miny,maxy,minz,maxz},
    "meshes":[ { "texture": <PNG data-URI or null>, "color":[r,g,b],
                 "positions":[x,y,z, ...], "uvs":[u,v, ...] } ] }

Positions are in DS world units (raw * up_scale); Y is up. UVs are normalized
to the material texture (may exceed 0..1 → wrap: repeat in the viewer).

Usage:
  python3 tools/hgss_export_map.py <cell.bin> <texset.nsbtx> <out_name>
"""
import sys, os, json, base64, io
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
import nitro_g3d as g


def png_data_uri(rgba: np.ndarray) -> str:
    im = Image.fromarray(rgba, "RGBA")
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def export(cell_path, texset_path, out_name):
    d = open(cell_path, "rb").read()
    mi = d.find(b"BMD0")
    if mi < 0:
        raise SystemExit("no BMD0 in cell")
    model = g.find_model(d, mi)
    up = model.up_scale
    texset = g.find_tex0(open(texset_path, "rb").read())

    meshes = []
    bx = [1e9, -1e9]; by = [1e9, -1e9]; bz = [1e9, -1e9]
    tex_cache = {}
    for mat_idx, tris in model.triangles():
        if not tris:
            continue
        tname = model.mat_texture.get(mat_idx)
        tex_arr = None; tw = th = 1
        if tname and texset and tname in texset.textures:
            pname = model.mat_palette.get(mat_idx)
            if pname not in texset.palettes:
                pname = texset.default_palette_for(tname)
            key = (tname, pname)
            if key not in tex_cache:
                try:
                    a = g.__dict__.get("texture_rgba")
                    # texture_rgba lives in render_platinum_maps; import lazily
                    import render_platinum_maps as R
                    tex_cache[key] = R.texture_rgba(texset, tname, pname)
                except Exception:
                    tex_cache[key] = None
            tex_arr = tex_cache[key]
        pos = []; uv = []
        for t in tris:
            for v in t:
                x, y, z = v.x * up, v.y * up, v.z * up
                pos += [x, y, z]
                bx[0] = min(bx[0], x); bx[1] = max(bx[1], x)
                by[0] = min(by[0], y); by[1] = max(by[1], y)
                bz[0] = min(bz[0], z); bz[1] = max(bz[1], z)
                if tex_arr is not None:
                    th, tw = tex_arr.shape[0], tex_arr.shape[1]
                    uv += [v.s / tw, v.t / th]
                else:
                    uv += [0.0, 0.0]
        mesh = {"positions": pos, "uvs": uv}
        if tex_arr is not None:
            mesh["texture"] = png_data_uri(tex_arr)
            mesh["color"] = [255, 255, 255]
        else:
            mesh["texture"] = None
            mesh["color"] = [140, 170, 120]
        meshes.append(mesh)

    out = {
        "name": out_name,
        "up_scale": up,
        "bounds": {"minx": bx[0], "maxx": bx[1], "miny": by[0],
                   "maxy": by[1], "minz": bz[0], "maxz": bz[1]},
        "meshes": meshes,
    }
    os.makedirs("data/unleashed", exist_ok=True)
    p = f"data/unleashed/{out_name}.json"
    json.dump(out, open(p, "w"))
    ntex = sum(1 for m in meshes if m["texture"])
    print(f"wrote {p}: {len(meshes)} meshes ({ntex} textured), "
          f"{sum(len(m['positions'])//9 for m in meshes)} tris, "
          f"{os.path.getsize(p)//1024} KB")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__); raise SystemExit(1)
    export(sys.argv[1], sys.argv[2], sys.argv[3])
