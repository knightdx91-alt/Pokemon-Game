#!/usr/bin/env python3
"""
render_platinum_maps.py — Render Pokémon Platinum's 3D map models to flat 2D
top-down textured images, so the maps look like their real in-game graphics
instead of behavior-colored blocks.

For each map it:
  1. resolves the map's NSBTX texture set (via area data);
  2. parses the map's NSBMD model out of the land-data blob (tools/nitro_g3d.py);
  3. projects every textured triangle straight down (orthographic, +Y up) and
     rasterizes it with a Y-buffer so higher geometry wins;
  4. writes one PNG per map, at 16 px per tile, aligned to the collision grid
     (world X/Z ∈ [-256,256] per 32-tile cell → pixels [0,512]).

The result is a real 2D rendering of the 3D map that can be sliced into tiles or
used directly as a map background in the browser game.

Usage:
  python3 tools/render_platinum_maps.py [map_name ...]     # specific maps
  python3 tools/render_platinum_maps.py --all              # every map
"""

import json
import math
import os
import sys

import numpy as np
from PIL import Image

import platinum_common as pc
import nitro_g3d as g3d

PROP_MODEL_DIR = os.path.join(pc.PLAT_ROOT, "res", "field", "props", "models")
PROP_TEXSET_DIR = os.path.join(pc.PLAT_ROOT, "res", "field", "props", "texture_sets")
PROP_ORDER_FILE = os.path.join(PROP_MODEL_DIR, "map_prop_models.order")

TILE_PX = 16
CELL_PX = pc.MAP_TILES_X * TILE_PX          # 512 px per 32-tile land-data cell
HALF_UNITS = pc.MAP_UNITS / 2               # 256

# Oblique (cavalier) projection tilt. A pure top-down view collapses vertical
# walls to nothing, so buildings show only their roof. Lifting geometry up-screen
# by its height reveals south-facing walls (doors, windows) — the GBA "2.5D"
# look — while flat ground (y≈0) stays aligned to the collision grid.
TILT = float(os.environ.get("PLAT_TILT", "0.6"))

OUT_DIR = os.path.join(pc.REPO_ROOT, "data", "maps", "sinnoh_textured")
TEXSET_DIR = os.path.join(pc.PLAT_ROOT, "res", "field", "maps", "texture_sets")
AREA_DIR = pc.AREADATA_DIR

_texset_cache = {}
_area_cache = {}
_prop_texset_cache = {}
_prop_model_cache = {}
_prop_order = None


def prop_order():
    """Global build-model index → prop model filename (map_prop_models.order)."""
    global _prop_order
    if _prop_order is None:
        _prop_order = [ln.strip() for ln in open(PROP_ORDER_FILE) if ln.strip()]
    return _prop_order


def area_prop_set_index(area_data_id):
    """area_data_<NNN> → the prop set index (shared by model & texture sets)."""
    path = os.path.join(AREA_DIR, area_data_id + ".json")
    if not os.path.isfile(path):
        return None
    name = json.load(open(path)).get("mapPropSet", "")
    m = name.rsplit("_", 1)
    return int(m[1]) if len(m) == 2 and m[1].isdigit() else None


def load_prop_texset(index):
    if index in _prop_texset_cache:
        return _prop_texset_cache[index]
    path = os.path.join(PROP_TEXSET_DIR, f"prop_texture_set_{index:03d}.nsbtx")
    tex = g3d.find_tex0(open(path, "rb").read()) if os.path.isfile(path) else None
    _prop_texset_cache[index] = tex
    return tex


def load_prop_model(model_id):
    """Load (model, own_texset) for a build-model index, cached."""
    if model_id in _prop_model_cache:
        return _prop_model_cache[model_id]
    order = prop_order()
    result = (None, None)
    if 0 <= model_id < len(order):
        path = os.path.join(PROP_MODEL_DIR, order[model_id])
        if os.path.isfile(path):
            data = open(path, "rb").read()
            try:
                result = (g3d.find_model(data, 0), g3d.find_tex0(data))
            except Exception as e:
                print(f"    prop model parse error ({order[model_id]}): {e}")
    _prop_model_cache[model_id] = result
    return result


def _rotation_matrix(rot):
    """3x3 rotation from DS Euler angles (0..65535 == 0..2π), applied Z·Y·X."""
    ax, ay, az = (r / 65536.0 * 2.0 * math.pi for r in rot)
    cx, sx = math.cos(ax), math.sin(ax)
    cy, sy = math.cos(ay), math.sin(ay)
    cz, sz = math.cos(az), math.sin(az)
    rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return rz @ ry @ rx


def area_texture_set(area_data_id):
    """area_data_<NNN> → the map_texture_set_<MMM> NSBTX name."""
    if area_data_id in _area_cache:
        return _area_cache[area_data_id]
    path = os.path.join(AREA_DIR, area_data_id + ".json")
    name = None
    if os.path.isfile(path):
        raw = json.load(open(path))
        name = raw.get("mapTextureSet")
    _area_cache[area_data_id] = name
    return name


def load_texset(name):
    """Load + cache a Tex0 for a map_texture_set NSBTX by name."""
    if name in _texset_cache:
        return _texset_cache[name]
    path = os.path.join(TEXSET_DIR, name + ".nsbtx")
    tex = g3d.find_tex0(open(path, "rb").read()) if os.path.isfile(path) else None
    _texset_cache[name] = tex
    return tex


def texture_rgba(tex, tex_name, pal_name):
    """Decode a texture to an (h, w, 4) uint8 numpy array (cached on the Tex0)."""
    cache = getattr(tex, "_np_cache", None)
    if cache is None:
        cache = tex._np_cache = {}
    key = (tex_name, pal_name)
    if key in cache:
        return cache[key]
    pixels, w, h = tex.decode(tex_name, pal_name)
    arr = np.array(pixels, dtype=np.uint8).reshape(h, w, 4)
    cache[key] = arr
    return arr


def rasterize_triangle(fb, yb, tri, up_scale, ox, oy, tex, repeat):
    """
    Rasterize one triangle into framebuffer `fb` (H,W,4) using Y-buffer `yb`.
    Screen pixel = world + 256 (+ cell offset); depth = world Y (higher wins).
    Affine (orthographic) UV interpolation; texels sampled from `tex` (H,W,4).
    """
    # Project to screen space + depth (oblique: height lifts geometry up-screen).
    wx = np.array([v.x * up_scale for v in tri])
    wy = np.array([v.y * up_scale for v in tri])
    wz = np.array([v.z * up_scale for v in tri])
    sx = wx + HALF_UNITS + ox
    sy = wz + HALF_UNITS + oy - wy * TILT
    # Nearness to the (south, elevated) camera: more-south (larger z) and higher
    # (larger y) surfaces occlude what's behind/below them. Larger wins.
    depth = wz + wy
    if tex is not None:
        th, tw = tex.shape[0], tex.shape[1]
        us = np.array([v.s for v in tri])
        vs = np.array([v.t for v in tri])

    minx = int(np.floor(sx.min())); maxx = int(np.ceil(sx.max()))
    miny = int(np.floor(sy.min())); maxy = int(np.ceil(sy.max()))
    H, W = fb.shape[0], fb.shape[1]
    minx = max(minx, 0); miny = max(miny, 0)
    maxx = min(maxx, W - 1); maxy = min(maxy, H - 1)
    if minx > maxx or miny > maxy:
        return

    x0, y0 = sx[0], sy[0]
    x1, y1 = sx[1], sy[1]
    x2, y2 = sx[2], sy[2]
    denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
    if abs(denom) < 1e-9:
        return

    xs = np.arange(minx, maxx + 1)
    ys = np.arange(miny, maxy + 1)
    gx, gy = np.meshgrid(xs + 0.5, ys + 0.5)
    l0 = ((y1 - y2) * (gx - x2) + (x2 - x1) * (gy - y2)) / denom
    l1 = ((y2 - y0) * (gx - x2) + (x0 - x2) * (gy - y2)) / denom
    l2 = 1.0 - l0 - l1
    inside = (l0 >= -1e-4) & (l1 >= -1e-4) & (l2 >= -1e-4)
    if not inside.any():
        return

    pdepth = l0 * depth[0] + l1 * depth[1] + l2 * depth[2]
    sub_yb = yb[miny:maxy + 1, minx:maxx + 1]
    win = inside & (pdepth >= sub_yb)
    if not win.any():
        return

    if tex is not None:
        u = l0 * us[0] + l1 * us[1] + l2 * us[2]
        v = l0 * vs[0] + l1 * vs[1] + l2 * vs[2]
        if repeat[0]:
            ui = np.mod(np.round(u).astype(np.int64), tw)
        else:
            ui = np.clip(np.round(u).astype(np.int64), 0, tw - 1)
        if repeat[1]:
            vi = np.mod(np.round(v).astype(np.int64), th)
        else:
            vi = np.clip(np.round(v).astype(np.int64), 0, th - 1)
        texels = tex[vi, ui]
        alpha = texels[:, :, 3]
        win = win & (alpha > 0)
        if not win.any():
            return
        sub_fb = fb[miny:maxy + 1, minx:maxx + 1]
        sub_fb[win] = texels[win]
    else:
        sub_fb = fb[miny:maxy + 1, minx:maxx + 1]
        sub_fb[win] = (180, 180, 190, 255)

    sub_yb[win] = pdepth[win]
    fb[miny:maxy + 1, minx:maxx + 1] = sub_fb
    yb[miny:maxy + 1, minx:maxx + 1] = sub_yb


def _draw_model_triangles(fb, yb, model, texset, up, ox, oy, transform=None):
    """Rasterize every textured triangle of `model`, optionally pre-transformed."""
    for mat_idx, tris in model.triangles():
        tex_arr = None
        tname = model.mat_texture.get(mat_idx)
        if tname and texset and tname in texset.textures:
            pname = model.mat_palette.get(mat_idx)
            if pname not in texset.palettes:
                pname = texset.default_palette_for(tname)
            try:
                tex_arr = texture_rgba(texset, tname, pname)
            except Exception:
                tex_arr = None
        for tri in tris:
            tri2 = transform(tri) if transform else tri
            rasterize_triangle(fb, yb, tri2, up, ox, oy, tex_arr, (True, True))


def render_props(fb, yb, land, ox, oy, prop_texset):
    """
    Composite each map prop (building, tree, door, …) onto the map. Prop model
    vertices are scaled by the model's up_scale then the prop's scale, rotated,
    and translated by the prop's world position (same ±256 unit space as the
    base map). Depth (Y) feeds the shared Y-buffer so roofs sit above ground.
    """
    for prop in land["props"]:
        model, own_tex = load_prop_model(prop["model_id"])
        if model is None:
            continue
        texset = prop_texset or own_tex
        up = model.up_scale or 1.0
        R = _rotation_matrix(prop["rot"])
        sc = prop["scale"]
        px, py, pz = prop["x"], prop["y"], prop["z"]

        def transform(tri, R=R, sc=sc, px=px, py=py, pz=pz, up=up):
            out = []
            for v in tri:
                # up_scale is applied later by the rasterizer, so pre-divide the
                # translation by it to keep everything in the model's raw space.
                vec = np.array([v.x * sc[0], v.y * sc[1], v.z * sc[2]])
                vec = R @ vec
                nv = g3d.Vertex(vec[0] + px / up, vec[1] + py / up,
                                vec[2] + pz / up, v.s, v.t)
                out.append(nv)
            return out

        _draw_model_triangles(fb, yb, model, texset, up, ox, oy, transform)


def render_cell(fb, yb, land_index, texset, prop_texset, ox, oy):
    """Render one land-data cell's model + props into fb at pixel offset (ox, oy)."""
    land = pc.load_land_data(land_index)
    d = land["raw"]
    mo, me = land["model_range"]
    if not land["has_model"]:
        return
    try:
        model = g3d.find_model(d, mo)
    except Exception as e:
        print(f"    model parse error (land {land_index}): {e}")
        return
    up = model.up_scale or 1.0
    _draw_model_triangles(fb, yb, model, texset, up, ox, oy)
    render_props(fb, yb, land, ox, oy, prop_texset)


def render_map(name, entry):
    """Render a full (possibly multi-cell) map to an RGBA image, or None."""
    texset_name = area_texture_set(entry["area_data_id"]) if entry["area_data_id"] else None
    texset = load_texset(texset_name) if texset_name else None
    prop_idx = area_prop_set_index(entry["area_data_id"]) if entry["area_data_id"] else None
    prop_texset = load_prop_texset(prop_idx) if prop_idx is not None else None

    W = entry["cols"] * CELL_PX
    H = entry["rows"] * CELL_PX
    if W * H > 4096 * 4096:
        return None  # skip pathologically large maps (Underground)
    fb = np.zeros((H, W, 4), dtype=np.uint8)
    yb = np.full((H, W), -1e18, dtype=np.float64)

    for cell in entry["cells"]:
        if cell["land_index"] is None:
            continue
        ox = (cell["col"] - entry["min_col"]) * CELL_PX
        oy = (cell["row"] - entry["min_row"]) * CELL_PX
        render_cell(fb, yb, cell["land_index"], texset, prop_texset, ox, oy)

    return Image.fromarray(fb, "RGBA")


def main(argv):
    os.makedirs(OUT_DIR, exist_ok=True)
    catalog, _ = pc.build_catalog()

    if "--all" in argv:
        names = sorted(catalog)
    elif argv:
        names = [a for a in argv if not a.startswith("--")]
    else:
        names = ["twinleaf_town"]

    for name in names:
        entry = catalog.get(name)
        if not entry:
            print(f"  unknown map: {name}")
            continue
        img = render_map(name, entry)
        if img is None:
            print(f"  {name}: skipped")
            continue
        out = os.path.join(OUT_DIR, f"{name}.png")
        img.save(out)
        print(f"  {name}: {img.width}x{img.height} → {out}")


if __name__ == "__main__":
    main(sys.argv[1:])
