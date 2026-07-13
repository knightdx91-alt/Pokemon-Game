#!/usr/bin/env python3
"""
render_oras_3d.py — Render a decoded Omega Ruby field map from a real 3D
PERSPECTIVE camera (not the flat top-down bake of render_oras_maps.py).

This proves the map is genuine 3D: terrain relief, cliff height, tree volume and
building fronts are visible because the camera has yaw+pitch and true perspective
divide. It reuses render_oras_maps._draw_triangles (exact texture binding) so the
only difference from the top-down tool is the projection.

Usage:
  python3 tools/render_oras_3d.py 0006          # Littleroot -> /tmp/oras_3d_0006.png
  ORAS_YAW=25 ORAS_PITCH=38 python3 tools/render_oras_3d.py 0006
"""
import math
import os
import struct
import sys

import numpy as np
from PIL import Image

import bch
import render_oras_maps as R


# Meshes to cull from the static render: `chip_wind` = a flat y=0 alpha wind
# overlay that reads as a black smear; `chip_kusa_b` = tall-grass BILLBOARD
# planes that streak when seen edge-on (in-engine they face the camera);
# `chip_wood_shadow` = dark blob shadows painted opaque. Cull-by-name until the
# billboard/alpha compositing is implemented.
# Cull only genuine overlay/shadow meshes: `chip_wind` = a mostly-transparent
# sparkle overlay; `chip_wood_shadow` + `t101_a01` = dark navy (31,39,55) shadow
# layers that paint as black bands winding across the map. Keep `chip_kusa_b`
# (green) — it's the border trees/bushes, wrongly culled before (missing trees).
CULL = {"chip_wind", "chip_wood_shadow", "t101_a01", "projection_dummy", None}


def render(model_mem, index, S=900):
    d = open(os.path.join(R.MODEL_DIR, f"{model_mem}.bin"), "rb").read()
    off = struct.unpack_from("<I", d, 8)[0] & 0x7FFFFFFF
    model = bch.BCH(d, off)
    res = R.TexResolver(index)
    R._draw_triangles.res = res
    # Own name-aware draw loop so CULL (by texture name) works.
    meshes = []
    for dc in model.mesh_draws():
        if dc["index_addr"] is None or dc["stride"] < 0x18:
            continue
        name = dc.get("texture")
        if name in CULL:
            continue
        im = res.get(name)
        st, vbo, ib = dc["stride"], dc["vbuf_off"], dc["index_addr"]
        uvo = 0x18 if st >= 0x20 else 0x0C
        tris, cur = [], []
        for i in range(dc["count"]):
            vi = struct.unpack_from("<H", model.data, ib + i * 2)[0]
            o = vbo + vi * st
            if o + uvo + 8 > len(model.data):
                cur = []
                break
            cur.append(tuple(struct.unpack_from("<f", model.data, o + k)[0]
                             for k in (0, 4, 8, uvo, uvo + 4)))
            if len(cur) == 3:
                if all(math.isfinite(c) and abs(c) < 8192 for v in cur for c in v[:3]):
                    tris.append(cur)
                cur = []
        if tris:
            meshes.append((im, tris))
    pts = [v for _, tris in meshes for t in tris for v in t]
    if not pts:
        return None
    cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
    cz = (min(p[2] for p in pts) + max(p[2] for p in pts)) / 2
    cyc = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2

    # Proper LOOK-AT camera (fixes the earlier ad-hoc projection that viewed the
    # map's UNDERSIDE). The DS/3DS overworld camera sits ABOVE and to the SOUTH,
    # tilted down onto the top surface, looking north — so building fronts
    # (doors/windows) face the camera. In this model -Z is north (houses at
    # z≈-295), so the eye is placed on the +Z (south) side, elevated.
    #   ORAS_AZ  = azimuth about the vertical axis (deg, 0 = due south)
    #   ORAS_ELEV= elevation above the horizon (deg; ~50 ≈ the real ORAS tilt)
    #   ORAS_DIST= eye distance from the target
    az = math.radians(float(os.environ.get("ORAS_AZ", os.environ.get("ORAS_YAW", "0"))))
    elev = math.radians(float(os.environ.get("ORAS_ELEV", "52")))
    dist = float(os.environ.get("ORAS_DIST", "820"))
    F = float(os.environ.get("ORAS_F", "820"))
    target = np.array([cx, cyc, cz])
    eye = target + dist * np.array([math.sin(az) * math.cos(elev),
                                    math.sin(elev),
                                    math.cos(az) * math.cos(elev)])
    fwd = target - eye
    fwd = fwd / np.linalg.norm(fwd)
    right = np.cross(fwd, np.array([0.0, 1.0, 0.0]))
    right = right / np.linalg.norm(right)
    up = np.cross(right, fwd)

    def project(v):
        rel = np.array([v[0], v[1], v[2]]) - eye
        zc = float(rel @ fwd)                 # depth in front of camera
        if zc < 1:
            return None
        xc = float(rel @ right)
        yc = float(rel @ up)
        return (S / 2 + xc * F / zc, S / 2 - yc * F / zc, zc)

    fb = np.zeros((S, S, 3), np.uint8)
    fb[:] = (120, 175, 95)          # grass-green background (no black voids)
    zb = np.full((S, S), 1e18)
    light = np.array([0.3, 0.8, 0.4])
    light /= np.linalg.norm(light)
    for im, tris in meshes:
        for t in tris:
            A, B, C = (np.array(t[k][:3]) for k in range(3))
            n = np.cross(B - A, C - A)
            ln = float(np.linalg.norm(n))
            shade = 0.55 + 0.45 * abs(float((n / ln) @ light)) if ln > 1e-6 else 0.75
            P = [project(v) for v in t]
            if any(p is None for p in P):
                continue
            px = [p[0] for p in P]
            py = [p[1] for p in P]
            dep = [p[2] for p in P]
            x0, x1 = int(min(px)), int(max(px)) + 1
            y0, y1 = int(min(py)), int(max(py)) + 1
            den = (py[1] - py[2]) * (px[0] - px[2]) + (px[2] - px[1]) * (py[0] - py[2])
            if abs(den) < 1e-6:
                continue
            for X in range(max(0, x0), min(S, x1)):
                for Y in range(max(0, y0), min(S, y1)):
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
                        v = a * t[0][4] + b * t[1][4] + c * t[2][4]
                        texel = img[int(v * th) % th, int(u * tw) % tw]
                        if texel[3] < 96:
                            continue
                        fb[Y, X] = [min(255, int(texel[k] * shade)) for k in range(3)]
                        zb[Y, X] = zc
                    else:
                        continue
    return Image.fromarray(fb, "RGB")


def main(argv):
    index = R.load_index()
    for mem in [a for a in argv if not a.startswith("--")] or ["0006"]:
        img = render(mem, index)
        if img is None:
            print(f"  {mem}: no geometry")
            continue
        out = f"/tmp/oras_3d_{mem}.png"
        img.save(out)
        print(f"  {mem}: {img.width}x{img.height} -> {out}")


if __name__ == "__main__":
    main(sys.argv[1:])
