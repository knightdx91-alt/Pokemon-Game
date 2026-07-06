# Hoenn (Omega Ruby, 3DS) — map-asset reconnaissance ⏳ IN PROGRESS

Omega Ruby is a **3DS** game, so unlike the DS regions (HGSS/Platinum → Nitro
G3D) its maps are **GARC archives of 3DS-format 3D models**. This is genuinely
new work; the DS pipeline (`nitro_g3d.py`) does NOT apply. Reconnaissance below
was done on the real ROM extraction (`source/3ds/omegaruby`, gitignored).

## Bootstrap (extraction is ephemeral/gitignored)
```
curl -sSL "https://drive.usercontent.google.com/download?id=1_amuM3N1RISg2bk7J0M_7f7jwUBPijb_&export=download&confirm=t" -o /tmp/omega-ruby.zip
cd /tmp && unzip -o omega-ruby.zip "*.3ds"
python3 tools/3ds_decomp.py "/tmp/Pokemon Omega Ruby (USA) (En,Ja,Fr,De,Es,It,Ko) (Rev 2) Decrypted.3ds" -o source/3ds/omegaruby
# verified: CTR-P-ECRA, 655 romfs files, 298 GARCs, 51,084 members;
# personal data a/1/9/5 member 1 = Bulbasaur 45/49/49/45/65/65 (extraction valid)
```

## Located map GARCs (this is the pipeline)
| GARC | members | what |
|------|--------:|------|
| `a/0/1/3` | 538 | **ZONE header table** — magic `ZO\x05`; per-zone container with a section-offset table (offsets at hdr+0x08…). ORAS equivalent of the DS map-header table; references model/matrix/encounters/scripts. |
| `a/0/3/9` | 857 | **MAP TERRAIN models** — magic `GR\x07`. 846 members carry a map code (`c102r0101_00_00` etc.), **416 distinct maps**. Strings: `chip_grass`, `chip_gake01` (cliff), `chip_kusa` (grass), `chip_flower_*`, `collPw`/`coll*` (collision), material `lambert1`. |
| `a/0/3/1` | 2040 | CGFX/`.bcres` 3D graphics — field object/prop models (SOBJ/MTOB/SHDR resources). |
| `a/1/6/0` | 684 | per-map grids, `0xfffe`-filled, ~256 KB each — candidate collision/height matrices. |

## The "GR" container format (a/0/3/9) — decoded header
```
+0x00  "GR" u16 magic
+0x02  u16 version (== 7)
+0x04  u32 count/size (0x80)
+0x08  u32[] sub-resource offsets (0x1a00, 0x2700, 0x9e80, 0x9f00, …; high bit
       0x80000000 = flag on some entries)
```
**KEY:** the first offset points at an embedded **standard `BCH\x00` model**
(member 0: BCH at 0x1a00). So GR is a thin wrapper and the real geometry is
**BCH** — the documented 3DS model format (PICA200). That makes a parser
tractable (reference: SPICA / Ohana3DS). Later offsets hold more BCH resources /
textures / the `collPw` collision block.

## BCH byte layout — CONFIRMED against real ORAS `a/0/3/9` member 0
Parser: `tools/bch.py` (`BCH(data, base)`), validated on the real extraction.

**GR sub-resource chain** (member 0): `0x1a00`=BCH model · `0x2700`=`coll`
collision block (~0x7780 B) · `0x9e80/0x9f00/0x9f80`=empty · `0xa000`=`KAGE`
(shadow). So terrain geometry+materials are a single self-contained BCH; the
collision grid is a *separate* GR sub-resource (`coll`), not inside the BCH.

**BCH header** (`BCH\0`, back=fwd=0x21, ver=0xa66f): main@0x44 str@0x5d0
gpu@0x6e0 data@0xb00 dataExt@0xb80(empty) reloc@0xb80/0x148. Field order for
back≥0x21 includes dataExtendedOffset/Length — `bch.py` reads this correctly.

**String table** (validated extraction via `BCH.strings()`): the model is named
by its **map code** `c102r0101_00_00`; material `lambert1`; texture
`test00_00_00`; shaders `DefaultShader`/`FieldChar`. → material→texture binding
and map-code naming both come straight out of the string table.

**Content header** (`main_off`): (patricia-dict-ptr, count) pairs — pair0 =
Models (count 1), then Materials/Shaders/Textures/LUTs. Models dict resolves to
`0x110`.

## ⚠ Precise next step (the current blocker)
The **relocation pass is not yet byte-exact** — `bch.py::_apply_relocations`
re-bases most pointers but mis-bases a few (some content pointers come out as 1
or unshifted), so the Patricia-dict/mesh walk is unsafe. Reproduce SPICA's exact
relocation-flag decode (BCH.cs `PatchOffset`: the per-entry flag selects BOTH
the section the pointer *lives in* and the base to *add*) before geometry decode.
Once relocation is exact: Models dict → SOBJ → PICA200 command buffer (gpu
section) → vertex arrays (data section) → triangles.

## Remaining work (the real build — multi-session)
1. **BCH model parser** (the big one): fix relocation (above), then PICA200
   vertex-attribute decode (positions/UVs/normals), materials → texture
   bindings, and the embedded texture images (BCH `TXOB`, ETC1/RGBA formats).
   From-spec, ~SPICA-level.
2. **GR container parser**: walk the offset table → the terrain BCH(s) + the
   `collPw` collision grid; map code (`c102r0101`) → map name.
3. **Zone table (`a/0/1/3`) decode**: zone → which `a/0/3/9` map model(s) +
   matrix placement + prop set (`a/0/3/1`).
4. **Rasterize** top-down (reuse `render_platinum_maps`'s rasterizer — it's
   model-agnostic once we hand it triangles+texture) → `assets_3d/hoenn/`.
5. Zone name map (text GARC `a/0/7/2`) → real Hoenn town names.

## Status
Reconnaissance DONE ✅ — all map GARCs located and the GR→BCH path confirmed.
BCH parser **foundation built & validated** (`tools/bch.py`): header/section map
+ string table (model/material/texture names) parse correctly on real bytes.
**Gating item now = byte-exact relocation** (see ⚠ above), then PICA200 geometry
decode. Extraction: `source/3ds/omegaruby` (gitignored) — re-run the bootstrap.
