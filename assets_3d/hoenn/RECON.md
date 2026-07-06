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

## BCH internal structure — DECODED (validated on real ORAS members)
Relocation flag 0 (majority) is byte-exact in `bch.py`: pointer word at
`main_off + pos*4`, value `+= main_off`. Flags 1-3 = str/data/gpu bases
(hypothesis); the 3 rare high-flag entries (0x26/0x28/0x2e) still open — they
patch words further into the header and are NOT needed for the geometry walk.

**Content header** (`main_off`): array of (pointer-table ptr, count) pairs.
pair0 = Models (word@0x44 → `0x110`, count 1). The Models pointer-table at
`0x110` holds `count` pointers → each **model descriptor**.

**Model descriptor** (member 0 @ `0x1cc`; layout confirmed):
`+0x00` 4×3 world transform matrix (row-major floats; identity on test map) ·
`+0x34` mesh-table ptr + `+0x38` count · `+0xb0` name offset (string-table
**relative**, e.g. 0xbc → "c102r0101_00_00" — names are str-relative offsets,
NOT relocated pointers) · `+0xdc` a (ptr,count) → the `coll`/vertex block table.

**Mesh path**: mesh-table → SOBJ. Per-mesh **PICA200 draw command buffer**
(found on real member 0818 = map `c09r1002`, @~`0x9e80`):
```
reg 0x227 = index-buffer address (offset into data section) | fmt in high nibble
reg 0x228 = vertex/index count      (0x4b0 = 1200 on that mesh)
reg 0x25e = primitive config        reg 0x22f/0x231 = draw-elements trigger
reg 0x200..0x226 = vertex-attribute array config (base addr, per-buffer
                   offset/format/stride) — the "loadVertexBuffer" block
```
Material/fragment state (combiners, LUTs: regs 0x0c0-0x115, 0x2c0/0x2c1) lives
in the **gpu section**, separate from the per-mesh vertex/draw commands above.

Real map members (by geometry size): `0389`(cliff/sea, 1.3 MB), `0818`
(`c09r1002`), `0301`, `0264`, … — use these to validate, NOT member 0
(`c102r0101` = an empty "test00" map: only a `coll` block, no render mesh).

## VERTEX FORMAT — CONFIRMED by reading real vertices (member 0818 `c09r1002`)
The per-mesh VAO block (reg 0x200 consecutive-write @~0x9e60) decodes to:
- `reg 0x201` VtxAttrFmt0 = `0xd7bb` → attribute list (4 bits each, low→high:
  bits[1:0]=type 0/1/2/3=byte/ubyte/short/float, bits[3:2]=components-1):
  **attr0 = POSITION float3 (0xb), attr1 = NORMAL float3 (0xb),
  attr2 = UV float2 (0x7), attr3 = COLOR ubyte4 (0xd).**
- `reg 0x205` buf0 config-high → **bytesPerVertex = 0x24 = 36** = 12+12+8+4 ✓.
- `reg 0x200`=0 base, `reg 0x203`=0 buf offset → vertex buffer starts at the
  BCH **data section base (`data_off`)**. `reg 0x227` = index-buffer offset
  (data-relative), `reg 0x228` = count (per sub-mesh, e.g. 0x4b0), `reg 0x22f`
  = draw-elements.

**PROVEN:** reading float3+float2 at stride 36 from `data_off` yields real map
geometry — v0 = pos (123.68, 0.65, -126.88) uv (3.09, 0.34); a coherent textured
terrain cluster (UVs >1 ⇒ texture tiling). So position/UV extraction WORKS; the
format is no longer a hypothesis.

## ✅ Model-descriptor path RECOVERED (verified on real member 0818)
The flag!=0 relocation is still not byte-exact (the content-header material/
shader/texture pointers, pairs 1+, come out mis-based — 0818 pair1=0xf8,
pair2=0x11 are garbage). BUT the **Models path does not need it** and is now
decoded + verified in `tools/bch.py::BCH.find_map_model()`:

- GR member 0818 → BCH@0x1a00 (`coll`@0x100480, `KAGE`@0x103700).
- Content header pair0 = Models, count 1 (readable pre-reloc).
- Models dict **node** layout = `(u32 nameOffset_str_relative, u32 dataOffset,
  u32 links, …)`. Find the node by matching its nameOffset to the model-name
  string; the next word is the descriptor offset. **0818: node@0x10c, name
  'c09r1002_00_00' (str-rel 0x208) → descriptor @0x2cc.**
- **Model descriptor @0x2cc** (0818): `+0x00` 4×3 transform (axis-permutation,
  DS-Y-up→map space), `+0x34` **mesh-table ptr = 0x8c8**, `+0x38` **mesh count
  = 17**, `+0xb0` name offset, `+0xdc` (ptr,count)=(0x226,109) secondary table.
- **Mesh-table entries** reference **data-section** buffers: e.g. 0xb980,
  0xbc30, 0xbef0 (= data_off 0xb780 + 0x200, 0x4b0, 0x770) each paired with a
  small count (0x2c) — the per-mesh vertex/index buffers to walk next.
- Terrain material/texture names confirmed present (member 0389 = Route 124
  sea): `chip_gake_sea`, `chip_sea_a/b`, `chip_rock_c`, `r124_sand`, `sand`,
  shaders `DefaultShader`/`FieldChar`. So the texture-binding step has its names.
- `find_map_model()` currently covers `c##r####`-coded maps (verified unique on
  0818). D-/interior-named members (0389='D01') need the generic Models-dict
  patricia walk — that's the small remaining piece to enumerate all 416 maps.

## ✅ PICA200 GEOMETRY EXTRACTION — WORKING (verified on member 0818)
Implemented in `tools/bch.py`: `BCH.pica_draw_calls()` + `BCH.map_triangles()`.

- **Draw calls** are found by raw-scanning the GPU section for the reg-0x228
  command header `0x000f0228` (a linear command walk desyncs on interleaved
  data). Each draw: `reg 0x227` = index-buffer offset (data-relative), `reg
  0x228` = index count, preceded by a `reg 0x200` burst giving `reg 0x203` =
  vertex-buffer offset and `reg 0x205` where `(val>>16)&0xff` = **stride**
  (36 or 24 — formats vary per mesh). **17 draws found = the 17-mesh count.**
- **Vertices**: `data_off + vbuf_off + index*stride`; position = float3 at +0,
  UV = float2 at +0x18 (36B fmt) / +0x0c (24B). **u16 indices.**
- **Primitive mode CONFIRMED = triangle list** (`reg 0x25e` = 0), so indices
  group 3-at-a-time.
- **VERIFIED:** mesh0 index@0xd2278 count 1200 stride 36, vertex0.x == 123.68
  (matches earlier ground truth); the clean meshes reconstruct a coherent map
  extent **X[-288,306] Z[-306,250]** — real map-sized terrain, map-like
  structure in a top-down positional render (paths, stepped edges, borders).
- `map_triangles()` sanity-gates each mesh (skips array-draws / mismatched
  0x227 whose "vertices" are garbage floats).

## Material→texture bindings + texture-image location (session findings)
- **Use a real OUTDOOR map to validate, not 0818** — 0818 (`c09r1002`) is a
  contest-hall **interior** (strings `room63_kabe/stage/hoshi`, `com_chair05`,
  `com_table05`), which is why its render has furniture "fans". **Member 0389 =
  Route 124** (sea/cliffs) is proper terrain: `map_triangles()` yields 28.6k
  tris that render as coherent map geometry (platforms, stepped paths, borders)
  — a few spurious long tris remain (the per-mesh-robustness item).
- **Material descriptors** live in the main header; each material name (e.g.
  `chip_gake_sea`) is followed at **+0x0c** by its **texture0 name**
  (`chip_gake_sea`→`gake_sea_a1`, `chip_gake_sea_ground`→`gake_sea_b1`,
  verified). The +0x0c offset is NOT universal across all material subtypes yet
  — needs the proper material-struct stride before committing a `materials()`.
- **Texture IMAGES are NOT in the map BCH.** `gake_sea_a1` etc. appear only as
  the material's texture-name field — there is no TXOB with that name in the
  a/0/3/9 member. The pixels live in a **separate texture archive** (same split
  as DS NSBTX). Locating it is the gating item for a textured bake.

## ✅ Map-texture archive LOCATED — `a/1/5/2` (per-map texture BCHs)
Tree-grep for the material texture name `gake_sea_a1` → **`a/1/5/2/0890.bch`**
(449 KB, magic `BCH\0`). It is a per-map texture BCH: names `gake_sea_a1`,
`chip_gake_sea`, `mapr131_gake_sea_a1`, `mapr131_chip_soil2`, … (map r131).
`a/1/5/2` has **1263 members** — one texture set per map. The map model
(`a/0/3/9`) binds a material→texture NAME; the pixels are a **Textures**
content-dict entry inside the matching `a/1/5/2` BCH (no literal `TXOB` magic —
BCH textures are H3DTexture resources with image data in the data section).

## ⚠ Precise next step
1. **Decode `a/1/5/2` textures + match to maps.** Parse the Textures content
   dict of the `a/1/5/2` BCH (name → width/height/format/data offset), decode
   the PICA image (ETC1/ETC1A4/RGBA5551/RGBA8), and match each `a/0/3/9` map to
   its `a/1/5/2` texture BCH (by name prefix `mapr131_*` / the zone table).
   Then feed `map_triangles()` UVs + texture to `render_platinum_maps`'s
   rasterizer (model-agnostic) → bake `assets_3d/hoenn/`.
2. **Per-mesh robustness**: a few meshes emit spurious long triangles (0xFFFF
   primitive-restart, or a mismatched VAO on big array-draws). Handle restart /
   tighten VAO→draw pairing so every triangle is in-mesh.
3. **Generalize model lookup** to non-`c##r####` names (0389='D01') via the
   proper Models patricia-dict walk. `find_map_model()` is the verified ref.
4. **Zone table `a/0/1/3`** → matrix placement + real Hoenn town names.
1. **Iterate sub-meshes**: each SOBJ face/sub-mesh has its OWN 0x200-block +
   0x227/0x228 draw (count is per-sub-mesh — a single 1200 over-read walks past
   the first buffer). Enumerate them from the SOBJ face list.
2. **Index buffer → triangles**: read `reg 0x228` indices at `data_off +
   reg 0x227` (u8/u16 per the 0x227 fmt bits); assemble tris from the 36-byte
   vertex buffer. Apply the descriptor's world matrix.
3. **Textures**: BCH `TXOB` (ETC1/ETC1A4/RGBA) decode by material name
   (`chip_grass`, `chip_gake*`, …) → the rasterizer's texture interface.
4. Feed tris+texture to `render_platinum_maps` rasterizer → bake
   `assets_3d/hoenn/`. Then zone table `a/0/1/3` → matrix placement + names.

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
BCH parser: header/section map + string table validated; **model-descriptor
lookup** (`find_map_model`) and **PICA200 geometry extraction**
(`pica_draw_calls` + `map_triangles`) now WORKING and verified on real member
0818 (see the two ✅ sections above) — coherent map terrain triangles come out
at the correct extent. The relocation flag!=0 issue is *bypassed* (not needed
for the Models path). **Remaining = per-mesh robustness + TXOB textures + zone
placement** (⚠ next steps above). Extraction: `source/3ds/omegaruby`
(gitignored) — re-run the bootstrap.
