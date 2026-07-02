#!/usr/bin/env python3
"""Convert Ultra Moon (Gen 7) evolution data -> data/pokemon JSON.

Reads the evolution GARC `a/0/1/4` (976 members) from the tools/3ds_decomp.py
extraction. Each member is 8 evolution slots × 8 bytes:
  u16 method, u16 argument, u16 target_species, s8 form (0xFF = same), u8 level
(field layout verified: Bulbasaur = method 4 → Ivysaur at level 0x10 = 16).

Emits `usum_evolutions.json` keyed by national dex number: a list of
{method, methodName, arg, level, into (slug), name} per evolution.

Usage:
  python3 tools/usum_evolutions.py --verify
  python3 tools/usum_evolutions.py -o data/pokemon/usum_evolutions.json
"""
import argparse
import json
import struct
import sys
from pathlib import Path

SRC = Path('source/3ds/ultramoon/unpacked/a/0/1/4')
NAMES = Path('data/pokemon/usum_names.json')

sys.path.insert(0, str(Path(__file__).parent))
from usum_moves import slug  # noqa: E402

# Gen-7 evolution method ids (community/pk3DS documented).
METHOD = {
    1: 'LevelUpFriendship', 2: 'LevelUpFriendshipDay', 3: 'LevelUpFriendshipNight',
    4: 'LevelUp', 5: 'Trade', 6: 'TradeHeldItem', 7: 'TradeForSpecies',
    8: 'UseItem', 9: 'LevelUpAtkGtDef', 10: 'LevelUpAtkEqDef', 11: 'LevelUpAtkLtDef',
    12: 'LevelUpPIDLow', 13: 'LevelUpPIDHigh', 14: 'LevelUpEmptySpot',
    15: 'LevelUpFormExtra', 16: 'LevelUpBeauty', 17: 'UseItemMale',
    18: 'UseItemFemale', 19: 'LevelUpHeldItemDay', 20: 'LevelUpHeldItemNight',
    21: 'LevelUpKnowMove', 22: 'LevelUpWithPokemonType', 23: 'LevelUpMagneticField',
    24: 'LevelUpMossRock', 25: 'LevelUpIceRock', 26: 'UseItemLeafStone',
    27: 'UseItemIceStone', 28: 'LevelUpFormFemale', 29: 'LevelUpAffectionMove',
    30: 'LevelUpMove', 31: 'LevelUpWithPokemon', 32: 'LevelUpMale',
    33: 'LevelUpFemale', 34: 'LevelUpNight', 35: 'LevelUpDay',
    36: 'LevelUpFormOverworld', 37: 'LevelUpWeather', 38: 'LevelUpDayForm',
    39: 'LevelUpNightForm', 40: 'LevelUpFormOverworldExtra', 41: 'UseItemNight',
    42: 'LevelUpLocation',
}


def member_bytes(dex):
    # Some members are renamed `.lz` on a false LZ11 magic (first byte 0x11);
    # evolution data is raw, so read raw when the .bin is absent.
    b = SRC / f'{dex:04d}.bin'
    if b.exists():
        return b.read_bytes()
    lz = SRC / f'{dex:04d}.lz'
    return lz.read_bytes() if lz.exists() else b''


def evolutions(dex, species_names):
    d = member_bytes(dex)
    out = []
    for i in range(0, len(d), 8):
        method, arg, target, form, level = struct.unpack_from('<HHHbB', d, i)
        if method == 0:
            continue
        rec = {
            'method': method,
            'methodName': METHOD.get(method, f'Method{method}'),
            'into': slug(species_names[target]) if target < len(species_names) else target,
            'name': species_names[target] if target < len(species_names) else target,
        }
        if level:
            rec['level'] = level
        if arg:
            rec['arg'] = arg
        if form >= 0:
            rec['form'] = form
        out.append(rec)
    return out


def build():
    names = json.loads(NAMES.read_text())['species']
    return {str(dex): evolutions(dex, names) for dex in range(1, 808)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', '--out')
    ap.add_argument('--verify', action='store_true')
    args = ap.parse_args()
    data = build()
    if args.verify or not args.out:
        for dex in (1, 5, 133, 25, 37):
            print(f'  #{dex}: {data[str(dex)]}')
    if args.out:
        Path(args.out).write_text(json.dumps(data, indent=1, ensure_ascii=False))
        print(f'wrote {len(data)} species -> {args.out}')


if __name__ == '__main__':
    main()
