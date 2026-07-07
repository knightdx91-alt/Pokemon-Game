#!/usr/bin/env python3
"""
render_oras_town.py — Stitch and render a MULTI-CELL Omega Ruby town/area in 3D.

ORAS overworld areas are split into a grid of map-model cells named
`world<AA>_<COL>_<ROW>` (e.g. Littleroot = world01_02_04). Each cell is a
separate a/0/3/9 model in LOCAL (origin-centred) coordinates; the world layout is
the grid, so a cell (col,row) is placed at world offset (col*pitch, 0, row*pitch).
Rendering one cell alone (render_oras_3d.py) shows only that tile — the full town
+ its tree borders live in the neighbouring cells. This tool gathers every cell
of one `world<AA>` grid, offsets each by its grid position, and renders the whole
area with the same look-at camera + exact mesh→material binding as render_oras_3d.

Usage:
  python3 tools/render_oras_town.py world01           # whole area
  ORAS_PITCH=512 ORAS_AZ=0 ORAS_ELEV=50 python3 tools/render_oras_town.py world01
"""
import math
import os
import re
import struct
import sys

import numpy as np
from PIL import Image

import bch
import render_oras_maps as R

MODEL_DIR = R.MODEL_DIR
CULL = {"chip_wind", "chip_wood_shadow", "t101_a01", "projection_dummy", None}


def cells_for(area):
    """Return {(col,row): member} for every `world<AA>_col_row` map model."""
    out = {}
    for f in sorted(os.listdir(MODEL_DIR)):
        if not f.endswith(".bin"):
            continue
        mem = f[:-4]
        try:
            d = open(os.path.join(MODEL_DIR, f), "rb").read()
            if d[:2] != b"GR":
                continue
            off = struct.unpack_from("<I", d, 8)[0] & 0x7FFFFFFF
            m = bch.BCH(d, off)
            nm = m.find_map_model()
            if not nm or not nm.get("name"):
                continue
            mo = re.match(rf"{area}_(\d\d)_(\d\d)", nm["name"])
            if mo:
                out[(int(mo.group(1)), int(mo.group(2)))] = mem
        except Exception:
            pass
    return out


def cell_triangles(mem, res):
    """Yield (image_or_None, [ (x,y,z,u,v)*3 ]) for one cell, exact binding."""
    d = open(os.path.join(MODEL_DIR, f"{mem}.bin"), "rb").read()
    off = struct.unpack_from("<I", d, 8)[0] & 0x7FFFFFFF
    model = bch.BCH(d, off)
    out = []
    for dc in model.mesh_draws():
        if dc["index_addr"] is None or dc["stride"] < 0x18:
            continue
        tn = dc.get("texture")
        if tn in CULL:
            continue
        im = res.get(tn)
        st, vbo, ib = dc["stride"], dc["vbuf_off"], dc["index_addr"]
        uvo = 0x18 if st >= 0x20 else 0x0C
        tris, cur = [], []
        for k in range(dc["count"]):
            vi = struct.unpack_from("<H", model.data, ib + k * 2)[0]
            o = vbo + vi * st
            if o + uvo + 8 > len(model.data):
                cur = []
                break
            cur.append(tuple(struct.unpack_from("<f", model.data, o + j)[0]
                             for j in (0, 4, 8, uvo, uvo + 4)))
            if len(cur) == 3:
                if all(math.isfinite(c) and abs(c) < 8192 for v in cur for c in v[:3]):
                    tris.append(cur)
                cur = []
        if tris:
            out.append((im, tris))
    return out


def render(area, S=1100):
    index = R.load_index()
    res = R.TexResolver(index)
    cells = cells_for(area)
    if not cells:
        print(f"no cells for {area}")
        return None
    pitch = float(os.environ.get("ORAS_PITCH", "512"))
    print(f"  {area}: {len(cells)} cells {sorted(cells)} pitch={pitch}")

    # Offset each cell's triangles by grid position. +col = +X (east), +row = +Z
    # (south; Littleroot row 4 is the south end, houses face the camera).
    meshes = []
    for (col, row), mem in cells.items():
        ox, oz = col * pitch, row * pitch
        for im, tris in cell_triangles(mem, res):
            shifted = [tuple((v[0] + ox, v[1], v[2] + oz, v[3], v[4]) for v in t)
                       for t in tris]
            meshes.append((im, shifted))

    pts = [v for _, tris in meshes for t in tris for v in t]
    cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
    cz = (min(p[2] for p in pts) + max(p[2] for p in pts)) / 2
    cyc = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2

    az = math.radians(float(os.environ.get("ORAS_AZ", "0")))
    elev = math.radians(float(os.environ.get("ORAS_ELEV", "52")))
    dist = float(os.environ.get("ORAS_DIST", str(pitch * 3)))
    F = float(os.environ.get("ORAS_F", "900"))
    tgt = np.array([cx, cyc, cz])
    eye = tgt + dist * np.array([math.sin(az) * math.cos(elev),
                                 math.sin(elev), math.cos(az) * math.cos(elev)])
    fwd = tgt - eye
    fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, [0, 1, 0])
    right /= np.linalg.norm(right)
    up = np.cross(right, fwd)

    def proj(v):
        rel = np.array([v[0], v[1], v[2]]) - eye
        zc = float(rel @ fwd)
        if zc < 1:
            return None
        return (S / 2 + float(rel @ right) * F / zc, S / 2 - float(rel @ up) * F / zc, zc)

    fb = np.zeros((S, S, 3), np.uint8)
    fb[:] = (120, 175, 95)
    zb = np.full((S, S), 1e18)
    light = np.array([0.3, 0.8, 0.4])
    light /= np.linalg.norm(light)
    for im, tris in meshes:
        for t in tris:
            A, B, C = (np.array(t[k][:3]) for k in range(3))
            n = np.cross(B - A, C - A)
            ln = float(np.linalg.norm(n))
            sh = 0.55 + 0.45 * abs(float((n / ln) @ light)) if ln > 1e-6 else 0.75
            P = [proj(v) for v in t]
            if any(p is None for p in P):
                continue
            px = [p[0] for p in P]
            py = [p[1] for p in P]
            dep = [p[2] for p in P]
            den = (py[1] - py[2]) * (px[0] - px[2]) + (px[2] - px[1]) * (py[0] - py[2])
            if abs(den) < 1e-6:
                continue
            for X in range(max(0, int(min(px))), min(S, int(max(px)) + 1)):
                for Y in range(max(0, int(min(py))), min(S, int(max(py)) + 1)):
                    a = ((py[1] - py[2]) * (X - px[2]) + (px[2] - px[1]) * (Y - py[2])) / den
                    b = ((py[2] - py[0]) * (X - px[2]) + (px[0] - px[2]) * (Y - py[2])) / den
                    c = 1 - a - b
                    if a < -.02 or b < -.02 or c < -.02:
                        continue
                    zc = a * dep[0] + b * dep[1] + c * dep[2]
                    if zc >= zb[Y, X]:
                        continue
                    if im:
                        img, tw, th = im
                        u = a * t[0][3] + b * t[1][3] + c * t[2][3]
                        vv = a * t[0][4] + b * t[1][4] + c * t[2][4]
                        if not (math.isfinite(u) and math.isfinite(vv)):
                            continue
                        texel = img[int(vv * th) % th, int(u * tw) % tw]
                        if texel[3] < 96:
                            continue
                        fb[Y, X] = [min(255, int(texel[j] * sh)) for j in range(3)]
                        zb[Y, X] = zc
    return Image.fromarray(fb, "RGB")


def main(argv):
    area = next((a for a in argv if not a.startswith("--")), "world01")
    img = render(area)
    if img is None:
        return
    out = f"/tmp/oras_town_{area}.png"
    img.save(out)
    print(f"  {area}: {img.width}x{img.height} -> {out}")


if __name__ == "__main__":
    main(sys.argv[1:])
