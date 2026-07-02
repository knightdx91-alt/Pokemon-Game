// pml::pokepara::CoreParam — encrypted-blob crypto layer  (Pokémon Ultra Moon)
//
// Decompiled from static.crs (exefs .code). Addresses are file offsets into
// exefs/.code (== the disassembler's shown addresses for the static core).
//
// This is the Gen-4-through-7 Pokémon-record cipher: an LCRNG keystream XORed
// over the box-data halfwords, plus a 16-bit halfword-sum checksum. Verified
// numerically (no ROM needed) by decomp/verify/verify_coreparam.py; the LCRNG
// multiplier literal was read straight out of .code at 0x2204dc == 0x41C64E6D.
//
// ── The record ("box blob", 0xE8 = 232 bytes) ──────────────────────────────
//   +0x00  u32  pid          encryption seed (aka EncryptionConstant / PID)
//   +0x04  u16  sanity       flag bits; bit2 (0x4) is set when the stored
//                            checksum fails to match the recomputed one
//   +0x06  u16  checksum     16-bit sum of the halfwords in [+0x08 .. +0xE8)
//   +0x08  u8[224]           4 × 56-byte data blocks, LCRNG-encrypted
//                            (kept in PID-shuffled block order in RAM — USUM
//                            never un-shuffles into canonical order; see note)
//
// A parallel 0x1C = 28-byte party/battle-stats buffer is encrypted with the
// SAME seed. The live CoreParam data object (CoreParam+0xC points to it):
//   +0x04  void* party28     ptr to the 28-byte party buffer (may be null)
//   +0x08  void* box232      ptr to the 232-byte box blob
//   +0x0C  u8    isEncrypted 1 = blob currently ciphered
//   +0x0D  u8    fastDirty   fast-mode "decrypted & touched" latch
//
// NOTE ON BLOCK SHUFFLE: PKHeX decrypts *and* un-shuffles the 4 blocks into a
// canonical layout. USUM does NOT — sub_22258c only runs the XOR keystream and
// leaves the blocks in the order the PID selects, and Serialize_Core just
// memcpy's + re-encrypts. So field accessors here index the shuffled layout
// directly. The shuffle permutation itself lives in the accessor/offset layer,
// not in this crypto layer.

#include <cstdint>
#include <cstddef>

namespace pml { namespace pokepara {

// sub_220498 / sub_2204e0  — LCRNG XOR keystream over halfwords.
// The XOR cipher is its own inverse, so decrypt and encrypt of the block data
// are the identical routine (Game Freak emitted two byte-identical copies).
//   seed = seed*0x41C64E6D + 0x6073 ;  word[i] ^= (seed >> 16)
static void CryptBlock(uint16_t* data, uint32_t byteLen, uint32_t seed) {
    for (uint32_t i = 0; i < (byteLen >> 1); ++i) {
        seed = seed * 0x41C64E6Du + 0x6073u;   // +0x6000 + 0x73 in the asm
        data[i] ^= (uint16_t)(seed >> 16);
    }
}

// sub_220438 — 16-bit checksum: sum of every halfword, truncated to u16.
static uint16_t Checksum(const uint16_t* data, uint32_t byteLen) {
    uint32_t sum = 0;
    for (uint32_t i = 0; i < (byteLen >> 1); ++i)
        sum = (sum + data[i]) & 0xFFFF;
    return (uint16_t)sum;
}

// Field offsets inside the 232-byte box blob.
enum {
    kOffPid      = 0x00,
    kOffSanity   = 0x04,
    kOffChecksum = 0x06,
    kOffBlocks   = 0x08,
    kBlockBytes  = 0xE0,   // 224 = 4 × 56, the crypted/checksummed region
    kBoxBytes    = 0xE8,   // 232 total
    kPartyBytes  = 0x1C,   // 28-byte party/battle-stats buffer
};

struct CoreParamData {   // what CoreParam+0xC points at (partial)
    uint32_t _00;
    uint8_t* party28;     // +0x04
    uint8_t* box232;      // +0x08
    uint8_t  isEncrypted; // +0x0C
    uint8_t  fastDirty;   // +0x0D
};

// sub_22258c — decrypt in place (called by StartFastMode / sub_221908).
// Runs the keystream over the 224-byte block region and the 28-byte party
// buffer, clears isEncrypted, then re-checksums: on mismatch it flags the
// sanity word (|= 4) rather than rejecting the record.
void CoreParam_Decrypt(CoreParamData* d) {
    if (!d->isEncrypted) return;
    uint32_t seed = *(uint32_t*)(d->box232 + kOffPid);
    CryptBlock((uint16_t*)(d->box232 + kOffBlocks), kBlockBytes, seed);
    if (d->party28)
        CryptBlock((uint16_t*)d->party28, kPartyBytes, seed);
    d->isEncrypted = 0;

    uint16_t stored = *(uint16_t*)(d->box232 + kOffChecksum);
    uint16_t calc   = Checksum((uint16_t*)(d->box232 + kOffBlocks), kBlockBytes);
    if (stored != calc)
        *(uint16_t*)(d->box232 + kOffSanity) |= 0x4;
}

// sub_222514 — encrypt in place (called by EndFastMode / Serialize_Core).
// Recomputes+stores the checksum over the plaintext block region, then runs
// the keystream to re-cipher both buffers and sets isEncrypted.
void CoreParam_Encrypt(CoreParamData* d) {
    if (d->isEncrypted || d->fastDirty) return;   // already ciphered / mid-fast
    if (d->box232) {
        uint16_t calc = Checksum((uint16_t*)(d->box232 + kOffBlocks), kBlockBytes);
        *(uint16_t*)(d->box232 + kOffChecksum) = calc;
        uint32_t seed = *(uint32_t*)(d->box232 + kOffPid);
        CryptBlock((uint16_t*)(d->box232 + kOffBlocks), kBlockBytes, seed);
    }
    if (d->party28 && d->box232) {
        uint32_t seed = *(uint32_t*)(d->box232 + kOffPid);
        CryptBlock((uint16_t*)d->party28, kPartyBytes, seed);
    }
    d->isEncrypted = 1;
}

}} // namespace pml::pokepara
