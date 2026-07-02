#!/usr/bin/env python3
"""
generate_bw_tileset.py — Build a minimal placeholder appearance tileset for
converted Black/White (Unova) land-cells.

Unlike Platinum, no per-tile appearance/behavior data has been decoded yet for
BW (see tools/bw_common.py docstring), so this is deliberately minimal: three
flat-colored 16x16 tiles (floor / wall / special-marker), arranged 16-per-row
to match the browser renderer's spritesheet convention. Replace with a richer
tileset once appearance data is decoded.

Outputs:
  data/tilesets/unova_placeholder.png / .json

Run: python3 tools/generate_bw_tileset.py
"""
import json
import os

from PIL import Image

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(REPO_ROOT, "data", "tilesets")
NAME = "unova_placeholder"
TILE = 16
PER_ROW = 16

# metatile index -> (rgb, behavior byte)
# behavior 0 = generic / no special handling in GameMap.isWalkable
TILES = [
    ((96, 168, 96), 0),     # 0 floor / walkable
    ((40, 56, 40), 0),      # 1 wall / blocked
    ((224, 196, 96), 0),    # 2 special marker (warp candidate, currently inert)
]


def main():
    rows = (len(TILES) + PER_ROW - 1) // PER_ROW
    img = Image.new("RGBA", (TILE * PER_ROW, TILE * max(rows, 1)), (0, 0, 0, 0))
    behaviors = []
    for i, (rgb, behavior) in enumerate(TILES):
        col, row = i % PER_ROW, i // PER_ROW
        for y in range(TILE):
            for x in range(TILE):
                # slight border shading so tile edges are visible
                shade = 24 if (x == 0 or y == 0) else 0
                c = tuple(max(0, v - shade) for v in rgb) + (255,)
                img.putpixel((col * TILE + x, row * TILE + y), c)
        behaviors.append(behavior)

    os.makedirs(OUT_DIR, exist_ok=True)
    img.save(os.path.join(OUT_DIR, f"{NAME}.png"))
    with open(os.path.join(OUT_DIR, f"{NAME}.json"), "w") as f:
        json.dump({
            "name": NAME,
            "total_metatiles": len(TILES),
            "behaviors": behaviors,
        }, f, indent=2)
    print(f"wrote {NAME}.png/.json ({len(TILES)} tiles)")


if __name__ == "__main__":
    main()
