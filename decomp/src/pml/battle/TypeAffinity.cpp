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

    // Map the Q6 product back to an AffinityID: the smallest index whose bit
    // is set (the ROM scans bits 0..31 of `prod`, capping the id at 13).
    for (int i = 0; i < 32; ++i) {
        if (prod & (1u << i))
            return (AffinityID)(i < 14 ? i : 13);
    }
    return AFF_IMMUNE;            // prod == 0 -> immune
}

}  // namespace battle
}  // namespace pml
