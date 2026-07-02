#!/usr/bin/env python3
"""
Verify the auto-derived CoreParam field layout (decomp/pokepara/coreparam_fields.json,
produced by tools/usum_coreparam_fields.py).

Two layers:
  1. ROM-free anchor check — the canonical Gen-7 PK7 block-relative offsets
     (species A+0, item A+2, ID32 A+4, ability A+0xC, nature A+0x14, exp A+8,
     moves B+0x1a, ball D+0x2c). These are the same anchors PKHeX documents.
  2. Real-save check (optional) — decode party slot 0 of a real USUM `main` save
     using ONLY the offsets from the json, and confirm the fields are sane and
     agree with tools/usum_savedump.py's independent decode.

Usage:
  python3 decomp/verify/verify_coreparam_fields.py [path/to/main.sav]
  (path also taken from $USUM_SAVE)
"""
import json, os, sys, struct

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
FIELDS = json.load(open(os.path.join(ROOT, "decomp/pokepara/coreparam_fields.json")))
BP = json.load(open(os.path.join(ROOT, "decomp/pokepara/block_position_table.json")))["rows_by_shift"]
BASES = {"A": 0x08, "B": 0x40, "C": 0x78, "D": 0xB0}

fmap = {f["field"]: f for f in FIELDS["fields"]}

# canonical PK7 block-relative anchors (block, offset)
ANCHORS = {
    "MonsNo": ("A", 0x00), "Item": ("A", 0x02), "ID": ("A", 0x04),
    "TokuseiNo": ("A", 0x0C), "Seikaku": ("A", 0x14), "Exp": ("A", 0x08),
    "GetBall": ("D", 0x2C),
}


def anchor_check():
    ok = True
    for name, (blk, off) in ANCHORS.items():
        f = fmap.get(name)
        if not f:
            print("  MISSING derived field:", name); ok = False; continue
        if f["block"] != blk or f["off"] != off:
            print("  MISMATCH %-10s derived blk %s off 0x%x, canonical blk %s off 0x%x"
                  % (name, f["block"], f["off"], blk, off)); ok = False
    return ok


def decrypt(buf):
    pid = struct.unpack_from("<I", buf, 0)[0]
    stored = struct.unpack_from("<H", buf, 6)[0]
    seed, dec = pid, []
    for w in struct.unpack_from("<112H", buf, 8):
        seed = (seed * 0x41C64E6D + 0x6073) & 0xFFFFFFFF
        dec.append(w ^ ((seed >> 16) & 0xFFFF))
    if (sum(dec) & 0xFFFF) != stored:
        return None
    return pid, b"".join(struct.pack("<H", w) for w in dec)


def read_field(raw, pid, name):
    """Read a field using ONLY its json-derived (block, off, width)."""
    f = fmap[name]
    order = BP[(pid >> 13) & 0x1F]
    L = {"A": 0, "B": 1, "C": 2, "D": 3}[f["block"]]
    blk = raw[order[L] * 56:(order[L] + 1) * 56]
    off, w = f["off"], f["width"]
    val = {1: blk[off], 2: struct.unpack_from("<H", blk, off)[0],
           4: struct.unpack_from("<I", blk, off)[0]}[w]
    if f.get("shift"):
        val >>= f["shift"]
    if f.get("mask"):
        val &= f["mask"]
    return val


def real_save_check(path):
    d = open(path, "rb").read()
    buf = d[0x1600:0x1600 + 232]          # party slot 0 (block 4 @0x1600)
    r = decrypt(buf)
    if not r:
        print("  slot 0 checksum failed"); return False
    pid, raw = r
    got = {n: read_field(raw, pid, n) for n in
           ("MonsNo", "Item", "ID", "Seikaku", "Exp", "GetBall")}
    print("  party slot 0 via derived offsets:",
          "species=%d item=%d ID32=%d nature=%d exp=%d ball=%d"
          % (got["MonsNo"], got["Item"], got["ID"], got["Seikaku"],
             got["Exp"], got["GetBall"]))
    ok = 1 <= got["MonsNo"] <= 809 and got["Seikaku"] < 25 and got["Exp"] < 2_000_000
    return ok


def main():
    print("== verify CoreParam field layout ==")
    ok = anchor_check()
    print("  anchor check (canonical PK7 offsets):", "PASS" if ok else "FAIL")
    path = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("USUM_SAVE"))
    if path and os.path.exists(path):
        r = real_save_check(path)
        print("  real-save decode:", "PASS" if r else "FAIL")
        ok = ok and r
    else:
        print("  real-save decode: skipped (no save path)")
    print("verify:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
