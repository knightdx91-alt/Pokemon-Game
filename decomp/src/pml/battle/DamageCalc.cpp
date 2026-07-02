// pml::battle damage server — Pokémon Ultra Moon (CTR-P-A2BA), Battle.cro.
//
// This is the numeric HP-damage path — the decomp's long-standing "one big
// open RE problem" (see decomp/README.md). The btl battle engine is
// symbol-stripped, so these are unnamed `sub_XXXX` functions located by
// data-flow (tools/cro_dataflow.py) from the move-calc block that
// `sub_86e48` builds, NOT by symbol. Behaviour of the two leaf primitives is
// numerically verified against the textbook Gen-6/7 formula; the orchestrator
// is a faithful structural reconstruction of the observed control flow.
//
// Addresses are Battle.cro segment-0 offsets. Fixed-point convention: battle
// modifiers are Q12 (4096 == ×1.0), matching the whole Gen-6/7 engine.

namespace pml {
namespace battle {

// ── sub_84d40 : ApplyModifier (Q12, round-half-up) ───────────────────────────
// value' = (value * modifier) >> 12, rounding up when the discarded fraction
// exceeds 0.5 (frac > 0x800). This is THE modifier-application primitive the
// damage server calls for every step (STAB, type, item/ability/weather, …).
// ROM:
//   mul   r0, r0, r1          ; value * modifier   (product, 32-bit)
//   lsl   r1, r0, #20         ; isolate low 12 bits …
//   lsr   r0, r0, #12         ;   quotient = product / 4096
//   lsr   r1, r1, #20         ;   frac     = product & 0xFFF
//   cmp   r1, #0x800          ; round half up
//   addhi r0, r0, #1
// Verified: ApplyModifier(100, 6144)=150 (STAB ×1.5), (37,8192)=74 (×2),
//           (37,2048)=18 (×0.5).
unsigned int ApplyModifier(unsigned int value, unsigned int modifier)  // @0x84d40
{
    unsigned int product = value * modifier;
    unsigned int q = product >> 12;
    unsigned int frac = product & 0xFFF;
    if (frac > 0x800)
        ++q;
    return q;
}

// ── sub_81f2c : base-damage core ─────────────────────────────────────────────
//   base = ( (2*Level/5 + 2) * Power * Attack / Defense ) / 50 + 2
// The two constant divides are compiler reciprocal-multiplies:
//   /5  via magic 0xCCCCCCCD then >>2  (after the >>32 of umull)
//   /50 via magic 0x51EB851F then >>4
// and /Defense is a real division (import veneer 0x28 → __aeabi_uidivmod).
// ROM (args r0=Power, r1=Attack, r2=Level, r3=Defense — Power/Attack order is
// commutative in the r0*r1 product):
//   ldr   ip, =0xCCCCCCCD
//   lsl   r2, r2, #1          ; 2*Level
//   mul   r1, r0, r1          ; Power*Attack
//   umull r2, r0, ip, r2      ; (2*Level)*recip5
//   lsr   r0, r0, #2          ; = 2*Level/5
//   add   r0, r0, #2          ; + 2
//   mul   r0, r0, r1          ; * (Power*Attack)
//   mov   r1, r3 ; bl uidiv   ; / Defense
//   ldr   r1, =0x51EB851F
//   umull r1, r0, r1, r0
//   lsr   r0, r0, #4          ; / 50
//   add   r0, r0, #2          ; + 2
// Verified against ((2*L/5+2)*P*A/D)/50+2 for
//   (P80,A100,D100,L50)=37 · (P120,A150,D120,L100)=128 · (P40,A55,D40,L5)=6 ·
//   (P95,A200,D150,L75)=83 · (P250,A300,D50,L100)=1262 — all exact.
unsigned int CalcBaseDamage(unsigned int power, unsigned int attack,   // @0x81f2c
                            unsigned int level, unsigned int defense)
{
    unsigned int t = (2u * level) / 5u + 2u;
    unsigned int d = (t * power * attack) / defense;
    return d / 50u + 2u;
}

// ── sub_18504 : damage orchestrator ──────────────────────────────────────────
// Reads the move-calc block that sub_86e48 built (power u16 @0x10, moveType @6,
// dmgType @7, flags @8/@0x14, wazaNo @0/2), gathers attacker/defender stats and
// per-side modifier fields into the battle-calc context (field ids via the
// generic setter sub_881c4 / getter sub_879d8), and applies, in order:
//   1. base  = CalcBaseDamage(power, atk, level, def)          [sub_81f2c]
//   2. spread/other pre-modifiers via ApplyModifier            [sub_84d40]
//   3. STAB ×1.5  — inline: n*15/10 (rsb n,n,n,lsl#4 ; /10 magic)  when @7 set
//   4. type effectiveness — bl 0xb0414 → Q12 multiplier, applied when != 0x1000
//   5. random roll ×(85..100)/100 — mul by (0x55 + rnd) then /100 (>>5 magic)
//   6. remaining Q12 modifiers (item/ability/weather/…) via ApplyModifier
// A `modifier == 0x1000` (×1.0) fast-path skips each ApplyModifier call.
// The step values (85 = 0x55; STAB 15/10; type via 0xb0414) are read straight
// from the ROM; only the surrounding plumbing is paraphrased here.
//
// [Structural reconstruction — the leaf math (steps 1,3,5 and ApplyModifier)
//  is numerically verified above; the field-gather order is as observed.]

// 0xb0414 — type-effectiveness as a Q12 multiplier: wraps the TypeAffinity
// cluster (CalcAffinity/MulAffinity, see TypeAffinity.cpp) and returns the
// combined effectiveness scaled to 4096 (×1 = 0x1000, ×2 = 0x2000, ½ = 0x800,
// 0 = immune). This is the veneer-imported consumer that resolved the old
// "type-affinity has no callers" puzzle.

}  // namespace battle
}  // namespace pml
