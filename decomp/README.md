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
- `map/` — per-module address maps (`<Module>.json`: segments, export
  addresses, import patch sites). Regenerate: `python3 tools/cro_map.py`.
- `functions/` — per-module function tables (`{addr, size, name}` — named
  from symbols or `sub_<addr>`). Regenerate: `tools/cro_disasm.py --scan`.
  On-demand disassembly: `python3 tools/cro_disasm.py Battle "BgSystem"`.
- `src/` (phase 3) — decompiled/rewritten C++, organized by original namespace.

## Roadmap

1. ✅ **Symbol recovery** — `tools/cro_symbols.py` (this commit).
2. ✅ **CRO segment/address maps** — `tools/cro_map.py` → `map/`. Segment
   tables, export addresses (`btl::BgSystem::SetUseVram` = text+0xdfba0,
   validated by disassembly), and import patch sites (where each imported
   symbol's address gets written at load — i.e. cross-module call sites).
   Header gotcha: named imports live at header+0x100; +0xF8 is the raw
   external-patch table.
3. ✅ **Disassembly pipeline** — `tools/cro_disasm.py`. `--scan` builds
   `functions/` (39,182 functions detected via exports + ARM prologue scan,
   4,850 named); `cro_disasm.py <Module> <name|addr>` prints symbol-annotated
   disassembly of any function, with cross-module calls labeled via import
   patch sites. static.crs code = exefs `.code` (text at file offset 0,
   VA 0x100000); CRO code = segment-relative inside the .cro.
4. ⏳ **Decompiler pass** — per-function reconstructed C++ under `src/`,
   starting with `pml` (stats/damage), `btl` (battle flow), `Field`.
   First functions done: `pml::battle::TypeAffinity::CalcAffinity` +
   `MulAffinity` (`src/pml/battle/TypeAffinity.cpp`) — the type-effectiveness
   engine, with the verified 18×18 chart baked to `data/type_chart.json`
   (matches the Gen-7 chart exactly).
5. **Struct recovery** — rebuild headers (`pml::pokepara::CoreParam`,
   save blocks, …) from access patterns + community docs (pk3DS, PKHeX
   research already names many USUM structures — cross-reference).
6. **Long-term** — matching rewrites where feasible; realistically this stays
   a research decomp for a long time. Data/asset side is already fully
   extracted by `tools/3ds_decomp.py`.
