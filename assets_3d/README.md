# 3D Map Assets (per region)

Self-contained 3D field-map assets for the game, one folder per region. Each
region folder is collected verbatim from its source ROM by
`tools/collect_region_3d.py` and contains:

- `land/`       — land-data cells (embedded BMD0 terrain / room geometry)
- `textures/`   — NSBTX texture sets
- `buildings/`  — placed exterior building models (bm_field)
- `rooms/`      — interior room sub-models (bm_room)
- `MANIFEST.json` — every map -> its matrix, land cells, texture set
- `ATTRIBUTION.md` — ownership / credit for the source assets

## Regions & sources
| Region | Source ROM | Status |
|--------|-----------|--------|
| Kanto  | Pokemon HeartGold (IPKE) | collected |
| Johto  | Pokemon HeartGold (IPKE) | pending |
| Sinnoh | Pokemon Platinum (CPUE)  | pending |
| Hoenn  | Pokemon Omega Ruby (3DS) | pending (needs BCH extractor) |

## Ownership
All assets are © Nintendo / Creatures Inc. / GAME FREAK inc., used with
permission and credited. See each region's `ATTRIBUTION.md`.
