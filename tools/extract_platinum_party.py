#!/usr/bin/env python3
"""Extract the EXACT Pokemon Platinum party-screen UI from the ROM into
src/assets/platinum_party/ — the real game layers, not an approximation.

Member roles come from pret/pokeplatinum's res/graphics/party_menu/
party_menu_graphics.order (fetched via WebFetch, see CLAUDE.md rule):

  0000 member_ball_anim.NANR   0012 subscreen_tiles.NCGR
  0001 member_ball_cell.NCER    0013 subscreen.NCLR
  0002 member_ball.NCGR         0014 subscreen.NSCR   (bottom/touch screen bg)
  0003 touch_button.NCGR        0015 menu_tiles.NCGR
  0004 touch_button.NCLR        0016 menu.NCLR
  0005 cursor_anim.NANR         0017 menu.NSCR        (top screen bg)
  0006 cursor_cell.NCER         0018 icons_anim.NANR
  0007 cursor.NCGR              0019 icons_cell.NCER
  0008 shared.NCLR              0020 icons.NCGR
  0009 button_anim.NANR         0021 icons.NCLR
  0010 button_cell.NCER         0022 menu_panels.NSCR (6 party slot panels)
  0011 button.NCGR              0023 touch_button_shockwave.NCLR

Requires the ROM unpacked to source/nds/CPUE (gitignored) via nds_decomp.py.
Run: python3 tools/extract_platinum_party.py
"""
import os
from PIL import Image
import extract_platinum_ui as ui

NARC = 'source/nds/CPUE/unpacked/graphic/pl_plist_gra.narc'
OUT = 'src/assets/platinum_party'
DS_W, DS_H = 256, 192  # real screen; the 32x32 tilemap has 64px of padding below


def m(idx, ext):
    return os.path.join(NARC, '%04d.%s' % (idx, ext))


def bg(nscr, ncgr, nclr, name):
    tmp = os.path.join(OUT, '_full_' + name)
    ui.render_nscr(m(nscr, 'nscr'), m(ncgr, 'ncgr'), m(nclr, 'nclr'), tmp)
    img = Image.open(tmp).crop((0, 0, DS_W, DS_H))  # drop padding rows
    img.save(os.path.join(OUT, name))
    os.remove(tmp)
    print('  ', name, img.size)


def sheet(ncgr, nclr, name, cols=16):
    ui.dump_ncgr_sheet(m(ncgr, 'ncgr'), m(nclr, 'nclr'), os.path.join(OUT, name), cols=cols)
    print('  ', name)


if __name__ == '__main__':
    if not os.path.isdir(NARC):
        raise SystemExit('Missing ' + NARC + ' — run nds_decomp.py on the Platinum ROM first.')
    os.makedirs(OUT, exist_ok=True)
    print('Extracting exact Platinum party-screen assets ->', OUT)
    # Full-screen backgrounds (exact tilemaps).
    bg(14, 12, 13, 'subscreen_bg.png')   # bottom touch screen (striped + ball)
    bg(17, 15, 16, 'top_bg.png')         # top screen background
    bg(22, 15, 16, 'slot_panels.png')    # blue (normal) + yellow (selected) panels
    # Sprite sheets (raw tiles; NCER cell placement can be layered later).
    sheet(2, 8, 'member_ball.png')       # party pokeball sprites
    sheet(7, 8, 'cursor.png')            # hand cursor
    sheet(11, 8, 'button.png')           # command buttons
    sheet(20, 21, 'icons.png')           # status/hold icons
    sheet(3, 4, 'touch_button.png')      # bottom-screen touch buttons
    print('Done. Source of truth: pret/pokeplatinum party_menu_graphics.order.')
