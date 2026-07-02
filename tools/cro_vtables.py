#!/usr/bin/env python3
"""Extract a CRO module's function-pointer / handler tables (dispatch crack).

The battle engine (and other CRO modules) reach most functions NOT by direct
`bl` but by indexing tables of function pointers held in the rodata segment.
Those pointers are 0 in the on-disk file — they're written at load time by the
module's **internal relocation table**. Each reloc entry is
(u32 type=2, u32 source_seg0_offset, u32 target_tagged) where target's low
nibble is the destination segment (1 = rodata) and the rest is the byte offset.

By replaying those relocations we recover, statically, every rodata slot that
will hold a code pointer — i.e. the handler/vtable tables — and which function
each slot points at. Contiguous runs of such slots are the dispatch tables the
engine indexes by handler id. This is what makes the pointer-dispatched battle
server (damage/effects/AI) analyzable: e.g. Battle.cro's move-effect table at
rodata+0x45a0 (153 entries) contains the per-target damage loop `sub_9698`.

Output: decomp/vtables/<Module>.json — {tables: [{base, count, entries:
[{slot, func}]}], stray: [...]}.

Usage: python3 tools/cro_vtables.py Battle [-o decomp/vtables]
"""
import argparse
import json
import struct
import sys
from pathlib import Path

MAP = Path('decomp/map')
FUNC = Path('decomp/functions')
ROM = Path('source/3ds/ultramoon/romfs')
OUT = Path('decomp/vtables')

RELOC_TYPE = 2       # ARM absolute pointer relocation
DEST_RODATA = 1      # target segment nibble for rodata
RUN_GAP = 0x40       # max byte gap that still counts as one table


def reloc_table_bounds(d):
    """Internal relocation table: header +0x128 (offset, count), 12B entries.
    The header offset can be a few bytes out of phase with the real entries,
    so we return a generous byte range and pattern-scan within it."""
    off = struct.unpack_from('<I', d, 0x128)[0]
    cnt = struct.unpack_from('<I', d, 0x12c)[0]
    return off, off + cnt * 12 + 12


def extract(module):
    d = (ROM / f'{module}.cro').read_bytes()
    funcs = {f['addr']: f['name']
             for f in json.loads((FUNC / f'{module}.json').read_text())}
    lo, hi = reloc_table_bounds(d)

    slots = []          # (rodata_offset, func_addr)
    o = lo
    while o + 12 <= hi and o + 12 <= len(d):
        a, b, c = struct.unpack_from('<III', d, o)
        if a == RELOC_TYPE and b in funcs and (c & 0xF) == DEST_RODATA:
            slots.append((c >> 4, b))
            o += 12
        else:
            o += 4
    slots.sort()

    tables, cur = [], []
    for off, src in slots:
        if cur and off - cur[-1][0] > RUN_GAP:
            tables.append(cur)
            cur = []
        cur.append((off, src))
    if cur:
        tables.append(cur)

    out_tables, stray = [], []
    for t in tables:
        entries = [{'slot': f'{off:#x}', 'func': funcs[src]} for off, src in t]
        if len(t) >= 4:
            out_tables.append({'base': f'{t[0][0]:#x}', 'count': len(t),
                               'distinct': len(set(s for _, s in t)),
                               'entries': entries})
        else:
            stray += entries
    out_tables.sort(key=lambda x: -x['count'])
    return {'module': f'{module}.cro', 'total_code_ptr_slots': len(slots),
            'tables': out_tables, 'stray': stray}


def run(module, out):
    try:
        data = extract(module)
    except (FileNotFoundError, struct.error):
        return None
    (out / f'{module}.json').write_text(json.dumps(data, indent=1))
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('module', nargs='?', help='module stem, or omit with --all')
    ap.add_argument('--all', action='store_true',
                    help='extract every CRO module + write vtables/INDEX.md')
    ap.add_argument('-o', '--out', default=str(OUT))
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    if args.all:
        rows = []
        for cro in sorted(ROM.glob('*.cro')):
            data = run(cro.stem, out)
            if data and data['tables']:
                biggest = data['tables'][0]['count']
                rows.append((cro.stem, data['total_code_ptr_slots'],
                             len(data['tables']), biggest))
        rows.sort(key=lambda r: -r[1])
        with (out / 'INDEX.md').open('w') as f:
            f.write('# CRO dispatch-table (function-pointer) inventory\n\n')
            f.write('Per module: code-pointer slots recovered by replaying the '
                    'internal relocation table, grouped into dispatch tables '
                    '(handler arrays the engine indexes by id). See '
                    '`tools/cro_vtables.py` / decomp/README.md.\n\n')
            f.write('| Module | code-ptr slots | tables | largest |\n')
            f.write('|---|---|---|---|\n')
            for r in rows:
                f.write(f'| {r[0]} | {r[1]} | {r[2]} | {r[3]} |\n')
        print(f'{len(rows)} modules with dispatch tables; wrote {out}/INDEX.md')
        print('top:', ', '.join(f'{r[0]}({r[1]})' for r in rows[:6]))
        return

    data = run(args.module, out)
    print(f"{args.module}: {data['total_code_ptr_slots']} code-ptr slots, "
          f"{len(data['tables'])} dispatch tables")
    for t in data['tables'][:8]:
        print(f"  table rodata+{t['base']}: {t['count']} entries "
              f"({t['distinct']} distinct)")
    dmg = next((t for t in data['tables']
                if any(e['func'] == 'sub_9698' for e in t['entries'])), None)
    if dmg:
        print(f"  -> damage-loop table at rodata+{dmg['base']} "
              f"({dmg['count']} handlers)")


if __name__ == '__main__':
    sys.exit(main())
