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
| Region | Source ROM | Format | Status | maps | land | texsets | buildings | rooms |
|--------|-----------|--------|--------|-----:|-----:|--------:|----------:|------:|
| Kanto  | Pokémon HeartGold (IPKE) | DS Nitro G3D | ✅ collected | 199 | 246 | 41 | 102 | 93 |
| Johto  | Pokémon HeartGold (IPKE) | DS Nitro G3D | ✅ collected | 341 | 413 | 70 | 129 | 152 |
| Sinnoh | Pokémon Platinum (CPUE)  | DS Nitro G3D | ✅ collected | 533 | 580 | 138 | 358 | — |
| Hoenn  | Pokémon Omega Ruby (ECRA) | 3DS BCH/PICA200 | ⏳ parser in progress (see `hoenn/RECON.md`) | 416* | — | — | — | — |
| Unova  | Pokémon Black/White 1&2 | DS Nitro G3D | ⬜ not started (RE'd in main repo — see CLAUDE.md) | — | — | — | — | — |
| Kalos  | Pokémon X | 3DS BCH/PICA200 | ⬜ not started (reuses the ORAS BCH parser) | — | — | — | — | — |
| Alola  | Pokémon Ultra Moon | 3DS BCH/PICA200 | ⬜ not started (reuses the ORAS BCH parser) | — | — | — | — | — |

Kanto + Johto both come out of the single HeartGold ROM (its overworld is one
shared Johto/Kanto world). Verified by rendering every town in both regions —
terrain, textures and placed buildings all correct.

**DS vs 3DS split:** the three collected regions are **DS** games — their maps
are Nitro G3D (BMD0/NSBMD), decoded by `tools/nitro_g3d.py`. Hoenn/Kalos/Alola
are **3DS** games whose maps are **BCH (PICA200)** models in GARC archives — a
different format that needs `tools/bch.py` (in progress). Once the ORAS BCH
parser lands, Kalos (Pokémon X) and Alola (USUM) reuse it unchanged.

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
Hoenn (3DS) — extract Omega Ruby, then use the BCH parser (`tools/bch.py`,
in progress). Bootstrap + the full decoded BCH format are in `hoenn/RECON.md`:
```
curl -sSL "https://drive.usercontent.google.com/download?id=1_amuM3N1RISg2bk7J0M_7f7jwUBPijb_&export=download&confirm=t" -o /tmp/omega-ruby.zip
cd /tmp && unzip -o omega-ruby.zip "*.3ds"
python3 tools/3ds_decomp.py "/tmp/Pokemon Omega Ruby (USA) ... Decrypted.3ds" -o source/3ds/omegaruby
```

## Ownership
All assets are © Nintendo / Creatures Inc. / GAME FREAK inc., used with the
user's stated permission and credited. See each region's `ATTRIBUTION.md`. This
project claims no ownership of any Nintendo/Game Freak/Creatures IP.
