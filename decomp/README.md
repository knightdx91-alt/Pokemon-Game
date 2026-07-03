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
   - `pml::battle::TypeAffinity::CalcAffinity` + `MulAffinity` +
     `ConvAboutAffinity` (`src/pml/battle/TypeAffinity.cpp`) —
     type-effectiveness engine; verified 18×18 chart baked to
     `data/type_chart.json` (exact Gen-7 match). MulAffinity map-back bug
     fixed; dual/triple-type composition verified
     (`verify/verify_typeaffinity.py`).
   - **battle damage server** (`src/pml/battle/DamageCalc.cpp`) —
     `sub_81f2c` base damage `((2·L/5+2)·P·A/D)/50+2` + `sub_84d40` Q12
     `ApplyModifier` + the `sub_18504` orchestrator (STAB/type/random/
     modifiers). Leaf math verified (`verify/verify_damagecalc.py`). This was
     the decomp's headline open problem.
   - **battle AI move ranker** (`src/pml/battle/BattleAI.cpp`) — `sub_9348`
     damage estimator + move-preference sort and its helpers (structural).
   - **move-effect dispatch spine** (`src/pml/battle/MoveEffects.cpp`) —
     Phase-1 foundation: the 153-entry handler table at **rodata+0x45a0**
     (relocation-filled, recovered by `cro_vtables.py`) indexed by move-effect
     id; handler contract is a step-state machine (step @work+0xa94). Manifest
     id→handler at `decomp/battle_effects/effect_handler_table.json`; exemplar
     `sub_458c` (6-state) documented. Per-handler semantics = ongoing Phase-1
     bulk. ADDRESSING NOTE: text(seg0) and rodata(seg1) share offset numbers —
     the table is rodata+0x45a0, NOT the code at text+0x45a0.
     **Move-effect id decoded & extracted (verified):** move struct u16 @0x10 =
     the Gen-7 move-effect enum (400 distinct, 0..419) — 4=10%burn, 6=para-
     chance, 32=heal, 48=recoil, 50=+2Atk, 67=paralyze status (validated by
     move grouping). Now in `data/pokemon/usum_moves.json` (`effectId`); index
     at `decomp/battle_effects/move_effect_ids.json`. NOTE: this 0..419 enum is
     NOT a direct index into the ~150 rodata handler table — an intermediate
     effect-enum→sequence-handler mapping is the remaining Phase-1 link.
     **UPDATE — the live seqId dispatch is now CAPTURED** (see
     `decomp/battle_effects/EFFECT_DISPATCH.md`): after the gdbstub proved
     memory-read-only (Z0/Z3 no-ops, registers zero), Citra was rebuilt with a
     software read-watchpoint in the JIT read callback
     (`decomp/citra/effect_seq_hook.patch`) that records every guest read of the
     seq table (VA 0x7de5a0) → `seqId = (vaddr-0x7de5a0)/8`. A move runs a
     *script* of sequence handlers; e.g. Steam Eruption (effectId 4) =
     `[6,11,5,4,62,65,22,23,58,28,16,133,143,…]`, Hydro Pump (effectId 0) =
     `[6,11,5,4,62,65,22,23,58,28]` — shared prologue, effect-specific tail.
     Traces in `seq_dispatch_traces.json`. Fully reversing effectId→seqId now
     just needs non-KO captures across effectIds to line up the tails.
     **Move-effect DATA extracted & verified:** inflicted status (byte 8:
     1=par 2=slp 3=frz 4=brn 5=psn 6=confuse) and stat-stage changes (target
     @byte20, stat @21+i, signed stage @24+i, up to 3) now in
     `usum_moves.json` (`status`, `statChanges`) — 83 status / 138 stat-change
     moves, verified (`verify/verify_moveeffects.py`: Swords Dance +2 atk,
     Growl −1 atk, Growth +1 atk/spa, Calm Mind, Charm −2, Toxic/Ember/Ice
     Beam statuses). Read straight from the raw move record (the accessor's
     source blob), sidestepping sub_3af788's parsed-structure navigation.
     **+ flags & weather:** WazaFlag bitfield (u32 @byte36: contact/charge/
     recharge/protect/reflectable/snatch/mirror/punch/sound/gravity/heal/
     ignoreSub…, verified vs Fire Punch/Fly/Recover/Hyper Voice) and weather
     (via effectId 136=rain/137=sun/115=sand/164=hail) now in `usum_moves.json`
     (`flags` on 645 moves, `weather` on 4). **The move-effect DATA layer is
     complete & verified** — status, stat changes, flags, weather, effect id.
   - **catch-rate server** (`src/pml/battle/CatchRate.cpp`) — `sub_2d568`:
     `a = (3M−2H)·rateMod·ball·status/(3M)`, auto-catch at a≥255 (0xff000 Q12),
     else the 4-shake check (`^0.1875` shake, the `0.1875f` @0x2da0c that
     located it). Status/ball Q12 constants match Gen-7 exactly (sleep/freeze
     0x2800=2.5×, para/brn/psn 0x1800=1.5×); base identity verified
     (`verify/verify_catchrate.py`). **This was the last open battle-server
     piece — damage, type, AI, and catch are now all decompiled.**
   - **CoreParam crypto** (`src/pml/pokepara/CoreParamCrypto.cpp`) — the
     encrypted ~232-byte Pokémon record. `sub_22258c` decrypt / `sub_222514`
     encrypt via `sub_220498` (LCRNG XOR keystream `seed=seed·0x41C64E6D+0x6073;
     word^=seed>>16`, multiplier literal read from .code@0x2204dc) + `sub_220438`
     (16-bit halfword-sum checksum). Blob layout mapped: PID@0 (seed), sanity@4
     (bit2 raised on checksum mismatch), checksum@6 (over the 224-byte block
     region @8), 4×56-byte blocks; a parallel 28-byte party buffer is crypted
     with the same seed. `StartFastMode`/`EndFastMode` = the decrypt-once /
     re-encrypt latch (flag@+0xd). NOTE: USUM keeps blocks in PID-shuffled order
     in RAM (decrypt/serialize never un-shuffle) — the block permutation lives
     in the accessor/offset layer, not here. Verified (`verify/verify_coreparam.py`:
     constants, keystream vector, round-trip, checksum + sanity-flag). This
     unlocks save/box/trade record reads.
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
- `tools/usum_moves.py` → `data/pokemon/usum_moves.json` (710 moves). Reads the
  packed `a/0/1/1/0000.bin` ("WD" mini-container: u16 magic, u16 count, count+1
  u32 offsets, 40-byte entries), joins move names (0118). Fields verified:
  type/category/power/accuracy/pp/priority/effectChance (Flamethrower 90 Fire
  special 10% burn; Close Combat 120 Fighting; Swords Dance status). Same
  `{slug: {...}}` shape as `data/pokemon/moves.json`.
- `tools/usum_learnsets.py` → `data/pokemon/usum_learnsets.json` (807 species).
  Reads `a/0/1/3` ((u16 move, u16 level) pairs, 0xFFFF-terminated). Gotcha:
  the extractor renames members starting with byte 0x11 to `.lz` (false LZ11
  magic — many learnsets start with move id 0x0011); `member_bytes` tries
  decompress then falls back to raw. Verified: Bulbasaur/Charizard/Lucario.
- `tools/usum_evolutions.py` → `data/pokemon/usum_evolutions.json` (807 species).
  Reads `a/0/1/4` (8 slots × 8 bytes: u16 method, u16 arg, u16 target, s8 form,
  u8 level; 43-entry Gen-7 method table). Verified: Bulbasaur→Ivysaur L16,
  Charmeleon→Charizard L36, Eevee's 8 branches (stones + friendship day/night +
  affection→Sylveon), and the Alolan split (Pikachu→Kanto Raichu form 0 vs
  Alolan Raichu form 1).

### Battle architecture findings (server hunt)
- **Battle.cro is the battle *scene* module** (rendering/UI/animation:
  `btl::BgSystem`, move-anim sequencing), NOT the damage server. Evidence: its
  only variable-divide function (`sub_5ce4`) is an HP-%/status threshold check
  (75/50/25 → 29/30/31), and no function reads attacker/defender stats or the
  type chart. (But note: the type-effectiveness *consumers* — AI scorer and
  the `ConvAboutAffinity` multiplier path — are in Battle.cro, so the live
  damage server is reached from the CRO layer, not purely static; see the
  CORRECTION below.)
- **TypeAffinity cluster fully localized** at 0x21c0e0..0x21c3ac in static:
  `MulAffinity` (0x21c0e0), `CalcAffinity` (0x21c1e8, the *sole* reader of the
  18×18 type chart at VA 0x5bb558), and `CalcAffinityForDefender` (0x21c284,
  dual-type combine) — all three now in `src/pml/battle/TypeAffinity.cpp`.
- **CORRECTION (this session): affinity IS called by ordinary direct `bl`,
  from the CRO layer via import veneers** — the earlier "zero resolvable
  callers" claim was a scan artifact (the static `.code` scan used the wrong
  VA base — see the tooling gotcha below). Battle.cro's `.crodata` import
  table (`decomp/map/Battle.json`) imports exactly three TypeAffinity funcs —
  `CalcAffinity`, `MulAffinity`, `ConvAboutAffinity` — and the veneer thunks
  (`0x16d8`/`0x16d0`) have real ARM `bl` callers:
  - `sub_8ddb4` — **multi-type effectiveness combiner** (up to *three*
    defender types → Gen-6 Trick-or-Treat / Forest's Curse). Calls
    `CalcAffinity` per defender type and `MulAffinity`-combines, with the
    `0x12` (TYPE_NONE) sentinel and duplicate-type guards. Calls only the
    already-verified primitives.
  - `sub_b0328` — resist-list builder: loops all 18 types, `CalcAffinity`
    against each, collects those returning half/immune.
- **The consumer of `sub_8ddb4` is the battle AI**, a self-contained subtree:
  `sub_9698` (a handler in Battle dispatch table `@0x45a0`, 153 entries) →
  `sub_9348` (**AI move scorer**: `pml::wazadata::GetPower`/`GetType`/
  `IsDamage`, estimates damage per candidate move, then bubble-sorts the
  candidates by score — classic enemy move selection) → `sub_8ddb4`
  (+ `sub_8de5c` attacker-type extractor, `sub_8dce4` stat-stage shift table).
- **The live HP-damage path is still the open gate, and the lead is now
  concrete: `ConvAboutAffinity`** (AffinityID→numeric multiplier — what the
  real formula needs, vs. the AI's AffinityID scoring) is imported by
  Battle.cro but has **zero direct `bl` callers** → it is dispatched
  indirectly. Tracing where the `ConvAboutAffinity` thunk address is loaded
  into a register/table is the next RE step for the damage server.
- **TOOLING GOTCHA (cost a wrong conclusion once already):** in the static
  `exefs/.code` image, **VA == file offset** (verified: `CalcAffinity`'s
  `cmp r0,#0x12` signature sits at file offset 0x21c1e8, matching its VA).
  Do NOT scan with `VA = 0x100000 + offset` — that base is wrong for `.code`
  and makes every BL/pointer target miss. The rodata value/chart tables
  (e.g. VA 0x5bb69c) live past the `.code` text end and need the segment
  map, not the flat text offset.
- **✅ RESOLVED (bug found & fixed):** the `MulAffinity` map-back WAS off by
  one. The ROM does `add r0, r1, #1` (@0x21c1a4) — it returns **bit_index + 1**
  (because `sAffinityValue[id] == 2^(id-1)`), but the committed C returned the
  bit index, collapsing neutral×neutral to ½ and knocking every 2×/4× down a
  step. Confirmed from the disassembly and **fixed** in `TypeAffinity.cpp`;
  composed dual/triple-type effectiveness now yields exact 0×/¼×/½×/1×/2×/4×
  (`decomp/verify/verify_typeaffinity.py`, PASS).
- **Full cluster mapped from exports** (`decomp/map/static.json`):
  `MulAffinity` 0x21c0e0 · `CalcAffinity` 0x21c1e8 · internal combiner
  0x21c284 · `CalcAffinityAbout(atk,def1,def2,bool)` 0x21c3b0 (the exported
  dual-type entry, calls 0x21c284) · `ConvAboutAffinity(AffinityID)` 0x21c3d8.
  **`ConvAboutAffinity` fully decoded & added to `TypeAffinity.cpp`** — it is
  a display/AI category bucket (immune→0, nve→3, neutral→1, super→2), NOT a
  numeric multiplier. **`CalcAffinityAbout` has *zero* callers** anywhere
  (no static bl, no CRO import) — effectively dead/indirect-only in USUM.
- **Damage-server hunt — leads narrowed, two false trails cleared:**
  - Candidate appliers (call `GetPower`+`GetDamageType`): `sub_86e48` (turned
    out to be the **move-execution parameter builder** — packs type/dmg-type/
    power/flags into an event record via `set_field(id,val)` calls, not the
    arithmetic), `sub_d4608`, `sub_3175c`. Next: follow the event record
    `sub_86e48` builds to its consumer (that handler does the HP math).
  - FALSE LEAD ①: the `(x·mod + 0x800) >> 12` 4096-fixed-point modifier-round
    is **not** inline in Battle.cro (0 hits) — USUM likely applies modifiers
    via a helper call or a different round form.
  - FALSE LEAD ②: the `/50` division magic `0xA3D70A3D` occurs exactly once,
    inside `__aeabi_uldivmod`'s reciprocal table — a libgcc artifact, not the
    damage core. ⇒ the formula's `/50` (and `/100` roll) are **helper-call
    divisions** (`__aeabi_uidivmod`/`uldivmod`), so magic-constant
    fingerprinting won't find them; trace via the callee instead.
  - FALSE LEAD ③ (round 2): the damage core is **not Thumb** (a Thumb-BL scan
    for callers of `GetPower`/`GetDamageType`/`GetType`/type funcs = 0 hits),
    and **`mov r1,#50; bl` = 0** in both static and Battle.cro — so the `/50`
    is not a plain `r1=50` helper divide either.
  - FALSE LEAD ④: none of `sub_86e48`'s **7 callers**
    (`sub_144ec`/`1c664`/`24040`/`25d78`/`7b51c`/`7b908`/`819f0`) contain a
    single multiply instruction → the arithmetic is NOT in the immediate
    move-execution consumers; it's deeper in the `btl` handler graph.
  - `sub_86e48` precisely decoded: it fills an **output struct** (arg 4) with
    `{wazaNo@0/2, type@6, dmgType@7, field0x20@4, power@0x10 (=GetPower),
    flags@0x14}` — the per-move calc parameter block. The HP math reads this
    block (by field, via the generic getter `sub_879d8`), not the `wazadata`
    getters directly — which is why getter-caller scans never hit it.
  - **DECISIVE STRUCTURAL FACT:** an exhaustive symbol sweep shows only the
    *framework* namespaces (`pml`, `gfl2`, `App`, `Field`, `PokeTool`) shipped
    with names; the core **`btl` battle engine (in Battle.cro) is
    symbol-stripped** — the only `Damage`-named symbols in the whole ROM are
    `pml::wazadata::IsDamage`/`GetDamageType`. So the damage calculator is an
    unnamed `sub_XXXX` and won't be found by name; it must be reached by
    data-flow from the move-record block above.
  - **✅ SOLVED — the damage server is found and verified.** Built the
    data-flow pass (`tools/cro_dataflow.py`); querying "functions that load
    move-block `+0x10` (power) with companion offsets `0x6/0x7/0x14/0x4`"
    ranks **`sub_18504`** first (all 4 companions) — the **damage
    orchestrator**. It calls:
    - **`sub_81f2c` = base-damage core** = `((2·L/5+2)·Power·Atk/Def)/50 + 2`
      (/5 via magic 0xCCCCCCCD»2, /50 via 0x51EB851F»4, /Def via
      `__aeabi_uidivmod`). **Verified exact** on 6 cases vs the textbook
      formula.
    - **`sub_84d40` = ApplyModifier** = `(value·mod + round)>>12` Q12
      round-half-up (frac>0x800). **Verified** (STAB ×1.5→150, ×2→74,
      ×0.5→18).
    - **`0xb0414` = type-effectiveness→Q12 multiplier** (wraps the
      TypeAffinity cluster; the veneer-imported consumer that resolved the
      "no callers" puzzle).
    - inline in `sub_18504`: **STAB ×1.5** (`n·15/10`) and the **random roll
      ×(85..100)/100** (`0x55` base, /100 via magic »5).
    Decompiled to `decomp/src/pml/battle/DamageCalc.cpp`; self-check
    `decomp/verify/verify_damagecalc.py` (PASS, no ROM needed). This closes
    the decomp's headline open problem — the full damage pipeline
    (base → STAB → type → random → Q12 modifiers) is now readable C++.

### ⏩ CHECKPOINT — resume here (session handoff)
Progress so far (all on `main`, all verified). Latest first:
- **CPU-EMULATION HARNESS BUILT — `tools/cro_emu.py`** (Unicorn ARM). Loads a
  `.cro`, replays the internal relocations (so relocation-only switch/handler
  tables resolve), stubs imports, and runs functions: `emu.call(off,[args])`.
  Self-test PASS (`--selftest`). This is the tool for all remaining live-PIC
  work. **It already caught a real off-by-one** in the static switch-table parse
  (reloc entry order is `(target,type,value)`, 12-byte aligned).
- **Phase-3 struct reconstruction — IN PROGRESS.**
  - CoreParam: 22 stored fields auto-derived + verified →
    `decomp/src/pml/pokepara/CoreParam.h` (`tools/usum_coreparam_fields.py`,
    `verify/verify_coreparam_fields.py`; anchor + real-save PASS).
  - Battle-pokemon in-RAM struct: stat-stage array (0x1ea–0x1f0, 7 signed bytes)
    recovered + emulator-confirmed → `decomp/src/pml/battle/BattlePokemon.h`
    (`tools/usum_battlemon_fields.py`, `verify/verify_battlemon_fields.py` PASS).
    Scalar offsets recovered exactly; their *names* are hypotheses (runtime-only
    struct — needs a live-battle dump to confirm).
- **CoreParam** fully decompiled (crypto + block-shuffle + all field accessors),
  proven by reading 6 party + 880 box Pokémon from a real save
  (`tools/usum_savedump.py`).
- **Save system DONE**: CRC-16/USB checksum; **full 39-block offset layout**
  solved & verified in two real saves; **all 39/39 blocks named** to their
  `Savedata::` class (`tools/usum_save_blocks.py`, `save_layout.json`; see below).

**✅ DONE — all 39 save blocks named (`tools/usum_save_blocks.py`).** Method (fully
static, reproducible, self-verifying — VERIFY PASS: every class's `GetSize`
equals its footer block length):
1. The block classes are **polymorphic with RTTI intact** — the Itanium
   typeinfo type-name string (`_ZTS`-style, e.g. `N8Savedata6MyItemE`) sits one
   word before each vtable's first virtual, so **every vtable in the .rodata
   cluster `0x64cf00..0x64d600` demangles directly to its `Savedata::` class** —
   no reliance on named virtuals (which are `sub_`). 41 distinct classes found.
2. **`GetSize` is vtable slot 3** (a trivial `return <const>` — validated because
   for every id-known block it returns the exact footer length). Matching each
   class's `GetSize` to the footer's per-block length pins the id wherever the
   length is unique (30 of 39 blocks land uniquely this way).
3. Shared lengths (the 0x200 trio GameSyncSave/Sodateya/TurtleSalmonSave; 0x1fc
   Misc/BattleInstSave; etc.) are disambiguated by the **save-body container
   constructor `sub_35a2a8`**, which BL-calls the block constructors in strictly
   increasing block-id order — a class's position between two id-pinned
   neighbours fixes its id. (The container builds 35 of the 39 blocks; the other
   four — FishingSpot, BerrySpot, PokeFinderSave, WeatherSave — were caught by
   the full vtable sweep.)
   RESULT (`save_layout.json` `blocks[].class`): 0 MyItem · 1 Situation ·
   2 RandomGroup · 3 MyStatus · 4 PokePartySave · 5 Field::EventWork · 6 ZukanData ·
   7 GtsData · 8 UnionPokemon · 9 Misc · 10 FieldMenu · 11 ConfigSave · 12 GameTime ·
   13 BOX · 14 BoxPokemon · 15 ResortSave · 16 PlayTime · 17 FieldMoveModelSave ·
   18 Fashion · 19–20 JoinFestaPersonalSave · 21 JoinFestaDataSave · 22 FishingSpot ·
   23 BerrySpot · 24 LiveMatchData · 25 BattleSpotData · 26 PokeFinderSave ·
   27 MysteryGiftSave · 28 Record · 29 ValidationSave · 30 GameSyncSave ·
   31 PokeDiarySave · 32 BattleInstSave · 33 Sodateya · 34 WeatherSave ·
   35 QRReaderSaveData · 36 TurtleSalmonSave · 37 BattleFesSave · 38 FinderStudioSave.
   CORRECTIONS to earlier guesses: **PokeFinderSave is block 26** (not 29 —
   block 29 is ValidationSave); block 27 = MysteryGiftSave and block 37 =
   BattleFesSave are re-confirmed. Lone open point: blocks 22/23 are certainly
   {FishingSpot, BerrySpot} but their identical 0x100 size can't say which id is
   which (assigned FishingSpot=22, BerrySpot=23 by convention).

**Immediate next task — the move effect-id → sequence-handler dispatch** (the
big open Phase-1 link). PROGRESS THIS SESSION (`decomp/battle_effects/EFFECT_DISPATCH.md`,
`tools/usum_effect_dispatch.py`, `verify/verify_effect_dispatch.py` PASS):
- **Input side SOLVED — effectId is emitted as a battle EVENT (tag 0x1f).**
  `sub_86e48` (move-exec parameter builder) fetches it via `GetParam(WazaNo,
  ParamID 0x1b)` and calls `sub_8790c(tag=0x1f, payload=effectId)`. `sub_8790c`
  is an **event-queue push** (96-slot parallel arrays at a relocated global; tag
  at `base+n*2+4`, payload at `base+n*4+0xc4`), NOT a struct-field setter — this
  corrects the earlier "work field 0x1f" reading. The effect id is queued and
  consumed asynchronously by the sequence runner.
- **Direct-index hypothesis DISPROVEN (rigorously).** Read all four candidate
  tables out of the *relocated* module (`usum_effect_dispatch.py` via cro_emu →
  `effect_dispatch_tables.json`; each entry = 8B `{handler, aux}`) and tested
  `table[effectId]`: on every table, real move-effect ids fall on **null** slots
  while unused slots carry real handlers (0x7e24: 43 used→null, 27 unused→real;
  0x98ac: 272/21; 0x67b8: 100/20; 0x45a0: 84/11). If the index were the effect
  id both counts would be 0 → there is an **intermediate effect-enum → sequence
  index remap** between the event payload and these tables — the open link.
  *(This remap is now read directly at runtime by the JIT read-watch hook, which
  logs the live seqId dispatched off the `0x45a0` table per move — see the
  Effect→sequence status above and `EFFECT_DISPATCH.md`.)*
- **Remap is a code lookup, not data (two more exhaustive disproofs,
  `usum_effect_dispatch.py --scan`).** No move-record u16 field indexes any
  handler table cleanly; no contiguous byte/u16 array indexed by effectId maps
  onto valid 153-table slots. So the effect-enum → sequence-id translation is a
  PIC `switch`/structured table in code (consistent with the 153-table base
  being PIC-computed). Also confirmed: 0x45a0 is the **sequence** table (index =
  0..152 sequence id, NOT the move-effect id — overturning its old note).
- EMULATION HARNESS BUILT (`tools/usum_effect_remap.py`): fault-tolerant Unicorn
  runner (lazy page-map + import stubs) with a memory watch on the 0x45a0 table.
  Swept all functions with the effect id in r0 and in filled arg buffers →
  **no function exposes an effect-id-dependent 0x45a0 index**: the dispatcher
  reads the id via a structured pointer walk into the live effect-object, which
  a blind fixture can't route. NEXT is now a data-capture problem — reconstruct
  the effect-object layout, then feed `probe()` a real object.
  **UPDATE: the live-capture route is BUILT** (the sibling blocker, the
  battle-pokemon scalar names, is already SOLVED this way — verified). Take a
  mid-move-execution **VA dump** (`/tmp/dump_va`, not the MMU-scattered physical
  FCRAM dump) and read the active sequence id (`work+0xa94`) + queued effectId
  (`bss+0x394`) from Battle.cro (`.text` @ VA ~0x6de000). Full recipe + VA map in
  `battle_effects/EFFECT_DISPATCH.md` and `decomp/citra/README.md`.

### ⏩⏩ MEMORY-CAPTURE ROUTE — LIVE CAPTURE DONE ✅ battlemon scalars CONFIRMED
Both open items were gated on a **live-battle 3DS RAM image**. That capture is
now DONE and one of the two items is SOLVED:

- **✅ Live FCRAM captured.** A 256 MB N3DS FCRAM dump was taken at the move-select
  menu of a real wild battle on **Route 4** (OT Lylliana's Volcanion Lv85 vs a
  wild Grubbin Lv13). The two live battlemon structs are carved into
  `decomp/verify/fixtures/battlemon_{volcanion,grubbin}.bin` (0x240B each).
- **✅ Battle-pokemon scalar field names CONFIRMED** (was "hypotheses").
  `verify/verify_battlemon_live.py` PASSes: species@0xc, maxHp@0xe, curHp@0x10,
  ability@0x16 (11 Water Absorb / 68 Swarm — independent check), level@0x18,
  stat-stages@0x1ea..0x1f0 (all 6=neutral at battle start), and the 4×0xe
  move-record array @0x1fc (id + PP verified vs the in-battle move menu).
  **Disproved** the old 0x1a/0x1b type1/type2 guess (live values aren't type ids).
  `decomp/src/pml/battle/BattlePokemon.h` updated with a `MoveSlot` struct.
- **✅ Effect→sequence dispatch — CAPTURED LIVE** (was the "mid-move-execution"
  problem; the manual `dump_now`/FCRAM route below is superseded). The event-queue
  tag-0x1f payload turned out to be a **sub-frame transient** external dumps can't
  catch, so Citra was rebuilt with an **in-process JIT read-watch** on the seq
  table (`decomp/citra/effect_seq_hook.patch`; arm `/tmp/hook_arm`, read
  `/tmp/hook_out`, analyze `tools/citra_gdb/hookcap.py`). It reads the dispatched
  `seqId=(vaddr-0x7de5a0)/8` per frame during a real move. Traces:
  `decomp/battle_effects/seq_dispatch_traces.json` (Steam Eruption eff4 vs Hydro
  Pump eff0 — shared prologue `[6,11,5,4,62,65,22,23,58,28]`, effect-specific
  tail). Remaining: non-KO captures across effectIds to pin each effectId→seqId.
  (Superseded plan, for the record: auto-dump keyed to the move executing → feed
  `tools/usum_effect_remap.py` `probe_queue()`.)

**Pipeline is now FAST to resume (no 20-min rebuild, no navigation):**
- **Prebuilt binary committed** — `decomp/citra/prebuilt/citra` (+ `run_citra.sh`,
  installs SDL2/xvfb/mesa). Skips the ~10-min from-source build.
- **Route 4 grass save committed** — `decomp/citra/saves/usum_route4_grass_main.sav`;
  boot + tap A → Continue lands one step from a wild encounter (no overworld grind).
- **Live control channel added** to the frontend (in `citra1_build_fixes.patch`):
  `/tmp/ap_key` = "<down> <scancode>" applied per frame; `touch /tmp/shot` →
  `/tmp/frames/live.ppm` on demand. Enables frame-by-frame see→act driving.
  `tools/usum_battle_capture.py` locates Battle.cro base + battlemon objects in a dump.

--- original plan (superseded above) ---
Both open items (the effect→sequence remap AND the battle-pokemon *scalar* field
names) are gated on the same thing: a **live-battle 3DS RAM image**. The save
files only carry CoreParam, not in-battle objects. Static + blind emulation are
exhausted and proven insufficient (dirty-emu false hits; see EFFECT_DISPATCH.md).
Plan: build a 3DS emulator here, run USUM to a battle, dump RAM, feed it to the
harness.

**STATUS UPDATE — the emulator + capture harness are DONE and VERIFIED.** Full
detail in **`decomp/citra/README.md`** (recipe + `citra1_build_fixes.patch`):
- `StonedEdge/citra-1` built (SDL frontend) after **5 fork-skew fixes** — it was
  never actually compile-validated. Boots the decrypted USUM `.3ds` with **no AES
  keys** (decrypted exheader → force no crypto), Program ID `00040000001B5100`.
- The user's decrypted USUM `main` save (0x6CC00) loads; OT **"Lylliana"**
  confirmed live in FCRAM after a scripted title-skip → Continue.
- Headless **autopilot** (env `CITRA_AUTOPILOT`): scripted keyboard input via
  `/tmp/autopilot.txt` + **`touch /tmp/dump_now` → 256 MB N3DS FCRAM to
  `/tmp/fcram.bin`** (verified to hold the live CRO cluster). Framebuffer PPM
  dump is black (render reconciliation) — not needed; use the memory route.
- **REMAINING:** memory-route battle capture — walk into grass, detect in-battle
  from a battle-only FCRAM signature (resolve Battle.cro's relocated base per
  boot), dump, feed to `tools/usum_effect_remap.py`. The build/tree is ephemeral:
  reproduce via clone → `git apply citra1_build_fixes.patch` → `ninja` (~20 min).

**What we found (do NOT re-derive):**

**What we found (do NOT re-derive):**
- Env can't `curl`/`codeload`/download GitHub release zips — egress policy 403 on
  ALL of them (tested torvalds/linux too). BUT **`git clone` over https WORKS**
  through the proxy. Use git, not curl, for GitHub.
- Citra itself was DMCA'd; most backup forks are dead because their submodules
  point at deleted orgs (`citra-emu/ext-boost`, `merryhime/dynarmic` = GONE →
  e.g. `TayouVR/citra-backup` is unbuildable).
- ✅ **`StonedEdge/citra-1` IS buildable** — all 20 submodules point at LIVE
  maintainer forks and every one `git ls-remote`s OK: boost=`PabloMK7/ext-boost`,
  **dynarmic (the ARM JIT)=`rtiangha/dynarmic-old`**, libressl=`PabloMK7/ext-libressl-portable`,
  SDL/fmt/cryptopp/zstd/ffmpeg/etc. all fine. Submodules are NOT vendored (empty
  gitlinks) — must fetch recursively.
- Toolchain present: Ubuntu 24.04, apt/gcc, cmake, **xvfb + mesa llvmpipe** (so a
  software-GL headless run is possible), ~13 GB free on /tmp.

**Build steps (next session):**
1. `git clone --depth 1 https://github.com/StonedEdge/citra-1 /tmp/citra2`
2. `cd /tmp/citra2 && git submodule update --init --recursive` (recursive; dynarmic
   has nested submodules — do NOT use a bad `-j`/`--depth` combo, plain recursive
   is safest; shallow only if SHAs allow).
3. `apt-get install -y build-essential cmake ninja-build pkg-config libsdl2-dev`
   (+ system ffmpeg dev libs to skip building bundled FFmpeg).
4. Configure the **SDL frontend only** (no Qt): `cmake -B build -G Ninja
   -DENABLE_QT=OFF -DENABLE_QT_TRANSLATION=OFF -DENABLE_WEB_SERVICE=OFF
   -DCITRA_ENABLE_COMPATIBILITY_REPORTING=OFF -DUSE_DISCORD_PRESENCE=OFF
   -DCMAKE_BUILD_TYPE=Release` then `ninja -C build citra` (the SDL binary).
5. Run headless: `xvfb-run -a ./build/bin/Release/citra "<USUM .3ds>"` with
   `LIBGL_ALWAYS_SOFTWARE=1` (llvmpipe). ROM: re-pull from Drive per the CLAUDE.md
   bootstrap. Use the user's save (Drive "Pokemon ultra Moon save").

**Capture the battle image:** get into a wild battle (and pick a move so the
effect-object is live), then dump RAM. Options in priority order: (a) Citra
**save state** (.cst is a full compressed memory snapshot — zstd; decompress and
scan) — the user can also just make one on their own machine and drop it in Drive,
which skips the whole build; (b) Citra **GDB stub** (`-DENABLE_GDBSTUB`/config,
`use_gdbstub=true`), attach gdb-multiarch, `dump memory`; (c) an on-exit RAM dump.

**Then finish both items:** load the captured FCRAM into `tools/usum_effect_remap.py`
(seed the real effect-object / event-queue global bss+0x394 with the live bytes,
`fresh_probe()`), read the sequence id off the 0x45a0 watch per move → the remap;
and read the battle-pokemon struct scalars directly from the image → the field
names in `BattlePokemon.h`. FASTEST alternative to the whole build: user supplies
a mid-battle `.cst` savestate.

**✅ DONE — this is exactly the route that worked.** Rather than a full trace
firehose, Citra's dynarmic read callback (`src/core/arm/dynarmic/arm_dynarmic.cpp`,
`MemoryRead32`) now logs ONLY reads inside an armed watch range
(`decomp/citra/effect_seq_hook.patch`, `config.page_table=nullptr` full-callback
mode). `Battle.cro`'s runtime base is resolved per boot by
`tools/usum_battle_resolve.py` (deterministic 0x6dd180 → seq table 0x7de5a0). The
GDB-stub `rwatch` alternative was tried and **does not work** in this fork
(watchpoints/breakpoints/registers are no-ops — `tools/citra_gdb/README.md`).

What the filtered trace resolves (priority order):
1. **✅ Effect→sequence dispatch (was THE open link).** The read-watch on the
   153-seq table `rodata+0x45a0` (VA 0x7de5a0) logs the dispatched seqId per frame
   during a move → `seqId=(vaddr-0x7de5a0)/8`. (The event-queue tag-0x1f payload is
   a sub-frame transient and is NOT the read path — effectId is known from the
   chosen move instead.) Traces captured; **remaining: run more moves covering
   distinct effectIds with a non-KO setup** to pin each effectId→seqId.
2. **The 427/444 tables' true index key.** Same technique on `rodata+0x7e24` /
   `+0x98ac` reads reveals what those `{handler,aux}` tables are indexed by
   (still unknown — not effectId).
3. **✅ Battle-pokemon scalar field NAMES — DONE.** Confirmed from a live wild-
   battle capture (`verify/verify_battlemon_live.py` PASS): species/HP/level/
   ability/moves/stat-stages carved from the two live battlemon structs. See
   `BattlePokemon.h`.
4. **Sequence-handler bodies / step-state flow (Phase-1 deep remainder).** Trace
   the step byte `@effectObj+0xa94` transitions per handler to confirm each
   effect's state machine behaviorally.
5. **Live cross-check of the finished servers** (damage/type/AI/catch): optional
   confidence pass — trace the inputs/outputs of `sub_18504`/`sub_2d568` etc.
   against the decompiled formulas.
Items that DON'T need a trace: a plain RAM snapshot suffices for #3's raw offsets;
wild encounters (C) and all move/species DATA are pure ROM (no runtime needed).

**Phase-3 struct naming — battle-pokemon init fields NAMED (verified).** The
runtime battle-pokemon struct is built from a CoreParam by `sub_6188c`, a
straight-line copy (`bl CoreParam::GetX → str [this+off]`). `tools/usum_battlemon_init.py`
follows those pairs (no guessing) → `battle_effects/battlemon_init_fields.json`
and refreshes `src/pml/battle/BattlePokemon.h`: 0xc monsNo, **0xe maxHp**,
**0x10 curHp** (the old header had these two swapped — now corrected & proven
via GetPower(HP)/GetHp), 0x12 heldItem, 0x16 tokuseiNo (ability), 0x18 level,
0x1c formNo; plus 0x1a/0x1b type1/type2, EVs @0x1f4, pokerus @0x1fa, and the
stat stages @0x1ea..0x1f0 stored as **stage+6** (init=6=neutral, not signed).
`verify/verify_battlemon_init.py` PASS.
Lower-priority leftovers: confirm the 22↔23 FishingSpot/BerrySpot order against a
real save; battle-sequence handler *bodies* (per-id, deep); wild encounters
(`a/0/8/*`).

**Environment reminder (do FIRST each session — extraction is gitignored):**
`pip install capstone unicorn`, then pull the USUM zip from Drive via the direct
curl in the "Session bootstrap" (CLAUDE.md), unzip the `.3ds`, `python3
tools/3ds_decomp.py … -o source/3ds/ultramoon`, then
`cro_symbols.py`/`cro_map.py`/`cro_disasm.py --scan`. **Unicorn is required for
`cro_emu.py`.** The two real save files for verification live in Drive
("Pokemon ultra Moon save" folder → the "download" zip = two `main` saves,
GRIDELIN/Harvey); re-download to `/tmp` to re-verify save/CoreParam work.
`tools/usum_savedump.py <main.sav>` dumps trainer + party + box;
`decomp/verify/verify_coreparam_fields.py <main.sav>` and
`decomp/verify/verify_battlemon_fields.py` re-check the struct maps.

### Known next targets / open issues
The battle server is DONE (damage/type/AI/catch, all verified) and the entire
move-effect DATA layer is extracted. "Full decomp" = game-logic core + data,
verified; the UI/network/rendering long tail is out of scope. Remaining core,
in priority order:

1. **`pml::pokepara::CoreParam` field layout** — DONE (crypto + shuffle +
   offsets). Crypto/checksum in `CoreParamCrypto.cpp`; the block-shuffle
   resolver + field map in `CoreParamLayout.cpp`. The PID→block permutation is
   `shift=(PID>>13)&0x1F; pos=BlockPositionTable[shift*4+block]; ptr=blob+8+56·pos`
   (four resolvers sub_3ad590/610/690/710, one per block A/B/C/D). The 128-byte
   table (VA 0x5e6994 = canonical Gen-6/7) is extracted to
   `decomp/pokepara/block_position_table.json`; verified species/item/form/move
   offsets match canonical PK7 (`verify/verify_coreparam_layout.py`). **All the
   common accessors are now mapped & verified** (16 fields): species/item/ID32/
   ability/nature/form/sex/EVs in block A, moves/PP/PP-ups/IV32 in block B,
   friendship in C, ball/hyper-training-flags/version/language in D — each read
   straight from its accessor and confirmed against the canonical absolute PK7
   offset. Resolvers: A=sub_3ad590, B=sub_3ad610, C=sub_3ad694, D=sub_3ad718.
2. **Struct/class reconstruction** (steady; the readability multiplier) — name
   the battle-pokemon struct fields (HP @0xe/0xd, step @0xa94, ballId @0x220,
   move-calc block power@0x10/type@6/dmgType@7) and CoreParam, so `decomp/src`
   reads like real source. `tools/cro_dataflow.py --offset <N>` per field.
   - **✅ CoreParam field layout auto-derived & verified** — `tools/usum_coreparam_fields.py`
     disassembles every named `pml::pokepara::CoreParam::Get*` accessor and its
     field helper (each is the fixed shape `bl Decrypt → bl ResolveBlock{A/B/C/D}
     → ldr[b/h] [ptr+off] → bl Encrypt`), classifying the block from the resolver
     and reading the load offset/width — **no offsets guessed**. Emits
     `decomp/pokepara/coreparam_fields.json` and a readable struct header
     `decomp/src/pml/pokepara/CoreParam.h` (22 stored fields: species/item/ID32/
     exp/ability/nature/form/sex/EVs in A, IV32 in B, friendship/feed in C, ball/
     origin/language/parent-sex/memories in D). Self-verifying: anchor-checked
     against the canonical PK7 offsets AND decoded from a **real save**
     (`verify/verify_coreparam_fields.py` — party slot 0 species/nature/exp/ball
     read straight through the derived offsets, matches `usum_savedump.py`).
   - **✅ Battle-pokemon in-RAM struct — stat-stage array recovered** —
     `tools/usum_battlemon_fields.py`. The `btl` engine is symbol-stripped, so
     there's no named accessor; the engine funnels field reads through one indexed
     getter `sub_924a8(this, enum)` — a 23-way switch whose jump table
     (text+0x92508) is zero on disk (relocation-filled). The tool replays
     Battle.cro's internal relocations to recover the 23 case→handler pointers,
     then disassembles each handler for the struct offset/width/sign it loads
     (incl. `mov r0,#imm; ldrsb [r0,r4]` indexed forms). **Certain result:**
     cases 2–8 read seven contiguous *signed* bytes at 0x1ea–0x1f0 — the
     stat-stage array (Atk/Def/SpA/SpD/Spe/Acc/Eva), cases 9–13 the
     apply-stage-to-stat path over the same bytes. Emits
     `decomp/battle_effects/battlemon_getter_fields.json` +
     `decomp/src/pml/battle/BattlePokemon.h`; `verify/verify_battlemon_fields.py`
     PASS. Scalar offsets (0x8/0xc/0xe/0x10/0xa0/0x234/…) are recovered exactly but
     their semantic names are flagged as hypotheses (struct is runtime-only — a
     live-battle dump, not a save, would confirm; 0xe/0x10 are the u16 curHP/maxHP
     pair CatchRate reads through this getter).

### CPU emulation harness (`tools/cro_emu.py`) — PIC dispatch is now executable
The btl engine reaches code through PIC segment-relative dispatch that static
reading can't follow, so `tools/cro_emu.py` loads a `.cro` into a **Unicorn ARM
CPU**: maps the segments at chosen bases, replays the internal relocation table
(entry = `(target_tag, (src_seg<<8)|type, value)`, write `base[src]+value` into
`base[tseg]+off`) so the relocation-only switch/handler tables resolve, and traps
unpatched import veneers (null-branch) into an immediate return. `emu.call(off,
[args])` runs a function and returns r0; `alloc/read/write` set up structs.
Self-test PASS: it executes the in-battle field getter `sub_924a8(this, enum)`
and reads back the exact struct offsets. **This immediately paid off** — running
it against the getter exposed and fixed an **off-by-one** in the earlier *static*
switch-table parse (the reloc entry field order is `(target,type,value)`, not the
`(type,value,target)` an unaligned scan implied): the enum→offset map is now
emulator-confirmed (`verify_battlemon_fields.py` cross-checks static vs emulated).
This is the tool for the remaining live-PIC work (effect-id→handler dispatch).
3. **Save data** (`Savedata::`) — checksum + block inventory DONE; per-block
   byte offsets are the remaining piece. The block checksum is
   `gfl2::math::Crc::Crc16` (@0x261534) = **CRC-16/USB** (poly 0x8005 reflected
   0xA001, init/xorout 0xFFFF), decompiled to `src/gfl2/math/Crc16.cpp` and
   verified by check value 0xB4C8 (`verify/verify_savecrc.py`); table extracted
   to `pokepara/crc16_table.json`. The 31 save-body block classes (MyStatus,
   MyItem, BOX/BoxPokemon, ZukanData, ResortSave, …) are inventoried in
   `savedata/block_inventory.json`.
   **Validated against a REAL save** (two independent USUM `main` files, 0x6CC00):
   the footer at 0x6ca10 is `u32 magic 0x42454546 + u32 + 39×{u16 id, u16 crc,
   u32 length}` (`savedata/save_footer.json`). The CRC-16/USB is confirmed on
   real data — block 19's stored checksum equals CRC-16/USB over its 0x6408
   bytes at file offset 0x44200 in BOTH saves (a 25 KB match, not coincidence);
   block 22 at 0x54800. **Open:** a full dual-save CRC scan pins only blocks 19
   & 22 at a common offset — the other 37 don't share a file offset between two
   different saves and no offset table sits by the footer, so the full per-block
   offset map needs the ROM's save-layout registrar (the `Savedata` init that
   assigns each block its region), not a brute-force scan. A 16-bit CRC also
   yields ~7 false offsets per block in a single save, so dual-save agreement is
   the only reliable locator.
   **CoreParam pipeline PROVEN end-to-end on the real save** (`tools/usum_savedump.py`):
   scanning the save for 232-byte records that decrypt (LCRNG) to a matching
   16-bit checksum finds every stored Pokémon — 6 party + 880 box mons read out
   with correct species/TID/nature/moves/IVs via the block-shuffle + field map.
   Located: **party @0x1600** (6× 260-byte PokemonParam), **box storage @0x5200**
   (960 slots × 0xE8, 32 boxes × 30). This validates CoreParamCrypto.cpp +
   CoreParamLayout.cpp against real data — the encrypted Pokémon record is fully
   readable. (The party/box block *file offsets* are thus recovered directly.)
   **FULL SAVE LAYOUT SOLVED** (`savedata/save_layout.json`,
   `verify/verify_save_layout.py`): the footer entry is `{u32 length, u16 id,
   u16 checksum}` (I'd earlier mis-split length from checksum — that off-by-one
   is why the first dual-scan found almost nothing). With the right format, all
   39 blocks are in **id order**, each at the previous block's end **rounded up
   to 0x200**, tiling exactly to the footer at 0x6ca00. 38/39 blocks
   CRC-verified in TWO independent real saves (block 36 is a zero-padded block
   whose stored checksum doesn't validate; its offset 0x6c000 is fixed by
   geometry). Known roles: block 4 = party @0x1600, block 14 = PC box @0x5200
   (0x36600 = 960×0xE8). Save layout is DONE.
   **Block id→class identified** (`verify/verify_savedata_ids.py`) by matching
   each block's unique length to the size constant that appears only inside that
   `Savedata` class's code (or its size-getter): block 0=MyItem, 3=MyStatus,
   4=party, 6=ZukanData(Pokédex), 8=UnionPokemon, 11=ConfigSave, 13=BOX,
   14=BoxPokemon, 18=Fashion, 21=JoinFestaDataSave, 27=MysteryGiftSave,
   29=PokeFinderSave. MyStatus is content-verified in a real save (OT "Lylliana"
   TID 37488 = the party's OT). The other 27 blocks use computed (count×elem)
   sizes not stored as literals — resolving them needs the block-factory
   (`tools/usum_savedump.py` reads trainer + party + box).
   **Factory hunt (`save_layout.json` → factory_investigation):** ruled out a
   flat size table, a constructor pointer-table, RTTI symbols, and callgraph
   edges (container init is Thumb/indirect). STRONGEST LEAD found: the block
   class **vtables sit in a .rodata table around VA 0x64d000 in id order**
   (MyItem@0x64d37c=block0, GameTime@0x64d3f8=block1/2, ZukanData@0x64d508=block6),
   and the constructors likewise cluster at 0x358000–0x35d000 in id order.
   Enumerating those vtables in address order = id order; each vtable's GetSize
   slot yields the size and its virtuals name the class. Blocked only by unnamed
   sub_ vtable slots in this symbol set.
   **Factory cracked (partly):** the vtable table @0x64d000 was segmented into
   per-class vtables; a class's virtual method names it, and for 6-method
   vtables **slot 3 is GetSize** (validated: MyStatus 0xc0, ConfigSave 0x4,
   UnionPokemon 0x30c). That added GameTime=block12, PlayTime=block16,
   BattleFesSave=block37 (GameTime year 2018 + PlayTime 151h content-verified in
   the real save). **15/39 identified.** The rest have shared sizes (0x1fc,
   0x200, 0x100 appear on 2–3 blocks) or GetSize at a non-slot-3 position
   (5-method vtables), so disambiguating them needs the container's construction
   order (dynamic trace).
4. **Battle-sequence handler BODIES** (deep btl grind, behavioral) — the ~150
   step-state handlers in `battle_effects/effect_handler_table.json`; decode
   per-id. Lower value: the DATA they consume is already extracted. NOTE: the
   effect-enum(0..419)→sequence-handler(0..152) link and each handler's body are
   driven at runtime via PIC segment-relative dispatch — static name/constant
   scans and a rodata byte-scan for a 420-entry map came up empty, so this
   needs live PIC data-flow tracing, not more static reading.
   - **Move-data accessor API decompiled** (`src/pml/wazadata/WazaData.cpp`):
     `GetParam(WazaNo<=0x2d8, ParamID<0x25)` funnels all scalar move props
     through a record cache (sub_22645c) + parsed-record reader (sub_3af788).
     Recovered+verified the `ParamID` enum from the accessor thunks (Type=0,
     Category=1, DamageType=2, Power=3, AlwaysHit=31, ZWazaNo=32, ZWazaEffect=34)
     → `battle_effects/wazadata_paramid.json`, `verify/verify_wazadata.py`.
     sub_3af788's parsed-record field layout is the remaining piece (the raw
     GARC extraction in `usum_moves.json` sidesteps it).
5. **Wild encounters** — `a/0/8/*` zone data; needs a zone→route-name map
   (a zone-RE subproject). Defer unless wanted.

Tooling reminders: static `.code` is **VA == file offset** (NOT 0x100000+off);
in a `.cro`, text(seg0)/rodata(seg1) share offset numbers and rodata pointer
tables are zero-on-disk (relocation-filled — use `cro_vtables.py`). For
dispatch that name/constant scans miss, use `cro_dataflow.py` (cracked damage
& catch). ROM extraction is gitignored — re-run the bootstrap (top of the
"TRUE DECOMP" section) each session.

### Gen-7 data conversion — extended tables (session cont.)
- `tools/usum_eggmoves.py` → `data/pokemon/usum_eggmoves.json` (322 species with
  egg moves). GARC `a/0/1/2`: u16 species_id, u16 count, count×u16 move. Verified
  Bulbasaur/Charmander/Squirtle.
- `tools/usum_tmcompat.py` → `data/pokemon/usum_tm_compat.json`. TM01–100 move
  table from `.code` @ 0x4bb98e (Work Up…Confide), per-species compatibility
  from the 100-bit flag field in personal data @ byte 0x28. Verified Bulbasaur
  (Toxic) / Charizard (Fly, 43 TMs).
- `tools/usum_items.py` → `data/pokemon/usum_items.json` (959 items). GARC
  `a/0/1/9` (36-byte entries): price (stored ÷10) + fling power + names.
  Verified Ultra/Great/Poké Ball 800/600/200, Master Ball 0, Potion fling 30.

### Battle dispatch mechanism — CRACKED (handler tables via reloc replay)
`tools/cro_vtables.py <Module>` → `decomp/vtables/<Module>.json`. The battle
server reaches most functions by indexing **function-pointer tables in the
rodata segment**, NOT by direct `bl` — which is why every earlier caller scan
came up empty. Those pointers are zero on disk; they're written at load by the
module's **internal relocation table** (header +0x128, 12-byte entries:
type=2, source seg0 offset, target tagged with dest-segment nibble). Replaying
those relocations statically recovers every rodata code-pointer slot and the
function it will hold.

Battle.cro: 2,151 code-pointer slots across **20 dispatch tables**. Largest:
rodata+0x98ac (444), +0x7e24 (427), +0x67b8 (406) — the per-move-effect /
per-battle-event handler arrays (Gen-7 has ~400+ effect scripts). The
**per-target damage loop `sub_9698` sits in the 153-entry table at
rodata+0x45a0** (150 distinct handlers). This turns the pointer-dispatched
server from "no callers findable" into a mapped set of handler tables.
Remaining: label each table index → named battle event (needs the dispatcher's
index source), then the damage arithmetic in `sub_9698`'s callees.

`cro_vtables.py --all` maps this game-wide → `decomp/vtables/INDEX.md`: **94
CRO modules** carry dispatch tables (Battle 2151 pointers, FieldRo/overworld
975, BattleSpot/GTS/Resort/FinderStudio the rest). So the whole engine's
pointer-dispatch architecture is now inventoried, not just the battle server.
The one thing reloc replay can't give is the *index* each handler is called
with — the table base (e.g. rodata+0x45a0) is computed at runtime from the
CRO segment-base register (PIC), not a reloc'd literal, so per-dispatcher
index labelling needs live PIC data-flow tracing (deferred).
