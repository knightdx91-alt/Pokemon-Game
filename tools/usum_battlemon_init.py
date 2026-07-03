#!/usr/bin/env python3
"""
usum_battlemon_init.py — name the in-battle Pokémon struct fields from the
initializer's data flow.

The `btl` engine is symbol-stripped, so the runtime battle-pokemon struct has
no named accessors. But the struct is *built* from a CoreParam by one function,
`sub_6188c` (Battle.cro), which is a straight-line copy:

    ldr r0,[r5] ; bl CoreParam::GetXxx ; str{b,h} r0,[r4,#OFF]

so each destination offset is *named by the accessor that feeds it* — the same
verifiable, no-guessing method used for CoreParam (`usum_coreparam_fields.py`).
This disassembles the initializer, follows the `bl <getter>` → `str[bh] [r4+off]`
pairs (resolving the getter through the import veneer table), and emits
`decomp/battle_effects/battlemon_init_fields.json` plus a refreshed
`decomp/src/pml/battle/BattlePokemon.h`.

Usage: python3 tools/usum_battlemon_init.py [--json]
Needs source/3ds/ultramoon + `pip install unicorn capstone`.
"""
import sys, os, json, struct
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cro_emu import CroEmu, SEG_BASE
from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INIT_FN = 0x6188c
OUT = os.path.join(ROOT, "decomp/battle_effects/battlemon_init_fields.json")

# PowerID enum (pml::pokepara::PowerID) — GetPower(id)/GetEffortPower(id)
POWER = {0: "Hp", 1: "Atk", 2: "Def", 3: "SpAtk", 4: "SpDef", 5: "Speed"}
# short semantic name per source accessor
NAME = {
    "GetMonsNo": "monsNo",       # species
    "GetHp": "curHp",
    "GetItem": "heldItem",
    "GetTokuseiNo": "tokuseiNo",  # ability
    "GetLevel": "level",
    "GetFormNo": "formNo",        # packed into a bitfield
    "GetSick": "sickCode",        # status condition
    "HavePokerusUntilNow": "pokerus",
}


def veneer_targets():
    d = json.load(open(os.path.join(ROOT, "decomp/map/Battle.json")))
    t = {}
    for imp in d["imports"]:
        nm = imp["demangled"]
        if "CoreParam::" not in nm and "Pokerus" not in nm:
            continue
        short = nm.split("(")[0].split("::")[-1]
        for p in imp["patches"]:
            if p["seg"] == 0:
                t[p["offset"] - 4] = short   # ldr-pc veneer thunk sits 4B before patch
    return t


def main():
    emu = CroEmu("Battle")
    o, s, sid = emu.segs[0]
    text = bytes(emu.read(SEG_BASE[0], s))
    vt = veneer_targets()
    md = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    fn = next(f for f in json.load(open(os.path.join(ROOT, "decomp/functions/Battle.json")))
              if f["addr"] == INIT_FN)
    ins = list(md.disasm(text[INIT_FN:INIT_FN + fn["size"]], SEG_BASE[0] + INIT_FN))

    fields = {}
    last_call = None      # (accessor, powerid_or_None)
    pending_powerid = 0
    for i, x in enumerate(ins):
        m, ops = x.mnemonic, x.op_str
        if m == "mov" and ops.startswith("r1, #"):        # PowerID arg
            try: pending_powerid = int(ops.split("#")[1], 0)
            except ValueError: pending_powerid = None
        elif m == "bl":
            # op_str is an absolute target like "#0x10001118"
            toff = None
            try: toff = int(ops.lstrip("#"), 0) - SEG_BASE[0]
            except ValueError: toff = None
            acc = vt.get(toff)
            last_call = (acc, pending_powerid) if acc else None
        elif m in ("ldr", "ldrb", "ldrh", "mov", "mvn") and ops.startswith("r0"):
            # r0 replaced by a fresh value (not a transform of the return) -> stale.
            # and/orr/bic/lsl/lsr/uxt* are treated as value-preserving masks of the
            # accessor result (e.g. formNo = GetFormNo() & 0x1f).
            last_call = None
        if m in ("strh", "strb") and last_call and "[r4, #" in ops:
            off = int(ops.split("[r4, #")[1].rstrip("]"), 0)
            acc, pid = last_call
            base = NAME.get(acc, acc)
            if acc in ("GetPower", "GetEffortPower"):
                stat = POWER.get(pid, f"p{pid}")
                base = ("maxHp" if (acc == "GetPower" and pid == 0)
                        else ("ev" + stat if acc == "GetEffortPower" else "power" + stat))
            fields[off] = {"name": base, "accessor": acc,
                           "powerId": pid if acc in ("GetPower", "GetEffortPower") else None,
                           "width": 2 if m == "strh" else 1}
            last_call = None

    out = {"struct": "pml::battle in-RAM Pokemon", "init_fn": f"sub_{INIT_FN:x}",
           "note": "field offset -> the CoreParam accessor that initializes it in "
                   "sub_6188c (verifiable data flow, no guessing).",
           "fields": {f"0x{k:x}": v for k, v in sorted(fields.items())}}
    for off, f in sorted(fields.items()):
        pid = f"({f['powerId']})" if f["powerId"] is not None else ""
        print(f"  0x{off:<4x} {f['name']:<12} <- CoreParam::{f['accessor']}{pid} "
              f"[{f['width']}B]")
    if "--json" in sys.argv or not os.path.exists(OUT):
        json.dump(out, open(OUT, "w"), indent=1)
        print(f"wrote {OUT}")
    return fields


if __name__ == "__main__":
    main()
