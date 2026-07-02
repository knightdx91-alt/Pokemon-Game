#!/usr/bin/env python3
"""Convert Ultra Moon (Gen 7) move data -> the game's data/pokemon/ shape.

Reads the packed move archive `a/0/1/1/0000.bin` (a "WD" mini-container:
u16 magic, u16 count, (count+1) u32 offsets, then count × 40-byte entries)
from the tools/3ds_decomp.py extraction, joins it with decoded move names
(tools/usum_text.py, English file 0118), and emits `usum_moves.json` in the
exact `{slug: {name, power, type, accuracy, pp, category, ...}}` shape the
engine's battle.js/summary.js already consume (same as data/pokemon/moves.json).

Move entry byte layout (verified against Pound/Fire Punch/Flamethrower/
Thunderbolt): 0=type, 2=category(0 status/1 physical/2 special), 3=power,
4=accuracy, 5=PP, 6=priority(s8), 8=inflicted-status, 10=status-chance%.

Usage:
  python3 tools/usum_moves.py --verify
  python3 tools/usum_moves.py -o data/pokemon/usum_moves.json
"""
import argparse
import json
import struct
from pathlib import Path

MOVES = Path('source/3ds/ultramoon/unpacked/a/0/1/1/0000.bin')
NAMES = Path('data/pokemon/usum_names.json')

TYPES = ['Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug',
         'Ghost', 'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic',
         'Ice', 'Dragon', 'Dark', 'Fairy']
CATEGORY = {0: 'status', 1: 'physical', 2: 'special'}


def slug(name):
    """Match the existing move-key convention (double_slap, thunder_punch)."""
    out = []
    for i, c in enumerate(name):
        # split camelCase (ThunderPunch -> thunder_punch), but NOT a capital
        # that just follows a space (Close Combat must not become close__combat)
        if c.isupper() and i and name[i - 1].islower():
            out.append('_')
        out.append(c)
    return ''.join(out).lower().replace(' ', '_').replace('-', '_') \
        .replace("'", '').replace('.', '').replace(',', '')


def parse():
    d = MOVES.read_bytes()
    count = struct.unpack_from('<H', d, 2)[0]
    offs = [struct.unpack_from('<I', d, 4 + i * 4)[0] for i in range(count + 1)]
    names = json.loads(NAMES.read_text())['moves']
    moves = {}
    for i in range(1, count):
        e = d[offs[i]:offs[i + 1]]
        if len(e) < 11 or i >= len(names) or not names[i]:
            continue
        name = names[i]
        rec = {
            'name': name,
            'power': e[3],
            'type': TYPES[e[0]] if e[0] < len(TYPES) else e[0],
            'accuracy': e[4],
            'pp': e[5],
            'category': CATEGORY.get(e[2], 'status'),
        }
        prio = struct.unpack_from('<b', e, 6)[0]
        if prio:
            rec['priority'] = prio
        status_chance = e[10] if len(e) > 10 else 0
        if status_chance:
            rec['effectChance'] = status_chance
        # Move-effect id (u16 @0x10): the ~430-value Gen-7 move-effect enum.
        # Verified by grouping — 4=10% burn, 6=paralyze-chance, 32=heal,
        # 48=recoil, 50=+2 Atk self, 67=paralyze status. See
        # decomp/battle_effects/move_effect_ids.json for the id->moves index.
        if len(e) >= 18:
            rec['effectId'] = struct.unpack_from('<H', e, 16)[0]
        moves[slug(name)] = rec
    return moves


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', '--out')
    ap.add_argument('--verify', action='store_true')
    args = ap.parse_args()
    moves = parse()
    if args.verify or not args.out:
        for k in ('pound', 'flamethrower', 'thunderbolt', 'earthquake',
                  'close_combat', 'moonblast', 'swords_dance'):
            print(f'  {k}: {moves.get(k)}')
        print(f'total moves: {len(moves)}')
    if args.out:
        Path(args.out).write_text(json.dumps(moves, indent=1, ensure_ascii=False))
        print(f'wrote {len(moves)} moves -> {args.out}')


if __name__ == '__main__':
    main()
