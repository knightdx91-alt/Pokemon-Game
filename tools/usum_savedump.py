#!/usr/bin/env python3
"""Read Pokémon out of a real Pokémon Ultra Moon `main` save (0x6CC00).

Pure implementation of the decompiled CoreParam pipeline — nothing here is
guessed; every step corresponds to decompiled code:
  - LCRNG record cipher  -> decomp/src/pml/pokepara/CoreParamCrypto.cpp
  - block-shuffle + field -> decomp/src/pml/pokepara/CoreParamLayout.cpp
  - block table           -> decomp/pokepara/block_position_table.json

A CoreParam record is 232 bytes: PID@0, sanity@4, checksum@6 (16-bit sum of the
decrypted 224-byte block region), then 4x56 encrypted+shuffled blocks. The
checksum is a strong validator (false positive ~1/65536), so scanning the save
for records that decrypt to a matching checksum reliably finds every stored
Pokémon.

Verified layout in a real USUM save:
  party  @ 0x1600 (6 slots, 260-byte PokemonParam = 232 box + 28 party stats)
  box    @ 0x5200 (960 slots, 232-byte box records, 32 boxes x 30)

Usage: python3 tools/usum_savedump.py <main.sav> [--all]
"""
import sys, os, json, struct

HERE = os.path.dirname(__file__)
BP = json.load(open(os.path.join(HERE, "..", "decomp", "pokepara",
                                  "block_position_table.json")))["rows_by_shift"]
PARTY_OFF, PARTY_N, PARTY_STRIDE = 0x1600, 6, 260   # block 4
BOX_OFF, BOX_N, BOX_STRIDE = 0x5200, 960, 0xE8       # block 14 = Savedata::BoxPokemon
MYSTATUS_OFF = 0x1400                                 # block 3 = Savedata::MyStatus

def trainer(d):
    tid, sid = struct.unpack_from('<HH', d, MYSTATUS_OFF)
    name = ""
    for i in range(MYSTATUS_OFF + 0x38, MYSTATUS_OFF + 0x50, 2):
        c = struct.unpack_from('<H', d, i)[0]
        if c == 0: break
        name += chr(c)
    return name, tid, sid

def decrypt(buf):
    """Return the decrypted 224-byte block region, or None if checksum fails."""
    pid = struct.unpack_from('<I', buf, 0)[0]
    stored = struct.unpack_from('<H', buf, 6)[0]
    seed = pid
    dec = []
    for w in struct.unpack_from('<112H', buf, 8):
        seed = (seed * 0x41C64E6D + 0x6073) & 0xFFFFFFFF
        dec.append(w ^ ((seed >> 16) & 0xFFFF))
    if (sum(dec) & 0xFFFF) != stored:
        return None
    return pid, b''.join(struct.pack('<H', w) for w in dec)

def read_mon(buf):
    r = decrypt(buf)
    if not r:
        return None
    pid, raw = r
    order = BP[(pid >> 13) & 0x1F]              # physical pos of logical block L
    def blk(L):
        p = order[L]; return raw[p*56:(p+1)*56]
    A, B = blk(0), blk(1)
    species = struct.unpack_from('<H', A, 0)[0]
    if not (1 <= species <= 807):
        return None
    tid, sid = struct.unpack_from('<HH', A, 4)
    iv32 = struct.unpack_from('<I', B, 0x34)[0]
    return {
        "pid": pid, "species": species,
        "item": struct.unpack_from('<H', A, 2)[0],
        "tid": tid, "sid": sid,
        "ability": A[0x0C], "nature": A[0x14],
        "form": A[0x15] >> 3,
        "moves": list(struct.unpack_from('<4H', B, 0x1a)),
        "ivs": [(iv32 >> (5*i)) & 0x1f for i in range(6)],
    }

def main():
    if len(sys.argv) < 2:
        print(__doc__); return 1
    d = open(sys.argv[1], "rb").read()
    if len(d) != 0x6CC00:
        print("warning: expected 0x6CC00-byte USUM main save, got 0x%x" % len(d))
    show_all = "--all" in sys.argv

    name, tid, sid = trainer(d)
    print("=== TRAINER (MyStatus @0x%04X) ===" % MYSTATUS_OFF)
    print("  OT: %s   TID: %d   SID: %d\n" % (name, tid, sid))

    print("=== PARTY @0x%04X ===" % PARTY_OFF)
    for i in range(PARTY_N):
        o = PARTY_OFF + i*PARTY_STRIDE
        m = read_mon(d[o:o+232])
        if m:
            print("  slot %d: species %3d  lv-item %3d  nature %2d  IVs %s  moves %s"
                  % (i, m["species"], m["item"], m["nature"], m["ivs"], m["moves"]))

    box = [read_mon(d[BOX_OFF+i*BOX_STRIDE: BOX_OFF+i*BOX_STRIDE+232]) for i in range(BOX_N)]
    filled = [(i, m) for i, m in enumerate(box) if m]
    print("\n=== BOX @0x%04X: %d/%d slots filled ===" % (BOX_OFF, len(filled), BOX_N))
    for i, m in (filled if show_all else filled[:20]):
        print("  box slot %3d (box %2d pos %2d): species %3d  IVs %s"
              % (i, i//30, i % 30, m["species"], m["ivs"]))
    if not show_all and len(filled) > 20:
        print("  ... (%d more; pass --all)" % (len(filled)-20))
    return 0

if __name__ == "__main__":
    sys.exit(main())
