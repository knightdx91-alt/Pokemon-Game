#!/usr/bin/env python3
"""
generate_platinum_tileset.py — Build the 2D appearance tileset for converted
Platinum (Sinnoh) maps, and bake a top-down preview PNG of every map.

Platinum maps are 3D, so there is no 2D tile spritesheet to rip. Instead we
synthesise one 16x16 tile per appearance category (see CATEGORIES in
tools/platinum_common.py) with a small hand-drawn texture, arranged 16 tiles per
row to match the browser renderer's spritesheet convention. Layout `metatiles`
values index into this sheet.

Outputs:
  data/tilesets/sinnoh_overworld.png / .json   the appearance spritesheet
  data/maps/sinnoh_render/<name>.png            baked top-down preview per map
                                                (the 3D map rendered flat in 2D)

Run: python3 tools/generate_platinum_tileset.py
"""

import json
import os

from PIL import Image, ImageDraw

import platinum_common as pc

TILE = 16
PER_ROW = 16

OUT_TILESETS = os.path.join(pc.REPO_ROOT, "data", "tilesets")
OUT_LAYOUT_DIR = os.path.join(pc.REPO_ROOT, "data", "layouts", "sinnoh")
OUT_RENDER_DIR = os.path.join(pc.REPO_ROOT, "data", "maps", "sinnoh_render")

TILESET_NAME = "sinnoh_overworld"


# ---------------------------------------------------------------------------
# Deterministic dithering helpers (stable output, no RNG)
# ---------------------------------------------------------------------------
def _shade(c, d):
    return tuple(max(0, min(255, v + d)) for v in c)


def _speckle(px, x, y, base, dark, light):
    """Cheap hash-based speckle so tiles have texture without randomness."""
    h = (x * 73856093) ^ (y * 19349663)
    h &= 0xFFFF
    if h % 7 == 0:
        return dark
    if h % 11 == 0:
        return light
    return base


def draw_tile(name, color):
    img = Image.new("RGBA", (TILE, TILE), color + (255,))
    px = img.load()
    d = ImageDraw.Draw(img)
    dark = _shade(color, -28)
    light = _shade(color, 26)

    if name in ("grass", "ground", "cave_floor", "mountain", "sand", "snow",
                "mud", "floor_indoor", "shallow_water"):
        for y in range(TILE):
            for x in range(TILE):
                px[x, y] = _speckle(px, x, y, color, dark, light) + (255,)

    elif name == "tall_grass":
        for y in range(TILE):
            for x in range(TILE):
                px[x, y] = (color if (x % 4) else dark) + (255,)
        for x in range(1, TILE, 4):
            d.line([(x, 4), (x, TILE - 1)], fill=light + (255,))

    elif name in ("water", "sea"):
        for y in range(TILE):
            row = color if (y // 4) % 2 == 0 else _shade(color, -18)
            for x in range(TILE):
                px[x, y] = row + (255,)
        for y in range(2, TILE, 6):
            d.line([(2, y), (7, y)], fill=light + (255,))
            d.line([(9, y + 3), (13, y + 3)], fill=light + (255,))

    elif name == "ice":
        for y in range(TILE):
            for x in range(TILE):
                px[x, y] = color + (255,)
        d.line([(2, 12), (12, 2)], fill=light + (255,))
        d.line([(6, 14), (14, 6)], fill=light + (255,))

    elif name == "bridge":
        for y in range(TILE):
            for x in range(TILE):
                px[x, y] = color + (255,)
        for x in range(0, TILE, 5):
            d.line([(x, 0), (x, TILE - 1)], fill=dark + (255,))

    elif name == "flowers":
        base = pc.CATEGORY_COLORS["grass"]
        for y in range(TILE):
            for x in range(TILE):
                px[x, y] = base + (255,)
        for (cx, cy) in ((4, 4), (11, 6), (7, 11)):
            d.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=color + (255,))

    elif name == "door":
        wall = pc.CATEGORY_COLORS["wall"]
        for y in range(TILE):
            for x in range(TILE):
                px[x, y] = wall + (255,)
        d.rectangle([4, 3, 11, 15], fill=color + (255,))
        d.rectangle([4, 3, 11, 15], outline=_shade(color, -40) + (255,))
        px[10, 9] = (240, 220, 90, 255)

    elif name == "warp":
        for y in range(TILE):
            for x in range(TILE):
                px[x, y] = _shade(color, -20) + (255,)
        d.polygon([(8, 3), (13, 8), (8, 13), (3, 8)], fill=color + (255,))

    elif name.startswith("ledge_"):
        ground = pc.CATEGORY_COLORS["grass"]
        for y in range(TILE):
            for x in range(TILE):
                px[x, y] = ground + (255,)
        edge = _shade(color, -40) + (255,)
        if name == "ledge_south":
            d.rectangle([0, 12, 15, 15], fill=edge)
        elif name == "ledge_north":
            d.rectangle([0, 0, 15, 3], fill=edge)
        elif name == "ledge_east":
            d.rectangle([12, 0, 15, 15], fill=edge)
        elif name == "ledge_west":
            d.rectangle([0, 0, 3, 15], fill=edge)

    elif name == "wall":
        # tree/cliff clump
        for y in range(TILE):
            for x in range(TILE):
                px[x, y] = _speckle(px, x, y, color, dark, light) + (255,)
        d.line([(0, 0), (15, 0)], fill=dark + (255,))
        d.line([(0, 0), (0, 15)], fill=light + (255,))

    elif name == "void":
        for y in range(TILE):
            for x in range(TILE):
                px[x, y] = color + (255,)

    return img


# ---------------------------------------------------------------------------
# Tileset spritesheet
# ---------------------------------------------------------------------------
def build_tileset():
    os.makedirs(OUT_TILESETS, exist_ok=True)
    n = len(pc.CATEGORIES)
    rows = (n + PER_ROW - 1) // PER_ROW
    sheet = Image.new("RGBA", (PER_ROW * TILE, rows * TILE), (0, 0, 0, 0))
    tile_imgs = []
    for i, name in enumerate(pc.CATEGORIES):
        tile = draw_tile(name, pc.CATEGORY_COLORS[name])
        tile_imgs.append(tile)
        col, row = i % PER_ROW, i // PER_ROW
        sheet.paste(tile, (col * TILE, row * TILE))

    sheet.save(os.path.join(OUT_TILESETS, f"{TILESET_NAME}.png"))
    meta = {
        "total_metatiles": n,
        "metatiles_per_row": PER_ROW,
        "categories": pc.CATEGORIES,
        # per-category default collision (layouts carry the authoritative grid)
        "collisions": [1 if c in ("void", "wall") else 0 for c in pc.CATEGORIES],
        "behaviors": [0] * n,
    }
    with open(os.path.join(OUT_TILESETS, f"{TILESET_NAME}.json"), "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    print(f"  → data/tilesets/{TILESET_NAME}.png  ({n} category tiles)")
    return tile_imgs


# ---------------------------------------------------------------------------
# Baked top-down previews
# ---------------------------------------------------------------------------
def bake_previews(tile_imgs, limit=None):
    os.makedirs(OUT_RENDER_DIR, exist_ok=True)
    files = sorted(f for f in os.listdir(OUT_LAYOUT_DIR) if f.endswith(".json"))
    if limit:
        files = files[:limit]
    count = 0
    for fname in files:
        name = fname[:-5]
        layout = json.load(open(os.path.join(OUT_LAYOUT_DIR, fname)))
        w, h = layout["width"], layout["height"]
        # Skip pathologically large maps (e.g. the Underground grid): a preview
        # would be an enormous PNG and isn't useful as a flat image.
        if w * TILE > 3072 or h * TILE > 3072:
            continue
        img = Image.new("RGBA", (w * TILE, h * TILE), (0, 0, 0, 255))
        mt = layout["metatiles"]
        for ty in range(h):
            for tx in range(w):
                idx = mt[ty * w + tx]
                if 0 <= idx < len(tile_imgs):
                    img.paste(tile_imgs[idx], (tx * TILE, ty * TILE))

        # Building / prop footprints as red-outlined markers.
        d = ImageDraw.Draw(img)
        for prop in layout.get("props", []):
            cx = prop["x"] * TILE
            cy = prop["y"] * TILE
            d.rectangle([cx - 6, cy - 6, cx + 6, cy + 6],
                        outline=(220, 60, 60, 255))
        img.save(os.path.join(OUT_RENDER_DIR, f"{name}.png"))
        count += 1
    print(f"  → {count} baked previews → data/maps/sinnoh_render/")


def main():
    print("Generating Sinnoh appearance tileset + previews …")
    tile_imgs = build_tileset()
    bake_previews(tile_imgs)


if __name__ == "__main__":
    main()
