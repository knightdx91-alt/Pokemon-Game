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
