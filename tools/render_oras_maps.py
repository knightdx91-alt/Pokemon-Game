#!/usr/bin/env python3
"""
render_oras_maps.py — Render Pokémon Omega Ruby (3DS) field-map terrain to a
flat top-down textured PNG, the Gen-6 counterpart to render_platinum_maps.py.

Pipeline (all decoders proven in tools/bch.py — see assets_3d/hoenn/RECON.md):
  1. Map model  = a/0/3/9/<mem>.bin  (GR container → BCH; BCH.map_triangles()
     yields textured triangles, BCH.pica_draw_calls() the per-mesh draws).
  2. Textures   = a/1/5/2/<mem>.bch  (BCH.pica_textures() → ETC1 units;
     bch.decode_etc1() decodes them). Matched to the model by texture-name
     overlap (see find_texture_bch()).
  3. Rasterize  = orthographic top-down, Y-buffer, affine UV sampling.

STATUS: geometry + UV + ETC1 texture sampling are VERIFIED end-to-end (the map's
cliff/rock meshes texture correctly). The material→texture *binding* is still
approximate — meshes are paired to textures by draw order because the exact
mesh→material→texture-name link needs the BCH Textures patricia-dict resolved
(the last open item in RECON.md). So this bakes a real-textured PREVIEW, not yet
the pixel-exact asset. Do not commit its output into assets_3d/ until the
binding is exact.

Usage:
  python3 tools/render_oras_maps.py <model_mem> [tex_mem]   # e.g. 0210 0890
"""
import math
import os
import struct
import sys

import numpy as np
from PIL import Image

import bch

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                    "source", "3ds", "omegaruby", "unpacked")
MODEL_DIR = os.path.join(ROOT, "a", "0", "3", "9")
TEX_DIR = os.path.join(ROOT, "a", "1", "5", "2")
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                       "assets_3d", "hoenn", "renders")


def load_model(mem):
    d = open(os.path.join(MODEL_DIR, f"{mem}.bin"), "rb").read()
    off = struct.unpack_from("<I", d, 8)[0] & 0x7FFFFFFF
    return bch.BCH(d, off)


def load_texbch(mem):
    return bch.BCH(open(os.path.join(TEX_DIR, f"{mem}.bch"), "rb").read(), 0)


def _tex_names(b):
    import re
    reg = bytes(b.data[b.str_off:b.str_off + b.str_len])
    return set(m.decode() for m in re.findall(rb"[a-zA-Z_][a-zA-Z0-9_]{2,30}", reg))


def find_texture_bch(model):
    """Find the a/1/5/2 texture BCH whose texture names best cover the model's
    material texture names (deterministic overlap match — see RECON.md)."""
    import re
    reg = bytes(model.data[model.str_off:model.str_off + model.str_len])
    want = set(m.decode() for m in
               re.findall(rb"gake_[a-z0-9_]{2,20}|[a-z]+_a1|[a-z]+_b1", reg))
    if not want:
        return None
    best = None
    for f in sorted(os.listdir(TEX_DIR)):
        try:
            tb = bch.BCH(open(os.path.join(TEX_DIR, f), "rb").read(), 0)
        except Exception:
            continue
        base = set(re.sub(r"^mapr?\d+[a-z]?\d*_", "", n) for n in _tex_names(tb))
        cover = len(want & base) / len(want)
        if cover > 0.6 and (best is None or cover > best[1]):
            best = (f[:-4], cover)
    return best[0] if best else None


def decode_textures(texb):
    """Decode every ETC1 texture unit → list of (np RGB array, w, h)."""
    imgs = []
    for t in texb.pica_textures():
        if t["fmt"] != 0xC:            # only ETC1 handled so far
            continue
        rgb = bch.decode_etc1(texb.data, t["addr"],   # addr is absolute (relocated)
                              t["width"], t["height"])
        arr = np.frombuffer(rgb, np.uint8).reshape(t["height"], t["width"], 3)
        imgs.append((arr, t["width"], t["height"]))
    return imgs


def _mesh_triangles(model, dc):
    """Triangles (with UV) for one draw call, or None if the mesh is garbage."""
    d = model.data
    stride = dc["stride"]
    if dc["index_addr"] is None or stride < 0x18:
        return None
    vbo = dc["vbuf_off"]        # absolute (relocated)
    ib = dc["index_addr"]       # absolute (relocated)
    uvo = 0x18 if stride >= 0x20 else 0x0C
    # sanity gate
    for i in range(min(dc["count"], 24)):
        vi = struct.unpack_from("<H", d, ib + i * 2)[0]
        o = vbo + vi * stride
        if o + uvo + 8 > len(d):
            return None
        for k in (0, 4, 8):
            v = struct.unpack_from("<f", d, o + k)[0]
            if not math.isfinite(v) or abs(v) > 1e5:
                return None
    tris, cur = [], []
    for i in range(dc["count"]):
        vi = struct.unpack_from("<H", d, ib + i * 2)[0]
        o = vbo + vi * stride
        cur.append((struct.unpack_from("<f", d, o)[0],
                    struct.unpack_from("<f", d, o + 4)[0],
                    struct.unpack_from("<f", d, o + 8)[0],
                    struct.unpack_from("<f", d, o + uvo)[0],
                    struct.unpack_from("<f", d, o + uvo + 4)[0]))
        if len(cur) == 3:
            tris.append(cur)
            cur = []
    return tris


def render(model_mem, tex_mem=None, size=768):
    model = load_model(model_mem)
    if tex_mem is None:
        tex_mem = find_texture_bch(model)
        if tex_mem is None:
            print(f"  no texture BCH matched for {model_mem}")
            return None
        print(f"  matched texture BCH: {tex_mem}")
    imgs = decode_textures(load_texbch(tex_mem))
    if not imgs:
        print("  no ETC1 textures decoded")
        return None

    meshes = []
    allpts = []
    for di, dc in enumerate(model.pica_draw_calls()):
        tris = _mesh_triangles(model, dc)
        if not tris:
            continue
        meshes.append((di % len(imgs), tris))   # approximate binding (RECON)
        for t in tris:
            allpts += t
    if not allpts:
        return None
    xs = [p[0] for p in allpts]
    zs = [p[2] for p in allpts]
    minx, maxx, minz, maxz = min(xs), max(xs), min(zs), max(zs)
    S = size
    fb = np.zeros((S, S, 3), np.uint8)
    yb = np.full((S, S), -1e9)
    sx = lambda x: (x - minx) / (maxx - minx + 1e-9) * (S - 1)
    sz = lambda z: (z - minz) / (maxz - minz + 1e-9) * (S - 1)

    for tex_i, tris in meshes:
        img, tw, th = imgs[tex_i]
        for t in tris:
            px = [sx(v[0]) for v in t]
            pz = [sz(v[2]) for v in t]
            ay = sum(v[1] for v in t) / 3
            x0, x1 = int(min(px)), int(max(px)) + 1
            z0, z1 = int(min(pz)), int(max(pz)) + 1
            if x1 - x0 > S // 2 or z1 - z0 > S // 2:
                continue                    # stray oversized triangle
            den = (pz[1] - pz[2]) * (px[0] - px[2]) + (px[2] - px[1]) * (pz[0] - pz[2])
            if abs(den) < 1e-6:
                continue
            for X in range(max(0, x0), min(S, x1)):
                for Z in range(max(0, z0), min(S, z1)):
                    a = ((pz[1] - pz[2]) * (X - px[2]) + (px[2] - px[1]) * (Z - pz[2])) / den
                    b = ((pz[2] - pz[0]) * (X - px[2]) + (px[0] - px[2]) * (Z - pz[2])) / den
                    c = 1 - a - b
                    if a >= -.02 and b >= -.02 and c >= -.02 and ay > yb[Z, X]:
                        u = a * t[0][3] + b * t[1][3] + c * t[2][3]
                        v = a * t[0][4] + b * t[1][4] + c * t[2][4]
                        fb[Z, X] = img[int(v * th) % th, int(u * tw) % tw]
                        yb[Z, X] = ay
    return Image.fromarray(fb, "RGB")


def main(argv):
    if not argv:
        argv = ["0210"]
    model_mem = argv[0]
    tex_mem = argv[1] if len(argv) > 1 else None
    img = render(model_mem, tex_mem)
    if img is None:
        return
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"map_{model_mem}.png")
    img.save(out)
    print(f"  {model_mem}: {img.width}x{img.height} → {out}")


if __name__ == "__main__":
    main(sys.argv[1:])
