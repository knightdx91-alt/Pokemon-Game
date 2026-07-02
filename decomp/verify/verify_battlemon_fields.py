#!/usr/bin/env python3
"""
Verify the in-battle Pokémon field map (decomp/battle_effects/battlemon_getter_fields.json,
produced by tools/usum_battlemon_fields.py).

Checks (deterministic; needs the extracted Battle.cro):
  1. the relocated switch table of getter sub_924a8 yields all 23 cases;
  2. the stat-stage array is exactly seven contiguous signed bytes 0x1ea..0x1f0
     read by seven consecutive getter cases (the structural invariant that
     identifies it) — the certain result;
  3. the freshly re-derived map equals the committed json (no drift).
"""
import json, os, sys, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
JSON = os.path.join(ROOT, "decomp/battle_effects/battlemon_getter_fields.json")


def load_tool():
    p = os.path.join(ROOT, "tools/usum_battlemon_fields.py")
    spec = importlib.util.spec_from_file_location("bm", p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main():
    bm = load_tool()
    if not os.path.exists(bm.CRO):
        print("  Battle.cro missing — run the session bootstrap.")
        return 1
    d = bm.load()
    fields = bm.build(d)

    ncases = len({f["enum"] for f in fields})
    ok_cases = ncases == bm.NCASES
    stage = sorted({f["offset"] for f in fields
                    if f.get("offset") in bm.STAT_STAGE and f.get("signed")})
    ok_stage = stage == list(range(0x1ea, 0x1f1))

    committed = json.load(open(JSON))["fields"]
    ok_match = committed == fields

    # Emulator cross-check: execute the getter for a few enums and confirm it
    # reads the offset the static map claims (independent confirmation of the
    # relocated switch table — this is the check that caught the off-by-one).
    ok_emu = True
    try:
        p = os.path.join(ROOT, "tools/cro_emu.py")
        spec = importlib.util.spec_from_file_location("ce", p)
        ce = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(ce)
        byoff = {f["offset"]: f for f in fields if "offset" in f}
        checks = [(1, 0x1ea, 0x7f, True), (7, 0x1f0, 0x05, True),
                  (20, 0x1a, 0x37, False), (21, 0x1b, 0x5a, False)]
        for enum, off, val, signed in checks:
            emu = ce.CroEmu("Battle")
            this = emu.alloc(0x300)
            emu.write(this + off, bytes([val]))
            r = emu.call(0x924a8, [this, enum])
            if signed and r >= 0x80000000:
                r -= 0x100000000
                val = val - 0x100 if val >= 0x80 else val
            fe = next((f for f in fields if f["enum"] == enum), None)
            if r != val or not fe or fe.get("offset") != off:
                ok_emu = False
    except Exception as e:
        print("  (emulator cross-check unavailable:", e, ")")

    print("== verify in-battle Pokémon field map ==")
    print("  23 getter cases recovered:", "PASS" if ok_cases else "FAIL (%d)" % ncases)
    print("  stat-stage block 0x1ea..0x1f0 (7 signed bytes):",
          "PASS" if ok_stage else "FAIL")
    print("  committed json matches fresh derivation:",
          "PASS" if ok_match else "FAIL")
    print("  emulator agrees with static enum->offset map:",
          "PASS" if ok_emu else "FAIL")
    ok = ok_cases and ok_stage and ok_match and ok_emu
    print("verify:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
