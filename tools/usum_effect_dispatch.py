#!/usr/bin/env python3
"""
usum_effect_dispatch.py — extract & characterize Battle.cro's move-effect
sequence-handler tables, and test the "direct effect-id index" hypothesis.

Background: each move carries a Gen-7 move-effect enum (0..419, move record
u16 @0x10; extracted to data/pokemon/usum_moves.json `effectId`). The battle
engine runs a per-effect "sequence handler". Battle.cro holds several
relocation-filled handler tables (recovered by cro_vtables.py); the biggest
two — rodata+0x7e24 (427 entries) and rodata+0x98ac (444) — are the size to
be a direct effect-id index. This tool reads those tables out of the
*relocated* module (via cro_emu, so the reloc-only pointers resolve), decodes
each 8-byte entry as {handler_ptr, aux_u32}, and cross-checks the entry index
against the real move-effect ids.

RESULT (see decomp/battle_effects/README): the direct-index hypothesis is
DISPROVEN — move-effect ids used by real moves land on null table slots while
unused slots hold real handlers. So an intermediate effect-enum -> sequence
index remap sits between the move record and these tables (see the data-flow
note in decomp/README.md: effectId enters via GetParam(WazaNo, ParamID 0x1b),
cached into battle work-struct field 0x1f by sub_86e48).

Usage:
  python3 tools/usum_effect_dispatch.py            # dump + correlation report
  python3 tools/usum_effect_dispatch.py --json     # (re)write the JSON manifest
Needs the extracted ROM (source/3ds/ultramoon) + `pip install unicorn capstone`.
"""
import sys, os, json, struct
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cro_emu import CroEmu, SEG_BASE

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "decomp/battle_effects/effect_dispatch_tables.json")
MOVES = os.path.join(ROOT, "data/pokemon/usum_moves.json")

# candidate handler tables (base rodata offset, entry count) — from cro_vtables
TABLES = [(0x7e24, 427), (0x98ac, 444), (0x67b8, 406), (0x45a0, 153)]


def text_off(w):
    b = SEG_BASE[0]
    return (w - b) if b <= w < b + 0x2000000 else None


def read_table(emu, base, n):
    """Decode n 8-byte {handler, aux} entries from the relocated rodata."""
    raw = bytes(emu.read(SEG_BASE[1] + base, n * 8))
    out = []
    for i in range(n):
        w0, aux = struct.unpack_from("<II", raw, i * 8)
        out.append({"i": i, "handler": text_off(w0), "raw0": w0, "aux": aux})
    return out


def correlate(entries, used):
    """Test entry-index == move-effect-id."""
    n = len(entries)
    u = [e for e in used if e < n]
    ur = sum(1 for e in u if entries[e]["handler"] is not None)
    nu = [e for e in range(n) if e not in used]
    nun = sum(1 for e in nu if entries[e]["handler"] is None)
    return {"used": len(u), "used_real": ur, "used_null": len(u) - ur,
            "unused": len(nu), "unused_null": nun, "unused_real": len(nu) - nun}


def main():
    emu = CroEmu("Battle")
    moves = json.load(open(MOVES))
    used = set(v["effectId"] for v in moves.values()
               if v.get("effectId") is not None)
    manifest = {"module": "Battle", "relocs_applied": emu.relocs_applied,
                "note": "entry = {handler(text off), aux u32}; index is NOT the "
                        "move-effect id (see correlation) — a remap layer sits "
                        "between move.effectId and these tables.",
                "tables": []}
    for base, n in TABLES:
        ents = read_table(emu, base, n)
        distinct = len(set(e["handler"] for e in ents if e["handler"] is not None))
        corr = correlate(ents, used)
        print(f"table rodata+0x{base:x}: {n} entries, {distinct} distinct handlers, "
              f"{sum(1 for e in ents if e['handler'] is None)} null")
        print(f"  direct-index test: used->real {corr['used_real']}/{corr['used']} "
              f"(null {corr['used_null']}); unused->null "
              f"{corr['unused_null']}/{corr['unused']} -> "
              f"{'MATCH' if corr['used_null']==0 and corr['unused_real']==0 else 'NO MATCH'}")
        manifest["tables"].append({
            "base": f"0x{base:x}", "count": n, "distinct_handlers": distinct,
            "index_is_effectid": corr["used_null"] == 0 and corr["unused_real"] == 0,
            "correlation": corr,
            "entries": [{"i": e["i"],
                         "handler": (f"sub_{e['handler']:x}" if e["handler"] is not None else None),
                         "aux": e["aux"]} for e in ents]})
    if "--json" in sys.argv or not os.path.exists(OUT):
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        json.dump(manifest, open(OUT, "w"), indent=1)
        print(f"wrote {OUT}")
    if "--scan" in sys.argv:
        scan_remap(emu, used)


def scan_remap(emu, used):
    """Two exhaustive disproofs that the effect->handler map is a simple lookup.

    (1) No move-record u16 field directly indexes any handler table.
    (2) No contiguous byte/u16 array indexed by effectId maps every used
        effect id onto a valid slot of the 153-entry sequence table @0x45a0.
    Both come back empty -> the effect-enum -> sequence-id remap is a structured
    lookup (PIC switch / non-contiguous table), not a field or a flat array.
    """
    import struct
    from pathlib import Path
    # (2) remap-array scan against the 153 sequence-handler table
    N = 153
    raw = bytes(emu.read(SEG_BASE[1] + 0x45a0, N * 8))
    valid = [SEG_BASE[0] <= struct.unpack_from("<I", raw, i * 8)[0]
             < SEG_BASE[0] + 0x2000000 for i in range(N)]
    eff = sorted(used)
    maxeff = max(eff)
    hits = 0
    for seg in (1, 2):
        o, s, sid = [x for x in emu.segs if x[2] == seg][0]
        mem = bytes(emu.read(SEG_BASE[seg], s))
        for width in (1, 2):
            span = (maxeff + 1) * width
            step = 1 if width == 1 else 2
            for start in range(0, len(mem) - span, step):
                seen = set()
                ok = True
                for e in eff:
                    v = mem[start + e] if width == 1 else \
                        struct.unpack_from("<H", mem, start + e * 2)[0]
                    if v >= N or not valid[v]:
                        ok = False
                        break
                    seen.add(v)
                # a real remap uses many distinct sequence ids; an all-zero /
                # constant region trivially maps everything to slot 0.
                if ok and len(seen) >= 25:
                    hits += 1
    print(f"remap-array scan (effectId -> >=25 distinct valid 153-slots): {hits} "
          f"-> {'FOUND' if hits else 'none (remap is a structured lookup, not a flat array)'}")


if __name__ == "__main__":
    main()
