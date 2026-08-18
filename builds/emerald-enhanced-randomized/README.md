# Emerald Enhanced — Randomized build

Built from `source/emerald-enhanced` (pokeemerald/agbcc, MODERN=0).
ROM: `EmeraldEnhanced-Randomized.gba` (32 MB, standard GBA image).
Source diff: `ee_source_changes.patch` (apply inside `source/emerald-enhanced`).

## What changed

### 1. All wild Pokémon randomized
`src/wild_encounter.c` — every wild encounter (grass, water, rock smash, fishing)
now draws a fully random species. Randomization happens at the single choke point
`GenerateWildMonWithBossProbability()`, so all encounter paths are covered.

### 2. Pokédex entries added for every catchable species (Solgaleo, forms, etc.)
The previous randomizer froze on the Pokédex info screen because ~216 species
(Solgaleo, Necrozma, the Ultra Beasts, Tapus, Meltan/Melmetal, the Mega forms,
Alolan forms, all the Gen 4/5/7 mons EE never finished, …) had **no National Dex
number and no entry** — so the info screen showed zeros and hung.

These species now have **real Pokédex entries**:
- Every previously entry-less species is assigned a unique National Dex number
  and a full entry: **category, height, weight, and a real description**, sourced
  from PokéAPI (height in decimetres and weight in hectograms — the exact units
  the GBA Pokédex uses). See the generated files:
  `src/data/pokemon/pokedex_entries_random.h`, `pokedex_text_random.h`,
  `pokedex_natdex_random.h`.
- `NATIONAL_DEX_COUNT` and `POKEMON_SLOTS_NUMBER` were raised so the new species
  actually register as Seen/Caught (the old dex bit-arrays and the
  `GetSetPokedexFlag` gate stopped at 686).
- Forms that share a base Pokémon's dex slot (e.g. the two Lycanroc forms) keep
  showing the base entry — they already displayed fine.

Belt-and-suspenders so the dex can **never** hang again for any species:
- **Only dex-safe species are ever spawned.** `RyuIsSpeciesDexSafe()` requires a
  real species (nonzero base HP) with a valid, non-NULL Pokédex description — now
  satisfied by every real species.
- **Defensive guard in `src/pokedex.c`** — `PrintMonInfo()` falls back to
  placeholder text if a description is ever NULL.

### 3. Starters randomized (fresh line-up every time)
`src/starter_choose.c` — the starter line-up is now **re-rolled every time the
selection screen is shown**, drawing from the **entire dex** (any of the ~907
catchable species can appear). `RyuRollRandomStarters()` fills the 7 slots with
unique random dex-safe species in `Task_StarterChoose`, which runs on entry and
again after each decline — so picking a starter, viewing its stats, and choosing
**No** sends you back to a **completely new line-up**, exactly like the reference
ROM.

The chosen species is persisted to a save variable (`VAR_RANDOM_STARTER_SPECIES`,
0x417F) on confirm, and the later code that references the starter (credits,
`field_specials`) reads that var — so the starter stays correct for the whole
playthrough even though the on-screen line-up keeps re-rolling.

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
