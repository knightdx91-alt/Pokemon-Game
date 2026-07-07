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


def render(model_mem, index, S=900):
    d = open(os.path.join(R.MODEL_DIR, f"{model_mem}.bin"), "rb").read()
    off = struct.unpack_from("<I", d, 8)[0] & 0x7FFFFFFF
    model = bch.BCH(d, off)
    R._draw_triangles.res = R.TexResolver(index)
    meshes = list(R._draw_triangles(model))
    pts = [v for _, tris in meshes for t in tris for v in t]
    if not pts:
        return None
    cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
    cz = (min(p[2] for p in pts) + max(p[2] for p in pts)) / 2

    yaw = math.radians(float(os.environ.get("ORAS_YAW", "25")))
    pitch = math.radians(float(os.environ.get("ORAS_PITCH", "38")))
    dist = float(os.environ.get("ORAS_DIST", "780"))
    cy, sy = math.cos(pitch), math.sin(pitch)
    cyw, syw = math.cos(yaw), math.sin(yaw)
    F = 650.0

    def project(v):
        p0, p1, p2 = v[0] - cx, v[1], v[2] - cz
        x = p0 * cyw - p2 * syw
        z = p0 * syw + p2 * cyw
        y2 = p1 * cy - z * sy
        z2 = p1 * sy + z * cy
        zc = z2 + dist
        if zc < 1:
            return None
        return (S / 2 + x * F / zc, S / 2 - (y2 - 90) * F / zc, zc)

    fb = np.zeros((S, S, 3), np.uint8)
    zb = np.full((S, S), 1e18)
    for im, tris in meshes:
        for t in tris:
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
                        fb[Y, X] = texel[:3]
                    else:
                        fb[Y, X] = (90, 170, 80)
                    zb[Y, X] = zc
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
