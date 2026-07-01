#!/usr/bin/env python3
"""
rom_to_2d.py — Convert decompiled ROM data into this game's 2D data/ formats.

Consumes the `unpacked/` tree produced by tools/nds_decomp.py (Gen 5:
Pokémon Black / Black 2) and emits the exact JSON shapes the browser game
already loads from data/:

  data/pokemon/base_stats.json   {SPECIES: {base_hp, base_attack, ..., types,
                                            abilities, catch_rate, ...}}
  data/pokemon/learnsets.json    {species: [[level, "move_slug"], ...]}
  data/pokemon/moves.json        [["move_slug", {name, power, type, accuracy,
                                                 pp, category}], ...]
  data/encounters/<region>.json  {location_id: {grass:[...], surf:[...], ...}}

Why this exists: DS Gen-5 games are 3D for *maps* (geometry, not tile grids —
can't feed the 2D renderer), but their *game data* — stats, movesets, moves,
wild encounters — is plain tabular data that ports directly into a 2D game.
That's what this converts. (3DS Gen-6 via tools/3ds_decomp.py is the same
story: data ports, 3D models/maps don't.)

Usage:
  # First extract a ROM (see CLAUDE.md for the Drive download commands):
  python3 tools/nds_decomp.py /tmp/pokemon-black.nds -o source/nds/IRBO
  # Then convert. --dry-run writes to /tmp so you can diff before overwriting.
  python3 tools/rom_to_2d.py source/nds/IRBO --only stats,moves,learnsets
  python3 tools/rom_to_2d.py source/nds/IRBO --encounters gen5 --dry-run

Stdlib only.
"""
import argparse
import json
import re
import struct
import sys
from pathlib import Path

GAME_ROOT = Path(__file__).parent.parent

TYPES = ['Normal', 'Fighting', 'Flying', 'Poison', 'Ground', 'Rock', 'Bug',
         'Ghost', 'Steel', 'Fire', 'Water', 'Grass', 'Electric', 'Psychic',
         'Ice', 'Dragon', 'Dark']
MOVE_CATEGORY = {0: 'status', 1: 'physical', 2: 'special'}

# Member indices within each text NARC (a/0/0/2). Verified against the US
# English Pokémon Black ROM (IRBO); Black 2 (IREO) ships localized text in
# these members, so English names come from the Black extraction. If only a
# localized ROM is available the names will be in that language.
TEXT_SPECIES  = 70
TEXT_ABILITIES = 182
TEXT_MOVES    = 203
TEXT_ITEMS    = 64   # not used yet, documented for future

# NARC paths (Gen 5, both BW and BW2 share these)
P_PERSONAL  = 'a/0/1/6'
P_LEARNSET  = 'a/0/1/8'
P_MOVEDATA  = 'a/0/2/1'
P_TEXT      = 'a/0/0/2'
P_ENCOUNTER_BW  = 'a/1/2/6'
P_ENCOUNTER_BW2 = 'a/1/2/7'


def slug(name):
    """'Leech Seed' -> 'leech_seed', matching existing data slugs."""
    s = name.lower().replace('é', 'e').replace('♀', '_f').replace('♂', '_m')
    s = re.sub(r"[^a-z0-9]+", '_', s).strip('_')
    return s


# ------------------------------------------------------ Gen5 text decoder ---

def decode_text_member(data):
    """Decrypt one Gen-5 text file (member of a/0/0/2). Returns list[str]."""
    n_sections, n_lines = struct.unpack_from('<HH', data, 0)
    sec_off = struct.unpack_from('<I', data, 12)[0]
    lines = []
    for i in range(n_lines):
        off, length = struct.unpack_from('<IH', data, sec_off + 4 + i * 8)
        key = (0x7C89 + 0x2983 * i) & 0xFFFF
        chars = []
        for j in range(length):
            c = struct.unpack_from('<H', data, sec_off + off + j * 2)[0] ^ key
            key = ((key << 3) | (key >> 13)) & 0xFFFF
            chars.append(c)
        if chars and chars[-1] == 0xFFFF:
            chars.pop()
        lines.append(''.join(chr(c) if 32 <= c < 0xD800 else '' for c in chars))
    return lines


def load_text(unpacked, member):
    p = unpacked / P_TEXT / f'{member:04d}.bin'
    return decode_text_member(p.read_bytes())


def members(unpacked, narc):
    """Yield (index, bytes) for each member file of a NARC, in order."""
    d = unpacked / narc
    for f in sorted(d.glob('*')):
        m = re.match(r'(\d+)', f.name)
        if m:
            yield int(m.group(1)), f.read_bytes()


# ----------------------------------------------------------- converters ---

def convert_stats(unpacked, species_names, ability_names):
    out = {}
    for idx, d in members(unpacked, P_PERSONAL):
        if idx == 0 or idx >= len(species_names):
            continue
        name = species_names[idx]
        if not name or name.startswith('-') or set(name) <= set('―-'):
            continue
        hp, atk, dfn, spe, spa, spd = d[0:6]
        t1, t2 = d[6], d[7]
        types = [TYPES[t1]] if t1 < len(TYPES) else []
        if t2 != t1 and t2 < len(TYPES):
            types.append(TYPES[t2])
        abils = []
        for ai in (d[0x18], d[0x19], d[0x1A]):
            if ai and ai < len(ability_names) and ability_names[ai]:
                a = ability_names[ai]
                if a not in abils:
                    abils.append(a)
        out[name.upper()] = {
            'name': name,
            'base_hp': hp, 'base_attack': atk, 'base_defense': dfn,
            'base_speed': spe, 'base_sp_attack': spa, 'base_sp_defense': spd,
            'catch_rate': d[8],
            'exp_yield': struct.unpack_from('<H', d, 0x0A)[0],
            'types': types,
            'abilities': abils,
            'growth_rate': d[0x15],
            'gender_ratio': d[0x14],
            'friendship': d[0x16],
            'egg_cycles': d[0x17],
        }
    return out


def convert_moves(unpacked, move_names):
    out = []
    for idx, d in members(unpacked, P_MOVEDATA):
        if idx == 0 or idx >= len(move_names) or not move_names[idx] or len(d) < 6:
            continue
        name = move_names[idx]
        out.append([slug(name), {
            'name': name,
            'power': d[3],
            'type': TYPES[d[0]] if d[0] < len(TYPES) else 'Normal',
            'accuracy': d[4],
            'pp': d[5],
            'category': MOVE_CATEGORY.get(d[2], 'status'),
        }])
    return out


def convert_learnsets(unpacked, species_names, move_names):
    out = {}
    for idx, d in members(unpacked, P_LEARNSET):
        if idx == 0 or idx >= len(species_names):
            continue
        name = species_names[idx]
        if not name or name.startswith('-') or set(name) <= set('―-'):
            continue
        entries = []
        for i in range(0, len(d) - 3, 4):
            mv, lv = struct.unpack_from('<HH', d, i)
            if mv == 0xFFFF:
                break
            mname = move_names[mv] if mv < len(move_names) else ''
            if mname:
                entries.append([lv, slug(mname)])
        out[name.lower()] = entries
    return out


def convert_encounters(unpacked, species_names, which):
    """Gen-5 wild encounter tables (a/1/2/6 BW, a/1/2/7 BW2).
    Each member = one location's slots. Emitted grouped by field type.
    Format is best-effort (community-documented); verify counts in output."""
    narc = P_ENCOUNTER_BW2 if which == 'bw2' else P_ENCOUNTER_BW
    out = {}
    for idx, d in members(unpacked, narc):
        if len(d) < 0x60:
            continue
        rates = {'grass': d[0], 'grass_double': d[1], 'grass_special': d[2],
                 'surf': d[3], 'surf_special': d[4],
                 'fish': d[5], 'fish_special': d[6]}
        # Slots: after a small rate header, 12 grass slots follow as
        # (species u16, minLvl u8, maxLvl u8) — the canonical BW layout.
        loc = {}
        base = 8
        def read_slots(p, count):
            s = []
            for k in range(count):
                sp = struct.unpack_from('<H', d, p + k * 4)[0] & 0x7FF
                lo, hi = d[p + k * 4 + 2], d[p + k * 4 + 3]
                if 0 < sp < len(species_names) and species_names[sp]:
                    s.append({'species': species_names[sp], 'min': lo, 'max': hi})
            return s
        grass = read_slots(base, 12)
        if grass and rates['grass']:
            loc['grass'] = {'rate': rates['grass'], 'slots': grass}
        surf = read_slots(base + 12 * 4 * 3, 5)
        if surf and rates['surf']:
            loc['surf'] = {'rate': rates['surf'], 'slots': surf}
        if loc:
            out[str(idx)] = loc
    return out


# ------------------------------------------------------------------ main ---

def main():
    ap = argparse.ArgumentParser(description='Convert ROM data → 2D game data/')
    ap.add_argument('extraction', help='an unpacked ROM dir (e.g. source/nds/IRBO)')
    ap.add_argument('--only', default='stats,moves,learnsets',
                    help='comma list: stats,moves,learnsets')
    ap.add_argument('--encounters', choices=['bw', 'bw2'],
                    help='also convert wild encounters (experimental)')
    ap.add_argument('--names-from', help='extraction dir to read English text '
                    'from (default: same). Use an English ROM (IRBO) if the '
                    'data ROM is localized.')
    ap.add_argument('--dry-run', action='store_true',
                    help='write to /tmp instead of data/, for diffing')
    args = ap.parse_args()

    ext = Path(args.extraction)
    unpacked = ext / 'unpacked'
    if not unpacked.exists():
        sys.exit(f'No unpacked/ under {ext} — run nds_decomp.py first.')
    names_ext = Path(args.names_from) / 'unpacked' if args.names_from else unpacked

    species = load_text(names_ext, TEXT_SPECIES)
    abilities = load_text(names_ext, TEXT_ABILITIES)
    moves = load_text(names_ext, TEXT_MOVES)
    print(f'Text: {len(species)} species, {len(moves)} moves, {len(abilities)} abilities')
    if 'Bulbasaur' not in species:
        print('  ! species text is not English — pass --names-from <English ROM extraction>')

    out_root = Path('/tmp/rom_to_2d_out') if args.dry_run else GAME_ROOT
    todo = set(args.only.split(','))
    written = []

    if 'stats' in todo:
        data = convert_stats(unpacked, species, abilities)
        p = out_root / 'data/pokemon/base_stats.json'
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, indent=2))
        written.append((p, f'{len(data)} species'))
    if 'moves' in todo:
        data = convert_moves(unpacked, moves)
        p = out_root / 'data/pokemon/moves.json'
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, indent=2))
        written.append((p, f'{len(data)} moves'))
    if 'learnsets' in todo:
        data = convert_learnsets(unpacked, species, moves)
        p = out_root / 'data/pokemon/learnsets.json'
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, indent=2))
        written.append((p, f'{len(data)} learnsets'))
    if args.encounters:
        data = convert_encounters(unpacked, species, args.encounters)
        p = out_root / f'data/encounters/gen5_{args.encounters}.json'
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(data, indent=2))
        written.append((p, f'{len(data)} locations'))

    print('\nWrote:' + (' (DRY RUN → /tmp)' if args.dry_run else ''))
    for p, note in written:
        print(f'  {p}  — {note}')


if __name__ == '__main__':
    main()
