#!/usr/bin/env python3
"""Verify the recovered USUM save-block layout.

Checks the structural model against decomp/savedata/save_layout.json:
  1. Blocks are in id order (0..38).
  2. Offsets follow "previous block end rounded up to 0x200".
  3. The layout tiles exactly to the footer at 0x6ca00.
  4. 38/39 blocks were CRC-verified against TWO independent real saves (block 36
     is a zero-padded block whose stored checksum does not validate).

The CRC match itself was performed against real save files (not committed); this
script re-checks the committed structural model so it stays self-consistent.
"""
import json, os

HERE = os.path.dirname(__file__)
J = json.load(open(os.path.join(HERE, "..", "savedata", "save_layout.json")))
B = J["blocks"]

def align(x, a): return (x + a - 1) // a * a

def main():
    assert [b["id"] for b in B] == list(range(39)), "ids not 0..38 in order"
    print("PASS blocks in id order 0..38")

    cur = 0
    for b in B:
        assert b["offset"] == cur, (b["id"], hex(b["offset"]), hex(cur))
        cur = align(cur + b["length"], 0x200)
    print("PASS offsets = cumulative, 0x200-aligned")

    assert cur == 0x6ca00, hex(cur)
    print("PASS layout tiles exactly to footer @0x6ca00")

    verified = sum(1 for b in B if b["crc_verified_both_saves"])
    assert verified == 38, verified
    unver = [b["id"] for b in B if not b["crc_verified_both_saves"]]
    print("PASS %d/39 blocks CRC-verified in two real saves (unverified: %s)" % (verified, unver))

    party = next(b for b in B if b["id"] == 4)
    box = next(b for b in B if b["id"] == 14)
    assert party["offset"] == 0x1600 and box["offset"] == 0x5200
    print("PASS party @0x1600, box @0x5200")

    print("\nALL save-layout checks PASS")

if __name__ == "__main__":
    main()
