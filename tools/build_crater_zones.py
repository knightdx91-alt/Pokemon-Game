#!/usr/bin/env python3
"""Build src/crater/zones_gen.js for the Pokémon Crater clone (crater.html).

Parses the repo's real encounter data for all four regions —
  data/encounters/kanto.json   (pret FireRed wild_encounter_groups)
  data/encounters/hoenn.json   (pret Emerald wild_encounter_groups)
  data/encounters/johto.json   (HnS per-map land/surf/fishing, time-of-day species)
  data/encounters/sinnoh.json  (pokeplatinum per-map land/surf/rods/swarms)
— groups multi-floor maps into single zones, converts every species to the
repo's sprite slug convention (data/sprites/pokemon/front/<slug>.png), merges
land/water/fishing pools into one weighted spawn pool per zone, and injects
hand-authored legendary rare-spawns plus synthetic special zones.

Output: window.CRATER_ZONES = { regions: [...], zones: {...} }
Only species with committed sprites (front+back+icon) are kept.

Run: python3 tools/build_crater_zones.py
"""
import json, os, re, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENC = os.path.join(ROOT, 'data', 'encounters')
SPR = os.path.join(ROOT, 'data', 'sprites', 'pokemon')
OUT = os.path.join(ROOT, 'src', 'crater', 'zones_gen.js')

# ---------------------------------------------------------------- sprites
def sprite_slugs():
    front = {f[:-4] for f in os.listdir(os.path.join(SPR, 'front')) if f.endswith('.png')}
    back = {f[:-4] for f in os.listdir(os.path.join(SPR, 'back')) if f.endswith('.png')}
    icon = {f[:-4] for f in os.listdir(os.path.join(SPR, 'icons')) if f.endswith('.png')}
    return front & back & icon

SLUGS = sprite_slugs()
MISSING = collections.Counter()

def species_slug(const):
    """SPECIES_MR_MIME -> mr_mime (matches the sprite/file naming convention)."""
    s = const.replace('SPECIES_', '').lower()
    return s

def keep(slug):
    if slug in SLUGS:
        return True
    MISSING[slug] += 1
    return False

# ------------------------------------------------------- slot weight tables
LAND_W = [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1]
WATER_W = [60, 30, 5, 4, 1]
FISH_W = [70, 30, 60, 20, 20, 40, 40, 15, 4, 1]  # old(2)+good(3)+super(5)

def wt(table, i, default=5):
    return table[i] if i < len(table) else default

# ---------------------------------------------------------------- pools
class Zone:
    def __init__(self, zid, name, region, env):
        self.id, self.name, self.region, self.env = zid, name, region, env
        self.pool = {}   # slug -> [minLv, maxLv, weight]
        self.rares = []  # [slug, level, weight]
        self.special = False

    def add(self, slug, lo, hi, w):
        if w <= 0 or not keep(slug):
            return
        if slug in self.pool:
            p = self.pool[slug]
            p[0] = min(p[0], lo); p[1] = max(p[1], hi); p[2] += w
        else:
            self.pool[slug] = [lo, hi, w]

    def out(self):
        pool = sorted(([s] + v for s, v in self.pool.items()), key=lambda e: -e[3])
        o = {'name': self.name, 'region': self.region, 'env': self.env,
             'pool': [[s, lo, hi, w] for s, lo, hi, w in pool]}
        if self.rares:
            o['rares'] = self.rares
        if self.special:
            o['special'] = True
        return o

# ------------------------------------------------- pret-name prettification
STRIP_SUFFIX = [
    r'B\d?F$', r'\d?F$', r'\dR$', r'Room\d*$', r'Rooms$',
    r'(North|South|East|West|Center|Northwest|Northeast|Southwest|Southeast)$',
    r'(Entrance|Exterior|Interior|Inside|Outside|Summit|Lookout|Depths)$',
    r'(Stairs|Lower|Inner|Ice|Left|Right|Tunnel|LowWater)$',
    r'UnusedRubySapphireMap\d$', r'HiddenFloorCorridors$', r'Corridors$',
    r'Stevens(Room|Cave)?$', r'LowTide\w*$', r'[A-Z][a-z]+Chamber$',
    r'(Summit|Ruby)Path$', r'\d+$',
]

def base_name(label):
    s = re.sub(r'_(FireRed|LeafGreen)$', '', label)
    s = re.sub(r'^[sg]', '', s).replace('_', '')
    while True:
        before = s
        for pat in STRIP_SUFFIX:
            if pat == r'\d+$' and re.search(r'Route\d+$', s):
                continue  # route numbers are identity, not floor suffixes
            s = re.sub(pat, '', s)
        if s == before or not s:
            break
    return s or label

PRETTY = {
    'SSAnne': 'S.S. Anne', 'DiglettsCave': "Diglett's Cave",
    'PokemonTower': 'Pokémon Tower', 'PokemonMansion': 'Pokémon Mansion',
    'MtMoon': 'Mt. Moon', 'MtEmber': 'Mt. Ember', 'MtPyre': 'Mt. Pyre',
    'NewMauville': 'New Mauville', 'CaveOfOrigin': 'Cave of Origin',
    'Maniac': 'Maniac Tunnel', 'Rock': 'Rock Tunnel', 'Rusturf': 'Rusturf Tunnel',
    'PokemonLeague': 'Pokémon League', 'Resort': 'Resort Area',
}

def pretty(base):
    if base in PRETTY:
        return PRETTY[base]
    s = re.sub(r'(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Za-z])(?=\d)', ' ', base)
    return s

def classify(name, has_land, has_water):
    n = name.lower()
    if any(k in n for k in ('ember', 'fiery', 'jagged', 'magma', 'stark')):
        return 'volcano'
    if any(k in n for k in ('icefall', 'shoal', 'snowpoint', 'acuity', 'ice')):
        return 'ice'
    if any(k in n for k in ('cave', 'tunnel', 'mt.', 'mt ', 'falls', 'underpass',
                            'pillar', 'coronet', 'seafloor', 'underwater', 'moon')):
        return 'cave'
    if any(k in n for k in ('forest', 'woods', 'bush', 'marsh', 'tree', 'shrine')):
        return 'forest'
    if any(k in n for k in ('tower', 'mansion', 'ruins', 'ship', 'temple',
                            'hideout', 'mauville', 'power plant', 'lab')):
        return 'building'
    if any(k in n for k in ('desert', 'mirage')):
        return 'sand'
    if not has_land and has_water:
        return 'water'
    return 'grass'

# --------------------------------------------------------------- kanto/hoenn
def load_pret(path, region, zones):
    data = json.load(open(path))
    groups = collections.OrderedDict()
    for enc in data['wild_encounter_groups'][0]['encounters']:
        groups.setdefault(base_name(enc['base_label']), []).append(enc)
    for base, encs in groups.items():
        name = pretty(base)
        has_land = any(e.get('land_mons') for e in encs)
        has_water = any(e.get('water_mons') or e.get('fishing_mons') for e in encs)
        z = Zone(f'{region}_{re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")}',
                 name, region, classify(name, has_land, has_water))
        for e in encs:
            for field, table in (('land_mons', LAND_W), ('water_mons', WATER_W),
                                 ('rock_smash_mons', WATER_W), ('fishing_mons', FISH_W)):
                grp = e.get(field)
                if not grp:
                    continue
            # water/fishing share the pool at reduced weight vs land
                scale = 1.0 if field == 'land_mons' else 0.4
                for i, m in enumerate(grp['mons']):
                    z.add(species_slug(m['species']), m['min_level'], m['max_level'],
                          round(wt(table, i) * scale, 1))
        if z.pool:
            zones[z.id] = z

# ---------------------------------------------------------------------- johto
def johto_species(sp):
    """Flatten possibly-nested time-of-day dicts to a list of species consts."""
    if isinstance(sp, dict):
        out = []
        for v in sp.values():
            out.extend(johto_species(v))
        return list(dict.fromkeys(out))
    return [sp]

def johto_level(lv):
    if isinstance(lv, dict):
        return lv.get('min', 5), lv.get('max', lv.get('min', 5))
    return lv, lv

def load_johto(path, zones):
    data = json.load(open(path))
    for key, rec in data.items():
        m = re.fullmatch(r'R(\d\d)', key)
        if not m:
            continue
        num = int(m.group(1))
        name = f'Route {num}'
        land = rec.get('land') or {}
        surf = rec.get('surf') or {}
        has_land = bool(land.get('mons'))
        has_water = bool(surf.get('mons'))
        if not (has_land or has_water):
            continue
        z = Zone(f'johto_route_{num}', name, 'johto',
                 classify(name, has_land, has_water))
        for field, table, scale in (('land', LAND_W, 1.0), ('surf', WATER_W, 0.4),
                                    ('rock_smash', WATER_W, 0.3), ('fishing', WATER_W, 0.4),
                                    ('headbutt', WATER_W, 0.2)):
            grp = rec.get(field) or {}
            # 'fishing' nests {old_rod,good_rod,super_rod} sub-groups
            subgroups = [grp] if 'mons' in grp else [g for g in grp.values()
                                                     if isinstance(g, dict) and 'mons' in g]
            for sub in subgroups:
                for i, mon in enumerate(sub.get('mons') or []):
                    lo, hi = johto_level(mon.get('level', 5))
                    specs = johto_species(mon['species'])
                    for sp in specs:
                        z.add(species_slug(sp), lo, hi,
                              round(wt(table, i) * scale / len(specs), 1))
        if z.pool:
            zones[z.id] = z

# --------------------------------------------------------------------- sinnoh
SINNOH_STRIP = {'north', 'south', 'east', 'west', 'left', 'right', 'room',
                'rooms', 'tunnel', 'entrance', 'exterior', 'inside', 'outside',
                'summit', 'lookout', 'upper', 'lower', 'inner', 'low', 'water',
                'stairs', 'cavern', 'and', 'middle', 'back', 'corridor',
                'dining', 'area', 'side', 'long', 'short', 'dead', 'end',
                'deadend', 'maniac', 'northwest', 'northeast', 'southwest',
                'southeast', 'giratina', 'pillar'}

SINNOH_REBASE = {'route_209_lost_tower': 'lost_tower'}

def sinnoh_base(key):
    toks = key.split('_')
    while len(toks) > 1 and (toks[-1] in SINNOH_STRIP or toks[-1].isdigit()
                             or re.fullmatch(r'r\d+|b?\d+f', toks[-1])):
        if toks[0] == 'route' and len(toks) == 2:
            break  # keep the route number
        toks.pop()
    base = '_'.join(toks)
    return SINNOH_REBASE.get(base, base)

def load_sinnoh(path, zones):
    data = json.load(open(path))
    groups = collections.OrderedDict()
    for key, rec in data.items():
        if key.startswith('unknown'):
            continue
        groups.setdefault(sinnoh_base(key), []).append(rec)
    for base, recs in groups.items():
        name = pretty(''.join(w.capitalize() for w in base.split('_')))
        name = name.replace('Mt Coronet', 'Mt. Coronet')
        has_land = any(r.get('land') for r in recs)
        has_water = any(r.get('surf') for r in recs)
        z = Zone(f'sinnoh_{base}', name, 'sinnoh',
                 classify(name, has_land, has_water))
        for r in recs:
            for field, table, scale in (('land', LAND_W, 1.0), ('surf', WATER_W, 0.4),
                                        ('super_rod', WATER_W, 0.3),
                                        ('good_rod', WATER_W, 0.2),
                                        ('old_rod', WATER_W, 0.1)):
                for i, mon in enumerate(r.get(field) or []):
                    lv = mon.get('level', 5)
                    z.add(species_slug(mon['species']), lv, lv,
                          round(wt(table, i) * scale, 1))
            for field in ('swarms', 'day', 'night', 'radar'):
                for mon in (r.get(field) or []):
                    if isinstance(mon, str):   # bare SPECIES_ const, no level info
                        sp, lv = mon, 22
                    else:
                        sp, lv = mon['species'], mon.get('level', 22)
                    z.add(species_slug(sp), lv, lv, 3)
        if z.pool:
            zones[z.id] = z

# ------------------------------------------------ legendaries / special zones
RARES = {  # attached to real zones: [slug, level, weight]
    'kanto_cerulean_cave': [['mewtwo', 70, 1]],
    'kanto_seafoam_islands': [['articuno', 50, 1]],
    'kanto_power_plant': [['zapdos', 50, 1]],
    'kanto_mt_ember': [['moltres', 50, 1]],
    'kanto_route_12': [['snorlax', 30, 2]],
    'kanto_route_16': [['snorlax', 30, 2]],
    'johto_route_36': [['entei', 40, 1], ['raikou', 40, 1]],
    'johto_route_37': [['suicune', 40, 1], ['raikou', 40, 1]],
    'johto_route_38': [['entei', 40, 1], ['suicune', 40, 1]],
    'sinnoh_lake_acuity': [['uxie', 50, 1]],
    'sinnoh_lake_valor': [['azelf', 50, 1]],
    'sinnoh_lake_verity': [['mesprit', 50, 1]],
    'sinnoh_stark_mountain': [['heatran', 50, 1]],
    'sinnoh_snowpoint_temple': [['regigigas', 70, 1]],
    'sinnoh_turnback_cave': [['giratina', 70, 1]],
    'hoenn_sky_pillar': [['rayquaza', 70, 1]],
    'hoenn_cave_of_origin': [['groudon', 60, 1], ['kyogre', 60, 1]],
    'hoenn_route_105': [['latias', 40, 1], ['latios', 40, 1]],
    'hoenn_route_125': [['latias', 40, 1], ['latios', 40, 1]],
}

SPECIALS = [  # synthetic legendary zones — unlocked with all 8 badges
    ('kanto', 'Faraway Island', 'forest', [['mew', 50, 10]]),
    ('johto', 'Bell Tower', 'building', [['ho_oh', 60, 10]]),
    ('johto', 'Whirl Islands', 'cave', [['lugia', 60, 10], ['seel', 30, 30], ['horsea', 28, 30]]),
    ('johto', 'Ilex Shrine', 'forest', [['celebi', 50, 10]]),
    ('hoenn', 'Sealed Chamber', 'cave', [['regirock', 40, 10], ['regice', 40, 10], ['registeel', 40, 10]]),
    ('hoenn', 'Southern Island', 'forest', [['latias', 50, 10], ['latios', 50, 10]]),
    ('hoenn', 'Birth Island', 'water', [['deoxys', 50, 10]]),
    ('sinnoh', 'Spear Pillar', 'cave', [['dialga', 70, 10], ['palkia', 70, 10]]),
    ('sinnoh', 'Newmoon Island', 'forest', [['darkrai', 60, 10]]),
    ('sinnoh', 'Fullmoon Island', 'forest', [['cresselia', 60, 10]]),
    ('sinnoh', 'Flower Paradise', 'grass', [['shaymin', 50, 10]]),
    ('sinnoh', 'Hall of Origin', 'building', [['arceus', 80, 10]]),
]

# ------------------------------------------------------------------- main
def main():
    zones = collections.OrderedDict()
    load_pret(os.path.join(ENC, 'kanto.json'), 'kanto', zones)
    load_johto(os.path.join(ENC, 'johto.json'), zones)
    load_pret(os.path.join(ENC, 'hoenn.json'), 'hoenn', zones)
    load_sinnoh(os.path.join(ENC, 'sinnoh.json'), zones)

    for zid, rares in RARES.items():
        if zid in zones:
            zones[zid].rares = [r for r in rares if keep(r[0])]
        else:
            print(f'!! rare target zone missing: {zid}')

    for region, name, env, pool in SPECIALS:
        zid = f'{region}_sp_{re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")}'
        z = Zone(zid, name, region, env)
        z.special = True
        for slug, lv, w in pool:
            z.add(slug, max(1, lv - 2), lv + 2, w)
        if z.pool:
            zones[zid] = z

    regions = []
    for rid, rname in (('kanto', 'Kanto'), ('johto', 'Johto'),
                       ('hoenn', 'Hoenn'), ('sinnoh', 'Sinnoh')):
        ids = [z.id for z in zones.values() if z.region == rid]
        # routes first (numeric order), then dungeons, specials last
        def sort_key(zid):
            z = zones[zid]
            m = re.search(r'Route (\d+)', z.name)
            return (2 if z.special else (0 if m else 1),
                    int(m.group(1)) if m else 0, z.name)
        ids.sort(key=sort_key)
        regions.append({'id': rid, 'name': rname, 'zones': ids})

    out = {'regions': regions, 'zones': {zid: z.out() for zid, z in zones.items()}}
    js = ('// GENERATED by tools/build_crater_zones.py — do not edit by hand.\n'
          '// Source: data/encounters/{kanto,hoenn,johto,sinnoh}.json\n'
          'window.CRATER_ZONES = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        f.write(js)

    n_pool = sum(len(z.pool) for z in zones.values())
    print(f'zones: {len(zones)}  pool entries: {n_pool}  -> {OUT} ({len(js)//1024} KB)')
    for rid, rname in (('kanto', 'Kanto'), ('johto', 'Johto'), ('hoenn', 'Hoenn'), ('sinnoh', 'Sinnoh')):
        print(f'  {rname}: {sum(1 for z in zones.values() if z.region == rid)}')
    if MISSING:
        print('dropped species (no sprite):', dict(MISSING.most_common()))

if __name__ == '__main__':
    main()
