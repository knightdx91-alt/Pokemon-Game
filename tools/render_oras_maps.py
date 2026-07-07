#!/usr/bin/env python3
"""
render_oras_maps.py — Render Pokémon Omega Ruby (3DS) field maps to flat
top-down textured PNGs, the Gen-6 counterpart to render_platinum_maps.py.

Now with EXACT material->texture binding (no more draw-order guessing):
  - model (a/0/3/9): bch.mesh_draws() pairs each PICA draw with its material's
    Texture0Name (materials() reads the material table per Ohana3DS).
  - textures  (a/1/5/2): a GLOBAL name->image index built from every texture
    BCH's content-header texture table (bch.texture_table()); ORAS dedups
    textures across many BCHs, so one shared index serves all maps.
  - bind: draw -> texture name -> global index -> ETC1/ETC1A4 image -> UV raster.

Build the index once (cached to /tmp/oras_tex_index.json, ~a few s):
  python3 tools/render_oras_maps.py --build-index
Render a map (model member):
  python3 tools/render_oras_maps.py 0154        # c105 Oldale Town
  python3 tools/render_oras_maps.py 0006         # world01_02_04 = Littleroot

See assets_3d/hoenn/RECON.md for the full decode chain.
"""
import json
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
INDEX_CACHE = "/tmp/oras_tex_index.json"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                       "assets_3d", "hoenn", "renders")


def build_index(verbose=True):
    """Scan every a/1/5/2 texture BCH → global {name: [member, addr, w, h, fmt]}."""
    index = {}
    for f in sorted(os.listdir(TEX_DIR)):
        if not f.endswith(".bch"):
            continue
        try:
            tb = bch.BCH(open(os.path.join(TEX_DIR, f), "rb").read(), 0)
            for name, v in tb.texture_table().items():
                if name not in index:
                    index[name] = [f[:-4], v["addr"], v["width"], v["height"], v["fmt"]]
        except Exception:
            pass
    json.dump(index, open(INDEX_CACHE, "w"))
    if verbose:
        print(f"  built texture index: {len(index)} textures → {INDEX_CACHE}")
    return index


def load_index():
    if os.path.isfile(INDEX_CACHE):
        return json.load(open(INDEX_CACHE))
    return build_index()


class TexResolver:
    def __init__(self, index):
        self.index = index
        self._bch = {}
        self._img = {}

    def get(self, name):
        if not name:
            return None
        key = name
        if key not in self.index:                      # prefix-fuzzy fallback
            cands = [k for k in self.index if k.startswith(name) or name.startswith(k)]
            if not cands:
                return None
            key = min(cands, key=len)
        mem, addr, w, h, fmt = self.index[key]
        if fmt not in (0xC, 0xD) or not (0 < w <= 2048 and 0 < h <= 2048):
            return None
        ck = (mem, addr)
        if ck in self._img:
            return self._img[ck]
        if mem not in self._bch:
            self._bch[mem] = bch.BCH(open(os.path.join(TEX_DIR, mem + ".bch"), "rb").read(), 0)
        tb = self._bch[mem]
        try:
            rgba = bch.decode_etc1(tb.data, addr, w, h, alpha=(fmt == 0xD))
            img = (np.frombuffer(rgba, np.uint8).reshape(h, w, 4), w, h)
        except Exception:
            img = None
        self._img[ck] = img
        return img


def _draw_triangles(model):
    """Yield (image_or_None, [ (x,y,z,u,v)*3 ]) per draw with exact texture."""
    d = model.data
    res = _draw_triangles.res
    for dc in model.mesh_draws():
        if dc["index_addr"] is None or dc["stride"] < 0x18:
            continue
        im = res.get(dc.get("texture"))
        st, vbo, ib = dc["stride"], dc["vbuf_off"], dc["index_addr"]
        uvo = 0x18 if st >= 0x20 else 0x0C
        tris, cur = [], []
        for i in range(dc["count"]):
            vi = struct.unpack_from("<H", d, ib + i * 2)[0]
            o = vbo + vi * st
            if o + uvo + 8 > len(d):
                cur = []
                break
            cur.append(tuple(struct.unpack_from("<f", d, o + k)[0]
                             for k in (0, 4, 8, uvo, uvo + 4)))
            if len(cur) == 3:
                if all(math.isfinite(c) and abs(c) < 8192
                       for v in cur for c in v[:3]):   # position only, not UV
                    tris.append(cur)
                cur = []
        yield im, tris


def render(model_mem, index, size=768):
    d = open(os.path.join(MODEL_DIR, f"{model_mem}.bin"), "rb").read()
    off = struct.unpack_from("<I", d, 8)[0] & 0x7FFFFFFF
    model = bch.BCH(d, off)
    _draw_triangles.res = TexResolver(index)

    meshes = list(_draw_triangles(model))
    pts = [v for _, tris in meshes for t in tris for v in t]
    if not pts:
        return None
    xs = [p[0] for p in pts]; zs = [p[2] for p in pts]; ys = [p[1] for p in pts]
    minx, maxx, minz, maxz = min(xs), max(xs), min(zs), max(zs)
    miny, maxy = min(ys), max(ys)
    S = size
    sc = (S - 4) / max(maxx - minx, maxz - minz, 1e-6)
    ox = (S - (maxx - minx) * sc) / 2
    oz = (S - (maxz - minz) * sc) / 2
    fb = np.zeros((S, S, 3), np.uint8)
    yb = np.full((S, S), -1e9)
    for im, tris in meshes:
        for t in tris:
            px = [(v[0] - minx) * sc + ox for v in t]
            pz = [(v[2] - minz) * sc + oz for v in t]
            ay = sum(v[1] for v in t) / 3
            x0, x1 = int(min(px)), int(max(px)) + 1
            z0, z1 = int(min(pz)), int(max(pz)) + 1
            den = (pz[1] - pz[2]) * (px[0] - px[2]) + (px[2] - px[1]) * (pz[0] - pz[2])
            if abs(den) < 1e-6:
                continue
            for X in range(max(0, x0), min(S, x1)):
                for Z in range(max(0, z0), min(S, z1)):
                    a = ((pz[1] - pz[2]) * (X - px[2]) + (px[2] - px[1]) * (Z - pz[2])) / den
                    b = ((pz[2] - pz[0]) * (X - px[2]) + (px[0] - px[2]) * (Z - pz[2])) / den
                    c = 1 - a - b
                    if a >= -.02 and b >= -.02 and c >= -.02 and ay > yb[Z, X]:
                        if im:
                            img, tw, th = im
                            u = a * t[0][3] + b * t[1][3] + c * t[2][3]
                            v = a * t[0][4] + b * t[1][4] + c * t[2][4]
                            texel = img[int(v * th) % th, int(u * tw) % tw]
                            if texel[3] < 96:        # transparent overlay/shadow
                                continue
                            fb[Z, X] = texel[:3]
                        else:
                            continue                 # skip untextured (no solid fill)
                        yb[Z, X] = ay
    return Image.fromarray(fb, "RGB")


def main(argv):
    if "--build-index" in argv:
        build_index()
        return
    index = load_index()
    mems = [a for a in argv if not a.startswith("--")] or ["0154"]
    os.makedirs(OUT_DIR, exist_ok=True)
    for mem in mems:
        img = render(mem, index)
        if img is None:
            print(f"  {mem}: no geometry")
            continue
        out = os.path.join(OUT_DIR, f"map_{mem}.png")
        img.save(out)
        print(f"  {mem}: {img.width}x{img.height} → {out}")


if __name__ == "__main__":
    main(sys.argv[1:])
