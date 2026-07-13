# Platinum party-screen assets — EXACT, extracted from the ROM

These are the real Pokémon Platinum (US, `CPUE`) party-menu graphics, decoded
from `graphic/pl_plist_gra.narc` — **not** approximations, and **not** the old
FireRed-derived `src/assets/party/` set (wrong game).

Regenerate with `python3 tools/extract_platinum_party.py` (needs the ROM unpacked
to `source/nds/CPUE` via `nds_decomp.py`; ROM bytes stay gitignored).

Member roles from pret/pokeplatinum `res/graphics/party_menu/party_menu_graphics.order`:

| file | layers (NARC members) | what it is |
|------|----------------------|------------|
| `subscreen_bg.png` | NSCR 0014 + NCGR 0012 + NCLR 0013 | bottom/touch-screen background (stripes + pokéball watermark) |
| `top_bg.png`       | NSCR 0017 + NCGR 0015 + NCLR 0016 | top-screen background |
| `slot_panels.png`  | NSCR 0022 + NCGR 0015 + NCLR 0016 | the 6 party slot panels — blue (normal) + yellow (selected) |
| `member_ball.png`  | NCGR 0002 + NCLR 0008 (shared) | party pokéball sprites |
| `cursor.png`       | NCGR 0007 + NCLR 0008 | hand cursor |
| `button.png`       | NCGR 0011 + NCLR 0008 | command buttons |
| `icons.png`        | NCGR 0020 + NCLR 0021 | status / hold-item icons |
| `touch_button.png` | NCGR 0003 + NCLR 0004 | bottom-screen touch buttons |

## Still to do for a pixel-perfect assembled screen
- **On-screen coordinates**: where each of the 6 panels and each pokéball sit is
  defined by the party-menu layout code in pokeplatinum (`src/…party menu…`) and
  the NCER cell banks (`member_ball_cell.NCER` etc.). Fetch those (WebFetch) to
  place sprites exactly instead of guessing.
- **Verify** against a real captured frame from `emulator.html` (🔬 → Frame →
  Shot→Repo pushes the actual bottom screen to `main` under `storage/traces/`), diff to zero.
