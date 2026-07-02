# Pokémon Ultra Moon — true decompilation project

Target: `Pokemon Ultra Moon (USA) Decrypted.3ds` — NCCH `CTR-P-A2BA`.
Goal: a pret-style research decomp of the game's code, built incrementally:
symbol map → disassembly → per-function decompiled C++ → (long-term) matching
source. No ROM bytes are committed — only derived analysis (names, structure,
rewritten source). The extracted ROM tree lives at `source/3ds/ultramoon/`
(gitignored, ephemeral — regenerate with `tools/3ds_decomp.py`, see CLAUDE.md).

## Why this is tractable at all

USUM ships as a small static core (`static.crs` + exefs `.code`) plus **132
dynamically-loaded CRO modules, one per game system** (`Battle.cro`,
`Box.cro`, `Zukan.cro` = Pokédex, `Field*`, `JoinFesta*`, …), and Game Freak
left the **named symbol tables intact**: 5,088 named exports, 19,541 named
imports, 23,638 mangled C++ names recovered in total. That means real
namespaces, classes, and method signatures — not anonymous `sub_1A2B3C`s.

## Recovered architecture (namespace census)

| Namespace | Symbols | What it is |
|---|---|---|
| `gfl2` | 8,032 | Game Freak's engine library (gfx, heap, ui, fs, scenegraph) |
| `app` / `App` | 14,160 | per-screen application logic (menus, battle UI, …) |
| `pml` | 1,600 | **P**oké**m**on **l**ibrary — species/stats/party core |
| `Savedata` | 2,718 | save-file blocks |
| `Field` | 1,730 | overworld engine |
| `GameSys` | 948 | game manager / main loop |
| `PokeTool` | 910 | Pokémon utilities (forms, icons, …) |
| `btl` | (in Battle.cro) | battle engine |
| `NetAppLib`/`NetLib` | 5,614 | networking (GTS, Festa Plaza, …) |
| `poke_3d` | 1,828 | Pokémon/character 3D models |
| `nn`/`nw` | ~1k | Nintendo SDK |

## Layout

- `symbols/` — per-module symbol inventory (`<Module>.json`: exports/imports/
  scanned, mangled + demangled). `INDEX.md` = summary table.
  Regenerate: `python3 tools/cro_symbols.py`.
- `asm/` (phase 2) — per-module ARM disassembly with symbols applied.
- `src/` (phase 3) — decompiled/rewritten C++, organized by original namespace.

## Roadmap

1. ✅ **Symbol recovery** — `tools/cro_symbols.py` (this commit).
2. **CRO segment/relocation parser** — map each module's code/rodata/data
   segments and resolve import patches, so exports+imports become concrete
   code addresses. (3dbrew documents the CRO format.)
3. **Disassembly pipeline** — Capstone (ARMv6k/ARM11, Thumb2) over `.code`,
   `static.crs`, and each CRO's text segment; label functions from the symbol
   map; function-boundary detection for the unnamed remainder.
4. **Decompiler pass** — per-function pseudo-C, committed under `src/`,
   starting with the systems most valuable to the 2D game: `pml` (stats/
   damage), `btl` (battle flow), `Field` (maps/encounters).
5. **Struct recovery** — rebuild headers (`pml::pokepara::CoreParam`,
   save blocks, …) from access patterns + community docs (pk3DS, PKHeX
   research already names many USUM structures — cross-reference).
6. **Long-term** — matching rewrites where feasible; realistically this stays
   a research decomp for a long time. Data/asset side is already fully
   extracted by `tools/3ds_decomp.py`.
