# Pokédex-fix tooling (already applied — kept for reproducibility)

These scripts generated the Pokédex entries for the ~216 species EE left without
a National Dex number/entry. **You normally do NOT need to run these again** —
their output is already baked into `../ee_source_changes.patch` as the three
`src/data/pokemon/pokedex_*_random.h` files. Keep them only in case the dex set
needs regenerating (e.g. species added/removed).

Files:
- `fetch.py` — reads `broken.json`, maps each EE species name to PokéAPI slugs
  (handles Mega/Alolan/Primal/therian/etc. forms), fetches category (genus),
  flavor text, height (dm), weight (hg), writes `data.json`. Caches responses.
- `generate.py` — reads `data.json` + the EE source, recomputes the truly-broken
  set (real species with no dex number OR a number with no entry), assigns each a
  free National Dex number ≥686, and writes into the submodule:
  `pokedex_text_random.h`, `pokedex_entries_random.h`, `pokedex_natdex_random.h`.
- `data.json` — the fetched PokéAPI data (so you don't have to re-hit the API).
- `broken.json` / `assign.json` — analysis snapshots.

To regenerate from scratch (only if needed):
```
cd source/emerald-enhanced && git apply ../../builds/emerald-enhanced-randomized/ee_source_changes.patch  # base state
# edit broken set logic if the species list changed, then:
python3 builds/emerald-enhanced-randomized/dexfix-tools/generate.py   # rewrites the 3 _random.h files
```
PokéAPI height is in decimetres and weight in hectograms — the exact units the
GBA Pokédex struct uses, so values copy across directly.
