#!/usr/bin/env python3
"""
extract_platinum_npcs.py — Extract Pokémon Platinum overworld NPC sprites.

Platinum stores overworld character graphics in the `mmodel` archive: each
character is one NSBTX (BTX0) whose textures are the animation frames (16 of
them, 32×32; frame 1 is the down-facing idle pose). The map from an event's
`OBJ_EVENT_GFX_*` id to an mmodel archive member lives in the table
`Unk_ov5_021FC9B4` (src/overlay005/ov5_021FAF40.c).

This tool reads that table, decodes each character's down-idle frame with the
NSBTX decoder (tools/nitro_g3d.py), crops it to a 16×32 sprite (the size the
browser renderer expects, feet at the bottom), and writes:

  data/sprites/npcs/platinum/<stem>.png   one sprite per gfx id
  data/sprites/npcs/index.json            merged stem → path lookup

`<stem>` is the gfx id lower-cased without the `OBJ_EVENT_GFX_` prefix, matching
how the renderer resolves `graphics_id`.
"""

import json
import os
import re

from PIL import Image

import platinum_common as pc
import nitro_g3d as g3d

MMODEL_DIR = os.path.join(pc.PLAT_ROOT, "res", "prebuilt", "data", "mmodel", "mmodel")
GFX_TABLE_C = os.path.join(pc.PLAT_ROOT, "src", "overlay005", "ov5_021FAF40.c")

# Platinum sprites get their own directory + index so they never clobber the
# Kanto/GBA sprites (many stems collide: youngster, lass, mom, prof_oak, …).
# The renderer prefers this index only for Sinnoh maps.
OUT_DIR = os.path.join(pc.REPO_ROOT, "data", "sprites", "npcs", "platinum")
INDEX_FILE = os.path.join(OUT_DIR, "index.json")

SPRITE_W, SPRITE_H = 16, 32


def parse_gfx_to_member():
    """Parse the OBJ_EVENT_GFX_* → mmodel-member table (Unk_ov5_021FC9B4)."""
    txt = open(GFX_TABLE_C).read()
    block = re.search(r"Unk_ov5_021FC9B4\[\]\s*=\s*\{(.*?)\n\};", txt, re.S).group(1)
    mapping = {}
    for m in re.finditer(r"\{\s*(OBJ_EVENT_GFX_[A-Z0-9_]+)\s*,\s*(0x[0-9A-Fa-f]+)\s*\}", block):
        mapping[m.group(1)] = int(m.group(2), 16)
    return mapping


def gfx_to_stem(gfx_id):
    return gfx_id.replace("OBJ_EVENT_GFX_", "").lower()


def down_idle_frame(member):
    """Decode a character's down-facing idle frame (frame 1) to an RGBA Image."""
    path = os.path.join(MMODEL_DIR, f"mmodel_{member:08d}.bin")
    if not os.path.isfile(path):
        return None
    tex = g3d.find_tex0(open(path, "rb").read())
    if not tex or not tex.tex_names:
        return None
    # Frames are named "<char>.<n>". Frame 1 faces up (back of head); frame 5 is
    # the down-facing idle pose (facing the camera), which is what we want.
    DOWN_IDLE = 5
    def frame_num(name):
        m = re.search(r"\.(\d+)$", name)
        return int(m.group(1)) if m else 0
    frames = sorted(tex.tex_names, key=frame_num)
    name = next((n for n in frames if frame_num(n) == DOWN_IDLE), frames[0])
    pal = tex.default_palette_for(name)
    pixels, w, h = tex.decode(name, pal)
    img = Image.new("RGBA", (w, h))
    img.putdata(pixels)
    return img


def crop_to_sprite(frame):
    """
    Crop the character from its (usually 32×32) frame and place it in a 16×32
    canvas, horizontally centred and bottom-aligned (feet on the tile).
    """
    bbox = frame.getbbox()
    if not bbox:
        return None
    content = frame.crop(bbox)
    cw, ch = content.size
    # Downscale over-wide/tall content to fit the 16×32 sprite box.
    if cw > SPRITE_W or ch > SPRITE_H:
        scale = min(SPRITE_W / cw, SPRITE_H / ch)
        content = content.resize((max(1, round(cw * scale)), max(1, round(ch * scale))), Image.NEAREST)
        cw, ch = content.size
    canvas = Image.new("RGBA", (SPRITE_W, SPRITE_H), (0, 0, 0, 0))
    canvas.paste(content, ((SPRITE_W - cw) // 2, SPRITE_H - ch), content)
    return canvas


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    mapping = parse_gfx_to_member()
    print(f"Extracting {len(mapping)} Platinum NPC sprites …")

    index = {}
    ok = skipped = 0
    for gfx_id, member in sorted(mapping.items()):
        frame = down_idle_frame(member)
        if frame is None:
            skipped += 1
            continue
        sprite = crop_to_sprite(frame)
        if sprite is None:
            skipped += 1
            continue
        stem = gfx_to_stem(gfx_id)
        sprite.save(os.path.join(OUT_DIR, f"{stem}.png"))
        index[stem] = f"data/sprites/npcs/platinum/{stem}.png"
        ok += 1

    with open(INDEX_FILE, "w") as f:
        json.dump(index, f, indent=2, sort_keys=True)
    print(f"  → {ok} sprites → data/sprites/npcs/platinum/  ({skipped} skipped)")
    print(f"  → index now has {len(index)} entries")


if __name__ == "__main__":
    main()
