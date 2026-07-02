#!/usr/bin/env python3
"""Convert Ultra Moon (Gen 7) level-up learnsets -> data/pokemon JSON.

Reads the learnset GARC `a/0/1/3` (976 members, one per species+form) from
the tools/3ds_decomp.py extraction. Each member is a flat list of
(u16 move_id, u16 level) pairs terminated by a 0xFFFF sentinel. Emits
`usum_learnsets.json` keyed by national dex number (species 1..807), each a
list of {level, move (slug), name} learned by level-up — the same information
the engine's learnset data carries.

Usage:
  python3 tools/usum_learnsets.py --verify
  python3 tools/usum_learnsets.py -o data/pokemon/usum_learnsets.json
"""
import argparse
import importlib.util
import json
import struct
import sys
from pathlib import Path

SRC = Path('source/3ds/ultramoon/unpacked/a/0/1/3')
NAMES = Path('data/pokemon/usum_names.json')

sys.path.insert(0, str(Path(__file__).parent))
# reuse the exact slug convention from the move converter
from usum_moves import slug  # noqa: E402

# Some GARC members ship LZ11-compressed (extracted as .lz); reuse the NDS
# tool's decompressor to read them.
_spec = importlib.util.spec_from_file_location(
    'nds_decomp', Path(__file__).parent / 'nds_decomp.py')
_nds = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_nds)


def member_bytes(dex):
    """Read learnset member `dex`, decompressing an .lz member if needed."""
    b = SRC / f'{dex:04d}.bin'
    if b.exists():
        return b.read_bytes()
    lz = SRC / f'{dex:04d}.lz'
    if lz.exists():
        raw = lz.read_bytes()
        # The extractor renames any member whose first byte is 0x11 to `.lz`
        # (the LZ11 magic), but learnsets often start with move id 0x0011 and
        # are NOT actually compressed. Try to decompress; fall back to raw if
        # that fails (returns None) — verified correct for Charizard (#6).
        try:
            out = _nds.lz_decompress(raw)
            if out:
                return out
        except Exception:
            pass
        return raw
    return None


def parse_member(dex, move_names):
    d = member_bytes(dex)
    if d is None:
        return []
    out = []
    for i in range(0, len(d) - 3, 4):
        mv, lv = struct.unpack_from('<HH', d, i)
        if mv == 0xFFFF:
            break
        name = move_names[mv] if mv < len(move_names) else str(mv)
        out.append({'level': lv, 'move': slug(name), 'name': name})
    return out


def build():
    move_names = json.loads(NAMES.read_text())['moves']
    return {str(dex): parse_member(dex, move_names) for dex in range(1, 808)}


def main():
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', '--out')
    ap.add_argument('--verify', action='store_true')
    args = ap.parse_args()
    data = build()
    if args.verify or not args.out:
        for dex in (1, 6, 448):
            ls = data[str(dex)]
            head = [(e['level'], e['name']) for e in ls[:6]]
            print(f'  #{dex}: {head}')
        print(f'species with learnsets: {len(data)}')
    if args.out:
        Path(args.out).write_text(json.dumps(data, indent=1, ensure_ascii=False))
        print(f'wrote {len(data)} learnsets -> {args.out}')


if __name__ == '__main__':
    main()
