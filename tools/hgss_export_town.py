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


def export(code, name, texset_idx):
    cell = H.find_map_cell(code)
    _, col, row, land_id, hid = cell
    land = H.load_land(land_id)
    terr = g.find_model(land["raw"], land["model_off"])
    up = terr.up_scale
    texset = g.find_tex0(H.rip(f"unpacked/a/0/4/4/{texset_idx:04d}.nsbtx"))
    texcache = {}

    meshes = []
    # terrain (raw verts * up_scale = world units, Y up)
    meshes += model_meshes(terr, texset, up, lambda x, y, z: (x*up, y*up, z*up), texcache)

    # bounds from terrain
    allx = [p for m in meshes for p in m["positions"][0::3]]
    ally = [p for m in meshes for p in m["positions"][1::3]]
    allz = [p for m in meshes for p in m["positions"][2::3]]
    minx, maxx, minz, maxz = min(allx), max(allx), min(allz), max(allz)

    # buildings: bm_field model, own embedded texture, scaled + translated
    for b in land["buildings"]:
        bd = H.rip(f"{BM}/{b['model']:04d}.nsbmd")
        bm = g.find_model(bd, 0); btex = g.find_tex0(bd)
        bup = bm.up_scale or 1.0
        def tf(x, y, z, b=b, bup=bup):
            return (x*bup*b["sx"] + b["x"], y*bup*b["sy"] + b["y"], z*bup*b["sz"] + b["z"])
        meshes += model_meshes(bm, btex, bup, tf, texcache)

    tile = (maxx - minx) / 32.0
    out = {
        "name": name, "code": code, "header": hid,
        "bounds": {"minx": minx, "maxx": maxx, "minz": minz, "maxz": maxz},
        "tile": tile,
        "collision": land["collision"],          # 32x32, 1 = blocked (col-major row*32+col)
        "meshes": meshes,
    }
    os.makedirs("data/unleashed", exist_ok=True)
    p = f"data/unleashed/{name}.json"
    json.dump(out, open(p, "w"))
    tris = sum(len(m["positions"])//9 for m in meshes)
    print(f"wrote {p}: {len(meshes)} meshes, {tris} tris, {os.path.getsize(p)//1024} KB")
    return out, land


def verify_png(out, land, name):
    """Top-down render of terrain+buildings with collision overlay."""
    b = out["bounds"]; S = 448
    span = max(b["maxx"]-b["minx"], b["maxz"]-b["minz"]); sc = (S-8)/span
    cx, cz = (b["minx"]+b["maxx"])/2, (b["minz"]+b["maxz"])/2
    fb = np.zeros((S, S, 4), np.uint8); yb = np.full((S, S), -1e9, np.float32)
    for m in out["meshes"]:
        P = m["positions"]; tex = None
        col = tuple(m["color"])
        for i in range(0, len(P), 9):
            xs = [P[i], P[i+3], P[i+6]]; ys = [P[i+1], P[i+4], P[i+7]]; zs = [P[i+2], P[i+5], P[i+8]]
            sx = [int((x-cx)*sc + S/2) for x in xs]; sy = [int((z-cz)*sc + S/2) for z in zs]
            d = ys[0]+ys[1]+ys[2]
            _tri(fb, yb, sx, sy, d, col)
    im = Image.fromarray(fb, "RGBA").convert("RGB")
    from PIL import ImageDraw
    dr = ImageDraw.Draw(im, "RGBA")
    tw = span/32*sc
    for r in range(32):
        for c in range(32):
            if land["collision"][r*32+c]:
                px = (b["minx"]+(c+0.5)*out["tile"]-cx)*sc + S/2
                py = (b["minz"]+(r+0.5)*out["tile"]-cz)*sc + S/2
                dr.rectangle([px-tw/2, py-tw/2, px+tw/2, py+tw/2], fill=(255, 0, 0, 70))
    im.save(f"/tmp/verify_{name}.png")
    print(f"verify /tmp/verify_{name}.png")


def _tri(fb, yb, sx, sy, depth, col):
    minx = max(min(sx), 0); maxx = min(max(sx), fb.shape[1]-1)
    miny = max(min(sy), 0); maxy = min(max(sy), fb.shape[0]-1)
    for y in range(miny, maxy+1):
        for x in range(minx, maxx+1):
            d = (sy[1]-sy[2])*(sx[0]-sx[2])+(sx[2]-sx[1])*(sy[0]-sy[2])
            if d == 0: continue
            a = ((sy[1]-sy[2])*(x-sx[2])+(sx[2]-sx[1])*(y-sy[2]))/d
            bb = ((sy[2]-sy[0])*(x-sx[2])+(sx[0]-sx[2])*(y-sy[2]))/d
            cc = 1-a-bb
            if a >= -.02 and bb >= -.02 and cc >= -.02:
                if depth >= yb[y, x]:
                    yb[y, x] = depth; fb[y, x] = (col[0], col[1], col[2], 255)


if __name__ == "__main__":
    code, name, tset = sys.argv[1], sys.argv[2], int(sys.argv[3])
    out, land = export(code, name, tset)
    verify_png(out, land, name)
