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

// ── Block A (sub_3ad590, absolute base 0x08) ──
uint16_t GetMonsNo(uint8_t* blob) {              // sub_3ae004  species
    return *(uint16_t*)(ResolveBlock(blob, BLOCK_A) + 0x00);   // abs 0x08
}
uint16_t GetItem(uint8_t* blob) {                // sub_3adfa4  held item
    return *(uint16_t*)(ResolveBlock(blob, BLOCK_A) + 0x02);   // abs 0x0A
}
uint32_t GetID(uint8_t* blob) {                  // sub_3adadc  TID|SID<<16
    return *(uint32_t*)(ResolveBlock(blob, BLOCK_A) + 0x04);   // abs 0x0C
}
uint8_t GetTokuseiNo(uint8_t* blob) {            // sub_3ad014  ability id
    return ResolveBlock(blob, BLOCK_A)[0x0C];                  // abs 0x14
}
uint8_t GetSeikaku(uint8_t* blob) {              // sub_3aca28  nature
    return ResolveBlock(blob, BLOCK_A)[0x14];                  // abs 0x1C
}
uint8_t GetFormNo(uint8_t* blob) {               // sub_3adf74  form (bits 3+)
    return ResolveBlock(blob, BLOCK_A)[0x15] >> 3;             // abs 0x1D
}
uint8_t GetSex(uint8_t* blob) {                  // sub_3adcb8  gender (bits 1-2)
    return (ResolveBlock(blob, BLOCK_A)[0x15] << 29) >> 30;    // abs 0x1D
}
uint8_t GetEffortPower(uint8_t* blob, uint8_t stat) { // sub_3acca0..  EVs, stat 0..5
    return ResolveBlock(blob, BLOCK_A)[0x16 + stat];          // abs 0x1E..0x23
}

// ── Block B (sub_3ad610, absolute base 0x40) ──
uint16_t GetWazaNo(uint8_t* blob, uint8_t idx) { // sub_3ae08c  move id, idx 0..3
    return *(uint16_t*)(ResolveBlock(blob, BLOCK_B) + 0x1a + idx * 2); // abs 0x5A
}
uint8_t GetWazaPP(uint8_t* blob, uint8_t idx) {  // sub_3adb10  current PP
    return ResolveBlock(blob, BLOCK_B)[0x22 + idx];           // abs 0x62
}
uint8_t GetWazaPPUpCount(uint8_t* blob, uint8_t idx) { // sub_3ad52c  PP-ups used
    return ResolveBlock(blob, BLOCK_B)[0x26 + idx];           // abs 0x66
}
uint8_t GetTalentPower(uint8_t* blob, uint8_t stat) { // sub_3ae690  IV, stat 0..5
    // hyper-trained stats read back as 31 (flag byte @ block D +0x2e, abs 0xDE)
    if (ResolveBlock(blob, BLOCK_D)[0x2e] & (1 << stat)) return 31;
    uint32_t iv32 = *(uint32_t*)(ResolveBlock(blob, BLOCK_B) + 0x34); // abs 0x74
    return (iv32 >> (5 * stat)) & 0x1f;                       // 5 bits/stat
}

// ── Block C (sub_3ad694, absolute base 0x78) ──
uint8_t GetFamiliarity(uint8_t* blob) {          // sub_3ad1c0  friendship
    // current-handler flag @ C+0x1b (abs 0x93) selects HT vs OT friendship byte
    return ResolveBlock(blob, BLOCK_C)[0x1b];                 // abs 0x93
}

// ── Block D (sub_3ad718, absolute base 0xB0) ──
uint8_t GetGetBall(uint8_t* blob) {              // sub_3ac940  caught-in ball
    return ResolveBlock(blob, BLOCK_D)[0x2c];                 // abs 0xDC
}
uint8_t GetCassetteVersion(uint8_t* blob) {      // sub_3ad7fc  game of origin
    return ResolveBlock(blob, BLOCK_D)[0x2f];                 // abs 0xDF
}
uint8_t GetLangId(uint8_t* blob) {               // sub_3adfd0  language
    return ResolveBlock(blob, BLOCK_D)[0x33];                 // abs 0xE3
}

}} // namespace pml::pokepara
