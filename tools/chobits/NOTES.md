# Chobits GBA — English translation polish toolchain

Polishing **Gopicolo's 2025 English patch** for *Chobits: Atashi Dake no Hito* (GBA).

## How to rebuild the working English ROM (in a fresh session)
1. Download the user's Drive files (both link-shared):
   - Base ROM zip: `Chobits for GameBoy Advance - Atashi Dake no Hito.zip`
     (Drive id `1MwZ2AO4z4pikrvprgEFTUiEBEut_GX-t`)
   - Patch: `Chobits__Atashi_Dake_no_Hito_-_English_Translation.rar`
     (Drive id `1nFaJIfT1bQeW5xtHzgdVAnH6bCQ8mee_`) — contains `Chobits - GBA Version 1.0.xdelta`
2. Unzip the ROM; the patch base is the **`[f1]`** variant
   (`...Atashi Dake no Hito (J) [f1].gba`, 8 MB).
3. Apply: `xdelta3 -d -f -s "<...[f1].gba>" "Chobits - GBA Version 1.0.xdelta" gopicolo_eng.gba`
   (the other variants will NOT match the patch).

Large Drive files (>10 MB) bypass the connector by curl'ing the
`drive.usercontent.google.com/download` form (handle the virus-scan
interstitial — see chat history). Or use the hub's "Drive → GitHub Upload"
button to push the ROM to the `uploads` branch, then read it from there.

## Text format (verified)
- Pointer table: file offset **0x84e74 .. 0x8dcc0** = **9,107** little-endian
  pointers, each `0x08000000 + file_offset`.
- Strings: **null-terminated ASCII**, `\n` (0x0a) = in-box line break.
- Font is **ASCII only** (0x20–0x7e). No em-dash/smart quotes/accents.
- Box capacity: **max 2 lines, ~33 chars/line** (existing script peaks at 35).
  Keep every edited line <= 33 chars and <= 2 lines.
- ~574 KB of free space at the ROM tail (from ~0x773be9) — new/edited strings
  are appended there and the pointer is rewritten (see reinsert.py).
- ~8,700 English strings (~258 KB). Remaining Shift-JIS entries (~33) are just
  number/symbol glyphs (０-９, ★, −), not dialogue. Mini-game text is NOT in
  this table — it's graphics/tiles (separate, harder, not yet attempted).

## Workflow (play-and-flag loop, user's choice)
User plays `gopicolo_eng.gba`, flags bad/overflowing lines; fix them in
`reinsert.py`'s edits dict (index -> new ASCII text), rebuild, send the new
`.gba`. Use `extract.py` to dump the full script (`script_dump.txt`) and to
look up a line's pointer index by its text.
