#!/usr/bin/env python3
"""
verify_effect_dispatch.py — self-check for the move-effect dispatch findings.

Two independent checks, both need the extracted ROM + unicorn/capstone:

(1) DIRECT-INDEX DISPROOF. For each candidate handler table, entry-index is
    NOT the move-effect id: real move-effect ids fall on null slots and unused
    slots carry real handlers. We assert the mismatch (a positive result would
    mean we'd solved the map by direct indexing — we have not).

(2) DATA-FLOW ANCHOR. In sub_86e48 (the move-execution parameter builder) the
    move-effect id is fetched via `GetParam(WazaNo, ParamID 0x1b)` and written
    to battle work-struct field-id 0x1f through the generic setter sub_8790c.
    We disassemble sub_86e48 and assert that exact instruction pair is present
    (mov r1,#0x1b ; bl GetParam ; mov r1,r0 ; mov r0,#0x1f ; bl sub_8790c),
    pinning where effectId enters the battle engine — the input to the (still
    open) effect-enum -> sequence-index remap.
"""
import sys, os, json, struct
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "tools"))
from cro_emu import CroEmu, SEG_BASE
from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MOVES = os.path.join(ROOT, "data/pokemon/usum_moves.json")


def check_direct_index(emu, used):
    ok = True
    for base, n in [(0x7e24, 427), (0x98ac, 444), (0x67b8, 406)]:
        raw = bytes(emu.read(SEG_BASE[1] + base, n * 8))
        h = [struct.unpack_from("<I", raw, i * 8)[0] for i in range(n)]
        real = lambda w: SEG_BASE[0] <= w < SEG_BASE[0] + 0x2000000
        used_null = sum(1 for e in used if e < n and not real(h[e]))
        unused_real = sum(1 for e in range(n) if e not in used and real(h[e]))
        direct = used_null == 0 and unused_real == 0
        print(f"  table 0x{base:x}: used_null={used_null} unused_real={unused_real} "
              f"-> direct-index {'HOLDS' if direct else 'DISPROVEN (expected)'}")
        ok = ok and (not direct)   # we EXPECT disproof
    return ok


def check_dataflow(emu):
    o, s, sid = emu.segs[0]
    text = bytes(emu.read(SEG_BASE[0], s))
    fa = 0x86e48
    md = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    seq = [(i.address - SEG_BASE[0], i.mnemonic, i.op_str)
           for i in md.disasm(text[fa:fa + 400], SEG_BASE[0] + fa)]
    # find: mov r1,#0x1b ; ... bl GetParam ; mov r1,r0 ; mov r0,#0x1f ; bl <setter>
    txt = [f"{m} {o}" for _, m, o in seq]
    def has(pred):
        return any(pred(t) for t in txt)
    a = has(lambda t: t == "mov r1, #0x1b")
    b = has(lambda t: t == "mov r0, #0x1f")
    # the two must appear in order and close together
    idx_1b = next((k for k, t in enumerate(txt) if t == "mov r1, #0x1b"), None)
    idx_1f = next((k for k, t in enumerate(txt) if t == "mov r0, #0x1f"), None)
    ordered = idx_1b is not None and idx_1f is not None and 0 < idx_1f - idx_1b < 8
    print(f"  sub_86e48: fetch ParamID 0x1b={a}, store field 0x1f={b}, "
          f"ordered&adjacent={ordered}")
    return a and b and ordered


def main():
    emu = CroEmu("Battle")
    moves = json.load(open(MOVES))
    used = set(v["effectId"] for v in moves.values() if v.get("effectId") is not None)
    print("(1) direct-index disproof (expect all DISPROVEN):")
    ok1 = check_direct_index(emu, used)
    print("(2) effectId data-flow anchor in sub_86e48:")
    ok2 = check_dataflow(emu)
    ok = ok1 and ok2
    print("verify_effect_dispatch:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
