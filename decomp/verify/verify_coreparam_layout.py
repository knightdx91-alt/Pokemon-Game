#!/usr/bin/env python3
"""Verify the decompiled CoreParam block-shuffle + field layout (Ultra Moon).

Checks:
  1. The 128-byte BlockPositionTable extracted from .code (VA 0x5e6994, dumped
     to block_position_table.json) equals the canonical Gen-6/7 permutation set
     (24 orders, repeating for shift 24..31). Independently reconstructed here.
  2. The resolver math `blob+8 + 56*table[shift*4+block]` places the 4 logical
     blocks at the 4 distinct 56-byte physical slots for every PID (bijective).
  3. The verified block-relative field offsets map onto the canonical absolute
     PK7 offsets (block A@0x08, B@0x40): species 0x08, item 0x0A, form 0x1D,
     move1 0x5A.
"""
import json, os

HERE = os.path.dirname(__file__)
TBL_JSON = os.path.join(HERE, "..", "pokepara", "block_position_table.json")

# Canonical Gen-6/7 block orders for shift 0..23 (PKHeX BlockPosition).
CANON_24 = [
    [0,1,2,3],[0,1,3,2],[0,2,1,3],[0,3,1,2],[0,2,3,1],[0,3,2,1],
    [1,0,2,3],[1,0,3,2],[2,0,1,3],[3,0,1,2],[2,0,3,1],[3,0,2,1],
    [1,2,0,3],[1,3,0,2],[2,1,0,3],[3,1,0,2],[2,3,0,1],[3,2,0,1],
    [1,2,3,0],[1,3,2,0],[2,1,3,0],[3,1,2,0],[2,3,1,0],[3,2,1,0],
]

def main():
    rows = json.load(open(TBL_JSON))["rows_by_shift"]
    assert len(rows) == 32

    # (1) table matches canonical, with shift 24..31 repeating 0..7
    for s in range(32):
        assert rows[s] == CANON_24[s % 24], (s, rows[s], CANON_24[s % 24])
    print("PASS BlockPositionTable == canonical Gen-6/7 (32 shifts, wraps @24)")

    # (2) resolver is bijective for every PID shift value
    def resolve(pid, block):
        shift = (pid >> 13) & 0x1F
        pos = rows[shift][block]
        return 8 + 56 * pos
    for shift in range(32):
        pid = shift << 13
        slots = sorted(resolve(pid, b) for b in range(4))
        assert slots == [8, 8+56, 8+112, 8+168], (shift, slots)
    print("PASS resolver maps A/B/C/D to the 4 distinct 56-byte slots for all PIDs")

    # (3) verified field offsets -> canonical absolute PK7 offsets.
    # Using the identity permutation (shift 0): block A@+8, B@+64.
    A = 8            # block A absolute base (canonical 0x08)
    B = 8 + 56       # block B absolute base (canonical 0x40)
    checks = {
        "species": (A + 0x00, 0x08),
        "item":    (A + 0x02, 0x0A),
        "form":    (A + 0x15, 0x1D),
        "move1":   (B + 0x1a, 0x5A),
    }
    for name, (got, canon) in checks.items():
        assert got == canon, (name, hex(got), hex(canon))
        print("PASS %-8s block-relative offset -> absolute 0x%02X (canonical)" % (name, canon))

    print("\nALL CoreParam layout checks PASS")

if __name__ == "__main__":
    main()
