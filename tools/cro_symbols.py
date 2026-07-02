#!/usr/bin/env python3
"""Extract Game Freak's surviving C++ symbol names from 3DS CRO/CRS modules.

Phase 1 of the Ultra Moon true-decomp effort (see decomp/README.md).

A CRO (CTR Relocatable Object) is the 3DS dynamic-module format. Its header
(at file offset 0x80, magic "CRO0") contains named export/import tables whose
entries point at NUL-terminated symbol strings — Game Freak shipped USUM with
these intact, so the original C++ namespaces/classes/methods are recoverable.

Two extraction strategies, merged:
  1. Header-table walk (named exports + named imports per 3dbrew layout).
  2. Raw scan for Itanium-mangled names (`_Z...`) anywhere in the file —
     catches symbols referenced outside the tables (vtables, RTTI, statics).

Output: decomp/symbols/<Module>.json  { exports, imports, scanned } with both
mangled and demangled (c++filt) forms, plus decomp/symbols/INDEX.md summary.

Usage: python3 tools/cro_symbols.py [romfs_dir] [-o decomp/symbols]
"""
import argparse
import json
import re
import struct
import subprocess
import sys
from pathlib import Path

MANGLED_RE = re.compile(rb'_Z[A-Za-z0-9_$.]{2,400}')
PRINTABLE_RE = re.compile(rb'^[\x21-\x7e]{2,400}$')


def u32(d, o):
    return struct.unpack_from('<I', d, o)[0]


def cstr(d, off, limit=512):
    if off <= 0 or off >= len(d):
        return None
    end = d.find(b'\0', off, off + limit)
    if end < 0:
        return None
    s = d[off:end]
    return s.decode('ascii') if PRINTABLE_RE.match(s) else None


def table_names(d, off, cnt, entry_size=8):
    """Walk a (name_offset, ...) entry table, keeping valid ASCII names."""
    names = []
    if off <= 0 or cnt <= 0 or cnt > 100000 or off + cnt * entry_size > len(d):
        return names
    for i in range(cnt):
        s = cstr(d, u32(d, off + i * entry_size))
        if s:
            names.append(s)
    return names


def parse_module(d):
    """Return (exports, imports) name lists from the CRO0 header tables.

    3dbrew documents the header, but table offsets have shifted between
    system versions — so probe the plausible header slots and keep whichever
    yield valid ASCII string tables. Empirically on USUM 0xD0/0xD4 holds the
    named-export table and 0xF8/0xFC the named-import table.
    """
    if len(d) < 0x140 or d[0x80:0x84] != b'CRO0':
        return [], []
    exports, imports = [], []
    for off_field in (0xC8, 0xD0):
        got = table_names(d, u32(d, off_field), u32(d, off_field + 4))
        if len(got) > len(exports):
            exports = got
    for off_field in (0xF0, 0xF8, 0x100):
        got = table_names(d, u32(d, off_field), u32(d, off_field + 4))
        if len(got) > len(imports):
            imports = got
    return exports, imports


def scan_mangled(d):
    return sorted({m.group(0).decode('ascii') for m in MANGLED_RE.finditer(d)})


def demangle(names):
    """Batch-demangle via c++filt; returns {mangled: demangled}."""
    if not names:
        return {}
    out = subprocess.run(['c++filt'], input='\n'.join(names),
                         capture_output=True, text=True).stdout.splitlines()
    return {m: dm for m, dm in zip(names, out) if dm and dm != m}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('romfs', nargs='?', default='source/3ds/ultramoon/romfs')
    ap.add_argument('-o', '--out', default='decomp/symbols')
    args = ap.parse_args()

    romfs = Path(args.romfs)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    modules = sorted(list(romfs.glob('*.cro')) + list(romfs.glob('*.crs')))
    rows = []
    for path in modules:
        d = path.read_bytes()
        exports, imports = parse_module(d)
        scanned = scan_mangled(d)
        dm = demangle(sorted({*exports, *imports, *scanned}))
        rec = {
            'module': path.name,
            'size': len(d),
            'exports': [{'mangled': n, 'demangled': dm.get(n, n)} for n in exports],
            'imports': [{'mangled': n, 'demangled': dm.get(n, n)} for n in imports],
            'scanned': [{'mangled': n, 'demangled': dm.get(n, n)} for n in scanned],
        }
        (out / (path.stem + '.json')).write_text(json.dumps(rec, indent=1))
        rows.append((path.name, len(exports), len(imports), len(scanned)))
        print(f'{path.name:44s} exp={len(exports):5d} imp={len(imports):5d} scan={len(scanned):5d}')

    total = [sum(r[i] for r in rows) for i in (1, 2, 3)]
    with (out / 'INDEX.md').open('w') as f:
        f.write('# Ultra Moon CRO symbol inventory\n\n')
        f.write(f'{len(rows)} modules — exports {total[0]}, imports {total[1]}, '
                f'mangled-string scan {total[2]}\n\n')
        f.write('| Module | Exports | Imports | Scanned |\n|---|---|---|---|\n')
        for name, e, i, s in rows:
            f.write(f'| {name} | {e} | {i} | {s} |\n')
    print(f'\n{len(rows)} modules; totals exp={total[0]} imp={total[1]} scan={total[2]}')
    print(f'wrote {out}/INDEX.md')


if __name__ == '__main__':
    sys.exit(main())
