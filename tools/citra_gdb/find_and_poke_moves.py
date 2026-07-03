#!/usr/bin/env python3
"""Find Volcanion's battlemon in a /tmp/va.bin dump of the 0x30000000 region,
confirm the MoveSlot layout by printing its 4 move ids, and emit /tmp/poke to
overwrite all 4 slots (moveId @+0x0 and curMoveId @+0x6 of each 0xe-byte record)
with guaranteed-effect status moves (0 power -> target always survives -> effect
always applies), for the effectId->seqId isolation test.

Usage: python3 find_and_poke_moves.py            # dump must be at /tmp/va.bin (base 0x30000000)
"""
import struct

BASE = 0x30000000
MOVES_OFF = 0x1fc      # battlemon+0x1fc: MoveSlot[4], 0xe bytes each
SLOT = 0xe
# Gen-7 national move numbers for the test set (all 0-power, 100% effect):
TEST = [261, 45, 86, 92]   # Will-O-Wisp(burn) Growl(-atk) ThunderWave(para) Toxic(psn)
TEST_NAMES = ["Will-O-Wisp(burn,eff167)", "Growl(-atk,eff18)",
              "Thunder Wave(para,eff67)", "Toxic(psn,eff33)"]
# Volcanion's real moves, to validate the layout when found:
KNOWN = {592: "Steam Eruption", 257: "Heat Wave", 56: "Hydro Pump", 153: "Explosion"}


def find_volcanion(va):
    pat = struct.pack("<H", 721)
    i = 0
    out = []
    while True:
        j = va.find(pat, i)
        if j < 0:
            break
        b = j - 0xc
        if 0 <= b and b + 0x230 < len(va):
            if va[b + 0x18] == 85 and struct.unpack_from("<H", va, b + 0xe)[0] == 260:
                out.append(b)
        i += 2
    return out


def main():
    va = open("/tmp/va.bin", "rb").read()
    bases = find_volcanion(va)
    print(f"Volcanion battlemon copies: {[hex(BASE+b) for b in bases]}")
    if not bases:
        print("NOT FOUND — dump the 0x30000000 region while in battle first.")
        return
    poke_lines = []
    for b in bases:
        ids = [struct.unpack_from("<H", va, b + MOVES_OFF + s * SLOT)[0] for s in range(4)]
        cur = [struct.unpack_from("<H", va, b + MOVES_OFF + s * SLOT + 6)[0] for s in range(4)]
        named = [KNOWN.get(x, str(x)) for x in ids]
        print(f"  @{hex(BASE+b)} move ids={ids} ({named}) cur={cur}")
        for s in range(4):
            mid_va = BASE + b + MOVES_OFF + s * SLOT
            poke_lines.append(f"{mid_va:x} {TEST[s]:x} 2")        # moveId
            poke_lines.append(f"{mid_va + 6:x} {TEST[s]:x} 2")    # curMoveId
    open("/tmp/poke", "w").write("\n".join(poke_lines) + "\n")
    print(f"\nWrote /tmp/poke: {len(poke_lines)} writes -> slots set to:")
    for s in range(4):
        print(f"  slot{s} = {TEST[s]}  {TEST_NAMES[s]}")


if __name__ == "__main__":
    main()
