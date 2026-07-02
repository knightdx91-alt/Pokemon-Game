#!/usr/bin/env python3
"""Extract Ultra Moon (Gen 7) TM list + per-species TM compatibility.

- The 100-entry TM->move table lives in exefs `.code` at VA 0x5bb98e (file
  offset 0x4bb98e); verified TM01=Work Up ... TM100=Confide.
- Per-species TM compatibility is a 100-bit flag field in each personal-data
  member (`a/0/1/7`) starting at byte 0x28 (13 bytes, bit i = TM(i+1)).
  Verified: Bulbasaur learns TM06 Toxic, Charizard learns Fly.

Emits `usum_tm_compat.json` = {tms: [100 {tm, move, name}], compat: {dex: [tm#...]}}.

Usage:
  python3 tools/usum_tmcompat.py --verify
  python3 tools/usum_tmcompat.py -o data/pokemon/usum_tm_compat.json
"""
import argparse
import json
import struct
import sys
from pathlib import Path

CODE = Path('source/3ds/ultramoon/exefs/.code')
PERSONAL = Path('source/3ds/ultramoon/unpacked/a/0/1/7')
NAMES = Path('data/pokemon/usum_names.json')

TM_TABLE_OFF = 0x4bb98e   # file offset of the 100 u16 TM move ids
TM_COUNT = 100
TM_FLAGS_OFF = 0x28       # byte offset of the TM bitfield in a personal entry

sys.path.insert(0, str(Path(__file__).parent))
from usum_moves import slug  # noqa: E402


def tm_list(move_names):
    code = CODE.read_bytes()
    ids = [struct.unpack_from('<H', code, TM_TABLE_OFF + i * 2)[0]
           for i in range(TM_COUNT)]
    return [{'tm': i + 1, 'move': slug(move_names[m]), 'name': move_names[m]}
            for i, m in enumerate(ids)]


def compat(dex):
    p = (PERSONAL / f'{dex:04d}.bin').read_bytes()
    bits = p[TM_FLAGS_OFF:TM_FLAGS_OFF + 13]
    return [i + 1 for i in range(TM_COUNT) if bits[i // 8] >> (i % 8) & 1]


def build():
    move_names = json.loads(NAMES.read_text())['moves']
    tms = tm_list(move_names)
    return {'tms': tms,
            'compat': {str(dex): compat(dex) for dex in range(1, 808)}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', '--out')
    ap.add_argument('--verify', action='store_true')
    args = ap.parse_args()
    data = build()
    if args.verify or not args.out:
        tms = data['tms']
        print('TM01-06:', [t['name'] for t in tms[:6]])
        for dex in (1, 6):
            got = data['compat'][str(dex)]
            print(f"  #{dex}: {len(got)} TMs, incl "
                  f"{[tms[i-1]['name'] for i in got[:6]]}")
    if args.out:
        Path(args.out).write_text(json.dumps(data, indent=1, ensure_ascii=False))
        print(f"wrote TM list + {len(data['compat'])} species -> {args.out}")


if __name__ == '__main__':
    main()
