# Move-effect → sequence-handler dispatch (status: LIVE seqId DISPATCH CAPTURED via in-process JIT hook ✅)

## BREAKTHROUGH — the in-process hook reads the live sequence dispatch
The gdbstub route was a dead end (Z0/Z3 no-ops, registers zero). Instead, Citra
was **rebuilt with a software read-watchpoint in the JIT read callback**
(`decomp/citra/effect_seq_hook.patch`): the A32 JIT is built with
`config.page_table = nullptr` (full-callback mode) and `MemoryRead32` records
every guest read landing in the seq-handler table `[rodata+0x45a0 .. +153*8)`
(VA `0x7de5a0`), appending the faulting vaddr + all 16 guest regs to
`/tmp/hook_out`. Armed from the SDL frontend via `/tmp/hook_arm` ("lo hi" hex).
**seqId = (faulting_vaddr − 0x7de5a0) / 8.** This directly reads which sequence
handler the battle engine dispatches, per frame, during a real move — the exact
thing that was unreachable by static analysis and blind emulation.

VERIFIED live (Route 4 wild battles, base re-confirmed 0x6dd180 this boot):
a move executes as a **script of sequence handlers**, e.g.

    Steam Eruption (effectId 4, burn): [6,11,5,4,62,65,22,23,58,28,
                                        16,133,143,19,34,131,118,122,13,95,97,137,16,137,16,106,104]
    Hydro Pump     (effectId 0, none): [6,11,5,4,62,65,22,23,58,28]   (KO'd early)

The **common prologue `[6,11,5,4,62,65,22,23,58,28]`** is shared (PP/accuracy/
damage-calc framework). Traces in `seq_dispatch_traces.json`; analyzer
`tools/citra_gdb/hookcap.py`. seqId 6's handler = Battle.cro `sub_4b40` (0x6e1cc0).

## REFINEMENT (follow-up captures) — 0x45a0 is the MOVE-FLOW, not the effect table
A later session captured **non-KO** moves (weakened the lead to Lv1 via the new
file-poke `/tmp/poke`; see `effect_seq_hook.patch`) and **widened the watch to a
broad rodata span `[0x7de000,0x7e4800)`** covering all four EFFECT_DISPATCH
candidate tables (`0x45a0`/`0x67b8`/`0x7e24`/`0x98ac`). Result (in
`seq_dispatch_traces.json` → `broad_table_watch`):

- **`0x45a0` is the shared MOVE-FLOW sequencer, NOT indexed by effectId.** Its
  core `[6,11,5,4,62,65,22,23,58,28]` runs for *every* damaging move; the earlier
  "burn adds 16,133,143,…" tail was actually the **faint/exp/level-up** flow (it
  appears on any KO and vanishes when the target survives), not the burn effect.
  Only tiny move-to-move variation remains (Steam eff4 → 15,16; Hydro eff0 →
  18,19) — unattributed to the effect.
- **The larger tables are touched only SPARSELY and inconsistently:** Steam eff4
  read `0x7e24[339]` once; Hydro eff0 read `0x67b8[399]` once — different tables,
  single reads, large indices unrelated to the effectId (4/0). No clean
  effectId→index mapping (matches the earlier static disproof).

**Conclusion:** the `effectId→seqId` "remap" is very likely **not a clean
single-table lookup at all.** The move effect appears to be applied **data-driven
inside the shared move-flow handlers**, consuming the move-effect DATA that is
**already fully extracted** (`data/pokemon/usum_moves.json`:
effectId/status/statChanges/flags/weather). If so, the effect layer is already
complete and the "remap" was chasing a mechanism that does not exist as posited.

**To make this airtight** would need a controlled harness the headless emulator
made impractical here (reliable scripted input, a **guaranteed-proc** effect move
— Steam Eruption's burn is only 30% — and a survivor), to confirm no distinct
effect-handler is dispatched. Practical blockers hit: input taps intermittently
fail to confirm the move; poked wild HP is restored to canonical each turn (poke
the *attacker's* Lv instead); moves auto-fire on the reopened move menu.

---
(Historical note — the pre-refinement text below treated the KO tail as the
effect; it is superseded by the finding above.) The Lv85 lead one-shots wild
mons, so no-secondary-effect moves end at the faint before the effect step —  a
non-KO setup (weak move / edited weak lead / tanky target) is needed to line up
the tails and isolate each effect's dedicated seqId. The capture rig is proven.

---

## (earlier analysis) The battle engine runs a per-move "sequence handler"
The battle engine runs a per-move "sequence handler" chosen from the move's
Gen-7 move-effect id. This note records what is now proven about that path.

## The move-effect id enters battle as a battle EVENT of tag 0x1f
`sub_86e48` (Battle.cro, the move-execution parameter builder) fetches the
effect id with `pml::wazadata::GetParam(WazaNo, ParamID=0x1b)` and **emits it as
a battle event** via `sub_8790c(tag=0x1f, payload=effectId)`:

```
86ed4  mov r1, #0x1b
86edc  bl  pml::wazadata::GetParam      ; -> move-effect id (0..419)
86ee0  mov r1, r0                        ; payload = effectId
86ee4  mov r0, #0x1f                     ; tag = 0x1f
86ee8  bl  sub_8790c                     ; pushEvent(tag 0x1f, effectId)
```

`sub_8790c` is **not** a plain field setter — it is an **event-queue push**: it
finds a free slot `n` (< 0x60 = 96) in a parallel-array queue at a relocated
global and stores the tag at `[base + n*2 + 4]` and payloads at `[base + n*4 +
0xc4]` (= effectId), `+0x244`, `+0x3c4`, and `[base + n + 0x544]`. So the effect
id is **queued as event type 0x1f** and consumed asynchronously by the battle-
sequence runner — NOT read back as a struct field. (This corrects an earlier
"work field 0x1f" reading.) ParamID 0x1b (27) has no named accessor in
`wazadata_paramid.json`; it is the raw effect enum in
`data/pokemon/usum_moves.json` `effectId`. `verify/verify_effect_dispatch.py`
asserts the fetch+push instruction sequence.

## The handler tables are NOT directly indexed by the effect id (disproven)
Four relocation-filled handler tables of the right size were tested as a direct
`table[effectId]` index (`tools/usum_effect_dispatch.py`, dump in
`effect_dispatch_tables.json`). Each entry is 8 bytes = `{handler_ptr, aux u32}`.
The direct-index hypothesis fails on every one — real move-effect ids land on
null slots while unused slots carry real handlers:

| table (rodata) | entries | distinct | effect-ids on null slots | unused slots w/ handler |
|---|---|---|---|---|
| 0x7e24 | 427 | 316 | 43 | 27 |
| 0x98ac | 444 | 141 | 272 | 21 |
| 0x67b8 | 406 | 200 | 100 | 20 |
| 0x45a0 | 153 |  58 | 84 | 11 |

If the index were the effect id, both right-hand columns would be 0. They are
not — so an **intermediate effect-enum → sequence-index remap** sits between the
event payload and these tables. That remap is the remaining open link.

## The remap is a structured lookup, not a field or a flat array (two more disproofs)
`tools/usum_effect_dispatch.py --scan` runs two exhaustive brute forces:
1. **No move-record field is the key.** Every u16 field offset (0..38) in the
   40-byte move record was tested as a direct index into each handler table; the
   best combo (offset 12 → 0x7e24) still leaves 43 used ids on null slots + 42
   unused slots with handlers. No offset/table pair indexes cleanly.
2. **No contiguous remap array.** Scanned all of rodata+data for a byte/u16
   array that, indexed by effectId, maps every used id onto a *valid* slot of the
   153-entry sequence table (with ≥25 distinct targets, to exclude zero regions).
   Zero candidates.

So the effect-enum → sequence-id translation lives in **code** — a PIC `switch`
or a non-contiguous structured table computed at runtime — consistent with the
153-table base being PIC-computed (no static literal in text equals its address).

## Structure confirmed
The 0x7e24 table is a uniform array of 8-byte `{handler, aux}` entries with a
few legitimate data-only gaps (effects with no dedicated sequence). The 153-entry
`0x45a0` table is the **sequence-handler** table (index = a 0..152 sequence id,
NOT the move-effect id — its old "index = move-effect id" note was the wrong
assumption this analysis overturns). Damage sequence = `sub_9698`.

## Emulation attempt (built) — and why it doesn't finish yet
`tools/usum_effect_remap.py` is a **fault-tolerant Unicorn harness**: it applies
the internal relocations (so the 0x45a0 table is populated), lazily maps any
unmapped data page zero-filled, stubs import fetches, and installs a **memory
watch on `[rodata+0x45a0 .. +153*8)`** — every read there records the sequence
id being dispatched. It sweeps every function, calling each with the effect id
in r0 and in filled argument buffers (the id repeated at every offset), and
reports any function whose watched index depends on the effect id.

RESULT: **no function exposes an effect-id-dependent 0x45a0 index** under any
fixture — including seeding the *real* event-queue global (bss+0x394, resolved
from `sub_8790c`'s literal) with `{tag 0x1f, payload=effectId}`. A blind sweep
first *appeared* to find `sub_8c80`, but that was a **soundness bug**: reusing one
emulator across thousands of probes leaves memory dirty, so a later function
reads leftover data and looks input-dependent. With a **fresh emulator per
probe**, every candidate (incl. `sub_8c80`, a 7-way step-state handler on `[r1]`)
reads the table zero times. The false hit was pure stale-state noise.

Conclusion: the dispatch index depends on real battle state the game builds at
runtime (the effect-object graph reached from the live battle system); a
synthetic fixture can't stand that up without effectively emulating the whole
title. This is a **memory-capture** problem, not a static/blind-emulation one.

## Next step — the live-capture route is now BUILT (see decomp/citra/README.md)
The "needs a live-battle RAM dump" blocker is resolved: the Citra pipeline can
now boot USUM (prebuilt binary + Route 4 grass save committed), reach a wild
battle, and dump memory. The **sibling blocker — the battle-pokemon scalar field
names — is SOLVED** from a real move-select capture (`verify/verify_battlemon_
live.py` PASS), which validates the whole route end to end.

For THIS remap, one nuance was found: a **physical** FCRAM dump (`/tmp/dump_now`)
is MMU-scattered, so `.bss` (where the event queue at `bss+0x394` lives) can't be
located by offset. Use the added **VA-space dump** (`/tmp/dump_va` → `/tmp/va.bin`,
VA-contiguous) instead. In an in-battle VA dump: `|static|` CRO0 @ VA 0x8b2000;
**Battle.cro `.text` @ VA ~0x6de000** (found by matching disk seg0 bytes; its
header is `text_va - 0x180`, seg table at `+0xC8` → rodata/bss runtime VAs).

## LIVE CAPTURE RUN — Battle.cro runtime layout resolved & queue base CONFIRMED ✅
A real wild battle was driven end-to-end (boot → Route 4 grass → wild encounter →
FIGHT → move) and Battle.cro's runtime map was resolved from an in-battle
`/tmp/dump_va` image (`tools/usum_battle_resolve.py`). All four segment sizes
match the disk CRO exactly, so the base is pinned unambiguously:

| seg | runtime VA | size | note |
|---|---|---|---|
| text   | `0x6dd180`  | `0xfc7f4` | base is **deterministic** across battles (seen in 3 encounters) |
| rodata | `0x7da000`  | `0xe694`  | **sequence-handler table (rodata+0x45a0) @ `0x7de5a0`** |
| data   | `0x8145c90` | `0xe68`   | |
| bss    | `0x8146af8` | `0xbaa0`  | |

`sub_8790c` (the event-queue push) sits at runtime **`0x764a8c`**; its
relocation-filled queue-base literal (disk file off `0x879d4`) resolves to
**`0x8146e8c` == bss+0x394** — this **confirms EFFECT_DISPATCH's queue base
against live memory** for the first time. (`text` unloads on the overworld, so
all reads must come from a single in-battle dump.)

## The tag-0x1f event is a SUB-FRAME transient — external dumps CANNOT catch it
Across **25 frozen burst-dumps + 2 free-run single dumps** spanning full
Steam-Eruption executions, the queue at `0x8146e8c` held **zero** tag-0x1f
entries. The effect id is pushed by `sub_86e48` and drained by the sequence
runner within a single frame; a file-triggered `/tmp/dump_va` freezes the game
~1 frame and always lands between the push and the drain. **The queue is the
wrong read** — it is empty by the time any external dump samples it.

## Sharpened recipe — read the seqId, not the transient effectId
1. **effectId does NOT need a memory read.** It is fixed by the *move you choose*
   (`data/pokemon/usum_moves.json` `effectId` — e.g. Steam Eruption = 4,
   Hydro Pump = 0, Explosion = 7). Pick the move → you know the effectId.
2. The **seqId persists** at `work+0xa94` for the whole multi-frame move (the
   step-state machine advances across frames), so a single mid-move dump *can*
   read it — unlike the queue. The one remaining unknown is the **`work` object
   base**: a global pointer in Battle.cro `data`/`bss` (in range at `~0x814xxxx`).
3. **Two ways to finish it:**
   (a) *Static:* find the global that holds the battle-`work` pointer (disassemble
       a handler that reads `work+0xa94`), read it from the in-battle dump, then
       dump `work..work+0xB00` during a move and read u32 @ `work+0xa94`.
   (b) *In-process hook (robust):* add a PC-breakpoint dump to the Citra patch —
       when PC hits the sequence-dispatch site (`table[seqId]` call, or the
       `sub_86e48` push), snapshot `r0/r1` (effectId) and `work+0xa94` (seqId).
       This sidesteps the frame-freeze race entirely.
4. Repeat for a handful of moves with distinct effectIds → the (effectId→seqId)
   pairs that reverse the PIC remap.

Toward (a): a scan of Battle.cro `.text` finds **48 `[reg,#0xa94]` accessors**;
the pair at `0x459c` (`ldr r0,[r4,#0xa94]`) / `0x45d0` (`str r5,[r4,#0xa94]`) is
inside `sub_458c` (the documented 6-state effect handler), confirming the
handlers receive **`work` in `r4`** and `work+0xa94` is the step/seq field. The
`work` base itself is set up by the dispatcher's caller — trace the global that
loads `r4` before the `table[seqId]` call to name the battle-`work` pointer.

### Gotchas nailed this run (fold into any capture script)
- Default `/tmp/dump_va` window (`00100000 00F00000`, 16 MB) reaches text+rodata
  but **NOT** data/bss (`~0x814xxxx`). Dump those explicitly, e.g.
  `echo "08140000 00020000" > /tmp/dump_va`.
- Battle.cro is **unloaded on the overworld** — resolve its base *inside* the
  battle (idle at the command menu is fine; `work` and the seg table are live there).
- First boot after installing the save formats the SaveData archive and starts a
  NEW game; kill, re-copy `usum_route4_grass_main.sav` over `main`, reboot → the
  Continue slot loads straight into the Route 4 grass (per saves/README.md).
