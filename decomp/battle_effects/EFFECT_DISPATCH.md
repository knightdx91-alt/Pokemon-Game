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

## Next step
Trace the **consumer of event tag 0x1f** out of the `sub_8790c` queue. The queue
base is a relocated global loaded via a pc-literal in `sub_8790c` (slot tag at
`base + n*2 + 4`, effect payload at `base + n*4 + 0xc4`). Find the function that
reads a queue entry's tag, matches `0x1f`, and pulls the `+0xc4` payload —
`sub_e47fc` (912 B) is a queue-scanner that compares entry tags to `0x1f`
repeatedly and is the best lead; from there follow how the payload selects a
sequence handler (translation table or `switch`), then emulate across ids 0..419
with `cro_emu.py`. Validate by correlating handlers with `usum_moves.json`
effect semantics (ids with the same effect kind should share a handler).
