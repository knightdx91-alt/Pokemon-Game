// pml/btl catch-rate server — Pokémon Ultra Moon (CTR-P-A2BA), Battle.cro.
//
// The Poké Ball catch calculation: `sub_2d568` (Battle.cro seg-0). Located by
// the `0.1875f` (3/16) shake-exponent constant — the one anchor that cut
// through the presentation layer (see decomp/README.md catch-rate notes). Like
// the damage server it reads the battle-pokemon struct directly (not the pml
// CoreParam getters), in Q12 fixed-point (4096 == ×1.0), applying every
// modifier through the same `(x·mod + 0x800) >> 12` round used everywhere else.
//
// The status/ball Q12 constants match the published Gen-7 values exactly, which
// pins the formula; the surrounding field fetches are a structural
// reconstruction of the observed control flow.

namespace pml {
namespace battle {

// Battle-pokemon field getter (sub_924a8): field 0xd = current HP,
// 0xe = max HP. Species catch rate via sub_7c838. RNG via sub_84bf0.

// sub_2d568 — compute catch outcome for a thrown ball.
//   a = (3*maxHP - 2*curHP) * catchRateMod * ballBonus / (3*maxHP) * statusBonus
// then if a >= 255 → guaranteed catch, else run the shake check with
//   shakeThreshold ≈ 65536 / (255/a)^(3/16)      (the 0.1875f @0x2da0c)
// and draw 4 shakes.
//
// ROM-observed steps (all in Q12 unless noted):
//   maxHP3 = 3 * field(0xe)                 ; add r0,r0,r0,lsl#1
//   base   = 3*maxHP - 2*curHP              ; adds base, maxHP3, -curHP<<1
//   base <<= 12                             ; to Q12
//   rate   = getCatchRate()                 ; sub_7c838, capped 600 (0x258)
//   // low catch-rate boost curve (thresholds 600/300/150/30 → Q12 mod):
//   base   = ApplyModifier(base, rateCurveMod)
//   ball   = getBallBonus(ballId)           ; sub_7dda8 (+ Ultra-Ball special)
//   a      = ApplyModifier(base, ball)
//   a      = ApplyModifier(a, otherBonus)   ; sub_2db6c (e.g. dark-grass)
//   switch (status) {                       ; sub_81edc
//       case sleep/freeze: a = ApplyModifier(a, 0x2800);  // ×2.5
//       case para/psn/brn: a = ApplyModifier(a, 0x1800);  // ×1.5
//   }
//   a /= maxHP3                             ; __aeabi_uidivmod  → final `a`
//   if (a >= 0xff000 /*255 in Q12*/) return CAUGHT;   // guaranteed
//   // shake threshold, clamped to 255 (0xff000), scaled by the rate curve and
//   // the 0.1875 power, then compared against the RNG for each of 4 shakes.
//   b = shakeThreshold(a);                  // uses 0.1875f @0x2da0c
//   for (i=0;i<4;i++) if (rng() >= b) return BROKE_FREE_after_i_shakes;
//   return CAUGHT;
//
// Verified constants (match published Gen-7 mechanics exactly):
//   ×2.5 sleep/freeze = 0x2800/4096 ; ×1.5 para/burn/poison = 0x1800/4096 ;
//   guaranteed-catch threshold 255 = 0xff000 in Q12 ; shake exponent 3/16 =
//   0.1875f. Q12 modifier round-half-up is the shared ApplyModifier
//   (DamageCalc.cpp sub_84d40).
//
// [Structural reconstruction: control flow + the verified Q12 constants are
//  from the ROM; exact battle-struct field semantics (0xd/0xe) are as observed.
//  The base identity is checkable: at full HP a = (M·rate)/(3M) = rate/3, and
//  a≥255 always catches — matches known behaviour.]

}  // namespace battle
}  // namespace pml
