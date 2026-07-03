# Move-effect → sequence-handler dispatch (status: input side solved, remap open)

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

## Next step (needs battle-context emulation)
Static analysis has bottomed out; the remaining move is dynamic. In `cro_emu.py`,
build a minimal fixture — an effect object (step byte @+0xa94) plus the event
queue with one tag-0x1f entry carrying an effectId — and single-step the
move-execution consumer (a caller of `sub_86e48`: sub_144ec/1c664/24040/25d78/
7b51c/7b908/819f0) until it computes a 153-table index; read that index per
effectId 0..419 to recover the remap directly. Validate by correlating handlers
with `usum_moves.json` effect semantics (ids of the same kind share a handler).
