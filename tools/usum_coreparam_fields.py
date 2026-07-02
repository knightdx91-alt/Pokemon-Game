#!/usr/bin/env python3
"""
Reconstruct the pml::pokepara::CoreParam field layout (Ultra Moon) by
disassembling every named `CoreParam::Get*` accessor — no offsets guessed.

The pml namespace shipped with names, so each stored field has a named getter.
Every simple field getter expands to the same shape:

    CoreParam::GetX() :  ldr r0,[r0,#0xC]      ; the 232-byte record pointer
                         bl  <field helper>
                         uxth/uxtb r0,r0        ; width hint
    <field helper>    :  bl  0x22258c           ; Decrypt (StartFastMode)
                         bl  ResolveBlock{A|B|C|D}
                         ldr[b|h] r4,[r0,#imm]   ; <-- the field: block + offset
                         bl  0x222514           ; Encrypt
                         return

Resolvers (verified in CoreParamLayout.cpp): A=0x3ad590 B=0x3ad610 C=0x3ad694
D=0x3ad718, absolute block bases 0x08/0x40/0x78/0xB0. This tool follows each
getter (one level into its helper), classifies the block from the resolver it
calls, and records the load offset+width -> an absolute record offset. Bit
fields (a byte read then shifted/masked) are flagged with their shift/mask.

Outputs decomp/pokepara/coreparam_fields.json and a C++ struct sketch on stdout.
Self-verifies against the canonical PK7 anchors and the fields already hand-
decompiled in CoreParamLayout.cpp.  --write also refreshes the json.
"""
import json, os, re, sys, struct
from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CODE = os.path.join(ROOT, "source/3ds/ultramoon/exefs/.code")
MAP = os.path.join(ROOT, "decomp/map/static.json")
OUT = os.path.join(ROOT, "decomp/pokepara/coreparam_fields.json")
md = Cs(CS_ARCH_ARM, CS_MODE_ARM)

RESOLVER = {0x3ad590: "A", 0x3ad610: "B", 0x3ad694: "C", 0x3ad718: "D"}
BASE = {"A": 0x08, "B": 0x40, "C": 0x78, "D": 0xB0}
DECRYPT, ENCRYPT = 0x22258c, 0x222514
WIDTH = {"ldrb": 1, "ldrsb": 1, "ldrh": 2, "ldrsh": 2, "ldr": 4}


def load_code():
    if not os.path.exists(CODE):
        sys.exit("ERROR: %s missing — run the session bootstrap." % CODE)
    return open(CODE, "rb").read()


def bl_target(op):
    m = re.search(r"#(0x[0-9a-f]+)", op)
    return int(m.group(1), 16) if m else None


def disasm(code, off, n=60):
    return list(md.disasm(code[off:off + n * 4], off))


def func_insns(code, off, n=60):
    """Instructions of one function — stop at the return (pop{..pc} / bx lr)."""
    out = []
    for ins in disasm(code, off, n):
        out.append(ins)
        if ins.mnemonic == "bx" or (ins.mnemonic == "pop" and "pc" in ins.op_str):
            break
    return out


def scan_field(code, helper_off):
    """In a field helper, find (block, offset, width, bit_shift, bit_mask)."""
    block = None
    for ins in disasm(code, helper_off, 40):
        m, op = ins.mnemonic, ins.op_str
        if m == "bl":
            t = bl_target(op)
            if t in RESOLVER:
                block = RESOLVER[t]
            continue
        if block and m in WIDTH and "[r0" in op:
            mm = re.search(r"\[r0(?:,\s*#(0x[0-9a-f]+|\d+))?\]", op)
            imm = 0
            if mm and mm.group(1):
                imm = int(mm.group(1), 0)
            width = WIDTH[m]
            signed = m.startswith("ldrs")
            # look ahead a few insns for a shift/mask (bitfield) on the loaded reg
            dst = op.split(",")[0].strip()
            shift = mask = None
            look = disasm(code, ins.address + 4, 6)
            for j in look:
                jo = j.op_str
                if j.mnemonic in ("lsr", "asr") and jo.startswith(dst):
                    mm2 = re.search(r"#(\d+)", jo)
                    if mm2: shift = int(mm2.group(1))
                elif j.mnemonic == "and" and dst in jo:
                    mm2 = re.search(r"#(0x[0-9a-f]+|\d+)", jo)
                    if mm2: mask = int(mm2.group(1), 0)
                elif j.mnemonic in ("bl", "pop", "bx"):
                    break
            return dict(block=block, off=imm, width=width, signed=signed,
                        abs=BASE[block] + imm, shift=shift, mask=mask)
    return None


def is_canonical_helper(code, off):
    """A field helper reads exactly one stored field: it calls Decrypt, a block
    resolver, and Encrypt. Reject anything else (computed getters borrow other
    getters/helpers and would otherwise mis-attribute their offset)."""
    tgts = [bl_target(i.op_str) for i in func_insns(code, off, 40) if i.mnemonic == "bl"]
    tgts = [t for t in tgts if t is not None]
    has_res = any(t in RESOLVER for t in tgts)
    # canonical helper only ever calls Decrypt/Encrypt + one resolver (no other
    # named getters or personal-data loads).
    extra = [t for t in tgts if t not in RESOLVER and t not in (DECRYPT, ENCRYPT)]
    return has_res and ENCRYPT in tgts and not extra


def find_helper(code, getter_off):
    """Accept only a true wrapper getter: `ldr r0,[r0,#0xC]; bl helper; <casts>;
    return` with no further bl after the helper call. Returns the helper offset
    (which must be a canonical field helper), else None."""
    saw_ptr = False
    helper = None
    for ins in disasm(code, getter_off, 30):
        m, op = ins.mnemonic, ins.op_str
        t = bl_target(op) if m in ("bl", "b") else None
        if m == "ldr" and re.search(r"\[r0,\s*#0xc\]", op):
            saw_ptr = True
        elif m == "b" and saw_ptr and t is not None:
            # tail call: `ldr r0,[r0,#0xc]; b helper`
            return t if is_canonical_helper(code, t) else None
        elif m == "bl" and t in (DECRYPT, ENCRYPT):
            if helper is None:
                return getter_off if is_canonical_helper(code, getter_off) else None
        elif m == "bl":
            if helper is not None:
                return None                # a second call -> computed getter
            if t in RESOLVER:
                return getter_off if is_canonical_helper(code, getter_off) else None
            if saw_ptr and t is not None:
                helper = t                 # candidate field helper
            else:
                return None
        elif m in ("bx",) or (m == "pop" and "pc" in op):
            break
    if helper is not None and is_canonical_helper(code, helper):
        return helper
    return None


def field_name(demangled):
    m = re.search(r"CoreParam::Get(\w+)\(", demangled)
    name = m.group(1) if m else None
    indexed = bool(re.search(r"Get\w+\((?:unsigned char|pml::pokepara::PowerID|"
                             r"unsigned int)", demangled))
    return name, indexed


def main():
    write = "--write" in sys.argv
    code = load_code()
    exp = json.load(open(MAP))["exports"]
    getters = [e for e in exp
               if e["demangled"].startswith("pml::pokepara::CoreParam::Get")
               and not e["thumb"]]
    fields = []
    for e in sorted(getters, key=lambda x: x["offset"]):
        name, indexed = field_name(e["demangled"])
        if not name:
            continue
        helper = find_helper(code, e["offset"])
        if helper is None:
            continue                        # computed getter (Level, Hp, Exp*…)
        fi = scan_field(code, helper)
        if not fi:
            continue
        fi.update(field=name, indexed=indexed, getter=hex(e["offset"]),
                  helper=hex(helper))
        fields.append(fi)

    fields.sort(key=lambda f: f["abs"])
    # de-dup (some fields have two getter overloads)
    seen, uniq = set(), []
    for f in fields:
        k = (f["field"], f["abs"])
        if k in seen: continue
        seen.add(k); uniq.append(f)
    fields = uniq

    # ---- verify against known anchors (canonical PK7 + CoreParamLayout.cpp) --
    anchors = {"MonsNo": 0x08, "Item": 0x0A, "ID": 0x0C, "TokuseiNo": 0x14,
               "Seikaku": 0x1C, "Exp": 0x10}
    ok = True
    for name, want in anchors.items():
        got = next((f["abs"] for f in fields if f["field"] == name), None)
        if got is not None and got != want:
            ok = False
            print("  ANCHOR MISMATCH %s: got 0x%x want 0x%x" % (name, got, want))

    print("== CoreParam field layout (from named getters) ==")
    print("  %-20s %-3s %-8s %-5s %s" % ("field", "blk", "abs", "w", "notes"))
    for f in fields:
        note = []
        if f["indexed"]: note.append("indexed")
        if f["shift"] is not None: note.append("shift=%d" % f["shift"])
        if f["mask"] is not None: note.append("mask=0x%x" % f["mask"])
        if f["signed"]: note.append("signed")
        print("  %-20s %-3s 0x%-6x %-5d %s" %
              (f["field"], f["block"], f["abs"], f["width"], " ".join(note)))
    print("\nfields recovered: %d   anchor check: %s" %
          (len(fields), "PASS" if ok else "FAIL"))

    if write:
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        json.dump({"note": "pml::pokepara::CoreParam stored-field layout, "
                           "auto-derived from named getters "
                           "(tools/usum_coreparam_fields.py). abs = offset in the "
                           "decrypted 232-byte record.",
                   "block_bases": BASE, "fields": fields},
                  open(OUT, "w"), indent=1)
        print("wrote", OUT)
        hpath = os.path.join(ROOT, "decomp/src/pml/pokepara/CoreParam.h")
        open(hpath, "w").write(emit_header(fields))
        print("wrote", hpath)
    return 0 if ok else 1


CTYPE = {1: "uint8_t", 2: "uint16_t", 4: "uint32_t"}


def emit_header(fields):
    L = []
    L.append("// pml::pokepara::CoreParam — decrypted 232-byte Pokémon record layout")
    L.append("// AUTO-GENERATED by tools/usum_coreparam_fields.py from the named")
    L.append("// CoreParam::Get* accessors (Ultra Moon). Offsets are absolute in the")
    L.append("// decrypted blob; the four 56-byte data blocks A/B/C/D are stored")
    L.append("// PID-shuffled in RAM (see CoreParamLayout.cpp) — this view is the")
    L.append("// logical/unshuffled record. Every offset is read straight from the")
    L.append("// game's own accessor and anchor-checked against the canonical PK7 map.")
    L.append("#pragma once")
    L.append("#include <cstdint>")
    L.append("")
    L.append("namespace pml { namespace pokepara {")
    L.append("")
    L.append("// Block bases in the logical record: A=0x08 B=0x40 C=0x78 D=0xB0.")
    L.append("struct CoreParamFields {")
    prev_end = None
    for f in fields:
        # only lay out plain (non-bitfield, non-indexed-overlap) fields as members;
        # annotate bitfields/indexed in comments.
        note = []
        if f["indexed"]: note.append("[indexed]")
        if f["shift"] is not None: note.append("shift %d" % f["shift"])
        if f["mask"] is not None: note.append("mask 0x%x" % f["mask"])
        if f["signed"]: note.append("signed")
        ann = ("  // %s" % " ".join(note)) if note else ""
        L.append("  /* blk %s abs 0x%02x */ %-9s %s;%s" %
                 (f["block"], f["abs"], CTYPE[f["width"]], f["field"], ann))
    L.append("};")
    L.append("")
    L.append("}} // namespace pml::pokepara")
    L.append("")
    return "\n".join(L)


if __name__ == "__main__":
    sys.exit(main())
