# 3D MAPS — MASTER HANDOFF (read this FIRST every session)

Single source of truth for the "3D maps from every region" effort: where
everything lives, what's done, and the exact bootstrap + resume point for the
next session. When in doubt, this file wins; deeper detail is linked per topic.

Goal: extract each region's real 3D field maps (terrain + textures + buildings)
from the user's own ROMs into **`assets_3d/<region>/`**, then render/serve them.

---

## 0. Branch & repos
- **Work branch (all repos):** `claude/pokemon-3d-maps-extraction-rui36v`.
  - `Pokemon-Game` (this repo) — the tools + `assets_3d/` live here. PR #11 (draft).
  - `Pokemon-RPG` — the 3D game that will consume the assets. PR #1 (draft).
- In-scope decomp source repos, **cloned locally with ROM NARCs committed**
  (used to NAME maps/matrices/areas — not for the ROM pixels):
  - `/home/user/pokeheartgold` (HGSS) · `/home/user/pokeplatinum` (Platinum).
- **Ephemeral & gitignored — must be regenerated each session:**
  `source/nds/<code>/` and `source/3ds/<code>/` (ROM extractions). NEVER commit
  ROM bytes; only commit `assets_3d/` + tools + docs.

## 1. The user's ROMs (all in their Google Drive — download in seconds)
Use `curl` with the Drive id (verified working through the proxy):
`curl -sSL "https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t" -o /tmp/<file>`

| ROM | Region | Format | Gamecode | Drive id |
|-----|--------|--------|----------|----------|
| Pokémon HeartGold `.nds` | Kanto+Johto | DS | IPKE | `1hvHYAXor7UuDIXEUIt55j4FLNEc7rWuP` |
| Pokémon Platinum `.nds` | Sinnoh | DS | CPUE | `17pbLDu1VxBpO9Jf3AbWO9ZEH9O1ecVcc` |
| Pokémon Omega Ruby `.zip`→`.3ds` | Hoenn | 3DS | ECRA | `1_amuM3N1RISg2bk7J0M_7f7jwUBPijb_` |
| Pokémon Black `.nds` | Unova | DS | IRBO | `1uog4J8pUbTiNYptaoWAbdrY0E5HMEqwD` |
| Pokémon Black 2 `.nds` | Unova2 | DS | IREO | `11f9lNHk-42sDTxJHzLd9SAwy4niz35xk` |
| Pokémon X `.zip`→`.3ds` | Kalos | 3DS | — | `1ABu0vDdYt8juhWxiFpP8vWBbtBHaos5d` |
| Pokémon Ultra Moon `.zip`→`.3ds` | Alola | 3DS | A2BA | `1T9i0ItuNp8Ba0--MZhr5nna2rDswdren` |

(Drive MCP search: `title contains 'Ruby'` etc. HeartGold covers BOTH Kanto and
Johto — one shared overworld. No SoulSilver needed.)

## 2. Status per region
| Region | Source | Format | State | Output |
|--------|--------|--------|-------|--------|
| **Kanto** | HeartGold | DS Nitro G3D | ✅ DONE | `assets_3d/kanto/` (199 maps) |
| **Johto** | HeartGold | DS Nitro G3D | ✅ DONE | `assets_3d/johto/` (341 maps) |
| **Sinnoh** | Platinum | DS Nitro G3D | ✅ DONE | `assets_3d/sinnoh/` (533 maps) |
| **Hoenn** | Omega Ruby | 3DS BCH/PICA200 | ⏳ DECODERS WORKING (assembly + binding left) | parser `tools/bch.py` + `render_oras_maps.py`, see §4 |
| **Unova** | Black/White 1&2 | DS Nitro G3D | ⬜ NOT started (into `assets_3d/`) | (older blind-RE lives in `data/maps/unova*`) |
| **Kalos** | Pokémon X | 3DS BCH/PICA200 | ⬜ NOT started | reuses `tools/bch.py` |
| **Alola** | Ultra Moon | 3DS BCH/PICA200 | ⬜ NOT started | reuses `tools/bch.py` |

**Priority order (user's):** finish **Hoenn** → **BW1/2** → **Pokémon X** → **USUM**.

`assets_3d/<region>/` layout: `land/ textures/ buildings/ rooms/ renders/
MANIFEST.json ATTRIBUTION.md`. Full region table: `assets_3d/README.md`.

## 3. Tools (all in `tools/`)
- `nds_decomp.py <rom.nds> -o source/nds/<code>` — DS ROM → NitroFS + unpacked NARCs.
- `3ds_decomp.py <rom.3ds> -o source/3ds/<code>` — 3DS ROM → romfs + unpacked GARCs.
- `nitro_g3d.py` — DS BMD0/NSBMD + NSBTX decoder (Model.triangles() API).
- `bch.py` — **3DS BCH (PICA200) decoder** — geometry (`map_triangles`) + ETC1
  textures (`decode_etc1`) + model lookup WORKING & verified; relocation flag 1
  + SOBJ mesh walk + full content dict still open (§4).
- `render_oras_maps.py` — Hoenn top-down textured bake (PREVIEW: approximate
  texture binding until §4 items 1-2 land). `<model_mem> [tex_mem]`.
- `render_platinum_maps.py` — top-down rasterizer (`_draw_model_triangles`,
  `rasterize_triangle`, `texture_rgba`); **model-agnostic** — reused by every region.
- `collect_region_3d.py <kanto|johto>` / `collect_sinnoh_3d.py` — the DS collectors.
- `hgss_map.py`, `hgss_export_town.py` — HeartGold field-map parse + verify render.
- `platinum_common.py` — Platinum map-header/matrix/land resolvers.

Deps: `pip install ndspy pillow numpy` (DS) / `pip install pillow numpy` (3DS).

## 4. ▶ RESUME POINT — Omega Ruby (Hoenn): decoders WORK, finish assembly+binding
Full byte-level detail + all confirmed offsets: **`assets_3d/hoenn/RECON.md`**
(the authoritative doc — read it first; the summary here is a pointer).

**What now WORKS end-to-end in `tools/bch.py` + `tools/render_oras_maps.py`
(all verified on the real ROM):**
- `BCH.find_map_model()` — model descriptor lookup (bypasses relocation).
- `BCH.pica_draw_calls()` + `BCH.map_triangles()` — PICA geometry → real terrain
  triangles (v0.x=123.68 ground-truth match; renders a recognizable map).
- `BCH.pica_textures()` + `decode_etc1()` — ETC1 (3DS byte-reversed/Morton) →
  recognizable textures. Map textures are a SEPARATE archive: **`a/1/5/2`**
  (per-map texture BCHs; matched to a map model by texture-name overlap).
- `render_oras_maps.py <model_mem> [tex_mem]` bakes a textured PREVIEW.

**The 3 remaining pieces for a CLEAN, EXACT bake (each SPICA-level; the current
preview is garbled without them):**
1. **SOBJ mesh decode** — the mesh table (`desc+0x34`, stride 0x2c: `+0x10`
   SOBJ ptr, `+0x1c` vcount, `+0x28` icount) has another indirection; the
   heuristic `pica_draw_calls()` mis-pairs some meshes → stray overlay
   triangles. Walk the SOBJ for authoritative per-mesh (vbuf, ibuf, material).
2. **Relocation flag 1** — flags 0/2/3 are CRACKED (ptr-in-main; value base
   main/data/gpu). Flag 1 (string ptrs, majority) is delta/sub-tabled — finish
   it → `content_dict()` + Materials/Textures patricia dicts resolve → EXACT
   material→texture binding (kills the render striping).
3. **Zone table `a/0/1/3`** (538 `ZO\5` containers) — the overworld is a
   `world##_col_row` CELL GRID (like the DS matrix); towns/routes are cells,
   interiors are separate (`t###r####`,`c1##`). To render a NAMED town (e.g.
   **Littleroot**, the user's requested first target) you must decode this
   table: name → its `world##` cells → stitch (same pattern as Sinnoh/HGSS).

**Order to do them:** SOBJ (clean geometry, unblocks material link) → zone table
(find Littleroot's cells) → flag-1/binding (exact textures) → batch bake.

--- ORIGINAL RECON (still valid, byte-level) BELOW ---
Full byte-level detail + all confirmed offsets: **`assets_3d/hoenn/RECON.md`**.

**Bootstrap (ephemeral extraction, ~few min):**
```
curl -sSL "https://drive.usercontent.google.com/download?id=1_amuM3N1RISg2bk7J0M_7f7jwUBPijb_&export=download&confirm=t" -o /tmp/omega-ruby.zip
cd /tmp && unzip -o omega-ruby.zip "*.3ds"
python3 tools/3ds_decomp.py "/tmp/Pokemon Omega Ruby (USA) (En,Ja,Fr,De,Es,It,Ko) (Rev 2) Decrypted.3ds" -o source/3ds/omegaruby
pip install pillow numpy
```
Map terrain models = GARC **`a/0/3/9`** (`GR`-wrapped BCH). Zone table = `a/0/1/3`.

**DECODED & VALIDATED on real bytes (do NOT re-derive):**
- GR sub-resources: `0x1a00`=BCH model · `coll` collision · `KAGE` shadow.
- BCH header/sections parse (`bch.BCH(data, base)`); **relocation flag 0**
  byte-exact (word@`main_off+pos*4`, value `+= main_off`) → Models dict `0x110`.
- Names = **string-table-relative offsets** (not relocated pointers).
- Model descriptor: `+0x00` 4×3 world matrix · `+0x34` mesh-table ptr+count ·
  `+0xb0` name offset.
- Per-mesh PICA200 VAO/draw: `reg 0x200` base, `0x201` attr-fmt (`0xd7bb`),
  `0x205` stride, `0x227` index-buf offset, `0x228` count, `0x22f` draw.
  **VERTEX FORMAT CONFIRMED** = `[position f3, normal f3, uv f2, color ubyte4]`,
  **36 bytes/vertex**; real vertices read back correct (v0 pos (123.68,0.65,
  −126.88) uv (3.09,0.34) on map `c09r1002`). Material state (combiners/LUTs) is
  in the gpu section, separate from vertex/draw.
- Real map members: `0389`,`0818`,`0301`,… ; member 0 = empty "test00" (skip).

**REMAINING WORK (mechanical, format proven):**
1. Enumerate per-sub-mesh draw blocks from the SOBJ face list (count is per-submesh).
2. Read index buffer (`data_off + reg0x227`, `reg0x228` indices) → triangles;
   apply the descriptor's world matrix.
3. Decode `TXOB` textures (ETC1 / ETC1A4 / RGBA) by material name (`chip_grass`,
   `chip_gake*`, …) → the rasterizer's texture interface.
4. Feed tris+texture to `render_platinum_maps` rasterizer → bake `assets_3d/hoenn/`.
5. Zone table `a/0/1/3` → matrix placement; text GARC → real Hoenn town names.

## 5. After Hoenn
- **Unova (BW1/2, DS):** collect into `assets_3d/unova/` with the DS pipeline
  (`nds_decomp.py` + `nitro_g3d.py`). Prior blind-RE notes are in `CLAUDE.md`'s
  Unova section / `tools/bw_common.py` (targets the older `data/maps/unova*`).
- **Kalos (X) & Alola (USUM), 3DS:** reuse `tools/bch.py` unchanged once Hoenn
  is done; only locate each game's map-terrain GARC (the ORAS recon method).

## 6. Ground rules
- Commit ONLY derived assets/tools/docs — **never ROM bytes** (`source/**` is
  gitignored). Verify each decode against real data before trusting it.
- Push to `claude/pokemon-3d-maps-extraction-rui36v`; keep PRs #11/#1 updated.
