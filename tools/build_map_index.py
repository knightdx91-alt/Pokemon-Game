#!/usr/bin/env python3
"""Build a MAP_CONST -> filename lookup table from all kanto map JSONs."""
import json
import os

KANTO_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'maps', 'kanto')
OUT_FILE  = os.path.join(os.path.dirname(__file__), '..', 'data', 'maps', 'kanto_index.json')

index = {}
for fname in os.listdir(KANTO_DIR):
    if not fname.endswith('.json'):
        continue
    fpath = os.path.join(KANTO_DIR, fname)
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        map_id   = data.get('id')
        map_name = data.get('name') or fname[:-5]
        if map_id:
            index[map_id] = map_name
    except Exception as e:
        print(f'Warning: could not parse {fname}: {e}')

with open(OUT_FILE, 'w', encoding='utf-8') as f:
    json.dump(index, f, indent=2, sort_keys=True)

print(f'Written {len(index)} entries to {OUT_FILE}')
