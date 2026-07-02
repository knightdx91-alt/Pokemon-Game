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
   Done so far:
   - `pml::battle::TypeAffinity::CalcAffinity` + `MulAffinity`
     (`src/pml/battle/TypeAffinity.cpp`) — type-effectiveness engine; verified
     18×18 chart baked to `data/type_chart.json` (exact Gen-7 match).
   - `pml::pokepara::CoreParam::GetPower` / `GetMaxHp` + the CalcStat/CalcHp/
     ApplyNature cores (`src/pml/pokepara/StatCalc.cpp`) — the full stat
     formula `(2·base+IV+EV/4)·L/100 (+5 | +L+10)` × nature, incl. the
     Shedinja 1-HP case; verified against the canonical Garchomp spread
     (all six stats exact).
   - `pml::pokepara::CoreParam` EXP↔level: `CalcLevelFromExp`,
     `GetExpForNextLevel`, `GetExpForCurrentLevel`
     (`src/pml/pokepara/ExpLevel.cpp`) — the growth-table scan (curves
     themselves are data-driven, loaded by pml::personal).
   - `pml::pokepara::CoreParam::IsRare` (`src/pml/pokepara/Shiny.cpp`) — the
     shininess check `(TID^SID^PID_hi^PID_lo) < 16`; threshold-16 boundary
     verified exact.
   - `pml::pokepara::CoreParam::GetMezapaType`
     (`src/pml/pokepara/HiddenPower.cpp`) — Hidden Power type from the six IV
     low bits, `sum·15/63`; uses *native* (pre-Hyper-Training) IVs. Verified
     (all-even→Fighting, all-odd→Dark).
   - `gfl2::math::SFMTRandom::Next` + `gfl2::math::Random::Next`
     (`src/gfl2/math/Random.cpp`) — the two engine RNGs: SFMT MEXP-19937
     (624-word state refill, then `%max`) and a lightweight WELL512-family
     xorshift generator.
   - **Nature modifier table** extracted to `data/nature_table.json` (25
     natures × 5 stats, ±1, VA 0x5e6a14 — the table `ApplyNature`/`sub_223744`
     reads). Verified: Adamant +Atk/−SpA, Modest +SpA/−Atk, Jolly +Spe/−SpA,
     Bold +Def/−Atk, Hardy neutral.

### Cross-module call resolution (import veneers) — WORKING
`cro_map.py` now emits a `veneers` map per module. Mechanism: a named
import's patch site in the text segment is a literal word that receives the
resolved address at load; an `ldr pc,[pc,#-4]` thunk 4 bytes earlier is what
in-module code actually branches to. `cro_disasm.py` labels `bl`/`b`/`blx`
to a thunk with the imported symbol, so cross-module calls read naturally
(e.g. `bl #0x60 ; -> pml::wazadata::GetPower(WazaNo)`).
(My earlier "patch decoder bug" note was a misdiagnosis — the decoder was
correct; the confusion was this veneer indirection plus a bisect wrap-around
in a throwaway debug script.)

### Call graph (`tools/cro_callgraph.py`) — damage pipeline located
`cro_callgraph.py --build <mod>` emits `callgraph/<mod>.json`: every direct
`bl`/`b`/`blx` edge, with local callees resolved to functions and cross-module
edges resolved through import veneers. Queries: `--callers`, `--callees`,
`--find <symbol-substr>`. (ARM linear sweep — Thumb regions are noisy, but the
ARM battle-engine core resolves cleanly.)

Battle.cro damage pipeline traced via the graph:
- `sub_9348` (848 B) — **move-data fetch**: the only function pulling
  `wazadata::GetPower` + `GetType` + `IsDamage` together (base power, type,
  is-it-a-damaging-move).
- `sub_9698` (732 B) — **per-target damage/effect loop**: calls `sub_9348`,
  clamps the target count to 4 (spread-move handling), iterates targets, and
  rolls `gfl2::math::Random::Next` per target. This is the move-execution node
  that sits just below the battle handler-table dispatch (no direct ARM
  callers — reached by function pointer, as expected). The exact damage
  arithmetic lives in its callees (`sub_8f04c`, `sub_e3a50`, …) — next to trace.

### Gen-7 data conversion (practical payoff)
- `tools/usum_personal.py` converts the `a/0/1/7` personal-data GARC (977
  members) → `data/pokemon/usum_base_stats.json` (807 species): base stats,
  named types, catch rate, base EXP, EV yield, gender ratio, egg cycles/groups,
  base friendship, growth rate, ability ids. Verified against known species
  (Bulbasaur/Charizard/Mewtwo/Lucario — stats, types, growth, base-exp, gender
  all exact; `--verify`). Species **names** need Gen-7 message-text decoding
  (per-line XOR) — a separate step; records are keyed by national-dex number.
  This is the clean 2D-portable slice of the ROM (Gen-7 *data* ports; Gen-7
  3D *maps* do not).
- `tools/usum_text.py` — **Gen-7 message-text decoder** (per-line XOR, PKHeX
  algo: key `0x7C89+i*0x2983`, XOR + rotate-left-3). Decodes any text file in
  `a/0/3/<lang>/<idx>.bin`; `--names` writes `data/pokemon/usum_names.json`
  (species/moves/abilities/items). Langs: 2=English (3=Fr,4=It,5=De,6=Es,
  7=Ko,8/9=Zh,0/1=Ja). Verified: #1 Bulbasaur, move1 Pound, ability1 Stench.
  `usum_base_stats.json` is now enriched with `name` + `abilityNames`
  (Charizard→Blaze/Solar Power, Lucario→Steadfast/Inner Focus/Justified — exact).

### Battle architecture findings (server hunt)
- **Battle.cro is the battle *scene* module** (rendering/UI/animation:
  `btl::BgSystem`, move-anim sequencing), NOT the damage server. Evidence: its
  only variable-divide function (`sub_5ce4`) is an HP-%/status threshold check
  (75/50/25 → 29/30/31), and no function reads attacker/defender stats or the
  type chart. The numeric battle server lives in the main executable (`.code`).
- **TypeAffinity cluster fully localized** at 0x21c0e0..0x21c3ac in static:
  `MulAffinity` (0x21c0e0), `CalcAffinity` (0x21c1e8, the *sole* reader of the
  18×18 type chart at VA 0x5bb558), and `CalcAffinityForDefender` (0x21c284,
  dual-type combine) — all three now in `src/pml/battle/TypeAffinity.cpp`.
- **Affinity is called only by function pointer**: exhaustive ARM+Thumb `bl`
  scans of both Battle.cro and all of static, plus a search for the functions'
  stored absolute VAs, find *zero* resolvable callers. The battle server
  dispatches type-effectiveness (and damage) through handler/vtable pointers.
  Cracking that dispatch (vtable/handler-table data-flow) is the remaining
  gate on the numeric damage formula.

### Known next targets / open issues
- **Damage formula** (`btl`, internal/unnamed in Battle.cro): `sub_9348`
  (the move base-power/type/IsDamage setup) is decoded; the type-effectiveness
  step calls `TypeAffinity::CalcAffinity`/`MulAffinity` **indirectly** through
  a function-pointer table (no direct `bl` to the veneer), so pinning the
  exact damage function needs indirect-call/data-flow analysis — tracing where
  the thunk address (0x16d8/0x16d0) is loaded into a register. That's the next
  RE step; export→address mapping for everything decompiled so far is solid.
  Update: `CalcAffinity`/`MulAffinity` are *exported by static.crs* (defined
  at 0x21c1e8/0x21c0e0), and neither an ARM nor Thumb direct-`bl` scan (in
  Battle.cro or static's pml-battle window) finds a caller — confirming the
  battle server reaches them only through function-pointer dispatch. Finding
  the damage server therefore needs either (a) identifying the dedicated `btl`
  server module and its handler tables, or (b) indirect-call/vtable data-flow
  analysis. Tracked as the main open RE problem.
5. **Struct recovery** — rebuild headers (`pml::pokepara::CoreParam`,
   save blocks, …) from access patterns + community docs (pk3DS, PKHeX
   research already names many USUM structures — cross-reference).
6. **Long-term** — matching rewrites where feasible; realistically this stays
   a research decomp for a long time. Data/asset side is already fully
   extracted by `tools/3ds_decomp.py`.
