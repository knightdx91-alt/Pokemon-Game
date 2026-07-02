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

    print("== verify in-battle Pokémon field map ==")
    print("  23 getter cases recovered:", "PASS" if ok_cases else "FAIL (%d)" % ncases)
    print("  stat-stage block 0x1ea..0x1f0 (7 signed bytes):",
          "PASS" if ok_stage else "FAIL")
    print("  committed json matches fresh derivation:",
          "PASS" if ok_match else "FAIL")
    ok = ok_cases and ok_stage and ok_match
    print("verify:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
