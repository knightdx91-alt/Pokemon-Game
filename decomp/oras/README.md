# ORAS (Omega Ruby) binary decomp — field/map graphics

Goal: read the ORAS engine code to learn **how the field map is assembled and
rendered** ("how it's supposed to look"), so the `assets_3d/hoenn` extraction is
driven by the real spec instead of byte-level guessing. This answers the
recurring questions: exact cell-placement/matrix offsets (stitching seams), the
field camera (angle/dist/FOV), whether border trees are terrain vs placed
objects, and the cull/draw rules.

## Key fact: ORAS is symbol-STRIPPED, but RTTI class names survive
Unlike USUM (Gen-7, ~23k shipped C++ symbol names — see `decomp/` and the
`tools/cro_*` pipeline), ORAS (Gen-6, 2014) stripped its function symbols:
`DllField.cro` contains exactly **1** mangled function name. So the
symbol-driven decomp that made USUM readable does NOT apply here.

BUT the **RTTI type-name strings are intact** — the full C++ **class structure**
is recovered (488 classes; see `RTTI_CLASSES.md`). Functions are nameless, but we
know every class. RE therefore goes: RTTI class → its **vtable** (recover with
`tools/cro_vtables.py`, which replays relocations to fill the reloc-only pointer
tables) → the class's virtual methods → disassemble (`tools/cro_disasm.py`) /
data-flow (`tools/cro_dataflow.py`) the method that loads/sets-up the thing.

## Modules
- **`DllField.cro`** (1.32 MB) — the field/map engine. Primary target.
- `static.crs` — core runtime (462 exports, all C++ stdlib/RogueWave `__rw::`).
- `DllTownmap.cro`, `DllFieldDemo.cro`, `DllFieldEvent*.cro` — supporting.

## The high-value target classes (from RTTI_CLASSES.md)
| Class | Answers |
|-------|---------|
| `field::FieldCameraSetting`, `field::FieldStereoCamera`, `field::CCameraGameTargetInterface` | the exact field camera — "how it's supposed to look" (our camera guessing) |
| `field::MapFileSimple`, `field::MapBlock`, `field::FieldmapProc` | map cell load + placement (→ exact stitching offsets / the matrix) |
| `field::FieldAreaEnv` | per-area environment (texset/season/lighting) |
| `field::GridBase`, `GridRail`, `GridVector`, `PlayerGrid` | collision/walk grid |
| `field::FieldH3dKusaModel`, `field::nuts::FieldNutsModel` | grass / berry-tree models (confirms static border trees are TERRAIN geometry, not placed props — `nuts`/`kusa` are the only vegetation model classes, and they're the animated berry-trees / tall-grass, not the static tree line) |
| `field::mmodel::Move3DModel*`, `DrawCode*` | moving models (NPCs/player) + their draw paths |
| `field::PositionBase`, `PositionRail`, `PositionVector` | entity placement (NPCs/events) |

## Bootstrap (extraction is ephemeral/gitignored)
```
# ROM → extraction (source/3ds/omegaruby, gitignored):
curl -sSL "https://drive.usercontent.google.com/download?id=1_amuM3N1RISg2bk7J0M_7f7jwUBPijb_&export=download&confirm=t" -o /tmp/omega-ruby.zip
cd /tmp && unzip -o omega-ruby.zip "*.3ds"
python3 tools/3ds_decomp.py "/tmp/Pokemon Omega Ruby (USA) ... Decrypted.3ds" -o source/3ds/omegaruby
pip install capstone
# symbols (sparse) + RTTI classes:
python3 tools/cro_symbols.py source/3ds/omegaruby/romfs -o /tmp/oras_symbols
strings source/3ds/omegaruby/romfs/DllField.cro | grep -oE 'N5field[0-9]+[A-Za-z0-9_]+E'  # RTTI
```

## NEXT (resume point)
1. Recover the `DllField.cro` vtables (`tools/cro_vtables.py DllField` — adapt for
   the ORAS romfs path). Match each vtable to its RTTI class via the type_info
   pointer that precedes/《references》 the vtable.
2. First target: **`field::FieldCameraSetting`** — disassemble its ctor/setup to
   read the default field-camera angle/distance/FOV (validates our render camera).
3. Then **`field::MapFileSimple` / `field::MapBlock`** — the map-cell loader:
   find where it reads the matrix/placement so multi-cell stitching gets exact
   per-cell offsets (kills the seams).

## Pipeline now runs on ORAS (env overrides) + findings
The `cro_*` tools take env overrides so the USUM pipeline runs on ORAS:
```
export CRO_ROM=source/3ds/omegaruby CRO_MAP_DIR=/tmp/oras_map \
       CRO_FUNC_DIR=/tmp/oras_functions CRO_VTABLE_DIR=/tmp/oras_vtables
python3 tools/cro_map.py source/3ds/omegaruby/romfs -o /tmp/oras_map
python3 tools/cro_disasm.py --scan          # 14,931 funcs located in DllField
python3 tools/cro_vtables.py DllField -o /tmp/oras_vtables
```
- **DllField.cro segments:** text @384 (0xf0270), rodata @987136 (0x1d9e0), data
  @1316472, bss. RTTI name strings live in **rodata** (e.g. FieldAreaEnv name
  `N5field12FieldAreaEnvE` @ rodata+0xf0a5; FieldCameraSetting @ 0xf245;
  MapBlock @ 0x14dce; MapFileSimple @ 0xf101; FieldmapProc @ 0xf0bc).
- **RTTI→vtable bridge (mechanism confirmed, format TBD):** the C++ ABI puts a
  type_info at vtable[-1]; type_info+4 points to the name string. Confirmed such
  a reloc EXISTS: FieldAreaEnv's type_info name-ptr is written at rodata+0xcda8 →
  name rodata+0xf0a5. But the internal-relocation table (header @0x128 → off
  0x121710, cnt 0x2a9e) is NOT cleanly 12-byte `[type][value][dest]` from the
  start — `cro_vtables` pattern-scans for `type==2` and works for FUNCTION-pointer
  slots, but the rodata→rodata (typeinfo/name) entries appear in a different
  layout/phase (the FieldAreaEnv one parsed raw as `[dest_tagged=0xcda81]
  [flags=0x102: patchType 2, srcSeg 1][value=0xf0a5]`). **NEXT: nail the exact
  internal-reloc entry format** (compare against a known vtable func-slot at
  rodata+0x7238) → build a complete rodata pointer map → walk name→type_info→
  vtable→methods for FieldCameraSetting / MapFileSimple / MapBlock → disasm the
  ctor/setup for the camera constants and the cell-placement/matrix read.

## What the binary has already told us (actionable for the maps)
1. **Our cell-stitching model is correct.** The map = `field::FieldAreaEnv` (an
   area) composed of `field::MapBlock` cells, loaded by `field::MapFileSimple`,
   with a `field::Grid*` collision grid. Stitching `world##_col_row` cells is
   exactly the engine's own model.
2. **Static border trees are terrain, not props** — the only vegetation MODEL
   classes are `FieldH3dKusaModel` (grass) and `field::nuts::FieldNutsModel`
   (animated berry-trees). There is no static-tree placement class → confirms our
   ~6-tree Littleroot extraction is complete; denser borders come from neighbor
   cells (stitching), not missing props.
3. **A collision grid exists** (`GridBase`/`GridVector`/`PlayerGrid`) — a future
   extract target for walkability, separate from the render mesh.

Practical implication: the two remaining fidelity fixes (seam-exact cell offsets;
the field camera) are best gotten by (a) decoding the ROM's zone/matrix DATA
directly now that the class model confirms the structure, and/or (b) finishing
the reloc parse above to read `FieldCameraSetting`/`MapFileSimple` constants.

## Zone/matrix data probe (seam-exact stitching) — findings
Tried to derive the exact cell pitch from the ROM data (for seamless stitching):
- **Cell collision** lives in each `a/0/3/9` GR container as a `coll` sub-block
  (GR offset-table +0xc). It's a collision MESH (triangle verts + a small header
  `[u32 0x910][u32 0x5d8][counts 1,3,2,1,2]`), not a tile grid. Its extent is
  **±363.6** (full 727.2 ≈ 40 tiles @ 18.18 u/tile) — the same for every cell.
- **But 727 is NOT the render pitch:** at 727 the cells separate (gaps); the
  rendered geometry doesn't fill the whole collision cell and cell edges are
  irregular. Empirically the cells mesh best at **pitch ≈ 485** (440 overlaps,
  512/727 gap). `render_oras_town.py` now defaults to 485.
- **Seam-exact placement is a code constant, not derivable from geometry.**
  Because the cells are irregular blobs, no single uniform pitch abuts them
  perfectly — the engine uses an exact per-cell world offset from
  `field::MapFileSimple`/`MapBlock` (or a zone-matrix table). Getting pixel-exact
  seams therefore requires either finishing the reloc→vtable→disasm of
  `MapFileSimple` (read the placement math) or locating the overworld matrix that
  lists cell→world-offset. 485 uniform is the best approximation until then.
