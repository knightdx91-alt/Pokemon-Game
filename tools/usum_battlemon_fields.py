#!/usr/bin/env python3
"""
Recover the in-battle Pokémon struct's field map (Ultra Moon, Battle.cro).

Unlike pml::pokepara (which shipped names), the btl engine is symbol-stripped,
so there is no named accessor to read. But the engine funnels field reads
through one indexed getter, sub_924a8(this, fieldEnum), a 23-way switch. The
switch's jump table (text+0x92508) is zero on disk — filled by Battle.cro's
internal relocations — so we:
  1. replay the internal relocation table (header +0x128) to recover the 23
     case -> handler pointers in enum order (deterministic; same mechanism as
     tools/cro_vtables.py), then
  2. disassemble each handler to read the struct offset/width/signedness it
     loads from `this` (r4), including the `mov r0,#imm; ldrsb [r0,r4]` and
     `ldr r0,[pc]; ldrsb [r0,r4]` indexed forms.

The standout result is structural and certain: enum cases 2..8 read seven
*contiguous signed bytes* at 0x1ea..0x1f0 — the battle stat-stage array
(Atk/Def/SpA/SpD/Spe/Acc/Eva, range -6..+6), and cases 9..13 read the same
bytes through sub_81904 (the "apply stage to base stat" path). Semantic names
for the remaining scalar offsets are annotated with confidence; the enum->offset
table itself is exact and reproducible.

Outputs decomp/battle_effects/battlemon_getter_fields.json and
decomp/src/pml/battle/BattlePokemon.h.  --write to refresh them.
"""
import struct, re, os, sys, json
from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRO = os.path.join(ROOT, "source/3ds/ultramoon/romfs/Battle.cro")
JOUT = os.path.join(ROOT, "decomp/battle_effects/battlemon_getter_fields.json")
HOUT = os.path.join(ROOT, "decomp/src/pml/battle/BattlePokemon.h")
GETTER = 0x924a8
JT = 0x92508          # jump-table base (text seg), 23 relocated word slots
NCASES = 23
TEXT_BASE = 384       # Battle.cro text segment file offset
md = Cs(CS_ARCH_ARM, CS_MODE_ARM)
WNAME = {1: "int8/uint8", 2: "uint16", 4: "uint32"}
CTYPE = {(1, False): "uint8_t", (1, True): "int8_t",
         (2, False): "uint16_t", (2, True): "int16_t",
         (4, False): "uint32_t", (4, True): "int32_t"}

# Best-effort semantic labels (confidence noted). The stat-stage block is
# structurally certain; scalars are hypotheses pending a live-battle check.
STAT_STAGE = {0x1ea: "rankAtk", 0x1eb: "rankDef", 0x1ec: "rankSpAtk",
              0x1ed: "rankSpDef", 0x1ee: "rankSpeed", 0x1ef: "rankAccuracy",
              0x1f0: "rankEvasion"}

# Hypotheses for scalar offsets (NOT verified — the struct is runtime-only).
# 0xe/0x10 are the only u16 pair and CatchRate.cpp reads HP through this getter,
# so they are almost certainly {curHP, maxHP}; 0xa0 is masked `tst #7` (a flag
# word). Left un-named in the struct; surfaced only as reviewer hints.
HINTS = {0xe: "u16 HP pair with 0x10 — likely curHP (CatchRate reads HP here)",
         0x10: "u16 HP pair with 0xe — likely maxHP",
         0xa0: "flag word (handler does tst #7)"}


def load():
    if not os.path.exists(CRO):
        sys.exit("ERROR: %s missing — run the session bootstrap." % CRO)
    return open(CRO, "rb").read()


def recover_table(d):
    off = struct.unpack_from("<I", d, 0x128)[0]
    cnt = struct.unpack_from("<I", d, 0x12c)[0]
    lo, hi = JT, JT + NCASES * 4
    hits, o, end = {}, off, off + cnt * 12 + 12
    while o + 12 <= end and o + 12 <= len(d):
        a, b, c = struct.unpack_from("<III", d, o)
        if a == 2 and (c & 0xF) == 0 and lo <= (c >> 4) < hi:
            hits[c >> 4] = b
            o += 12
        else:
            o += 4
    return {(slot - JT) // 4: hits[slot] for slot in hits}


def u32(d, addr):
    return struct.unpack_from("<I", d, addr + TEXT_BASE)[0]


def handler_field(d, addr):
    """Extract (offset, width, signed) that a case handler loads from r4=this."""
    reg = {}
    code = d[addr + TEXT_BASE:addr + TEXT_BASE + 48]
    for ins in md.disasm(code, addr):
        m, op = ins.mnemonic, ins.op_str
        ops = [x.strip() for x in op.split(",")]
        if m == "mov" and len(ops) == 2 and ops[1].startswith("#"):
            reg[ops[0]] = int(ops[1].lstrip("#"), 0)
        elif m == "ldr" and "[pc" in op:
            imm = int(op.split("#")[-1].rstrip("]"), 0) if "#" in op else 0
            reg[ops[0]] = u32(d, ins.address + 8 + imm)
        elif m == "add" and len(ops) == 3 and ops[2].startswith("#"):
            reg[ops[0]] = reg.get(ops[1], 0) + int(ops[2].lstrip("#"), 0)
        elif m in ("ldrb", "ldrsb", "ldrh", "ldrsh", "ldr") and "[" in op:
            w = {"ldrb": 1, "ldrsb": 1, "ldrh": 2, "ldrsh": 2, "ldr": 4}[m]
            sg = m.startswith("ldrs")
            m2 = re.search(r"\[r4,\s*#(0x[0-9a-f]+|\d+)\]", op)
            if m2:
                return int(m2.group(1), 0), w, sg
            mm = re.search(r"\[(\w+),\s*(\w+)\]", op)       # [base,index]
            if mm:
                base, idx = mm.group(1), mm.group(2)
                if idx == "r4" and base in reg:
                    return reg[base], w, sg
                if base == "r4" and idx in reg:
                    return reg[idx], w, sg
            m3 = re.search(r"\[(\w+)\]", op)
            if m3 and m3.group(1) in reg:
                return reg[m3.group(1)], w, sg
        if ins.mnemonic in ("pop", "bx") and ("pc" in ins.op_str or ins.mnemonic == "bx"):
            break
    return None


def build(d):
    table = recover_table(d)
    fields = []
    for enum in range(NCASES):
        h = table.get(enum)
        if h is None:
            continue
        fi = handler_field(d, h)
        if not fi:
            fields.append(dict(enum=enum, handler=hex(h), note="non-field (default/computed)"))
            continue
        off, w, sg = fi
        fields.append(dict(enum=enum, handler=hex(h), offset=off, width=w,
                           signed=sg, name=STAT_STAGE.get(off)))
    return fields


def emit_header(fields):
    stage = sorted({f["offset"] for f in fields
                    if f.get("offset") in STAT_STAGE})
    L = ["// pml::battle in-battle Pokémon struct — partial field map (Ultra Moon)",
         "// AUTO-GENERATED by tools/usum_battlemon_fields.py from the indexed field",
         "// getter sub_924a8 (Battle.cro). The btl engine is symbol-stripped, so",
         "// offsets are recovered from the getter's relocated switch table + the",
         "// per-case loads — the enum->offset mapping is exact/reproducible.",
         "//",
         "// CERTAIN: 0x1ea..0x1f0 are seven contiguous *signed* bytes read by seven",
         "// consecutive getter cases — the stat-stage array. Scalar names elsewhere",
         "// are best-effort (a live-battle dump would confirm them).",
         "#pragma once", "#include <cstdint>", "",
         "namespace pml { namespace battle {", "",
         "// Offsets are into the in-RAM battle-pokemon object (getter arg `this`).",
         "struct BattlePokemonFields {"]
    seen = set()
    for f in sorted((x for x in fields if "offset" in x), key=lambda x: x["offset"]):
        off = f["offset"]
        if off in seen:
            continue
        seen.add(off)
        ct = CTYPE[(f["width"], f["signed"])]
        nm = f.get("name") or ("field_%x" % off)
        if f.get("name"):
            note = ""
        elif off in HINTS:
            note = "  // ? " + HINTS[off]
        else:
            note = "  // semantic TBD"
        L.append("  /* 0x%03x */ %-9s %s;%s" % (off, ct, nm, note))
    L += ["};", "",
          "// getter enum -> field (see battlemon_getter_fields.json):",
          "//   2..8  -> rank{Atk,Def,SpAtk,SpDef,Speed,Accuracy,Evasion} (signed)",
          "//   9..13 -> same first five via sub_81904 (apply-stage-to-stat path)",
          "}} // namespace pml::battle", ""]
    return "\n".join(L)


def main():
    write = "--write" in sys.argv
    d = load()
    fields = build(d)
    # verify: the seven stat-stage bytes are contiguous 0x1ea..0x1f0, signed,
    # each read by a distinct getter case.
    stage_offs = sorted({f["offset"] for f in fields
                         if f.get("offset") in STAT_STAGE and f.get("signed")})
    want = list(range(0x1ea, 0x1f1))
    ok = stage_offs == want
    print("== in-battle Pokémon field getter (sub_924a8) ==")
    for f in fields:
        if "offset" in f:
            print("  enum %2d  off 0x%-4x %-11s %s%s" %
                  (f["enum"], f["offset"], WNAME[f["width"]],
                   "signed " if f["signed"] else "", f.get("name") or ""))
        else:
            print("  enum %2d  %s" % (f["enum"], f.get("note", "")))
    print("\nstat-stage block 0x1ea..0x1f0 (7 signed bytes):",
          "PASS" if ok else "FAIL")
    if write:
        os.makedirs(os.path.dirname(JOUT), exist_ok=True)
        json.dump({"note": "in-battle Pokémon struct field getter sub_924a8 "
                          "enum->offset map, recovered via reloc'd switch table "
                          "(tools/usum_battlemon_fields.py).",
                   "getter": hex(GETTER), "fields": fields},
                  open(JOUT, "w"), indent=1)
        open(HOUT, "w").write(emit_header(fields))
        print("wrote", JOUT); print("wrote", HOUT)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
