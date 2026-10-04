# Tales of the World: Radiant Mythology 2 — English image patch

Graphics-only patch that runs **on top of the fan-translated build `RM2_EN_iter3_31_08.iso`**
(ULJS-00175). The script, skits, NPC text, quests and menus in that build are already 100%
English; this patch translates the Japanese text that was baked into images.

## Apply
Patch: `RM2_images_EN.xdelta` (xdelta3/VCDIFF)

| | MD5 |
|---|---|
| Input `RM2_EN_iter3_31_08.iso` | `8215d5acf24c6afb79783b1ffaa63abc` |
| Output (patched) | `897856ba6a9fcaaf11d1893f94a27682` |

- Phone/browser: open Rom Patcher JS (marcrobledo.com/RomPatcher.js), pick the ISO + the .xdelta.
- PC: `xdelta3 -d -s RM2_EN_iter3_31_08.iso RM2_images_EN.xdelta RM2_EN_images.iso`

## What changed
| Where | Was | Now |
|---|---|---|
| XMB background `PIC1.PNG` | katakana title reading, Japanese tagline, illustrator names | erased / "Return to this land, and a radiant tale begins anew..." / romanized names |
| Save-data icons ×3 | セーブデータ, EXアタック セーブデータ, 連動サイト用 認証データ | SAVE DATA, EX ATTACK SAVE DATA, LINKED SITE AUTH DATA |
| Save-data backgrounds ×4 | katakana title reading | erased |
| Title copyright strip | いのまたむつみ / 藤島康介 | Mutsumi Inomata / Kosuke Fujishima |
| Ending logo | katakana title reading | erased |
| "Golden Victory" banner (5 skit archives) + mercenary card | テイルズ オブ ゴールデンビクトリー | TALES OF GOLDEN VICTORY |
| Hex puzzle "How to Play" pages ×2 (both copies) | Japanese instructions | English instructions |

## Not changed (known)
- Videos: `ev3003.pmf` has a "一ヶ月後" (One Month Later) card and `title.pmf` shows the katakana
  reading under the logo. Re-encoding PSMF video needs Sony's muxer; left as-is.
- `facechat/ev0707.arc>cutin_004.ppt`: a child's scribbled notes cut-in with illegible handwriting.
- Decorative brush/fantasy script (Gokumon dungeon banner, save-point glyphs).
- Japanese voice acting.

## Formats (reverse-engineered, see tools/)
- **EZBIND** container: `"EZBIND\0\0"`, u32 count, u32 align, then count × {name_off, size, data_off,
  name_hash}. Members may be gzip'd (keep them gzip'd on repack). The hash is a name hash.
- **ppt** texture: `"ppt\0"`, u16 buffer w/h, u16 fmt (5 = 8bpp + palette at u32@0x18 (+16-byte
  header), 3 = RGBA8888, 1/2 = 16bpp), u16, stored w/h, visible w/h; pixels at 0x20; usually
  PSP-swizzled (16-byte × 8-row blocks).
- Skit/NPC scripts: gzip'd `FaceChat` bytecode with EUC-JP/ASCII string tables.

## Rebuild
`tools/render_all.py` (decode all textures) → `do_help.py`, `do_misc.py`, `do_gv.py` (edits) →
`encode.py` (re-encode) → `build.py` (repack + patch ISO in place / append, update ISO9660 records).
