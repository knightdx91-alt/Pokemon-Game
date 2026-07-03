#!/usr/bin/env python3
"""
verify_battlemon_init.py — assert the battle-pokemon init field map.

Re-derives the field->accessor map from sub_6188c (tools/usum_battlemon_init.py)
and checks the anchor offsets, including the corrected HP pair (0xe = maxHp via
GetPower(HP); 0x10 = curHp via GetHp — the old header had these swapped).
No ROM save needed; the ROM code itself is the ground truth.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools"))
import usum_battlemon_init as B

EXPECT = {
    0x0c: ("monsNo", "GetMonsNo"),
    0x0e: ("maxHp", "GetPower"),     # PowerID 0 = HP
    0x10: ("curHp", "GetHp"),
    0x12: ("heldItem", "GetItem"),
    0x16: ("tokuseiNo", "GetTokuseiNo"),
    0x18: ("level", "GetLevel"),
    0x1c: ("formNo", "GetFormNo"),
}


def main():
    fields = B.main()
    ok = True
    for off, (name, acc) in EXPECT.items():
        got = fields.get(off)
        good = got is not None and got["accessor"] == acc
        if off == 0x0e:
            good = good and got["powerId"] == 0
        print(f"  0x{off:x}: {'OK' if good else 'FAIL'} "
              f"(want {acc}, got {got['accessor'] if got else None})")
        ok = ok and good
    # the corrected ordering: maxHp offset must be < curHp offset AND come from GetPower/GetHp
    print("  HP-pair order corrected (0xe=maxHp, 0x10=curHp):",
          "OK" if fields.get(0x0e, {}).get("accessor") == "GetPower"
          and fields.get(0x10, {}).get("accessor") == "GetHp" else "FAIL")
    print("verify_battlemon_init:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
