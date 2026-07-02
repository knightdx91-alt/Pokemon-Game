#!/usr/bin/env python3
"""Phase 3 of the Ultra Moon decomp: symbol-annotated ARM disassembly.

Works on top of the phase-2 address maps (decomp/map/*.json):

  # build the function tables for every module (committable metadata):
  python3 tools/cro_disasm.py --scan

  # disassemble one function (by demangled-substring or address) to stdout:
  python3 tools/cro_disasm.py Battle "BgSystem::SetUseVram"
  python3 tools/cro_disasm.py static 0x4a40

Code sources (validated empirically):
  - CRO modules: text segment bytes live in the .cro file at seg.offset;
    all addresses are segment-relative (CROs relocate at load).
  - static: the .crs holds only tables; its code is exefs/.code, text at
    file offset 0, VA base 0x100000. Export offsets are file offsets.

Function boundaries = named export addresses + ARM prologue scan
(push/stmfd {...lr}). Each function gets named from exports when known,
else `sub_<addr>`. Import patch sites are used to annotate instructions
whose words get rewritten at load with an imported symbol's address.
"""
import argparse
import bisect
import json
import re
import struct
import sys
from pathlib import Path

from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM, CS_MODE_THUMB

MAP_DIR = Path('decomp/map')
FUNC_DIR = Path('decomp/functions')
ROM = Path('source/3ds/ultramoon')

PROLOGUE_RE = struct.Struct('<I')


def load_module(name):
    """Return (map_record, code_bytes, va_base) for a module stem."""
    rec = json.loads((MAP_DIR / f'{name}.json').read_text())
    text = next(s for s in rec['segments'] if s['id'] == 0 and s['size'])
    if rec['module'].endswith('.crs'):
        code = (ROM / 'exefs/.code').read_bytes()[:text['size']]
        va = 0  # export offsets are already file offsets; VA base 0x100000
    else:
        raw = (ROM / 'romfs' / rec['module']).read_bytes()
        code = raw[text['offset']:text['offset'] + text['size']]
        va = 0  # CRO addresses are segment-relative == offset into code
    return rec, code, va


def scan_functions(rec, code):
    """Function starts: named exports in text + ARM push{...lr} prologues."""
    starts = {}
    for e in rec['exports']:
        if e['seg'] == 0 and e['offset'] < len(code):
            starts[e['offset']] = e['demangled']
    for off in range(0, len(code) - 3, 4):
        w = PROLOGUE_RE.unpack_from(code, off)[0]
        # ARM: push {..., lr} = stmdb sp!, {... lr}  -> 0xE92D4xxx
        if (w & 0xFFFF4000) == 0xE92D4000:
            starts.setdefault(off, None)
    addrs = sorted(starts)
    funcs = []
    for i, a in enumerate(addrs):
        end = addrs[i + 1] if i + 1 < len(addrs) else len(code)
        funcs.append({'addr': a, 'size': end - a,
                      'name': starts[a] or f'sub_{a:x}'})
    return funcs


def patch_annotations(rec):
    """{text_offset: imported symbol} for load-time patched words."""
    ann = {}
    for imp in rec['imports']:
        for p in imp['patches']:
            if p['seg'] == 0:
                ann[p['offset'] & ~3] = imp['demangled']
    return ann


def disasm_function(name, query):
    rec, code, _ = load_module(name)
    funcs = scan_functions(rec, code)
    if re.fullmatch(r'(0x)?[0-9a-fA-F]+', query):
        addr = int(query, 16)
        f = max((f for f in funcs if f['addr'] <= addr), key=lambda f: f['addr'])
    else:
        f = next((f for f in funcs if query in f['name']), None)
    if not f:
        sys.exit(f'no function matching {query!r} in {name}')
    by_addr = {fn['addr']: fn['name'] for fn in funcs}
    ann = patch_annotations(rec)
    md = Cs(CS_ARCH_ARM, CS_MODE_ARM)
    print(f'; {name} :: {f["name"]}  ({f["size"]} bytes at {f["addr"]:#x})')
    for ins in md.disasm(code[f['addr']:f['addr'] + f['size']], f['addr']):
        line = f'{ins.address:08x}  {ins.mnemonic:8s} {ins.op_str}'
        note = ann.get(ins.address)
        if not note and ins.mnemonic in ('bl', 'b', 'blx'):
            m = re.match(r'#(0x[0-9a-f]+|\d+)', ins.op_str)
            if m:
                note = by_addr.get(int(m.group(1), 0))
        print(line + (f'    ; -> {note}' if note else ''))


def scan_all():
    FUNC_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    for mpath in sorted(MAP_DIR.glob('*.json')):
        if mpath.name == 'INDEX.md':
            continue
        stem = mpath.stem
        try:
            rec, code, _ = load_module(stem)
        except (StopIteration, FileNotFoundError):
            continue
        funcs = scan_functions(rec, code)
        named = sum(1 for f in funcs if not f['name'].startswith('sub_'))
        (FUNC_DIR / f'{stem}.json').write_text(json.dumps(funcs, indent=0))
        rows.append((rec['module'], len(funcs), named, len(code)))
        print(f'{rec["module"]:44s} funcs={len(funcs):6d} named={named:5d}')
    with (FUNC_DIR / 'INDEX.md').open('w') as f:
        f.write('# Ultra Moon function tables\n\n')
        f.write(f'{len(rows)} modules — {sum(r[1] for r in rows)} functions '
                f'detected, {sum(r[2] for r in rows)} named from symbols\n\n')
        f.write('| Module | functions | named | text bytes |\n|---|---|---|---|\n')
        for r in rows:
            f.write('| ' + ' | '.join(str(x) for x in r) + ' |\n')
    print(f'\ntotal funcs={sum(r[1] for r in rows)} named={sum(r[2] for r in rows)}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('module', nargs='?', help='module stem, e.g. Battle or static')
    ap.add_argument('query', nargs='?', help='demangled-name substring or hex addr')
    ap.add_argument('--scan', action='store_true', help='build decomp/functions/ tables')
    args = ap.parse_args()
    if args.scan:
        scan_all()
    elif args.module and args.query:
        disasm_function(args.module, args.query)
    else:
        ap.print_help()


if __name__ == '__main__':
    sys.exit(main())
