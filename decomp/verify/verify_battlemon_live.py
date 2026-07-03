#!/usr/bin/env python3
"""
verify_battlemon_live.py — confirm the pml::battle in-RAM Pokémon struct field
offsets against a REAL live-battle capture (the payoff of the Citra memory route).

Two battlemon structs were carved from a 256 MB FCRAM dump taken at the move-select
menu of a wild battle on Route 4 (OT Lylliana's save): the active Volcanion
(Lv85) and the wild Grubbin (Lv13). Ground-truth values come from the battle UI
+ the save (party slot 0 moves 592/257/56/153) + PokeAPI-known species data.

Unlike the earlier static recovery (offsets from getter sub_924a8's switch, names
"best-effort"), these offsets are now CONFIRMED by matching known values in a real
in-battle object. Fixtures: decomp/verify/fixtures/battlemon_{volcanion,grubbin}.bin
(0x240 bytes each — runtime battle objects derived from the user's own save mons,
not ROM bytes).
"""
import os, struct, sys

FX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")

# (name, expected species, level, hp, ability, [move ids], [move pp])
CASES = [
    ("volcanion", 721, 85, 260, 11, [592, 257, 56, 153], [5, 10, 5, 5]),   # abil 11 = Water Absorb
    ("grubbin",   736, 13,  39, 68, [81, 189, 44, 450],   [40, 10, 25, 20]),  # abil 68 = Swarm
]


def check(name, species, level, hp, ability, moves, pp):
    d = open(os.path.join(FX, f"battlemon_{name}.bin"), "rb").read()
    u16 = lambda o: struct.unpack_from("<H", d, o)[0]
    ok = True

    def eq(label, got, want):
        nonlocal ok
        good = got == want
        ok = ok and good
        print(f"    {'OK ' if good else 'BAD'} {label}: {got} (want {want})")

    print(f"  == {name} ==")
    eq("species @0x0c", u16(0x0c), species)
    eq("level   @0x18", d[0x18], level)
    eq("hp      @0x0e", u16(0x0e), hp)     # maxHp (== curHp at full)
    eq("hp      @0x10", u16(0x10), hp)     # curHp
    eq("ability @0x16", u16(0x16), ability)
    eq("stages  @0x1ea..0x1f0 (neutral=6)", list(d[0x1ea:0x1f1]), [6] * 7)
    for k in range(4):
        base = 0x1fc + k * 0xe          # 4 move records, 0xe bytes each
        eq(f"move{k} id  @0x{base:x}", u16(base), moves[k])
        eq(f"move{k} curPP@0x{base+2:x}", d[base + 2], pp[k])
        eq(f"move{k} maxPP@0x{base+3:x}", d[base + 3], pp[k])
    return ok


def main():
    allok = all(check(*c) for c in CASES)
    print("\nverify_battlemon_live:", "PASS" if allok else "FAIL")
    sys.exit(0 if allok else 1)


if __name__ == "__main__":
    main()
