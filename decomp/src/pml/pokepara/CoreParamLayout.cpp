// pml::pokepara::CoreParam — block-shuffle resolver + field layout  (Ultra Moon)
//
// Decompiled from static.crs (exefs .code). This is the layer that turns a
// decrypted 232-byte record into readable fields. Pairs with CoreParamCrypto.cpp
// (the LCRNG cipher) — every field accessor is a
//   Decrypt(sub_22258c) → resolve block → read field → Encrypt(sub_222514)
// sandwich (the game re-encrypts after each read; StartFastMode/EndFastMode
// batch this for many reads).
//
// ── Block shuffle (sub_3ad590 / sub_3ad610 / … ) ────────────────────────────
// The 4 × 56-byte data blocks (A,B,C,D) are stored in a PID-dependent order.
// A resolver returns a pointer to a *logical* block, undoing the shuffle:
//     shift = (PID >> 13) & 0x1F                       // 0..31
//     pos   = BlockPositionTable[shift*4 + block]      // block: A=0 B=1 C=2 D=3
//     ptr   = boxblob + 8 + 56 * pos
// Game Freak emitted one resolver per block (each hardcodes the block column
// as the load immediate: A=[r0,#0], B=[r0,#1], C=[r0,#2], D=[r0,#3]). The
// 128-byte table lives at VA 0x5e6994 and is the canonical Gen-6/7 permutation
// set (24 orders, repeating for shift 24..31) — extracted verbatim to
// decomp/pokepara/block_position_table.json. If the sanity word (@blob+4) has
// bit2 set (checksum failed on decrypt), the resolver returns a dummy buffer
// instead of real data.
//
// Field offsets below are block-relative and were read straight from the
// accessors; they line up exactly with the well-documented canonical PK7 map
// (block A at absolute 0x08, B at 0x40, C at 0x78, D at 0xB0), which is what
// verify/verify_coreparam_layout.py checks. Verified in this pass: species
// (A+0), held item (A+2), form (A+0x15), move ids (B+0x1a).

#include <cstdint>

namespace pml { namespace pokepara {

extern const uint8_t kBlockPositionTable[128]; // VA 0x5e6994, see json dump

// Logical block ids (canonical order).
enum Block { BLOCK_A = 0, BLOCK_B = 1, BLOCK_C = 2, BLOCK_D = 3 };

// sub_3ad590 (A) / sub_3ad610 (B) / sub_3ad690 (C) / sub_3ad710 (D):
// resolve a logical block to its physical address inside the decrypted blob.
static uint8_t* ResolveBlock(uint8_t* boxblob, Block block) {
    // checksum-failed record -> caller substitutes a dummy buffer (omitted).
    uint32_t pid   = *(uint32_t*)(boxblob + 0x00);
    uint32_t shift = (pid & 0x3E000u) >> 13;          // (PID>>13)&0x1F
    uint32_t pos   = kBlockPositionTable[shift * 4 + block];
    return boxblob + 8 + 56 * pos;                     // 56 = 0x38 block size
}

// ── Verified field accessors (block-relative offsets) ───────────────────────
// (each is wrapped by Decrypt/Encrypt in the real accessor; shown here reading
//  an already-decrypted blob for clarity)

uint16_t GetMonsNo(uint8_t* blob) {              // sub_3ae004
    return *(uint16_t*)(ResolveBlock(blob, BLOCK_A) + 0x00);   // species
}
uint16_t GetItem(uint8_t* blob) {                // sub_3adfa4
    return *(uint16_t*)(ResolveBlock(blob, BLOCK_A) + 0x02);   // held item
}
uint8_t GetFormNo(uint8_t* blob) {               // sub_3adf74
    return ResolveBlock(blob, BLOCK_A)[0x15] >> 3;             // form (bits 3+)
}
uint16_t GetWazaNo(uint8_t* blob, uint8_t idx) { // sub_3ae08c, idx 0..3
    return *(uint16_t*)(ResolveBlock(blob, BLOCK_B) + 0x1a + idx * 2); // move id
}

// Canonical block-relative offsets for the remaining common fields (block A at
// absolute 0x08). Kept as documentation for the next accessor-mapping pass:
//   A: species 0x00, item 0x02, TID 0x04, SID 0x06, exp 0x08, ability 0x0C,
//      nature 0x14, form 0x15, EVs 0x1E..0x23
//   B: moves 0x1a..0x21 (4×u16), PP 0x22..0x25, PP-ups 0x26..0x29, IVs u32 0x34
//   C: nickname 0x00.. (u16 chars), OT/handler flags
//   D: OT name, met data

}} // namespace pml::pokepara
