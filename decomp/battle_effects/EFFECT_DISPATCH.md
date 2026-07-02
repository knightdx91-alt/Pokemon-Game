# Move-effect → sequence-handler dispatch (status: input side solved, remap open)

The battle engine runs a per-move "sequence handler" chosen from the move's
Gen-7 move-effect id. This note records what is now proven about that path.

## The move-effect id enters battle via ParamID 0x1b → work field 0x1f
`sub_86e48` (Battle.cro, the move-execution parameter builder) fetches the
effect id with `pml::wazadata::GetParam(WazaNo, ParamID=0x1b)` and immediately
writes it into the battle work-struct through the generic setter `sub_8790c`
with field-id **0x1f**:

```
86ed4  mov r1, #0x1b
86edc  bl  pml::wazadata::GetParam      ; -> move-effect id (0..419)
86ee0  mov r1, r0
86ee4  mov r0, #0x1f
86ee8  bl  sub_8790c                    ; work.setField(0x1f, effectId)
```

ParamID 0x1b (27) has no named accessor in `wazadata_paramid.json`; it is the
raw effect enum already extracted to `data/pokemon/usum_moves.json` (`effectId`)
and indexed in `move_effect_ids.json`. So **the dispatcher reads work field
0x1f**, not the move record directly. (`verify/verify_effect_dispatch.py`
asserts this instruction sequence.)

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
not — so an **intermediate effect-enum → sequence-index remap** sits between
work field 0x1f and these tables. That remap is the remaining open link.

## Next step
Find the reader of work field 0x1f (generic getter `sub_87578`/`sub_879d8`
with `r1=0x1f`) that consumes it — either indexing a small translation table
first or `switch`-ing on it — then emulate it across ids 0..419 with
`cro_emu.py`. Candidate field-0x1f readers that also contain indexed loads
(from `usum_effect_dispatch.py`'s scan): sub_12ee8 (large), sub_698bc,
sub_1ac14, sub_df4c0, sub_87e7c, sub_8e520 — start with the ones inside the
move-execution subtree reached from sub_86e48's caller.
