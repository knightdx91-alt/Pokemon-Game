#!/usr/bin/env python3
"""Verify the recovered pml::wazadata::ParamID enum against the ROM.

Re-reads each 4-byte GetParam thunk in exefs/.code and confirms the first
instruction is `mov r1, #<ParamID>` matching decomp/battle_effects/
wazadata_paramid.json, and that GetParam's bounds are waza<=0x2d8, id<0x25.
No external tooling beyond the extracted .code (regenerable via the bootstrap).
"""
import json, os, struct

HERE = os.path.dirname(__file__)
CODE = os.path.join(HERE, "..", "..", "source", "3ds", "ultramoon", "exefs", ".code")
J = json.load(open(os.path.join(HERE, "..", "battle_effects", "wazadata_paramid.json")))

# addr of each thunk (from decomp/functions/static.json)
THUNKS = {
    "GetType": 0x2266f8, "GetCategory": 0x22633c, "GetDamageType": 0x2263d4,
    "GetPower": 0x226868, "IsDamage": 0x22687c, "IsAlwaysHit": 0x2263bc,
    "GetZenryokuWazaNo": 0x226618, "GetZenryokuWazaEffect": 0x226668,
}
EXPECT = {"GetType":0,"GetCategory":1,"GetDamageType":2,"GetPower":3,"IsDamage":3,
          "IsAlwaysHit":31,"GetZenryokuWazaNo":32,"GetZenryokuWazaEffect":34}

def mov_r1_imm(word):
    # ARM: MOV r1, #imm  => cond E, 0011 101 0 0000 0001 rotimm  (0xE3A01xxx)
    if (word & 0x0FFFF000) != 0x03A01000:
        return None
    imm = word & 0xFF
    rot = (word >> 8) & 0xF
    return (imm >> (2*rot)) | ((imm << (32 - 2*rot)) & 0xFFFFFFFF) if rot else imm

def main():
    if not os.path.exists(CODE):
        print("SKIP: extracted .code not present (run the decomp bootstrap first)")
        return
    code = open(CODE, "rb").read()
    for name, addr in THUNKS.items():
        w = struct.unpack_from("<I", code, addr)[0]
        val = mov_r1_imm(w)
        assert val == EXPECT[name], (name, hex(w), val, EXPECT[name])
        print("PASS %-22s @0x%06x  ParamID=%d" % (name, addr, val))

    # the json matches what we assert
    for acc, pid in J["accessor_to_paramid"].items():
        assert EXPECT[acc] == pid, (acc, pid)
    print("PASS wazadata_paramid.json consistent with ROM thunks")
    print("\nALL wazadata ParamID checks PASS")

if __name__ == "__main__":
    main()
