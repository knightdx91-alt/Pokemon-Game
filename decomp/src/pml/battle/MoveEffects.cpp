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

// ── The move-effect id (move struct u16 @0x10) ───────────────────────────────
// VERIFIED: every move carries a Gen-7 move-effect id in its 40-byte record at
// offset 0x10 (~430-value enum; 400 distinct ids used). Grouping validates it:
//   0  = no secondary effect (Pound, Scratch, Cut, …)      4  = 10% burn (Ember,
//   Flamethrower, Fire Blast, …)   6 = paralyze-chance (Thunderbolt, Body Slam)
//   32 = heal ½ HP (Recover, Soft-Boiled)   48 = recoil (Take Down, Wild Charge)
//   50 = +2 Atk self (Swords Dance)   67 = paralyze status (Thunder Wave, Glare).
// Now extracted into data/pokemon/usum_moves.json (`effectId`); full id→moves
// index at decomp/battle_effects/move_effect_ids.json.
//
// ── CORRECTION: the effect id does NOT directly index the rodata handler table.
// The rodata+0x45a0 table has ~150 handler slots, but move-effect ids range
// 0..419 (400 distinct) — so byte 0x10 is the high-level move-effect enum, and
// it reaches the battle-sequence handlers through an INTERMEDIATE mapping
// (effect-enum → sequence-handler), not a direct table index. That intermediate
// (a switch or a second table) is the remaining Phase-1 link. The rodata table
// is still a real relocation-filled dispatch (the damage/effect *sequence*
// handlers, step-state machines); its precise index domain is TBD.
//   extern SeqHandler sBattleSeqTable[/*~150*/];   // rodata+0x45a0

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

// ── Gen-7 move-effect DATA model (mapped this session) ───────────────────────
// Effects are NOT one opaque script — they're decomposed into data fields read
// by pml::wazadata accessors (all verified as callers of the packed reader):
//   GetSickCont   (0x226350) — status the move inflicts   → fields 0xd/0xe/0xf
//   GetRankEffectCount (0x22662c) / GetRankEffect (0x2263e8) — stat-stage
//                   changes (up to 3) → stat at field 0x10+i, stage at 0x13+i
//   GetWeather    (0x226290), GetFlag, GetParam, GetType, GetDamageType, …
// All of them call **sub_2267d0(wazaNo≤0x2d8, fieldIdx<0x25)** — a two-level
// packed-field reader: it caches the move's data blob, then tail-calls
// **sub_3af788(blob, fieldIdx)**, a 37-case jump table that extracts each field
// with per-field shift/mask. So the full move-effect schema = 37 bitfields ×
// 728 moves, addressable by field index.
//
// EXTRACTED (verified) — rather than decode sub_3af788's parsed-structure
// navigation, the same data was read directly from the raw 40-byte move record
// (which IS the source blob) by correlating known moves:
//   byte 8  = inflicted STATUS: 1=paralysis 2=sleep 3=freeze 4=burn 5=poison
//             6=confusion (Thunder Wave→1, Ice Beam→3, Ember→4, Toxic→5, …)
//   byte 10 = status/effect chance (already `effectChance`)
//   byte 20 = stat-change target (7 = self, else the opponent)
//   bytes 21+i = stat id (1=atk 2=def 3=spa 4=spd 5=spe 6=acc 7=eva), up to 3
//   bytes 24+i = signed stage delta   (Swords Dance +2 atk; Growl −1 atk;
//             Growth +1 atk/+1 spa; Calm Mind +1 spa/+1 spd; Charm −2 atk)
//   u32 @ byte 36 = WazaFlag bitfield: 0=contact 1=charge 2=recharge 3=protect
//             4=reflectable 5=snatch 6=mirror 7=punch 8=sound 9=gravity
//             10=defrost 11=distance 12=heal 13=ignoreSub (verified: Fire Punch
//             =contact+punch, Fly=charge+gravity, Recover=snatch+heal, Hyper
//             Voice=sound+ignoreSub, Hyper Beam=recharge).
//   weather set by a move is its effectId (136=rain 137=sun 115=sand 164=hail).
// All now in data/pokemon/usum_moves.json (`status`, `statChanges`, `flags`,
// `weather`); verified by decomp/verify/verify_moveeffects.py (83 status, 138
// stat-change, 645 flag, 4 weather moves). The move-effect DATA layer is
// COMPLETE. STILL TODO: the battle-sequence handler bodies (the deep btl grind).
//
// ── Status of the ~150 handlers ──────────────────────────────────────────────
// Manifest (id → handler fn) is committed at
// decomp/battle_effects/effect_handler_table.json. Decoding each handler's
// semantics = the ongoing Phase-1 work; use tools/cro_dataflow.py +
// tools/cro_disasm.py per id, correlating effect ids with move data
// (data/pokemon/usum_moves.json) to name them (e.g. which ids inflict burn,
// change stat stages, are fixed-damage / OHKO, drain, multi-hit, …).

}  // namespace battle
}  // namespace pml
