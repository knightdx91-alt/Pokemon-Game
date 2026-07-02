// pml::battle::TypeAffinity — type-effectiveness lookup.
//
// Decompiled from Pokémon Ultra Moon (CTR-P-A2BA), exefs `.code`, from the
// symbol-mapped disassembly (tools/cro_disasm.py). Behaviour verified against
// the known Gen-7 type chart; addresses are VA (text base 0x100000).
//
// This is a faithful research reconstruction — readable C++ matching the
// observed control flow and data, NOT a byte-matching recompile. See
// decomp/README.md.

namespace pml {
namespace battle {

// AffinityID (return domain, from the observed branch targets):
//   0 = immune (0x)      6 = not-very-effective (0.5x)
//   7 = neutral (1x)     8 = super-effective (2x)
// Effect codes stored in the chart bytes: 0=immune, 2=½, 4=1, 8=2 (a bitmask).
enum AffinityID {
    AFF_IMMUNE = 0,
    AFF_HALF   = 6,
    AFF_NEUTRAL = 7,
    AFF_SUPER  = 8,
};

// 18×18 attacker→defender effect-code chart (rodata @ VA 0x5bb558).
// Row = attacking type, column = defending type, both in the internal type
// order: Normal Fight Flying Poison Ground Rock Bug Ghost Steel Fire Water
// Grass Electric Psychic Ice Dragon Dark Fairy.
extern const unsigned char sTypeChart[18][18];  // baked from the ROM

// Type index 0x12 (18) is the "no type" sentinel used for typeless moves /
// the empty second type slot — always neutral.
static const int TYPE_NONE = 0x12;

// pml::battle::TypeAffinity::CalcAffinity(u8 attackType, u8 defendType,
//                                         bool inverse)   @ VA 0x21c1e8
// `inverse` selects Inverse-Battle scoring (the r2 argument), which flips
// the immune/half/super outcomes.
AffinityID CalcAffinity(unsigned char attackType,
                        unsigned char defendType,
                        bool inverse)
{
    // A typeless attacker or defender is always neutral.
    if (attackType == TYPE_NONE || defendType == TYPE_NONE)
        return AFF_NEUTRAL;

    unsigned char code = sTypeChart[attackType][defendType];
    switch (code) {
    case 0:  // normally immune
        return inverse ? AFF_SUPER : AFF_IMMUNE;
    case 2:  // normally ½×
        return inverse ? AFF_SUPER : AFF_HALF;
    case 4:  // normally 1×
        return AFF_NEUTRAL;
    case 8:  // normally 2×
        return inverse ? AFF_HALF : AFF_SUPER;
    default:
        return AFF_IMMUNE;  // unreachable for a well-formed chart
    }
}

// Fixed-point (1/64) affinity-value table (rodata @ VA 0x5bb69c):
//   index i -> value (1 << i) in Q6, capped at 4096 (= 64×, i.e. ×64.0).
static const unsigned int sAffinityValue[14] = {
    0, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096,
};

// pml::battle::TypeAffinity::MulAffinity(AffinityID a, AffinityID b) @0x21c0e0
// Combines two per-type affinities (dual-type defender) by multiplying their
// Q6 values, renormalising (>>6), clamping to ×64, then mapping the product
// back to the nearest AffinityID via the value table.
AffinityID MulAffinity(AffinityID a, AffinityID b)
{
    // Guard: ids must be < 14 (table size); the ROM returns id 0 otherwise.
    if (a >= 14 || b >= 14)
        return AFF_IMMUNE;

    unsigned int prod = (sAffinityValue[a] * sAffinityValue[b]) >> 6;

    if (prod > 4096)              // clamp to ×64
        prod = 4096;
    else if (prod == 0 && a != AFF_IMMUNE && b != AFF_IMMUNE)
        prod = 1;                 // never collapse a non-immune pair to 0

    // Map the Q6 product back to an AffinityID. sAffinityValue[id] == 2^(id-1)
    // (value[7]=64=×1.0 in Q6), so an id's value has bit (id-1) set — the
    // AffinityID is therefore (bit_index + 1). The ROM scans bits low→high and
    // returns `bit_index + 1`, capped at 13:
    //     add r0, r1, #1 ; cmp r0,#0xe ; movhs r0,#0xd    (@0x21c1a4)
    // (Earlier revisions of this file returned `bit_index`, off by one — that
    // collapsed neutral×neutral to ½ and every 2×/4× down a step. Verified
    // fixed: composing CalcAffinity+MulAffinity now yields exact 0×/¼×/½×/1×/
    // 2×/4× for all dual-type cases — see decomp/verify/verify_typeaffinity.py.)
    for (int i = 0; i < 32; ++i) {
        if (prod & (1u << i)) {
            int id = i + 1;
            return (AffinityID)(id < 14 ? id : 13);
        }
    }
    return AFF_IMMUNE;            // prod == 0 -> immune
}

// sub_21c284 — effectiveness of an attacking type against a (dual-type)
// defender. Calls CalcAffinity for the attack type vs each of the defender's
// two types, combines the two results the same way MulAffinity does (product
// of their Q6 values, renormalised, mapped back to an AffinityID).
//
// NOTE (corrected): the internal combiner lives at 0x21c284; the *exported*
// dual-type entry point is `CalcAffinityAbout(atk, def1, def2, bool)` at
// 0x21c3b0, which calls 0x21c284. The full cluster exports are:
//   MulAffinity 0x21c0e0 · CalcAffinity 0x21c1e8 · (internal 0x21c284) ·
//   CalcAffinityAbout 0x21c3b0 · ConvAboutAffinity 0x21c3d8.
// The earlier "reached only by function-pointer dispatch, no resolvable
// caller" claim was a scan artifact (wrong VA base — static .code is
// VA==file-offset). Real callers exist in Battle.cro via import veneers; see
// decomp/README.md "CORRECTION".
//   attackType vs (defType1, defType2); pass defType2 == TYPE_NONE for a
//   single-typed defender (CalcAffinity returns neutral for TYPE_NONE).
AffinityID CalcAffinityForDefender(unsigned char attackType,
                                   unsigned char defType1,
                                   unsigned char defType2,
                                   bool inverse)
{
    AffinityID a1 = CalcAffinity(attackType, defType1, inverse);
    AffinityID a2 = CalcAffinity(attackType, defType2, inverse);
    return MulAffinity(a1, a2);
}

// pml::battle::TypeAffinity::ConvAboutAffinity(AffinityID) @ VA 0x21c3d8
// Collapses an AffinityID into a coarse display/AI category ("about" = the
// general effectiveness bucket, NOT a numeric multiplier). Fully decoded from
// the ROM (cmp #7 / moveq #1 / movhi #2 / cmp #0 / movne #3):
//   immune (id 0)            -> 0
//   not-very-effective (1..6)-> 3
//   neutral (id 7)           -> 1
//   super-effective (id >=8) -> 2
// Verified by construction against the branch constants; this is the value
// the effectiveness message / AI switching logic keys off (it is one of the
// three TypeAffinity funcs Battle.cro imports).
enum AffinityAbout {
    ABOUT_NONE   = 0,   // no effect
    ABOUT_NORMAL = 1,   // 1x
    ABOUT_SUPER  = 2,   // super effective
    ABOUT_WEAK   = 3,   // not very effective
};

AffinityAbout ConvAboutAffinity(AffinityID id)
{
    if (id == AFF_NEUTRAL) return ABOUT_NORMAL;   // == 7
    if (id > AFF_NEUTRAL)  return ABOUT_SUPER;    // >  7
    if (id != AFF_IMMUNE)  return ABOUT_WEAK;     // 1..6
    return ABOUT_NONE;                            // == 0
}

}  // namespace battle
}  // namespace pml
