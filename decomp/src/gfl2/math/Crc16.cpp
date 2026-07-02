// gfl2::math::Crc::Crc16 — save-data block checksum  (Pokémon Ultra Moon)
//
// Decompiled from static.crs (exefs .code) @ 0x261534. This is the checksum
// every Savedata block is validated with (the footer stores a Crc16 over the
// block body; a mismatch marks the save corrupt).
//
// It is a table-driven **CRC-16/USB**: reflected poly 0x8005 (table[1]=0xC0C1,
// table[0x80]=0xA001 = reflected 0x8005), init 0xFFFF, reflected in/out,
// xorout 0xFFFF. The two `mvn` in the asm are the init inversion (~seed) and
// the final xorout (~crc). Identified by the standard check value: CRC of the
// ASCII "123456789" == 0xB4C8 (the CRC-16/USB check constant). The 256-entry
// reflected table lives at VA 0x66ed70; verify/verify_savecrc.py regenerates it
// from the polynomial and confirms both the table and the check value.

#include <cstdint>

namespace gfl2 { namespace math {

extern const uint16_t kCrc16Table[256];   // VA 0x66ed70, reflected poly 0xA001

// signature matches the export: Crc16(u16 seed, const u8* data, int len)
uint16_t Crc16(uint16_t seed, const uint8_t* data, int len) {
    uint16_t crc = ~seed;                       // mvn r0,r0 ; uxth  (init ^ 0xFFFF)
    for (int i = 0; i < len; ++i)
        crc = kCrc16Table[(crc ^ data[i]) & 0xFF] ^ (crc >> 8);
    return (uint16_t)~crc;                       // mvn r0,r0 ; uxth  (xorout 0xFFFF)
}

// Save blocks pass seed = 0 (so init becomes 0xFFFF via the ~), matching the
// canonical CRC-16/USB used by PKHeX for 3DS-gen main-save block validation.

}} // namespace gfl2::math
