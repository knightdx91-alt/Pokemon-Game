#!/usr/bin/env python3
"""Convert Ultra Moon (Gen 7) egg moves -> data/pokemon JSON.

Reads the egg-move GARC `a/0/1/2` from the tools/3ds_decomp.py extraction.
Each member: u16 species_id (self-index), u16 count, then count × u16 move id.
Emits `usum_eggmoves.json` keyed by national dex number: list of {move, name}.
Verified against Bulbasaur / Charmander / Squirtle egg-move lists.

Usage:
  python3 tools/usum_eggmoves.py --verify
  python3 tools/usum_eggmoves.py -o data/pokemon/usum_eggmoves.json
"""
import argparse
import json
import struct
import sys
from pathlib import Path

SRC = Path('source/3ds/ultramoon/unpacked/a/0/1/2')
NAMES = Path('data/pokemon/usum_names.json')

sys.path.insert(0, str(Path(__file__).parent))
from usum_moves import slug  # noqa: E402


def member_bytes(dex):
    b = SRC / f'{dex:04d}.bin'
    if b.exists():
        return b.read_bytes()
    lz = SRC / f'{dex:04d}.lz'
    return lz.read_bytes() if lz.exists() else b''


def egg_moves(dex, move_names):
    d = member_bytes(dex)
    if len(d) < 4:
        return []
    count = struct.unpack_from('<H', d, 2)[0]
    out = []
    for i in range(count):
        if 4 + i * 2 + 2 > len(d):
            break
        mv = struct.unpack_from('<H', d, 4 + i * 2)[0]
        if mv == 0xFFFF or mv == 0 or mv >= len(move_names):
            continue
        out.append({'move': slug(move_names[mv]), 'name': move_names[mv]})
    return out


def build():
    move_names = json.loads(NAMES.read_text())['moves']
    n = len(list(SRC.glob('*.bin')) + list(SRC.glob('*.lz')))
    data = {}
    for dex in range(1, 808):
        em = egg_moves(dex, move_names)
        if em:
            data[str(dex)] = em
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', '--out')
    ap.add_argument('--verify', action='store_true')
    args = ap.parse_args()
    data = build()
    if args.verify or not args.out:
        for dex in (1, 4, 7):
            print(f"  #{dex}: {[e['name'] for e in data.get(str(dex), [])]}")
        print(f'species with egg moves: {len(data)}')
    if args.out:
        Path(args.out).write_text(json.dumps(data, indent=1, ensure_ascii=False))
        print(f'wrote {len(data)} species -> {args.out}')


if __name__ == '__main__':
    main()
