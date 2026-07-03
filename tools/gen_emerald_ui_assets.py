#!/usr/bin/env python3
"""Generate the pret-pokeemerald UI assets used by the Crater card
(src/assets/emerald_ui/) from source/pokeemerald/graphics/.

Converts the indexed 4bpp-style PNGs (palette embedded in the PNG) to RGBA
with palette index 0 transparent, exactly like the EE start-menu conversion
documented in CLAUDE.md. Run from repo root:
    python3 tools/gen_emerald_ui_assets.py
Requires: pillow, and the pokeemerald submodule checked out.
"""
import os
from PIL import Image

SRC = 'source/pokeemerald/graphics'
OUT = 'src/assets/emerald_ui'


def convert(rel, out_name, transparent=True, crop=None):
    img = Image.open(os.path.join(SRC, rel))
    if crop:
        img = img.crop(crop)
    if img.mode == 'P':
        pal = img.getpalette()
        t = tuple(pal[0:3])
        rgba = img.convert('RGBA')
        if transparent:
            d = rgba.load()
            for y in range(rgba.size[1]):
                for x in range(rgba.size[0]):
                    if d[x, y][:3] == t:
                        d[x, y] = (0, 0, 0, 0)
    else:
        rgba = img.convert('RGBA')
    path = os.path.join(OUT, out_name)
    rgba.save(path)
    print('%-34s %s %s' % (out_name, rgba.size, '(from %s)' % rel))


def main():
    os.makedirs(OUT, exist_ok=True)
    # Overworld/menu dialogue frame, Emerald "Type 1" (3x3 tiles of 8px —
    # used via CSS border-image slice 8).
    convert('text_window/1.png', 'frame1.png')
    # Battle healthboxes + bars (palette baked into the pret PNGs).
    convert('battle_interface/healthbox_singles_player.png', 'healthbox_player.png')
    convert('battle_interface/healthbox_singles_opponent.png', 'healthbox_opponent.png')
    # The hpbar sheet mixes frame + animation fill segments; only the "HP"
    # label + left cap are usable directly — the track/fill are CSS-drawn
    # with the authentic hpbar_anim.pal colors.
    convert('battle_interface/hpbar.png', 'hp_label.png', crop=(8, 0, 24, 8))
    convert('battle_interface/expbar.png', 'expbar.png')
    convert('battle_interface/status.png', 'status.png')
    convert('battle_interface/ball_caught_indicator.png', 'ball_caught.png')
    convert('battle_interface/textbox.png', 'battle_textbox.png', transparent=False)


if __name__ == '__main__':
    main()
