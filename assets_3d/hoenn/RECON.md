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

## ✅ ETC1 TEXTURE DECODE — WORKING (verified on a/1/5/2/0890.bch)
Implemented in `tools/bch.py`: `BCH.pica_textures()` + `decode_etc1()`.
- Texture units are read from the GPU section: `reg 0x082` = size ((h<<16)|w),
  `reg 0x085` = data-relative address, `reg 0x08e` = format (**0xC = ETC1**).
  0890.bch → three 128x128 / 256x128 ETC1 units at data-rel 0x2000/0x4000/0x6000.
- `decode_etc1()` handles the **3DS variant**: 8x8-tiled, 4x4 ETC1 blocks in
  Morton order, and each 8-byte block **byte-reversed** vs the ETC1 spec.
- VERIFIED: the `gake_sea` unit decodes to a recognizable sea-cliff texture
  (rock over green over blue sea), 1363 unique colors.

So all three layers now decode independently: **geometry** (`map_triangles`),
**textures** (`pica_textures`+`decode_etc1`), and the **material→texture names**.

## ✅ Model → texture-BCH matching (deterministic, by texture-name overlap)
Map models (`a/0/3/9`) don't embed textures (verified: `pica_textures()`==0 on
0818/0389/0301/0100/0500/0700) — all reference the shared `a/1/5/2` archive.
Match a model to its texture BCH by **texture-name-set overlap** (not a guess):
`a/0/3/9/0210` ↔ `a/1/5/2/0890.bch` (map r131) share `gake_sea_a1`,
`gake_sea_b1`, `sea_b1` (0.75 coverage, unique best). The `a/1/5/2` BCH names
its textures `mapr131_<base>`; the model's material texture is the bare `<base>`.

## Textures dict — located (final blocker for the bake)
The 3 texture units in the GPU section are only a default/combiner setup — the
**full per-map texture list is in the Textures content-dict**, not the GPU
stream. In `a/1/5/2/0890.bch`: content header pair0=Models/1, and a texture
**name+pointer table sits at the end of the data section** (~0x6d56c): repeating
`(u32 name_str_rel, u32 packed_ptr)` where packed_ptr has a `0x02`/`0x04` flag
byte in the top (relocation-encoded data pointer to the H3DTexture / image).
Names resolve straight (str-relative), e.g. `mapr131_gake_sea_a1`,
`…-silhouette` variants.

## ✅ FIRST TEXTURED RENDER — pipeline complete end-to-end
`tools/render_oras_maps.py <model_mem> [tex_mem]` bakes a top-down textured PNG:
loads the map model + its matched `a/1/5/2` texture BCH, decodes the ETC1
textures, and rasterizes `map_triangles()` with affine UV sampling. Run on map
0210 ↔ 0890 (`python3 tools/render_oras_maps.py 0210 0890`) it produces a
recognizable Hoenn map — cliff/rock meshes texture correctly, proving
geometry + UV + ETC1 sampling all work together.

**Remaining defect (why it's a preview, not the final asset):** meshes are
paired to textures by **draw order** (`di % len(imgs)`), not the true
material→texture name — so some meshes get the wrong texture (visible striping).
The output dir `assets_3d/hoenn/renders/` is **gitignored** until the binding is
exact. The tool is committed; the preview PNG is not.

## ✅ RELOCATION — CRACKED (SPICA-exact, all flags) — foundational unlock
The relocation is now byte-exact in `bch.py::_apply_relocations` (was main-only).
Per SPICA `H3DRelocator`, each 4-byte entry is:
`PtrAddress` (bits 0-24, word index of the pointer within Source) ·
`Target` (bits 25-28, the section base ADDED to the pointer's value) ·
`Source` (bits 29-31, the section the pointer WORD lives in). Section map:
0 Contents(main) · 1 Strings · 2/3 Commands(gpu) · 4-8 RawData(data) · 9+ ext.
So `word@ base(Source)+PtrAddress*4  +=  base(Target)`. The old "flag = bits
25-31, Source always main" mis-based every pointer whose Source≠main (materials,
textures, vertex, index). Now EVERY pointer resolves. Consequences already
folded in: reg 0x203(vbuf)/0x227(index)/0x085(tex-addr) in the command streams
are ABSOLUTE post-relocation, so the readers drop the manual `data_off` add and
mask the index high bit (0818 geometry unchanged 4201 tris; 0890 ETC1 still
decodes). This is the foundation for the exact material→texture binding.

## Content patricia dict — walk MECHANISM found (node struct needs exact nail)
With exact relocation the content-header pairs (`(dictPtr, count)` at `main_off`,
8 bytes each) now resolve. Empirically on `a/1/5/2/0890.bch`:
- **pair0 = Models, pair1 = Materials/Shaders(348), pair4 = Textures(452)** —
  pair4 walks out the real texture names: `mapr131_chip_soil2`,
  `mapr131_gake_basic1`, `mapr131_gake_basic_side`, `mapr13P_gake_sea_b1`,
  `gake_O1_01`, … (matches the map's materials).
- **Node walk**: after a small header the tree is ~**0xc-byte nodes**
  `(u32 nameOffset_str_RELATIVE, u32 links, u32 dataOffset)`; the root node has
  `ReferenceBit = 0xffffffff` (seen at dict+0x4). name = `str_off + nameOffset`.
- ✅ **NODE FORMAT NAILED** (by locating known names' exact str-rel offsets in
  the node array): each node is **0xc bytes** =
  `u16 LeftNodeIndex · u16 RightNodeIndex · u32 NameOffset(str-relative) ·
  u32 ReferenceBit`. Root node (index 0) has ReferenceBit 0xffffffff and no
  name. The **actual objects (H3DTexture/H3DMaterial) are a PARALLEL Values
  array**, indexed by node order — the tree only maps name→index (standard
  SPICA H3DDict). Reading nodes sequentially at 0xc stride gives clean, ordered
  names: e.g. `mapr131_chip_soil2`, `mapr131_gake_basic1`,
  `mapr131_gake_basic_side` (the map's textures, in Values order).

## ✅ LITTLEROOT located + rendered (map identification by name works)
Towns are identifiable by their mesh names (`mesh_draws()`): c105 (member 0154)
has `pokecen00`/`pc_mado` → Oldale, NOT Littleroot (the only town with no PC).
**Littleroot = `world01_02_04` = member `a/0/3/9/0006`** — found by grepping
a/0/3/9 for `mishiro` (Littleroot's JP name ミシロ); it carries `mishiro_gake`
(the town cliff). So towns' OUTDOOR terrain lives in the `world##_col_row`
overworld cells (Littleroot's town proper is one cell; houses/lab are separate
prop models placed via the zone table). `map_triangles()` renders 0006 directly
(2641 tris, X[-413,427] Z[-444,359]) — a recognizable town cell (paths, tree
border). find_map_model() fails on `world##` names (name not stored as a dict
node) but map_triangles doesn't need it (it scans the GPU section). Its texture
BCH is in `a/1/5/2` (find by the cell's texture-name prefix, like the c-maps).

## ✅✅ PIPELINE COMPLETE — Littleroot renders textured (end-to-end)
`tools/render_oras_maps.py <member>` bakes a top-down TEXTURED map from the ROM
via the full exact-binding chain. **Littleroot (0006 = world01_02_04) renders as
a recognizable town** (green grass, tree border, the wooden fenced garden plots
by the houses) — c105 (Oldale, 0154) likewise (trees + buildings). Chain:
`find_map_model` (content header) → `materials()` (draw→Texture0Name) →
`mesh_draws()` → global `texture_table()` index → `decode_etc1` (ETC1/ETC1A4) →
UV raster. Run: `python3 tools/render_oras_maps.py --build-index` then `… 0006`.

**Remaining polish (not blockers):** (a) buildings/Birch's lab are separate PROP
models (CGFX in `a/0/3/1`), not in the terrain cell — place them via the zone
table for a complete town; (b) a few meshes stay untextured (their texture name
isn't in the ~477-entry index yet — `texture_table()` still under-finds in some
BCHs; widen it); (c) minor mesh-pairing artifacts (elongated tris). The core RE
is DONE — this is asset-coverage polish. Next: batch-bake all Hoenn maps into
`assets_3d/hoenn/`, then reuse the exact same `bch.py` for Kalos (X) + Alola
(USUM), differing only in the GARC map-archive indices.

## ✅ EXACT BINDING CHAIN — SOLVED (via Ohana3DS layouts, both sides verified)
The material→texture binding that blocked the whole session is cracked. Ohana3DS
(explicit sequential reads, unlike SPICA's attribute-driven serializer) gave the
exact record layouts:
- **MATERIALS table** (the 0x2c-stride table at `find_map_model().mesh_table` —
  it was materials, not meshes, for BCH version>=0x21): `+0x00` MaterialParams ·
  `+0x10` TextureCommandsOffset · `+0x14` wordcount · `+0x18` MaterialMapper ·
  **`+0x1c` Texture0Name · `+0x20` Texture1Name · `+0x24` Texture2Name ·
  `+0x28` material Name** (all str-relative). `bch.materials()` reads this;
  `mesh_draws()` now carries each draw's exact texture name (tex0, or tex1 when
  tex0='projection_dummy'). VERIFIED c105: draw→chip_kusa(ground)/pokecen_01/
  c105_hashi01(bridge).
- **TEXTURE records** (in the a/1/5/2 texture BCHs): `+0x00`
  texUnit0CommandsOffset (→ PICA block w/ reg 0x082 size / 0x085 addr / 0x08e
  fmt) · `+0x1c` textureName. `bch.texture_table()` → `{name: {addr,w,h,fmt}}`.
  VERIFIED 0890: chip_gake01→0x7b80, chip_gake_sea→0x9b80. **Crucially the
  texture BCH uses the SAME base names the model materials reference** (no
  map-prefix), so `materials()[i]['texture']` keys straight into `texture_table`.

So the full chain now exists: **draw → material → texture name → image**.

## ⚠ Remaining to a clean textured render (bounded, logic proven)
1. **`texture_table()` under-finds** (~331 across all a/1/5/2; misses chip_kusa).
   The heuristic (name@+0x1c with +0x00 in gpu) is too narrow — enumerate via
   the content header's **texturesPointerTableOffset** (Ohana) instead, and
   accept texUnit0 commands in the data section too.
2. **Textures are shared across many a/1/5/2 BCHs** (dedup) — build a GLOBAL
   `{name: (member, addr,w,h,fmt)}` index once (scans in ~2s) and look up each
   map's texture names in it. (chip_wood_b resolved → member 0229, fmt 0xd
   ETC1A4 — so add ETC1A4 to decode_etc1.)
3. **`find_map_model()` fails on `world##` cells** (Littleroot=0006) — the name
   isn't stored as a dict node. Fix the descriptor lookup for world cells so
   `materials()`/`mesh_draws()` work there (map_triangles already works).
Then: per draw, look up texture in the global index → decode → rasterize UVs.

## ⚠ Precise next step — finish exact binding (node format now known)
1. Implement `read_dict(ptr)` in `bch.py`: 0xc-stride node walk (skip root) →
   ordered name list, plus the **parallel Values array** (H3DTexture /
   H3DMaterial objects) that follows the node array — index i's name pairs with
   Values[i]. For the `a/1/5/2` Textures dict: Values[i] = H3DTexture → its
   `reg 0x085` addr / dims / format (already decoded by `pica_textures`) → pair
   each ETC1 image with its NAME.
2. Model **Materials** dict the same way → material name → its texture0 name;
   per-mesh material index (from the mesh table / SOBJ) → material → texture
   name → the named image from step 1 → EXACT mesh→texture binding (replaces
   `render_oras_maps`'s `di % len(imgs)` guess; kills the striping).
3. Then SOBJ per-mesh pairing polish + zone table `a/0/1/3` for named-town
   (Littleroot) cell stitching.

## Relocation flag analysis (SUPERSEDED by the SPICA-exact decode above)
The exact material→texture binding (and every content dict) is gated by the BCH
relocation, which `bch.py` currently applies for flag 0 only (assuming the
pointer word is always in `main`). Full flag map, measured on `a/1/5/2/0890.bch`
(reloc 0x6d180/0x9d4; sections main=0x44/len0x1ebc, str=0x1f00, gpu=0x2300/
len0x1880, data=0x3b80):

    flag  n     pos*4 range        meaning (hypothesis from range vs section lens)
    0    235   [0, 0x1da4]         ptr word in MAIN, value += main_off   (DONE)
    1    319   [0x320, 0x7ae0]     value += str_off; ptr word NOT all in main
    2     40   [0x324, 0x1eac]     value += data_off
    3      5   [0x644, 0x16a4]     value += gpu_off
    0x25  15   [0x15c0,0x1860]     rare high flags — patch words deeper in header
    0x26   5 · 0x27  3 · 0x28  2 · 0x2e  5   (same cluster)

**CRACKED (empirically, by testing which section base makes each entry resolve
to a valid target):**
- **flag 0**: pointer word in `main`, value += `main_off` — 235/235 land in
  main. (already in `bch.py`)
- **flag 2**: pointer word in `main`, value += `data_off` — **40/40** land in
  data. ✓
- **flag 3**: pointer word in `main`, value += `gpu_off` — **5/5** land in gpu. ✓
  So flags 0/2/3 all have the pointer word in `main`; `bch.py`'s
  `main_off+pos` write is correct for them, and `_value_base` already adds the
  right base. **These are done.**

**STILL OPEN — flag 1** (319 entries, the majority = string-name pointers):
value += `str_off` does NOT cleanly resolve from any single section (best 101/
319), and pos*4 (up to 0x7ae0) exceeds `main_len` — so flag 1 is encoded
differently (likely delta/cumulative position, or a per-section sub-table with
its own header inside the reloc block). Reproduce SPICA's exact flag-1 handling
→ then string-name pointers resolve, `content_dict()` works, and the Materials/
Textures patricia dicts give material→texture-name and texture-name→image
directly (no more draw-order guess) → exact binding. The rare high flags
(0x25-0x2e) patch deeper header words and aren't needed for the geometry/texture
walk.

## Overworld is a CELL GRID + mesh-table indirection (session findings)
- **The ORAS overworld is chunked into `world##` cell maps** — e.g.
  `world13_07_02`, `world14_05_05` (name = `world<region>_<col>_<row>`), exactly
  like the DS matrix. Town/route OUTDOOR geometry lives in these cells; building
  **interiors** are separate models (`t103r0101` = town 103 room 1, `c1##r####`).
  So "render Littleroot" ≠ pick one model — it's: zone table → the town's
  `world##` cells → stitch (same pattern as Sinnoh/HGSS). **The zone table
  `a/0/1/3` (538 `ZO\5` containers) is the required index and is not yet
  decoded** (its per-zone section-offset table → map-cell list + name id).
- **Mesh-table (SOBJ) structure** (validated on town c105 = member 0154, desc
  0x30c, mesh table 0x4bc, 21 meshes, **stride 0x2c**): each 44-byte entry has
  `+0x10` a pointer (SOBJ, data-region — NOT the raw vertex-buffer offset; it's
  another indirection), `+0x1c` vertex count, `+0x28` index count. The mesh
  entry's `+0x10` does NOT equal the draw's reg-0x203 vbuf offset, so the SOBJ
  it points at must be walked to get the authoritative per-mesh (vertex buffer,
  index buffer, material). **This is why the current heuristic
  `pica_draw_calls()` (nearest-preceding 0x200 burst) mis-pairs some meshes →
  the stray overlay triangles in renders.** Decoding the SOBJ properly fixes
  the artifacts AND yields mesh→material→texture for exact binding.
- `find_map_model()` only matches `c##r####` names; broaden the map-code regex
  to `[a-z]+\d+[a-z]?\d*_\d+_\d+` to cover `c105_00_00` / `world##` / `t###`.

## ⚠ Precise next step — make the binding exact, then bake for real
1. **Parse the Textures dict** in the `a/1/5/2` BCH → `{name: (w,h,fmt,
   data_off)}` from the name+pointer table (~end of data section) + the
   H3DTexture struct each pointer targets (dimensions/format/image offset).
   `decode_etc1()` already handles fmt 0xC; add ETC1A4 (0xD) / RGBA as they
   appear. Build `{base_name: image}`.
2. **Bind + rasterize**: track material index per draw in `map_triangles()`
   (mesh table @desc+0x34 → material → texture name), resolve name→image, feed
   positions+UVs+image to `render_platinum_maps`'s rasterizer (model-agnostic)
   → bake `assets_3d/hoenn/renders/<map>.png`. Validate on 0210↔0890 (map r131).
3. Per-mesh restart robustness (kill stray long triangles); then batch via the
   zone table `a/0/1/3` (538 `ZO\5` containers) for placement + real names.
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

## ▶ PROP / BUILDING SUBSYSTEM — feasibility CRACKED ✅ (this is what makes it look like Littleroot)

The `a/0/3/9` terrain we already decode is ground-only — that's why maps render
empty (no houses/lab/trees). Buildings & trees are a SEPARATE model+placement
subsystem, now located and de-risked. **Online research (ProjectPokemon ORAS
file-system doc + pk3DS/Ohana3DS as format refs) + direct byte inspection this
session:**

### Archives (all present in `source/3ds/omegaruby/unpacked/`)
- **`a/0/2/1`** (544 members) = **overworld building models**. Container magic
  **`MM`**: header = `MM`(2) · ver u16 · `dataOffset` u32 (=0x80) · `fileSize`
  u32. **One embedded `BCH` model per member** at 0x80 (verified: member 0000 →
  `42434800`="BCH\0" v0x2121). **Decodes with our EXISTING `bch.py`** — no CGFX
  parser needed (CGFX was the feared unknown; ORAS building models are plain
  BCH). Model index in a placement record → member number here.
- **`a/0/1/4`** (229 members) = **town prop sets** (multiple models per town).
  Container magic **`AD`**: `AD`(2) · ver u16 · dataOffset u32 · fileSize u32,
  then at **+8 a u32 offset table** where **high-bit-set entries = embedded BCH
  models**, high-bit-clear entries = data blobs (bounding-box / scale floats,
  e.g. `0x3dcccccd`=0.1). Member 0000 → 2 BCH models (0x100, 0x1e80) + data.
- **`a/0/1/3`** (538 members) = **`ZO` zone data** = the PLACEMENTS. Layout:
  28-byte header = `ZO`(2)·ver u16 · **6× u32 section offsets**. Sections:
  0 = 56-byte zone header (matrix/texset/encounter refs); 1 = small table;
  **2 = the big entity/placement sub-table** (starts with its own u32 size, i.e.
  a nested container); 3 (often empty); 4 = 12 B; 5 = trailer. Placement records
  (model_id + xyz + rotation, like HGSS/BW) live in section 2 — decode next.

### Remaining prop work (tractable — no new format parsers)
1. Decode `ZO` section-2 placement records (model_id, position fx32, rotation)
   — same record-scan method that cracked HGSS/BW placements.
2. Map zone → terrain member (`a/0/3/9`) and zone → model archive
   (`a/0/2/1`/`a/0/1/4`) so a placement's model_id resolves to a BCH.
3. Load each building BCH via `bch.py`, transform by placement pos/rot, and add
   as extra nodes in `export_oras_gltf.py` (terrain + buildings in ONE .glb).
   This is the deliverable that makes Littleroot look like the Sinnoh 3D maps.

## ▶ ROOT CAUSE of the "garbled mess" = mesh→material binding by draw order (NOT projection)

Validated against IGN's real ORAS Littleroot screenshot (the correct ground
truth — it IS 3D, so our 3D approach is right; the house meshes `chip_wood_a/b`
+ `chip_mado` windows match the screenshot's tan-plank houses exactly). The
remaining garble (scattered ground quads, dark streaks, white gaps in houses) is
because `render_oras_maps.mesh_draws()` pairs each GPU draw to material N **by
order**, but the GPU-command order ≠ the model's mesh order. Wrong texture on a
mesh = garbage.

**The fix data is located.** Model descriptor (from `find_map_model`, e.g.
member 0006 desc @0x28c):
- `desc+0x34` → material table (13 × 0x2c records), `desc+0x38` = count.
- **`desc+0x40` → the H3DMesh ARRAY**, `desc+0x44` = count (=13). Each H3DMesh
  record's first `u16` = **MaterialIndex** (mesh 0 → 4 = `chip_kusa_a`), i.e. a
  DIFFERENT order than the draw scan. The record also holds sub-mesh / vertex-
  buffer pointers (e.g. `+0x08`, `+0x18`) + a float bounding box.

**Next step (the real correctness gate):** parse the H3DMesh array at
`desc+0x40`; for each mesh read MaterialIndex + its vertex-buffer/index pointers;
match those to the GPU-scanned draw (by index_addr / vbuf_off) so each draw gets
its TRUE material → texture. That replaces the by-order guess in `mesh_draws()`
and should make Littleroot match the screenshot. Cosmetic follow-ups after:
camera-facing billboards for `chip_kusa_b` tall grass; alpha compositing for
`chip_wind`; per-mesh cull list is a stopgap (`render_oras_3d.CULL`).

`tools/render_oras_3d.py` (committed) = the 3D perspective renderer used for this
comparison (ORAS_YAW/PITCH/DIST env knobs, cull list, normal-based shading).
