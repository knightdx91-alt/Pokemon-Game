#!/usr/bin/env python3
"""Gen-7 (Ultra Moon) message-text decoder + name extractor.

Decodes the game's text containers from the message GARC extraction
`a/0/3/<lang>/<file>.bin` (tools/3ds_decomp.py output). Gen-6/7 text is a
"section" container whose lines are per-line XOR-encrypted (PKHeX algorithm):
each line i uses key = (0x7C89 + i*0x2983) & 0xFFFF, XORing each UTF-16LE unit
and rotating the key left by 3 bits after each unit.

Language dirs (verified): 0/1 = Japanese, **2 = English**, 3 = French,
4 = Italian, 5 = German, 6 = Spanish, 7 = Korean, 8/9 = Chinese.
Name files (English, index in a/0/3/2), verified by content:
  0060 = species names (808)   0118 = move names (729)
  0101 = ability names (234)   0040 = item names (960)

Usage:
  python3 tools/usum_text.py --file 0060           # dump a text file
  python3 tools/usum_text.py --names               # write data/pokemon/usum_names.json
"""
import argparse
import json
import struct
from pathlib import Path

ROOT = Path('source/3ds/ultramoon/unpacked/a/0/3')
KEY_BASE = 0x7C89
KEY_ADVANCE = 0x2983

# English text-file indices (see module docstring).
ENGLISH = 2
IDX = {'species': 60, 'moves': 118, 'abilities': 101, 'items': 40}


def decode_textfile(data):
    """Return the list of decoded strings in a Gen-7 text container."""
    line_count = struct.unpack_from('<H', data, 2)[0]
    sec_off = struct.unpack_from('<I', data, 12)[0]
    table = sec_off + 4  # after the section-length u32
    out = []
    for i in range(line_count):
        off, length = struct.unpack_from('<II', data, table + i * 8)
        start = sec_off + off
        key = (KEY_BASE + i * KEY_ADVANCE) & 0xFFFF
        s = []
        for j in range(length):
            v = struct.unpack_from('<H', data, start + j * 2)[0] ^ key
            key = ((key << 3) | (key >> 13)) & 0xFFFF
            if v == 0x0000:      # NUL terminator
                break
            if v == 0xE000:      # gender/newline markers etc. -> space
                s.append(' ')
            elif v == 0x246E:    # non-standard ♂
                s.append('♂')
            elif v == 0x246D:    # non-standard ♀
                s.append('♀')
            elif 0x20 <= v < 0xE000:
                s.append(chr(v))
        out.append(''.join(s).strip())
    return out


def load(name, lang=ENGLISH):
    data = (ROOT / str(lang) / f'{IDX[name]:04d}.bin').read_bytes()
    return decode_textfile(data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--file', help='raw text-file index in a/0/3/<lang>')
    ap.add_argument('--lang', type=int, default=ENGLISH)
    ap.add_argument('--names', action='store_true')
    ap.add_argument('-o', '--out', default='data/pokemon/usum_names.json')
    args = ap.parse_args()

    if args.file:
        data = (ROOT / str(args.lang) / f'{int(args.file):04d}.bin').read_bytes()
        for i, s in enumerate(decode_textfile(data)):
            print(f'{i:4d}  {s}')
        return

    if args.names:
        names = {k: load(k, args.lang) for k in IDX}
        Path(args.out).write_text(json.dumps(names, ensure_ascii=False, indent=1))
        print(f'wrote {args.out}: ' + ', '.join(
            f'{k}={len(v)}' for k, v in names.items()))
        # sanity
        sp, mv, ab = names['species'], names['moves'], names['abilities']
        print(f"  #1={sp[1]} #6={sp[6]} #150={sp[150]}")
        print(f"  move1={mv[1]} ability1={ab[1]}")


if __name__ == '__main__':
    main()
