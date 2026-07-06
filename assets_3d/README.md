# 3D Map Assets (per region)

Self-contained 3D field-map assets for the game, **one folder per region**
(binaries and all). Each region folder is collected verbatim from its source ROM
by `tools/collect_region_3d.py` and is fully self-contained:

- `land/`       — land-data cells (embedded BMD0 terrain / interior-room geometry)
- `textures/`   — NSBTX texture sets (the FULL area set, incl. shared road/grass/flower textures)
- `buildings/`  — placed exterior building models (bm_field)
- `rooms/`      — interior room sub-models (bm_room)
- `renders/`    — verification PNGs (one representative town per region)
- `MANIFEST.json` — every map → its matrix, land cells, texture set
- `ATTRIBUTION.md` — ownership / credit for the source assets

## Regions & sources
| Region | Source ROM | Status | maps | land | texsets | buildings | rooms |
|--------|-----------|--------|-----:|-----:|--------:|----------:|------:|
| Kanto  | Pokémon HeartGold (IPKE) | ✅ collected | 199 | 246 | 41 | 102 | 93 |
| Johto  | Pokémon HeartGold (IPKE) | ✅ collected | 341 | 413 | 70 | 129 | 152 |
| Sinnoh | Pokémon Platinum (CPUE)  | ✅ collected | 533 | 580 | 138 | 358 | — |
| Hoenn  | Pokémon Omega Ruby (3DS) | ⏳ building — BCH parser (see `hoenn/RECON.md`) | 416* | — | — | — | — |

Kanto + Johto both come out of the single HeartGold ROM (its overworld is one
shared Johto/Kanto world). Verified by rendering every town in both regions —
terrain, textures and placed buildings all correct.

## Regenerating
```
# 1. HeartGold ROM (user's Drive, ~128 MB) + NDS decomp (both ephemeral/gitignored):
curl -sSL "https://drive.usercontent.google.com/download?id=1hvHYAXor7UuDIXEUIt55j4FLNEc7rWuP&export=download&confirm=t" -o /tmp/pokemon-heartgold.nds
python3 tools/nds_decomp.py /tmp/pokemon-heartgold.nds -o source/nds/IPKE
# 2. pokeheartgold decomp must be present (names every map's region/matrix/area);
#    cloned at /home/user/pokeheartgold
pip install pillow numpy
# 3. Collect (writes assets_3d/<region>/):
python3 tools/collect_region_3d.py kanto
python3 tools/collect_region_3d.py johto
```
Sinnoh needs no ROM — the pokeplatinum decomp ships the decoded assets. With the
`pokeplatinum` clone at `/home/user/pokeplatinum`:
```
python3 tools/collect_sinnoh_3d.py
```

## Ownership
All assets are © Nintendo / Creatures Inc. / GAME FREAK inc., used with the
user's stated permission and credited. See each region's `ATTRIBUTION.md`. This
project claims no ownership of any Nintendo/Game Freak/Creatures IP.
