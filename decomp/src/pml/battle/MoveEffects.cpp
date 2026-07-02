// pml/btl move-effect dispatch — Pokémon Ultra Moon (CTR-P-A2BA), Battle.cro.
//
// Phase-1 (battle engine) foundation: the architecture of the move-effect
// system. The per-effect handlers (~150) are state machines; this file
// documents the dispatch spine + handler contract that they all share, plus
// the manifest that maps effect id → handler function
// (decomp/battle_effects/effect_handler_table.json). Individual handlers are
// decoded incrementally on top of this (damage = sub_9698, already done in
// DamageCalc.cpp; sub_458c exemplar below).
//
// KEY ADDRESSING NOTE (cost an investigation): text (seg0) and rodata (seg1)
// share the same numeric offset space in a .cro. The handler TABLE is at
// **rodata+0x45a0** (zero on disk, filled at load by the module's internal
// relocation table — recovered statically by tools/cro_vtables.py). Do NOT
// confuse it with text+0x45a0, which is unrelated code (sub_458c's body).

namespace pml {
namespace battle {

// The move-effect handler table: 153 slots at rodata+0x45a0, indexed by a
// move's effect id. Each slot is a code pointer to a handler; the damage
// handler sub_9698 occupies the "deal damage" effect ids (140, 144).
//   extern EffectHandler sMoveEffectTable[153];   // rodata+0x45a0

// Handler contract (observed across handlers):
//   int handler(BtlEffectWork* w);
// `w` is the per-effect work object. Handlers are **coroutine-style state
// machines**: a step counter at w->step (offset +0xa94) selects the current
// phase via an internal jump table (`ldrb r0,[r4,#0xa94]; ldrlo pc,[pc,r0,#..]`),
// the handler advances the step and returns a status so the battle sequencer
// re-enters it across frames (message wait, animation wait, etc.). Effect
// parameters live at small offsets on `w` (e.g. sub_458c reads +0x26, +0x2c,
// +0x30). w+0x14 is a heap block freed by the cleanup handler sub_efe8.

// ── sub_458c — multi-step effect executor (exemplar) ─────────────────────────
// A 6-state handler (jump table on w->step @+0xa94). Reads effect params from
// the work object (+0x26 flag, +0x2c / +0x30 a u16 pair it compares) and drives
// the effect across states, calling sub_93fd8 (sub-effect setup) on entry.
// Used at effect ids 1 and 14. [Structural: the per-state semantics are decoded
// per-id as the Phase-1 bulk; this documents the shared shape.]

// ── Status of the ~150 handlers ──────────────────────────────────────────────
// Manifest (id → handler fn) is committed at
// decomp/battle_effects/effect_handler_table.json. Decoding each handler's
// semantics = the ongoing Phase-1 work; use tools/cro_dataflow.py +
// tools/cro_disasm.py per id, correlating effect ids with move data
// (data/pokemon/usum_moves.json) to name them (e.g. which ids inflict burn,
// change stat stages, are fixed-damage / OHKO, drain, multi-hit, …).

}  // namespace battle
}  // namespace pml
