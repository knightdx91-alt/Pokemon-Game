#!/usr/bin/env python3
"""Link the four regions into one walkable world.

Creates the physical inter-region seams so the player can WALK between
Kanto, Johto, Hoenn, and Sinnoh (no menus, no teleports):

  1. Johto Route 26 (east edge)  <->  Kanto Route 22 (west edge)
     The canon Johto/Kanto border (Route 26 runs along Kanto's west side).
     Direct seam — carves a small opening through Route 22's western trees.
  2. Johto Route 39 (west edge)  <->  [West Pass]  <->  Hoenn Route 115 (north edge)
     Hoenn lies to the south-west of Johto. West Pass is a generated
     connector route (custom region) with an L-shaped path.
  3. Kanto Route 25 (north edge) <->  [North Pass] <->  Sinnoh Route 221 (south edge)
     Sinnoh lies to the far north. North Pass is a generated connector
     route. (Route 221 is where Pal Park faces Kanto in the DS games.)

Mechanics used (all supported by src/engine/map.js):
  - GBA-style edge `connections` with a `region` field for cross-region hops.
  - Small "carves" through blocking edge tiles: the metatile of the nearest
    walkable tile is copied over the blockers (same map, same look) and the
    collision bytes cleared, so each opening looks native to its map.

Idempotent: connections are replaced by dest-map key, carves re-apply the
same values, and the connector maps are regenerated from scratch each run.

Run:  python3 tools/link_regions.py
"""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), '..')

GRASS_BEHAVIORS = {0x02, 0x03, 0x07}
CAVE_BEHAVIORS = {0x08}
WATER_BEHAVIORS = {0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x19, 0x1A, 0x1B}


def p(*parts):
    return os.path.join(ROOT, *parts)


def load_json(path):
    with open(path) as f:
        return json.load(f)


def save_json(path, data):
    with open(path, 'w') as f:
        json.dump(data, f)
    print(f'  wrote {os.path.relpath(path, ROOT)}')


class MapRef:
    """A map + its layout + tileset behaviors, with engine-equivalent walkability."""

    def __init__(self, region, name):
        self.region = region
        self.name = name
        self.map_path = p('data', 'maps', region, f'{name}.json')
        self.map = load_json(self.map_path)
        layout_id = self.map['layout']
        for lp in [p('data', 'layouts', region, f'{layout_id}.json'),
                   p('data', 'layouts', f'{layout_id}.json')]:
            if os.path.exists(lp):
                self.layout_path = lp
                self.layout = load_json(lp)
                break
        else:
            raise FileNotFoundError(f'layout {layout_id} for {region}/{name}')
        self.w = self.layout['width']
        self.h = self.layout['height']
        tsname = self.layout.get('tileset')
        tsp = p('data', 'tilesets', f'{tsname}.json')
        self.behaviors = load_json(tsp).get('behaviors') if os.path.exists(tsp) else None

    def walkable(self, x, y):
        if x < 0 or y < 0 or x >= self.w or y >= self.h:
            return False
        col = self.layout.get('collision')
        mts = self.layout.get('metatiles')
        if col and self.behaviors and mts:
            b = self.behaviors[mts[y * self.w + x]] if mts[y * self.w + x] < len(self.behaviors) else 0
            if b in GRASS_BEHAVIORS or b in CAVE_BEHAVIORS:
                return True
            if b in WATER_BEHAVIORS:
                return False
        if col and col[y * self.w + x] != 0:
            return False
        return True

    def nearest_walkable_metatile(self, x, y):
        """Metatile id of the closest walkable tile (for native-looking carves)."""
        mts = self.layout['metatiles']
        best = None
        for r in range(1, 12):
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    tx, ty = x + dx, y + dy
                    if self.walkable(tx, ty):
                        b = self.behaviors[mts[ty * self.w + tx]] if self.behaviors else 0
                        # prefer plain ground over encounter grass for the carve
                        if b not in GRASS_BEHAVIORS or best is None:
                            best = mts[ty * self.w + tx]
                        if best is not None and b not in GRASS_BEHAVIORS:
                            return best
            if best is not None:
                return best
        return None

    def carve(self, tiles):
        """Make the given (x, y) tiles walkable, copying a native ground tile."""
        mts = self.layout['metatiles']
        col = self.layout['collision']
        changed = 0
        for (x, y) in tiles:
            if self.walkable(x, y):
                continue
            fill = self.nearest_walkable_metatile(x, y)
            if fill is None:
                raise RuntimeError(f'no walkable tile near carve {x},{y} in {self.name}')
            mts[y * self.w + x] = fill
            col[y * self.w + x] = 0
            changed += 1
        print(f'  carved {changed} tiles in {self.region}/{self.name}')
        return changed

    def set_connection(self, direction, dest_map, offset, region=None):
        conns = self.map.setdefault('connections', None)
        if conns is None:
            self.map['connections'] = []
            conns = self.map['connections']
        entry = {'map': dest_map, 'offset': offset, 'direction': direction}
        if region:
            entry['region'] = region
        for i, c in enumerate(conns):
            if (c.get('map') or c.get('dest_map')) == dest_map:
                conns[i] = entry
                break
        else:
            conns.append(entry)
        print(f'  {self.region}/{self.name}: connection {direction} -> {dest_map}'
              + (f' ({region})' if region else ''))

    def save(self):
        save_json(self.map_path, self.map)
        save_json(self.layout_path, self.layout)


# --------------------------------------------------------------------------
# Connector-map generation (verified pallet_town metatile vocabulary — the
# same palette tools/make_example_map.py uses)
# --------------------------------------------------------------------------
TS = 'pallet_town'
GRASS, TALL_GRASS, FLOWER, WATER, PATH = 1, 13, 4, 41, 196
TREE_TL, TREE_TR, TREE_BL, TREE_BR = 28, 29, 20, 21


class Builder:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.mt = [GRASS] * (w * h)
        self.col = [0] * (w * h)

    def set(self, x, y, tile, blocked):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.mt[y * self.w + x] = tile
            self.col[y * self.w + x] = 1 if blocked else 0

    def rect(self, x0, y0, x1, y1, tile, blocked):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, tile, blocked)

    def tree_ring(self, openings):
        """2-thick tree border with rectangular openings [(x0,y0,x1,y1), ...]."""
        def is_open(x, y):
            return any(x0 <= x <= x1 and y0 <= y <= y1 for (x0, y0, x1, y1) in openings)
        for y in range(0, self.h, 2):
            for x in range(0, self.w, 2):
                on_edge = x < 2 or x >= self.w - 2 or y < 2 or y >= self.h - 2
                if not on_edge:
                    continue
                for (dx, dy, t) in ((0, 0, TREE_TL), (1, 0, TREE_TR), (0, 1, TREE_BL), (1, 1, TREE_BR)):
                    if not is_open(x + dx, y + dy):
                        self.set(x + dx, y + dy, t, True)


def write_custom_map(name, layout_id, builder, connections, map_type='MAP_TYPE_TOWN',
                     display_name=None, map_const=None):
    map_const = map_const or f'MAP_{name.upper()}'
    layout = {
        'id': layout_id, 'width': builder.w, 'height': builder.h,
        'primary_tileset': 'gTileset_General', 'secondary_tileset': 'gTileset_PalletTown',
        'tileset': TS, 'metatiles': builder.mt, 'collision': builder.col,
    }
    mapj = {
        'id': map_const, 'name': display_name or name, 'layout': layout_id,
        'region': 'custom', 'music': 'MUS_ROUTE1', 'map_type': map_type,
        'weather': 'WEATHER_SUNNY', 'show_map_name': True,
        'warps': [], 'npcs': [], 'signs': [], 'triggers': [],
        'connections': connections,
    }
    os.makedirs(p('data', 'layouts', 'custom'), exist_ok=True)
    os.makedirs(p('data', 'maps', 'custom'), exist_ok=True)
    save_json(p('data', 'layouts', 'custom', f'{layout_id}.json'), layout)
    save_json(p('data', 'maps', 'custom', f'{name}.json'), mapj)
    idx_path = p('data', 'maps', 'custom_index.json')
    idx = load_json(idx_path)
    # Drop stale keys for this map (e.g. an old MAP_WESTPASS spelling)
    for k in [k for k, v in idx.items() if v == name and k not in (map_const, name)]:
        del idx[k]
    idx[map_const] = name
    idx[name] = name
    save_json(idx_path, idx)


def main():
    # ------------------------------------------------------------------
    # 1. Johto Route 26 (east) <-> Kanto Route 22 (west) — direct seam
    #    Route 26's east edge is land only at rows 15..20 (by the Victory
    #    Road gate; the south stretch is sea). Route 22's west opening is
    #    carved at rows 10..12 (interior walkable from x≈3..4). Align
    #    Route 26 row 17 with Route 22 row 11: Route 26 oy = -6 rel Route 22.
    # ------------------------------------------------------------------
    print('[1] Johto Route 26 <-> Kanto Route 22')
    r26 = MapRef('johto', 'Route26')
    r22 = MapRef('kanto', 'Route22')
    r22.carve([(x, y) for y in (10, 11, 12) for x in (0, 1, 2, 3)])
    r22.set_connection('left', 'MAP_ROUTE26', -6, region='johto')
    r26.set_connection('right', 'MAP_ROUTE22', 6, region='kanto')
    r22.save()
    r26.save()

    # ------------------------------------------------------------------
    # 2. Johto Route 39 (west) <-> West Pass <-> Hoenn Route 115 (north)
    #    West Pass: 30x30, east opening rows 14..16 (aligns 1:1 with Route 39
    #    rows 14..16, offset 0 — open at Route 39's x=0 for rows 13..19),
    #    south opening cols 5..7 -> Route 115 cols 32..34 (offset -27).
    # ------------------------------------------------------------------
    print('[2] Johto Route 39 <-> West Pass <-> Hoenn Route 115')
    r39 = MapRef('johto', 'Route39')
    r115 = MapRef('hoenn', 'Route115')
    wp = Builder(30, 30)
    wp.tree_ring(openings=[(28, 14, 29, 16), (5, 28, 7, 29)])
    # L-shaped path: east opening -> west, then south to the south opening
    wp.rect(5, 14, 29, 16, PATH, False)
    wp.rect(5, 14, 7, 29, PATH, False)
    # scenery: tall grass pocket + pond
    wp.rect(10, 20, 16, 24, TALL_GRASS, False)
    wp.rect(20, 20, 25, 25, WATER, True)
    write_custom_map('WestPass', 'LAYOUT_WEST_PASS', wp, [
        {'map': 'MAP_ROUTE39', 'offset': 0, 'direction': 'right', 'region': 'johto'},
        {'map': 'MAP_ROUTE115', 'offset': -27, 'direction': 'down', 'region': 'hoenn'},
    ], display_name='West Pass', map_const='MAP_WEST_PASS')
    r39.set_connection('left', 'MAP_WEST_PASS', 0, region='custom')
    r115.carve([(x, y) for y in (0, 1) for x in (32, 33, 34)])
    r115.set_connection('up', 'MAP_WEST_PASS', 27, region='custom')
    r39.save()
    r115.save()

    # ------------------------------------------------------------------
    # 3. Kanto Route 25 (north) <-> North Pass <-> Sinnoh Route 221 (south)
    #    North Pass: 24x30, south opening cols 10..12 -> Route 25 cols 20..22
    #    (Route 25 up-conn offset 10), north opening cols 10..12 ->
    #    Route 221 cols 20..22 (open at its south edge; offset -10 on the
    #    pass's up-conn, +10 on Route 221's down-conn).
    # ------------------------------------------------------------------
    print('[3] Kanto Route 25 <-> North Pass <-> Sinnoh Route 221')
    r25 = MapRef('kanto', 'Route25')
    r221 = MapRef('sinnoh', 'route_221')
    np_ = Builder(24, 30)
    np_.tree_ring(openings=[(10, 0, 12, 1), (10, 28, 12, 29)])
    np_.rect(10, 0, 12, 29, PATH, False)
    np_.rect(4, 8, 8, 12, TALL_GRASS, False)
    np_.rect(15, 16, 20, 20, FLOWER, False)
    write_custom_map('NorthPass', 'LAYOUT_NORTH_PASS', np_, [
        {'map': 'MAP_ROUTE25', 'offset': -10, 'direction': 'down', 'region': 'kanto'},
        {'map': 'MAP_HEADER_ROUTE_221', 'offset': -10, 'direction': 'up', 'region': 'sinnoh'},
    ], display_name='North Pass', map_const='MAP_NORTH_PASS')
    r25.carve([(x, y) for y in (0, 1) for x in (20, 21, 22)])
    r25.set_connection('up', 'MAP_NORTH_PASS', 10, region='custom')
    r221.set_connection('down', 'MAP_NORTH_PASS', 10, region='custom')
    r25.save()
    r221.save()

    print('\nAll region links written.')
    print('Walk test points:')
    print('  Kanto Route22 (0..2, 10..12)  <-> Johto Route26 (38, 61..63)')
    print('  Johto Route39 (0, 14..16)     <-> WestPass east opening')
    print('  WestPass south opening         -> Hoenn Route115 (32..34, 0..1)')
    print('  Kanto Route25 (20..22, 0..1)  <-> NorthPass south opening')
    print('  NorthPass north opening        -> Sinnoh route_221 (20..22, 31)')


if __name__ == '__main__':
    main()
