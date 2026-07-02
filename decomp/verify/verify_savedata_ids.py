#!/usr/bin/env python3
"""Verify the Savedata block id -> class identifications.

Each identification ties a block's unique length (from the recovered layout) to
the size constant that appears only inside that Savedata class's own code, or to
the class's size-getter return value. This checks that the classes recorded in
save_layout.json carry the lengths those classes actually use.

MyStatus (block 3) is additionally content-verified in a real save: its TID/SID
match the OT of the party Pokémon (see tools/usum_savedump.py output).
"""
import json, os

HERE = os.path.dirname(__file__)
J = json.load(open(os.path.join(HERE, "..", "savedata", "save_layout.json")))
by = {b["id"]: b for b in J["blocks"]}

# id -> (class, expected length) established from the ROM (unique size in the
# class's own code, or its size-getter).
EXPECT = {
    0:  ("Savedata::MyItem",           0xe28),
    3:  ("Savedata::MyStatus",         0xc0),
    6:  ("Savedata::ZukanData",        0xf78),
    8:  ("Savedata::UnionPokemon",     0x30c),
    11: ("Savedata::ConfigSave",       0x4),
    13: ("Savedata::BOX",              0x5e6),
    14: ("Savedata::BoxPokemon",       0x36600),
    18: ("Savedata::Fashion",          0x1a08),
    21: ("Savedata::JoinFestaDataSave",0x3998),
    27: ("Savedata::MysteryGiftSave",  0x3f50),
    29: ("Savedata::PokeFinderSave",   0x728),
}

def main():
    for bid, (cls, ln) in EXPECT.items():
        b = by[bid]
        assert b["length"] == ln, (bid, hex(b["length"]), hex(ln))
        assert b.get("class") == cls, (bid, b.get("class"), cls)
        print("PASS block %2d = %-30s len 0x%05x @%s" % (bid, cls, ln, b["offset_hex"]))
    # block 4 is the party (content-verified, no dedicated Savedata class name)
    assert by[4]["offset"] == 0x1600 and "party" in by[4].get("role", "")
    print("PASS block  4 = party @0x1600 (content-verified)")
    print("\n%d/39 blocks identified; ALL identification checks PASS" % (len(EXPECT) + 1))

if __name__ == "__main__":
    main()
