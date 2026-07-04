# DS memory regions in the desmume2015 Emscripten heap — SOLVED ✅

Goal: capture *how each Platinum window is composited* (not just the frame PNG).
A DS screen is baked from three memory layers — **palette RAM** (colors),
**VRAM** (BG tilemaps + tile/char graphics), and **OAM** (sprite cells). This
doc records where those live in the `desmume2015` core's Emscripten heap
(`Module.HEAPU8`, ~184MB) so `emulator-debug.js` can dump all three per window.

## The key fact: regions are contiguous fields of one global `MMU_struct`

`desmume/src/MMU.h` declares the DS memories as adjacent arrays in one struct:

| field       | role            | size      |
|-------------|-----------------|-----------|
| `ARM9_VMEM` | **palette RAM** | `0x800`   |
| `ARM9_LCD`  | **VRAM**        | `0xA4000` |
| `blank`     | (zero pad)      | `0x20000` |
| `ARM9_OAM`  | **OAM**         | `0x800`   |

Because they're contiguous, **VRAM and OAM sit at FIXED byte deltas from the
palette RAM** — no matter where the whole struct lands in the heap this session:

```
VRAM = palette + 0x800      (len 0xA4000)
OAM  = palette + 0xC4800    (len 0x800)      # 0x800 + 0xA4000 + 0x20000
```

The palette itself is anchored **live** each session by `calibratePalette()`
(color-signature scan of the on-screen frame → densest 512B block of BGR555
colors → back up to the 2KB palette RAM). The two deltas above are then applied.

## Verified against a full heap dump (184MB)

Dump: user's Drive `3541_-_Pokemon_Platinum_..._heap_2026-07-04T10-10-22.bin`
(id `1DidqjHrvqf4H1dm1dnuVXlW26Vl36pbd`).

- **palette @ `0x02609800`** — 4 populated engine banks (main BG / main OBJ /
  sub BG / sub OBJ), each 50–64 distinct BGR555 colors. All other ~2KB blocks in
  the heap that fit the struct signature were pure zero padding (1 distinct).
- **VRAM @ `0x0260a000`** (palette + 0x800, len 0xA4000) — ends exactly at
  `0x026ae000`, the start of the 128KB zero `blank` field. This byte-exact seam
  is what confirms the struct order.
- **OAM @ `0x026ce000`** (palette + 0xC4800) — 105/110 of 128 sprite entries
  enabled, `attr0` Y bytes in valid 0–255 range with real sprite coordinates.

## Palette layout (both engines in the 2KB block)

Four 256-color banks, contiguous: `mainBG` @ +0x000, `mainOBJ` @ +0x200,
`subBG` @ +0x400, `subOBJ` @ +0x600. One 2KB region captures BOTH screens.

## Main RAM (secondary — for party/save, not UI composition)

The 16MB `MAIN_MEM` reservation is NOT contiguous with palette (its 16MB-before
window is zero). The live DS main RAM in this dump is a single dense ~4.5MB run
at **`0x00340000`** (candidate — not yet field-validated against known party
data). Not needed for window composition; pursue when reconstructing the
party/save from RAM.

## How it's wired

`calibratePalette()` in `emulator-debug.js` registers `palette`, `vram`, and
`oam` regions from the single live palette anchor. Auto-capture (🔬 panel) then
dumps all three to the `traces` branch (`regions/<name>/…`) with the same
sequence number as the frame PNG in `frames/auto/`, so each captured window has
its full composition (colors + tilemaps/tiles + sprite cells) attached.
