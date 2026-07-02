#!/usr/bin/env python3
"""
cro_dataflow.py — light intra-procedural data-flow search over a CRO / static
module's ARM code, for finding functions that consume a particular struct.

Motivation: in USUM the battle `btl` engine is symbol-stripped, so the damage
server is an unnamed `sub_XXXX` that reads a *pre-gathered move-calc block*
(built by Battle.cro `sub_86e48`: power u16 @0x10, type @6, dmgType @7, …)
via a generic field getter rather than the named `pml::wazadata` getters.
Name searches and constant fingerprints therefore can't find it — but a
data-flow query can: "which function loads [ptr+0x10] and multiplies it?".
That query located `sub_18504` (the damage orchestrator) → `sub_81f2c`
(base-damage core) + `sub_84d40` (Q12 ApplyModifier). See decomp/README.md.

This generalises that query. Given a module and a struct offset, it reports
every function that loads that offset and feeds the loaded value into an
arithmetic op (mul/umull/…), optionally requiring companion offsets to be
touched too (to disambiguate which struct).

Usage:
  # find the damage server: who loads move-block +0x10 (power) and multiplies
  python3 tools/cro_dataflow.py Battle --offset 0x10 --load hword \
      --op mul --companions 0x6,0x7,0x14

  # any module (static or a .cro stem from decomp/map/)
  python3 tools/cro_dataflow.py static --offset 0x1c --op div

Needs the decomp analysis layers (decomp/map/, decomp/functions/) and the
extracted ROM (source/3ds/<name>/). capstone required.
"""
import argparse
import json
import struct
import sys
from pathlib import Path

try:
    from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM
    from capstone.arm import ARM_OP_REG, ARM_OP_MEM
except ImportError:
    sys.exit("capstone required: pip install capstone")

ROOT = Path(__file__).parent.parent
MUL_OPS = {'mul', 'mla', 'umull', 'umlal', 'smull', 'smlal', 'smmul'}
LOAD_HWORD = {'ldrh', 'ldrsh'}
LOAD_WORD = {'ldr'}
LOAD_BYTE = {'ldrb', 'ldrsb'}


def find_extraction():
    base = ROOT / 'source' / '3ds'
    if not base.exists():
        sys.exit("no source/3ds/<name>/ extraction — run tools/3ds_decomp.py first")
    for d in sorted(base.iterdir()):
        if (d / 'romfs').exists():
            return d
    sys.exit("no extraction with romfs/ under source/3ds/")


def load_module(module):
    """Return (text_bytes, seg_base_va, funcs sorted by addr)."""
    mapf = ROOT / 'decomp' / 'map' / f'{module}.json'
    fnf = ROOT / 'decomp' / 'functions' / f'{module}.json'
    if not mapf.exists():
        sys.exit(f"no decomp/map/{module}.json (run cro_map.py)")
    m = json.loads(mapf.read_text())
    funcs = sorted(json.loads(fnf.read_text()), key=lambda f: f['addr']) if fnf.exists() else []
    ext = find_extraction()
    if module == 'static':
        text = (ext / 'exefs' / '.code').read_bytes()   # VA == file offset
        return text, 0, funcs
    cro = (ext / 'romfs' / f'{module}.cro').read_bytes()
    s0 = m['segments'][0]
    return cro[s0['offset']:s0['offset'] + s0['size']], 0, funcs


def owner_fn(funcs, va):
    best = None
    for f in funcs:
        if f['addr'] <= va:
            best = f
        else:
            break
    return best


def scan(module, offset, load_kind, op_kind, require_op, companions, min_companions):
    text, _base, funcs = load_module(module)
    md = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    md.detail = True
    load_set = {'hword': LOAD_HWORD, 'word': LOAD_WORD, 'byte': LOAD_BYTE,
                'any': LOAD_HWORD | LOAD_WORD | LOAD_BYTE}[load_kind]
    want_arith = MUL_OPS if op_kind == 'mul' else (
        MUL_OPS | {'bl'} if op_kind == 'div' else MUL_OPS)

    results = []
    for f in funcs:
        a, sz = f['addr'], f.get('size') or 0
        if sz < 16 or sz > 0x4000 or a + sz > len(text):
            continue
        try:
            ins = list(md.disasm(text[a:a + sz], a))
        except Exception:
            continue
        tracked = {}          # reg -> True if it holds [base+offset]
        loads_offset = False
        arith_hit = False
        offs_seen = set()
        for x in ins:
            if x.mnemonic in (LOAD_HWORD | LOAD_WORD | LOAD_BYTE) and len(x.operands) == 2:
                mem = x.operands[1]
                if mem.type == ARM_OP_MEM:
                    offs_seen.add(mem.mem.disp)
                    dst = x.operands[0].reg
                    if mem.mem.disp == offset and x.mnemonic in load_set:
                        tracked[dst] = True
                        loads_offset = True
                    else:
                        tracked.pop(dst, None)   # reg reused for something else
            elif x.mnemonic in want_arith:
                regs = [o.reg for o in x.operands if o.type == ARM_OP_REG]
                if any(tracked.get(r) for r in regs):
                    arith_hit = True
        # A consumer loads the tracked offset; if --op was requested, the loaded
        # value must also feed that op *in the same function* (misses cross-
        # function flow to a callee — orchestrators show up via companions).
        if loads_offset and (not require_op or arith_hit):
            comp = len(companions & offs_seen)
            if comp >= min_companions:
                results.append((comp, arith_hit, f,
                                sorted(o for o in offs_seen if 0 <= o < 0x80)))
    results.sort(key=lambda t: (-t[0], not t[1]))
    return results


def main():
    ap = argparse.ArgumentParser(description='data-flow struct-consumer search')
    ap.add_argument('module', help="module stem (e.g. Battle) or 'static'")
    ap.add_argument('--offset', required=True, help='struct offset to track, e.g. 0x10')
    ap.add_argument('--load', default='any', choices=['hword', 'word', 'byte', 'any'],
                    help='load width for the tracked offset')
    ap.add_argument('--op', default='mul', choices=['mul', 'div'],
                    help='arithmetic to look for (only enforced with --require-op)')
    ap.add_argument('--require-op', action='store_true',
                    help='require the loaded value to feed --op in the SAME function '
                         '(off by default: orchestrators pass it to a callee)')
    ap.add_argument('--companions', default='', help='comma offsets that should also appear')
    ap.add_argument('--min-companions', type=int, default=0)
    args = ap.parse_args()

    offset = int(args.offset, 0)
    companions = {int(c, 0) for c in args.companions.split(',') if c.strip()}
    res = scan(args.module, offset, args.load, args.op, args.require_op,
               companions, args.min_companions)
    print(f"{len(res)} function(s) load [base+{hex(offset)}] ({args.load})"
          f"{' and feed '+args.op if args.require_op else ''}:")
    for comp, arith, f, offs in res[:40]:
        offs_s = ' '.join(hex(o) for o in offs)
        tag = ' *'+args.op if arith else ''
        print(f"  {f['name']:14} @{hex(f['addr'])} size={f.get('size',0):#x} "
              f"companions={comp}{tag}  offsets=[{offs_s}]")


if __name__ == '__main__':
    main()
