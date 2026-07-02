#!/usr/bin/env python3
"""Phase 3b: per-module call graph with veneer-resolved cross-module edges.

Linearly disassembles a module's text (ARM) and records every direct
`bl`/`b`/`blx` edge, resolving targets through:
  - the module's function table (decomp/functions/<mod>.json) -> local callee
  - the module's import veneers (decomp/map/<mod>.json) -> external symbol

Outputs decomp/callgraph/<mod>.json:
  { func_addr: {name, size, calls_local: [...], calls_ext: [symbol,...],
                callers: [addr,...]} }

Also supports queries:
  --callers <mod> <addr>       who calls this function
  --callees <mod> <addr|name>  what this function calls
  --find <mod> <symbol-substr> functions whose external calls match

Note: ARM-only linear sweep — Thumb regions produce some noise/misses, but
direct call edges among ARM functions (the bulk of the battle engine) resolve
well. Good enough to trace pipelines like the damage/effect chain.
"""
import argparse
import bisect
import json
import re
import sys
from pathlib import Path

from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM

FUNC = Path('decomp/functions')
MAP = Path('decomp/map')
OUT = Path('decomp/callgraph')
ROM = Path('source/3ds/ultramoon')


def load(mod):
    rec = json.loads((MAP / f'{mod}.json').read_text())
    funcs = sorted(json.loads((FUNC / f'{mod}.json').read_text()),
                   key=lambda f: f['addr'])
    text = next(s for s in rec['segments'] if s['id'] == 0 and s['size'])
    if rec['module'].endswith('.crs'):
        code = (ROM / 'exefs/.code').read_bytes()[:text['size']]
    else:
        raw = (ROM / 'romfs' / rec['module']).read_bytes()
        code = raw[text['offset']:text['offset'] + text['size']]
    veneers = {int(k): v for k, v in rec.get('veneers', {}).items()}
    return funcs, code, veneers


def build(mod):
    funcs, code, veneers = load(mod)
    addrs = [f['addr'] for f in funcs]
    names = {f['addr']: f['name'] for f in funcs}

    def enc(off):
        i = bisect.bisect_right(addrs, off) - 1
        if i < 0:
            return None
        f = funcs[i]
        return f if f['addr'] <= off < f['addr'] + f['size'] else None

    md = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    graph = {f['addr']: {'name': f['name'], 'size': f['size'],
                         'calls_local': set(), 'calls_ext': set(),
                         'callers': set()} for f in funcs}
    for ins in md.disasm(code, 0):
        if ins.mnemonic not in ('bl', 'b', 'blx') or not ins.op_str.startswith('#'):
            continue
        tgt = int(ins.op_str[1:], 0)
        caller = enc(ins.address)
        if not caller:
            continue
        if tgt in veneers:
            graph[caller['addr']]['calls_ext'].add(veneers[tgt])
        elif tgt in names and tgt != caller['addr']:
            graph[caller['addr']]['calls_local'].add(tgt)
            graph[tgt]['callers'].add(caller['addr'])
    # serialise
    ser = {}
    for a, g in graph.items():
        ser[f'{a:#x}'] = {
            'name': g['name'], 'size': g['size'],
            'calls_local': sorted(f'{x:#x}' for x in g['calls_local']),
            'calls_ext': sorted(g['calls_ext']),
            'callers': sorted(f'{x:#x}' for x in g['callers']),
        }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f'{mod}.json').write_text(json.dumps(ser, indent=0))
    return ser


def load_or_build(mod):
    p = OUT / f'{mod}.json'
    return json.loads(p.read_text()) if p.exists() else build(mod)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--build', metavar='MOD')
    ap.add_argument('--callers', nargs=2, metavar=('MOD', 'ADDR'))
    ap.add_argument('--callees', nargs=2, metavar=('MOD', 'ADDR'))
    ap.add_argument('--find', nargs=2, metavar=('MOD', 'SUBSTR'))
    args = ap.parse_args()

    if args.build:
        g = build(args.build)
        print(f'built {args.build}: {len(g)} functions')
    elif args.callers:
        mod, addr = args.callers
        g = load_or_build(mod)
        key = addr if addr.startswith('0x') else f'0x{int(addr,16):x}'
        node = g.get(key)
        if not node:
            sys.exit(f'no function {key}')
        print(f'callers of {node["name"]} ({key}):')
        for c in node['callers']:
            print(f'  {c} {g[c]["name"]} (size {g[c]["size"]})')
    elif args.callees:
        mod, addr = args.callees
        g = load_or_build(mod)
        key = addr if addr.startswith('0x') else next(
            (k for k, v in g.items() if addr in v['name']), None)
        node = g.get(key)
        if not node:
            sys.exit(f'no function {addr}')
        print(f'{node["name"]} ({key}) calls:')
        for c in node['calls_local']:
            print(f'  local {c} {g[c]["name"]}')
        for e in node['calls_ext']:
            print(f'  ext   {e}')
    elif args.find:
        mod, sub = args.find
        g = load_or_build(mod)
        hits = [(k, v) for k, v in g.items()
                if any(sub in e for e in v['calls_ext'])]
        print(f'{len(hits)} functions in {mod} calling *{sub}*:')
        for k, v in sorted(hits, key=lambda kv: -kv[1]['size']):
            ext = [e for e in v['calls_ext'] if sub in e]
            print(f'  {k} {v["name"]} size={v["size"]} -> {ext}')
    else:
        ap.print_help()


if __name__ == '__main__':
    sys.exit(main())
