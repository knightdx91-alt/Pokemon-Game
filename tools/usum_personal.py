#!/usr/bin/env python3
"""Convert Ultra Moon (Gen 7) personal data -> the game's data/ JSON shape.

Reads the decomp GARC extraction `a/0/1/7` (977 members: 807 species + forms)
produced by tools/3ds_decomp.py, and emits verifiable per-species records:
base stats, types (named), catch rate, gender ratio, egg groups, growth rate,
abilities (by id), base EXP and EV yield. Species NAMES are not decoded here
(Gen-7 message text uses per-line XOR — a separate step); records are keyed by
national dex number.

Struct layout is the community-documented (pk3DS) Gen-7 `personal` entry;
fields used here were cross-checked against known species (see --verify).

Usage:
  python3 tools/usum_personal.py --verify           # print/verify a few species
  python3 tools/usum_personal.py -o data/pokemon/usum_base_stats.json
"""
import argparse
import json
import struct
from pathlib import Path

SRC = Path('source/3ds/ultramoon/unpacked/a/0/1/7')

TYPES = ['Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug',
         'Ghost', 'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic',
         'Ice', 'Dragon', 'Dark', 'Fairy']
GROWTH = ['MediumFast', 'Erratic', 'Fluctuating', 'MediumSlow', 'Fast', 'Slow']
EGG_GROUPS = ['---', 'Monster', 'Water1', 'Bug', 'Flying', 'Field', 'Fairy',
              'Grass', 'HumanLike', 'Water3', 'Mineral', 'Amorphous', 'Water2',
              'Ditto', 'Dragon', 'Undiscovered']


def parse(b):
    hp, atk, dfn, spe, spa, spd = b[0:6]
    t1, t2 = b[6], b[7]
    catch = b[8]
    evraw = struct.unpack_from('<H', b, 0x0a)[0]
    ev = {  # 2 bits per stat
        'hp': evraw & 3, 'atk': (evraw >> 2) & 3, 'def': (evraw >> 4) & 3,
        'spe': (evraw >> 6) & 3, 'spa': (evraw >> 8) & 3, 'spd': (evraw >> 10) & 3,
    }
    gender = b[0x12]
    hatch = b[0x13]
    friendship = b[0x14]
    growth = b[0x15]
    egg1, egg2 = b[0x16], b[0x17]
    ab1, ab2, abh = b[0x18], b[0x19], b[0x1a]
    base_exp = struct.unpack_from('<H', b, 0x22)[0]
    types = [TYPES[t1]] if t1 == t2 else [TYPES[t1], TYPES[t2]]
    return {
        'baseStats': {'hp': hp, 'atk': atk, 'def': dfn,
                      'spa': spa, 'spd': spd, 'spe': spe},
        'types': types,
        'catchRate': catch,
        'baseExp': base_exp,
        'evYield': {k: v for k, v in ev.items() if v},
        'genderRatio': gender,   # 0=always M, 254=always F, 255=genderless
        'eggCycles': hatch,
        'baseFriendship': friendship,
        'growthRate': GROWTH[growth] if growth < len(GROWTH) else growth,
        'eggGroups': [EGG_GROUPS[egg1], EGG_GROUPS[egg2]],
        'abilities': [ab1, ab2, abh],   # ability ids (names decoded separately)
    }


def load(dex):
    return parse((SRC / f'{dex:04d}.bin').read_bytes())


def verify():
    checks = {
        1:  ('Bulbasaur', {'hp': 45, 'atk': 49}, ['Grass', 'Poison'], 'MediumSlow'),
        6:  ('Charizard', {'hp': 78}, ['Fire', 'Flying'], 'MediumSlow'),
        150:('Mewtwo',    {'spa': 154}, ['Psychic'], 'Slow'),
        448:('Lucario',   {}, ['Fighting', 'Steel'], 'MediumSlow'),
    }
    ok = True
    for dex, (name, stats, types, growth) in checks.items():
        r = load(dex)
        good = (all(r['baseStats'][k] == v for k, v in stats.items())
                and r['types'] == types and r['growthRate'] == growth)
        ok = ok and good
        print(f"#{dex:3d} {name:10s} {r['baseStats']} {r['types']} "
              f"{r['growthRate']} exp={r['baseExp']} "
              f"gender={r['genderRatio']}  {'OK' if good else 'MISMATCH'}")
    print('verify:', 'PASS' if ok else 'FAIL')
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', '--out')
    ap.add_argument('--verify', action='store_true')
    args = ap.parse_args()
    if args.verify or not args.out:
        verify()
    if args.out:
        n = len(list(SRC.glob('*.bin')))
        data = {str(dex): load(dex) for dex in range(1, 808) if dex < n}
        Path(args.out).write_text(json.dumps(data, indent=1))
        print(f'wrote {len(data)} species -> {args.out}')


if __name__ == '__main__':
    main()
