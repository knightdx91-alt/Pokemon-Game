// gfl2::math — the engine's random number generators.
//
// Decompiled from Pokémon Ultra Moon (CTR-P-A2BA), exefs `.code`, via the
// symbol-mapped disassembly (tools/cro_disasm.py). Faithful research
// reconstruction. Two distinct generators ship in gfl2::math:
//   - SFMTRandom : SIMD-oriented Fast Mersenne Twister (MEXP-19937), used for
//                  bulk/gameplay randomness (encounters, damage roll, …).
//   - Random     : a lightweight WELL512-family (xorshift-lattice) generator
//                  with a small 5-word state, for cheap/local randomness.

namespace gfl2 {
namespace math {

// ---- SFMTRandom (Mersenne Twister, N = 624 32-bit words) ----------------
// State layout (offsets from the object base, observed):
//   [0x000 .. 0x9bf]  = 624-word state array (0x270 words × 4 bytes)
//   [0x9c0]           = current index into the state array
const int SFMT_N = 0x270;   // 624 words (MEXP-19937)

struct SFMTRandom {
    unsigned int state[SFMT_N];
    unsigned int index;

    void GenRandAll();   // sub_45ea54 — regenerate the whole 624-word block

    // gfl2::math::SFMTRandom::Next(unsigned int max)   @ 0x260f74
    //   Draw the next 32-bit word (refilling the block when exhausted) and
    //   reduce it into [0, max) with a plain modulo.
    unsigned int Next(unsigned int max)
    {
        if (index >= SFMT_N) {   // cmp #0x270 / blt
            GenRandAll();
            index = 0;
        }
        unsigned int raw = state[index++];
        return raw % max;        // __aeabi_uidivmod remainder
    }
};

// ---- Random (WELL512-family lightweight PRNG) ---------------------------
// gfl2::math::Random::Next(unsigned int max)   @ 0x2617cc
// A small-state xorshift-lattice step: masks the sign bit of word0, folds
// several state words through `x ^= x<<1`, `x ^= x>>1`, `x ^= x<<10`
// shift-XOR stages with a `-(x&1)` conditional-XOR mask (the WELL512
// tempering pattern), rotates the 5-word state, and returns the tempered
// output reduced into [0, max). Reproduced structurally; the exact WELL512
// constants live in the state words rather than immediates, so this is
// documented as the algorithm family, not re-expanded bit-for-bit here.
// (See the disassembly at 0x2617cc for the precise lattice.)

}  // namespace math
}  // namespace gfl2
