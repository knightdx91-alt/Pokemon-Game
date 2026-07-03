#!/usr/bin/env python3
"""
usum_battle_capture.py — analyse a live-battle FCRAM dump (/tmp/fcram.bin from
the Citra autopilot) to (a) resolve Battle.cro's relocated load base and (b)
locate a live battle-pokemon object, then confirm the BattlePokemon.h scalar
field offsets by matching the known party from the user's real save.

This is the "memory route" payoff described in decomp/citra/README.md: the
save carries only CoreParam blobs, not in-battle objects, so the battlemon
scalar names (and, next, the effect->sequence remap) can only be pinned from a
real in-battle RAM image.

Usage: python3 tools/usum_battle_capture.py [/tmp/fcram.bin]
"""
import sys, struct

# The user's USUM save party species (from tools/usum_savedump.py), used as the
# fingerprint to find battlemon objects in RAM. slot0=Magearna(721) etc.
PARTY_SPECIES = [721, 6, 807, 745, 643, 644]
PARTY_SET = set(PARTY_SPECIES)


def find_cro_bases(mem):
    """Every CRO0 module header in the image -> (offset, name)."""
    out = []
    i = 0
    while True:
        i = mem.find(b"CRO0", i)
        if i < 0:
            break
        # CRO header: name pointer is nearby; simpler — grab the module name
        # string that sits shortly after the header magic. Scan a small window
        # for a printable ASCII token.
        name = _nearby_name(mem, i)
        out.append((i, name))
        i += 4
    return out


def _nearby_name(mem, hdr, window=0x400):
    best = None
    j = hdr
    end = min(len(mem), hdr + window)
    cur = bytearray()
    start = 0
    while j < end:
        c = mem[j]
        if 0x20 <= c < 0x7f:
            if not cur:
                start = j
            cur.append(c)
        else:
            if len(cur) >= 4:
                tok = cur.decode()
                # prefer known module names
                for k in ("Battle", "Savedata", "PokeTool", "Field", "gfl2"):
                    if k in tok:
                        return tok
                if best is None:
                    best = tok
            cur = bytearray()
        j += 1
    return best


def find_battlemons(mem):
    """Scan for battle-pokemon objects: species(u16 @+0xc) in the party set,
    with plausible maxHp(@0xe)/curHp(@0x10)/level(@0x18) and the stat-stage
    array @0x1ea..0x1f0 all near the neutral bias 6 (0..12)."""
    hits = []
    # species u16 candidates
    for sp in PARTY_SET:
        pat = struct.pack("<H", sp)
        i = 0
        while True:
            i = mem.find(pat, i)
            if i < 0:
                break
            base = i - 0xc  # this would be the object start
            if base >= 0 and base + 0x1f1 <= len(mem):
                if _validate(mem, base):
                    hits.append((base, sp))
            i += 2
    return hits


def _validate(mem, b):
    maxhp = struct.unpack_from("<H", mem, b + 0xe)[0]
    curhp = struct.unpack_from("<H", mem, b + 0x10)[0]
    level = mem[b + 0x18]
    if not (1 <= level <= 100):
        return False
    if not (1 <= maxhp <= 1000):
        return False
    if curhp > maxhp:
        return False
    stages = mem[b + 0x1ea:b + 0x1f1]
    if len(stages) != 7 or any(s > 12 for s in stages):
        return False
    return True


def report(mem, b, sp):
    maxhp = struct.unpack_from("<H", mem, b + 0xe)[0]
    curhp = struct.unpack_from("<H", mem, b + 0x10)[0]
    item = struct.unpack_from("<H", mem, b + 0x12)[0]
    abil = struct.unpack_from("<H", mem, b + 0x16)[0]
    level = mem[b + 0x18]
    t1, t2 = mem[b + 0x1a], mem[b + 0x1b]
    stages = list(mem[b + 0x1ea:b + 0x1f1])
    print(f"  @0x{b:08x} species={sp} lv={level} hp={curhp}/{maxhp} "
          f"item={item} ability={abil} types=({t1},{t2}) "
          f"stages(+6)={stages}")


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/fcram.bin"
    with open(path, "rb") as f:
        mem = f.read()
    print(f"loaded {len(mem)/1e6:.0f} MB from {path}")

    cros = find_cro_bases(mem)
    print(f"\n== {len(cros)} CRO0 headers ==")
    for off, name in cros[:40]:
        print(f"  0x{off:08x}  {name}")
    for off, name in cros:
        if name and "Battle" in name:
            print(f"  -> Battle.cro relocated base candidate: 0x{off:08x}")

    print("\n== battlemon object candidates ==")
    hits = find_battlemons(mem)
    if not hits:
        print("  none found (not in battle, or offsets differ)")
    for b, sp in hits[:20]:
        report(mem, b, sp)


if __name__ == "__main__":
    main()
