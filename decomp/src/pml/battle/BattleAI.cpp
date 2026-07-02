// pml::battle — enemy-AI move evaluation (Pokémon Ultra Moon, Battle.cro).
//
// The btl AI is symbol-stripped; these are unnamed `sub_XXXX` located by call
// graph from the battle handler `sub_9698` (a slot in dispatch table @0x45a0).
// This is a faithful structural reconstruction of the observed control flow —
// the leaf helpers it composes (type effectiveness, stat-stage weight) are the
// same primitives verified in TypeAffinity.cpp. The AI *estimates* damage with
// a coarse version of the real formula (DamageCalc.cpp) purely to rank moves;
// the numbers it produces are heuristic scores, not the live HP result.
//
// Battle.cro seg-0 offsets.

namespace pml {
namespace battle {

// ── sub_8de5c : attacker type/ability packer ─────────────────────────────────
// Reads the attacker CoreParam and packs (moveType | defType1<<5 | defType2<<10)
// plus an ability flag into a single word for sub_8ddb4. (@0x8de5c)

// ── sub_8dce4 : stat-stage → coarse AI scale ─────────────────────────────────
// Jump table indexed by stat stage (0..13). Returns the input scaled by a
// power of two via shifts (stage < center → lsr, > center → lsl) — the AI's
// cheap approximation of the ±stage stat multiplier (the real battle uses the
// 2/2..8/2 fraction; the AI just shifts). (@0x8dce4)

// ── sub_8ddb4 : multi-type effectiveness combiner (AI) ───────────────────────
// attackType vs up to THREE defender types (Gen-6 Trick-or-Treat / Forest's
// Curse), skipping the 0x12 (TYPE_NONE) sentinel and duplicate types. Calls
// TypeAffinity::CalcAffinity per type and MulAffinity-combines — the veneer-
// imported consumer that resolved the "type-affinity has no callers" puzzle.
// (@0x8ddb4 → import veneers 0x16d8 CalcAffinity / 0x16d0 MulAffinity)

// ── sub_9348 : AI damage estimator + move ranker ─────────────────────────────
// For each of the attacker's candidate moves (count in arg2, indices in the
// arg1 byte array), estimates damage and then bubble-sorts the move-index
// array in place, descending by estimate — i.e. produces the AI's move
// preference order. Per move:
//   - fetch move id (sub_93798) and skip invalid/unusable (sub_93768/93164)
//   - eligibility/redirect check: move id compared against a 9-entry table
//     (twice) — immunity / target-redirect filtering
//   - if pml::wazadata::IsDamage(move):
//       power = pml::wazadata::GetPower(move);  if power < 10 use 60 (a
//               non-zero placeholder so variable-power moves still score)
//       type  = pml::wazadata::GetType(move)
//       est   = power
//             * typeEffectiveness   (sub_8ddb4, via sub_8de5c's packed types)
//             * statStageWeight      (sub_8dce4)     [coarse, shift-based]
//       store est into the parallel score array
//   - non-damaging moves score 0 (kept for the sort)
// The result is consumed by sub_9698 to pick/queue the AI's move. This is the
// enemy move-selection heuristic, distinct from the live damage server
// (sub_18504 / DamageCalc.cpp), which it approximates.
//
// [Structural reconstruction: control flow + helper composition are as
//  observed; the estimate is a heuristic score, not numerically verifiable
//  against a single "correct" value the way the leaf formulas are.]

}  // namespace battle
}  // namespace pml
