#!/usr/bin/env python3
"""Build MAP_CONST -> filename lookup tables for each region's map JSONs.

Produces data/maps/<region>_index.json for every region directory that
contains extracted map files (kanto, johto, hoenn, sinnoh, ...).
"""
import json
import os

MAPS_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'maps')


def build_region_index(region):
    region_dir = os.path.join(MAPS_DIR, region)
    if not os.path.isdir(region_dir):
        return None

    index = {}
    for fname in os.listdir(region_dir):
        if not fname.endswith('.json'):
            continue
        fpath = os.path.join(region_dir, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            map_id = data.get('id')
            if map_id:
                # Value is the filename (without .json) passed to GameMap.load()
                index[map_id] = fname[:-5]
        except Exception as e:
            print(f'Warning: could not parse {region}/{fname}: {e}')

    out_file = os.path.join(MAPS_DIR, f'{region}_index.json')
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2, sort_keys=True)
    print(f'Written {len(index)} entries to {out_file}')
    return index


if __name__ == '__main__':
    for entry in sorted(os.listdir(MAPS_DIR)):
        if os.path.isdir(os.path.join(MAPS_DIR, entry)):
            build_region_index(entry)
