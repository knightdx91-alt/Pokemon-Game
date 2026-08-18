# Emerald Enhanced — Randomized build

Built from `source/emerald-enhanced` (pokeemerald/agbcc, MODERN=0).
ROM: `EmeraldEnhanced-Randomized.gba` (32 MB, standard GBA image).
Source diff: `ee_source_changes.patch` (apply inside `source/emerald-enhanced`).

## What changed

### 1. All wild Pokémon randomized
`src/wild_encounter.c` — every wild encounter (grass, water, rock smash, fishing)
now draws a fully random species. Randomization happens at the single choke point
`GenerateWildMonWithBossProbability()`, so all encounter paths are covered.

### 2. No more Pokédex hang on new catches
The previous randomizer froze on the Pokédex info screen because randomized
species could map to a National Dex slot with **no entry** (NULL description →
the text printer hung; height/weight showed zeros).

Two-layer fix:
- **Only dex-safe species are ever spawned.** `RyuIsSpeciesDexSafe()` requires a
  real species (nonzero base HP) whose National Dex entry has a valid
  (non-NULL) description. The wild and starter randomizers both use it, so every
  catchable Pokémon is guaranteed a working Pokédex entry.
- **Defensive guard in `src/pokedex.c`** — `PrintMonInfo()` falls back to
  placeholder text if a description is ever NULL, so the info screen can never
  hang for *any* species (gifts, evolutions, trades included).

### 3. Starters randomized
`src/starter_choose.c` — the starter choices are randomized per save.
`RyuGetRandomStarterSpecies(slot)` is seeded from the player's Trainer ID, so the
displayed sprite, cry, and the Pokémon you actually receive always match and stay
consistent for the whole playthrough, while differing between new games. Starters
are also dex-safe.

### 4. Dev mode via button combo
`src/field_control_avatar.c` — in the overworld, **hold L + R and press SELECT**
to toggle EE's dev mode (`FLAG_RYU_DEV_MODE`). PC-login sound = ON, PC-off
sound = OFF. This unlocks the Dev Menu in the Start menu and the other dev
features EE already gates behind that flag.

## Rebuilding
```
# toolchain: arm-none-eabi-gcc/binutils + agbcc installed to tools/agbcc,
# poryscript in tools/poryscript
cd source/emerald-enhanced && make -j$(nproc)
```
