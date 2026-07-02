#!/usr/bin/env python3
"""Convert Ultra Moon (Gen 7) item data -> data/pokemon JSON.

Reads the item GARC `a/0/1/9` (960 members × 36 bytes) from the
tools/3ds_decomp.py extraction, joins item names (tools/usum_text.py, English
file 0040). Item entry fields (pk3DS Gen-7 layout, verified):
  0x00 u16 price (STORED as buy_price/10 → real price = ×10),
  0x02 held_effect, 0x05 fling_effect, 0x06 fling_power.
Verified: Ultra Ball 800, Great Ball 600, Poké Ball 200, Master Ball 0.

Emits `usum_items.json` keyed by item id: {name, price, flingPower}.

Usage:
  python3 tools/usum_items.py --verify
  python3 tools/usum_items.py -o data/pokemon/usum_items.json
"""
import argparse
import json
import struct
from pathlib import Path

SRC = Path('source/3ds/ultramoon/unpacked/a/0/1/9')
NAMES = Path('data/pokemon/usum_names.json')


def parse(i, item_names):
    d = (SRC / f'{i:04d}.bin').read_bytes()
    price = struct.unpack_from('<H', d, 0)[0] * 10
    rec = {'name': item_names[i] if i < len(item_names) else str(i),
           'price': price}
    fling = d[6] if len(d) > 6 else 0
    if fling:
        rec['flingPower'] = fling
    return rec


def build():
    item_names = json.loads(NAMES.read_text())['items']
    n = len(list(SRC.glob('*.bin')))
    return {str(i): parse(i, item_names) for i in range(1, n)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('-o', '--out')
    ap.add_argument('--verify', action='store_true')
    args = ap.parse_args()
    data = build()
    if args.verify or not args.out:
        for i in (1, 2, 3, 4, 17):
            print(f'  #{i}: {data[str(i)]}')
        print(f'total items: {len(data)}')
    if args.out:
        Path(args.out).write_text(json.dumps(data, indent=1, ensure_ascii=False))
        print(f'wrote {len(data)} items -> {args.out}')


if __name__ == '__main__':
    main()
