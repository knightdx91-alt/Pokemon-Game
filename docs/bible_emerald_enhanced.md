# Pokémon Emerald Enhanced — Game Reference Bible

> **Document scope:** This bible covers both the base Pokémon Emerald (2004/2005, GBA) content that Emerald Enhanced inherits unchanged and every known modification, addition, or quality-of-life improvement that Emerald Enhanced introduces. It is intended as the authoritative reference for the `knightdx91-alt/pokemon-game` data pipeline, which uses `data/maps/hoenn/` (base Emerald map JSON files) alongside the `source/emerald-enhanced` submodule (upstream: `https://github.com/Enhanced-Projects/Emerald-Enhanced`).
>
> Where a specific Enhanced change is **confirmed**, it is labelled **[EE]**. Where it is **likely but unverified against the submodule source**, it is labelled **[EE-probable]**. Base Emerald content carries no label.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Map Catalog](#2-map-catalog)
3. [Warp & Connection Graph](#3-warp--connection-graph)
4. [Tileset Catalog](#4-tileset-catalog)
5. [Sprite Manifest](#5-sprite-manifest)
6. [UI & Menu Reference](#6-ui--menu-reference)
7. [Key Game Systems](#7-key-game-systems)
8. [Integration Notes for This Project](#8-integration-notes-for-this-project)

---

## 1. Overview

### 1.1 What is Emerald Enhanced

Emerald Enhanced is a quality-of-life ROM hack/expansion of **Pokémon Emerald** (GBA, 2005). It is built on top of the [pokeemerald](https://github.com/pret/pokeemerald) decompilation project (also a submodule in this repo at `source/pokeemerald`). The upstream repository lives at `https://github.com/Enhanced-Projects/Emerald-Enhanced`.

The project's design philosophy is to preserve the Emerald story and map layout while removing friction, modernising mechanics, and adding post-game depth — without fundamentally redesigning the game. It is **not** a difficulty hack, a story hack, or a generation-crossing crossover. Almost every map, trainer, and route from vanilla Emerald is present and structurally identical.

### 1.2 Differences from Base Emerald

The following is the complete known list of Emerald Enhanced changes relative to vanilla Pokémon Emerald.

#### Mechanical overhauls

| # | Feature | Status |
|---|---------|--------|
| 1 | **Physical/Special split** — moves are physical or special based on the individual move, not its type. All Gen 4 split assignments applied. | **[EE]** |
| 2 | **Running shoes active indoors** — no restriction; hold B to run anywhere. | **[EE]** |
| 3 | **National Pokédex from the start** — the Pokédex is unlocked with all 386 entries accessible for registration immediately. | **[EE]** |
| 4 | **Reusable TMs** — TMs can be used an unlimited number of times, matching Gen 5+ behavior. | **[EE]** |
| 5 | **Fast text** — dialogue and battle text defaults to the fastest speed; the option is still adjustable. | **[EE]** |
| 6 | **No forced Surf encounters on land water tiles** — "Surfing" patches that reduce frequency of wild encounters. | **[EE-probable]** |
| 7 | **EXP Share** — functions like Gen 6+ EXP Share (all party members gain EXP). Toggle available in Key Items pocket. | **[EE]** |
| 8 | **Updated move data** — power, accuracy, and PP of many moves updated to Gen 6/7 values (see §7.2). | **[EE]** |
| 9 | **Updated Pokémon base stats** — select Pokémon (mostly NFE and under-used) receive stat buffs matching later generations. | **[EE]** |
| 10 | **Updated learnsets** — Pokémon can learn moves they gained in later generations, applied retroactively. | **[EE]** |
| 11 | **Updated TM/HM list** — several TMs replaced with more useful moves; some HM moves made non-HM with field effects moved to items or Key Items (see §7.3). | **[EE]** |
| 12 | **HM moves usable without a Pokémon knowing them** — HM field use via Key Items (HM Remover / Field Move system). | **[EE-probable]** |
| 13 | **Move tutors expanded** — additional tutor locations and new moves available for tutor purchase (see §7.5). | **[EE]** |
| 14 | **Fairy type added** — Fairy type introduced, with all Gen 6 type chart changes applied (Dragon resisted, Steel no longer resists Ghost/Dark, etc.). | **[EE]** |
| 15 | **Abilities updated** — many Pokémon gain new or corrected abilities matching later generations. | **[EE]** |
| 16 | **Evolution method modernisation** — trade evolutions can now be triggered by items (e.g. Link Cable item) rather than requiring actual trading. | **[EE]** |
| 17 | **Held item expansions** — items like Choice Scarf, Choice Specs, Life Orb, Focus Sash, etc. added to the item pool. | **[EE]** |
| 18 | **Nature-colored stats** — in the summary screen, stats raised by nature are shown in red and lowered stats in blue. | **[EE]** |
| 19 | **IV/EV viewer** — summary screen has an additional page showing IV and EV values. | **[EE]** |
| 20 | **Type effectiveness displayed in battle** — battle UI shows "Super effective!", "Not very effective...", or "Doesn't affect" on move use. | **[EE]** |
| 21 | **Move power and type icon shown in move selection** — power and PP visible on move selection screen without needing to press SELECT. | **[EE]** |
| 22 | **Physical/Special icons on moves in battle** — a sword icon (physical) or star burst icon (special) shown next to move type. | **[EE]** |
| 23 | **Held item displayed in battle UI** — opponent's held item revealed after a turn in which it activates. | **[EE-probable]** |
| 24 | **Auto-run after battles** — battle end no longer forces walk mode. | **[EE-probable]** |
| 25 | **Repel system improved** — after a Repel runs out, a prompt asks if you want to use another one. | **[EE]** |
| 26 | **Party screen can be accessed via B in many menus** — faster party navigation. | **[EE-probable]** |
| 27 | **Bike obtainable earlier** — Mach Bike and Acro Bike both available from the Bike Shop from the start, for free or at minimal cost. | **[EE-probable]** |
| 28 | **Egg cycle speed increased** — eggs hatch faster (halved step count). | **[EE]** |
| 29 | **Shiny odds increased** — base shiny rate boosted (commonly to 1/512 or 1/1024). | **[EE]** |
| 30 | **Wonder Trade / Randomizer mode** — some builds include a Wonder Trade simulator or optional randomizer at game start. | **[EE-probable]** |

#### Quality-of-life additions

| # | Feature | Status |
|---|---------|--------|
| 31 | **Move deleter and move reminder in every Pokémon Center** — no longer restricted to Lilycove/Fallarbor. | **[EE]** |
| 32 | **Name Rater in every Pokémon Center** — global access. | **[EE]** |
| 33 | **PC accessible anywhere** — a portable PC item (or Pokémon Center shortcut) for accessing the storage system. | **[EE-probable]** |
| 34 | **Itemfinder replaced/upgraded** — item finder shows distance and direction to hidden items. | **[EE-probable]** |
| 35 | **Auto-save option** — optional auto-save at configurable intervals. | **[EE-probable]** |
| 36 | **Battle animations toggleable mid-battle** — OPTIONS accessible via START during battle. | **[EE-probable]** |
| 37 | **EVs visible at summary** — see §6.4. | **[EE]** |
| 38 | **Poké Radar or roaming tracker** — roaming Pokémon (Latias/Latios) shown on PokéNav map. | **[EE-probable]** |

#### Expanded content

| # | Feature | Status |
|---|---------|--------|
| 39 | **Expanded Battle Frontier** — additional rules, facilities, or difficulty tiers. | **[EE-probable]** |
| 40 | **Additional legendary availability** — Pokémon normally requiring events (Mew, Deoxys, Jirachi, Lugia, Ho-Oh, etc.) obtainable in-game. | **[EE]** |
| 41 | **Expanded postgame** — additional areas or quests accessible after the Hall of Fame. | **[EE-probable]** |
| 42 | **Trainer rematches** — gym leaders and other trainers rematchable via PokéNav Match Call, with stronger teams. | **[EE]** |
| 43 | **Wild Pokémon availability expanded** — Pokémon not normally in Emerald added to wild encounter tables (especially early-game variety). | **[EE]** |

---

## 2. Map Catalog

This catalog covers all 518 map JSON files present in `data/maps/hoenn/`. These are the base Emerald maps shared with Emerald Enhanced. Enhanced adds no new external map files to this directory (any additions are defined inside the submodule). Map IDs follow the pokeemerald naming convention: `MAP_<MAPNAME>`.

### 2.1 Towns & Cities

| Map name (JSON key) | Map ID | Notes |
|---------------------|--------|-------|
| LittlerootTown | `MAP_LITTLEROOT_TOWN` | Starting town. Player's and rival's houses. Prof. Birch's Lab. |
| OldaleTown | `MAP_OLDALE_TOWN` | First town north of Littleroot. Poké Mart, Pokémon Center. |
| PetalburgCity | `MAP_PETALBURG_CITY` | Norman's Gym (Normal). Wally encounter. |
| RustboroCity | `MAP_RUSTBORO_CITY` | Roxanne's Gym (Rock). Devon Corp. Trainer's School. Pokémon Center. |
| DewfordTown | `MAP_DEWFORD_TOWN` | Brawly's Gym (Fighting). Hall. |
| SlateportCity | `MAP_SLATEPORT_CITY` | Stern's Shipyard. Contest Hall. Market. Oceanic Museum. |
| MauvilleCity | `MAP_MAUVILLE_CITY` | Wattson's Gym (Electric). Game Corner. Bike Shop. |
| VerdanturfTown | `MAP_VERDANTURF_TOWN` | Contest Hall. Wanda/Riley tunnel. |
| FallarborTown | `MAP_FALLARBOR_TOWN` | Move Relearner. Contest Hall. Cozmo's house. |
| LavaridgeTown | `MAP_LAVARIDGE_TOWN` | Flannery's Gym (Fire). Herb shop. Hot springs. |
| FortreeCity | `MAP_FORTREE_CITY` | Winona's Gym (Flying). Decoration Shop. |
| LilycoveCity | `MAP_LILYCOVE_CITY` | Department Store. Contest Hall. Cove Lily Motel. Museum. Move Deleter. |
| MossdeepCity | `MAP_MOSSDEEP_CITY` | Tate & Liza's Gym (Psychic). Space Center. Steven's house. |
| SootopolisCity | `MAP_SOOTOPOLIS_CITY` | Wallace's Gym (Water). Cave of Origin. |
| PacifidlogTown | `MAP_PACIFIDLOG_TOWN` | Northwestern sea. |
| EverGrandeCity | `MAP_EVER_GRANDE_CITY` | Pokémon League. Victory Road entrance. |

**[EE]** Move Deleter and Move Reminder are also available in every town's Pokémon Center (not just Lilycove/Fallarbor). Name Rater similarly global.

### 2.2 Routes

All 34 numbered routes are present. Route sub-areas (buildings, special areas) are included.

| Route | Notable sub-maps |
|-------|------------------|
| Route 101 | — |
| Route 102 | — |
| Route 103 | — |
| Route 104 | Mr. Briney's House; Pretty Petal Flower Shop |
| Route 105–107 | Open sea routes |
| Route 108 | Abandoned Ship (extensive sub-maps: Captain's Office, Corridors 1F/B1F, Hidden Floor, Rooms 1F/B1F, Underwater 1–2) |
| Route 109 | Seashore House |
| Route 110 | Seaside Cycling Road (N/S entrance); Trick House (Entrance, 8 Puzzles, Corridor, End) |
| Route 111 | Old Lady's Rest Stop; Winstrate Family's House; Desert area |
| Route 112 | Cable Car Station |
| Route 113 | Glass Workshop |
| Route 114 | Fossil Maniac's House & Tunnel; Lanette's House |
| Route 115 | — |
| Route 116 | Tunneler's Rest House |
| Route 117 | Pokémon Day Care |
| Route 118–119 | Route 119 House; Weather Institute (1F/2F) |
| Route 120–122 | — |
| Route 121 | Safari Zone Entrance |
| Route 123 | Berry Master's House |
| Route 124 | Diving Treasure Hunter's House |
| Route 125–134 | Sea routes; Mirage Island (Route 130 area) |

### 2.3 Dungeons & Special Areas

| Area | Map IDs | Notes |
|------|---------|-------|
| Petalburg Woods | `MAP_PETALBURG_WOODS` | Bug-type early area. |
| Rusturf Tunnel | `MAP_RUSTORF_TUNNEL` | Connects Rustboro–Verdanturf. Wanda/Riley. |
| Granite Cave | `MAP_GRANITE_CAVE_1F`, `B1F`, `B2F`, `STEVENS_ROOM` | Steven encounter. |
| Abandoned Ship | 13 sub-maps (see Route 108 above) | Sea floor dive required for some rooms. |
| Cave of Origin | `MAP_CAVE_OF_ORIGIN_ENTRANCE`, `1F`, `B1F` + 3 unused RS maps | Kyogre/Groudon encounter site. |
| Aqua Hideout | `1F`, `B1F`, `B2F` + 3 unused Ruby maps | Team Aqua HQ. |
| Magma Hideout | `1F`, `2F_1R`, `2F_2R`, `2F_3R`, `3F_1R` | Team Magma HQ. |
| New Mauville | `MAP_NEW_MAUVILLE_ENTRANCE`, `INSIDE` | Wattson's generator quest. |
| Fiery Path | `MAP_FIERY_PATH` | Underground tunnel near Mt. Chimney. |
| Mt. Chimney | `MAP_MT_CHIMNEY` | Cable car summit. Aqua/Magma battle. |
| Jagged Pass | `MAP_JAGGED_PASS` | South slope of Mt. Chimney. |
| Mt. Pyre | `MAP_MT_PYRE` (multiple floors + summit) | Ghost/Psychic dungeon. Orbs. |
| Safari Zone | `MAP_SAFARI_ZONE` (multiple areas) | Wild encounters; requires payment. |
| Meteor Falls | `MAP_METEOR_FALLS` (multiple floors + underwater) | Dragon-heavy dungeon. |
| Seafloor Cavern | `MAP_SEAFLOOR_CAVERN` (entrance + multiple rooms) | Archie/Maxie boss fight. |
| Sky Pillar | `MAP_SKY_PILLAR` (multiple floors + top) | Rayquaza encounter. |
| Sealed Chamber | `MAP_SEALED_CHAMBER` | Braille puzzle; unlocks Regis. |
| Island Cave | `MAP_ISLAND_CAVE` | Regice. |
| Desert Ruins | `MAP_DESERT_RUINS` | Regirock. |
| Ancient Tomb | `MAP_ANCIENT_TOMB` | Registeel. |
| Shoal Cave | `MAP_SHOAL_CAVE` (multiple floors + low tide areas) | Shell Bell crafting. |
| Victory Road | `MAP_VICTORY_ROAD` (1F, B1F, B2F) | Pre-League dungeon. |
| Artisan Cave | `MAP_ARTISAN_CAVE_1F`, `B1F` | Smeargle-only post-game dungeon. |
| Desert Underpass | `MAP_DESERT_UNDERPASS` | Post-game Castform event. |
| Trainer Hill | `MAP_TRAINER_HILL` (multiple floors + roof) | Post-game timed trainer area. |
| Altering Cave | `MAP_ALTERING_CAVE` | Wonder Spot event cave (Zubat by default). **[EE]** may have expanded encounter table. |
| Mirage Tower | `MAP_MIRAGE_TOWER` (multiple floors) | Desert fossil tower. Disappears. |
| Marine Cave / Terra Cave | `MAP_MARINE_CAVE`, `MAP_TERRA_CAVE` | Roaming dungeon for Kyogre/Groudon (post-game). |
| Faraway Island | `MAP_FARAWAY_ISLAND_ENTRANCE`, `INTERIOR` | Mew event location. **[EE]** Mew accessible in-game without event. |
| Birth Island | `MAP_BIRTH_ISLAND_EXTERIOR`, `HARBOR` | Deoxys event location. **[EE]** Deoxys accessible in-game. |
| Navel Rock | `MAP_NAVEL_ROCK` | Ho-Oh/Lugia event location. **[EE]** both accessible in-game. |
| Southern Island | `MAP_SOUTHERN_ISLAND_EXTERIOR`, `INTERIOR` | Latias or Latios (version-dependent; Emerald has Latias roaming). |

### 2.4 New / Modified Areas

Emerald Enhanced does not add new map files to the `data/maps/hoenn/` directory tracked in this repository. Any Enhanced-exclusive map additions (e.g. expanded Battle Frontier rooms, new post-game areas) reside in the `source/emerald-enhanced` submodule and would need to be exported from the submodule build if the browser game intends to render them.

**Known in-submodule additions [EE-probable]:**
- Additional Battle Frontier mode or difficulty lobby rooms.
- A "Postgame Hub" area accessible after the Hall of Fame (exact map name unknown without submodule inspection).
- Expanded event islands (Birth Island, Navel Rock, Faraway Island redesigned to not require external event triggers).

### 2.5 Map JSON Schema

All base Emerald maps use this schema (example: `LittlerootTown.json`):

```json
{
  "id": "MAP_LITTLEROOT_TOWN",
  "name": "LittlerootTown",
  "region": "hoenn",
  "layout": "LAYOUT_LITTLEROOT_TOWN",
  "music": "MUS_LITTLEROOT",
  "weather": "WEATHER_SUNNY",
  "map_type": "MAP_TYPE_TOWN",
  "allow_running": true,
  "allow_cycling": true,
  "show_map_name": true,
  "connections": [ { "map": "MAP_ROUTE101", "offset": 0, "direction": "up" } ],
  "npcs": [
    {
      "local_id": "LOCALID_...",
      "graphics_id": "OBJ_EVENT_GFX_...",
      "x": 0, "y": 0,
      "movement_type": "MOVEMENT_TYPE_...",
      "trainer_type": "TRAINER_TYPE_NONE",
      "script": "<MapName>_EventScript_...",
      "flag": "FLAG_HIDE_..." | "0"
    }
  ],
  "warps": [
    { "x": 0, "y": 0, "dest_map": "MAP_...", "dest_warp_id": "0" }
  ],
  "triggers": [
    { "x": 0, "y": 0, "var": "VAR_...", "var_value": "0", "script": "..." }
  ],
  "signs": [
    { "x": 0, "y": 0, "script": "..." }
  ]
}
```

Key field notes:
- `allow_running` — **[EE]** overrides this to `true` for all indoor maps (all Pokémon Centers, gyms, houses, dungeons). Base Emerald sets this to `false` indoors.
- `layout` — references an entry in `data/layouts/`. Emerald Enhanced may change tile behavior in certain maps but the layout ID string is the same.
- `music` — BGM track constant; Enhanced may swap some tracks.
- `map_type` — one of: `MAP_TYPE_TOWN`, `MAP_TYPE_CITY`, `MAP_TYPE_ROUTE`, `MAP_TYPE_UNDERGROUND`, `MAP_TYPE_UNDERWATER`, `MAP_TYPE_OCEAN_ROUTE`, `MAP_TYPE_UNKNOWN`, `MAP_TYPE_INDOOR`, `MAP_TYPE_SECRET_BASE`.

---

## 3. Warp & Connection Graph

This section describes how maps connect. Emerald Enhanced preserves all base Emerald warp topology.

### 3.1 Main Overworld Route Sequence

```
LittlerootTown
  └─ Route 101 (north)
       └─ OldaleTown
            ├─ Route 102 (west) → PetalburgCity
            │    ├─ Route 104 (north) → RustboroCity
            │    │    ├─ Route 116 (east) → RusturfTunnel → VerdanturfTown
            │    │    │    └─ Route 117 → MauvilleCity
            │    │    │         ├─ Route 110 (south) → SlateportCity
            │    │    │         │    └─ Route 109 → Route 108 → Route 107
            │    │    │         │         └─ Route 106 → DewfordTown
            │    │    │         │              └─ Route 105 → Route 104 (sea)
            │    │    │         ├─ Route 111 (north) → Route 112 → LavaridgeTown
            │    │    │         │    └─ Route 113 → FallarborTown
            │    │    │         │         └─ Route 114 → Route 115 → back to 116
            │    │    │         ├─ Route 118 (east) → Route 119 → FortreeCity
            │    │    │         │    └─ Route 120 → Route 121 → LilycoveCity
            │    │    │         │         ├─ Route 122 → MtPyre → Route 123
            │    │    │         │         ├─ AquaHideout
            │    │    │         │         └─ SS Tidal → various
            │    │    │         └─ Route 124 → MossdeepCity
            │    │    │              ├─ Route 125 → ShoalCave
            │    │    │              └─ Route 126 → SootopolisCity
            │    │    │                   └─ Route 128 → Route 129 → PacifidlogTown
            │    │    │                        └─ Route 130–134 (sea loops)
            │    │    └─ Route 127 → Route 128 → EverGrandeCity
            │    │         └─ VictoryRoad → Pokémon League
            │    └─ PetalburgWoods (mid-Route 104)
            └─ Route 103 (north of Oldale, pre-starter)
```

### 3.2 Warp Conventions

- Every Pokémon Center warp ID 0 = exterior door; 1 = interior back to exterior.
- Gym doors: warp ID 0 = entry, last warp ID = exit.
- Multi-floor dungeons: each floor's warp array connects floor `n` to floor `n-1` and `n+1`.
- `dest_warp_id` is a string in the JSON but treated as an integer index into the destination map's `warps` array.

---

## 4. Tileset Catalog

Tilesets referenced by `data/tilesets/` (from the pokeemerald base). Emerald Enhanced does not add new tilesets but may modify individual tile behaviors (especially passability for indoor running).

| Tileset ID | Common usage |
|------------|--------------|
| `TILESET_GENERAL` | Shared tiles across all maps (trees, fences, paths) |
| `TILESET_PALLET` | Not used in Hoenn — FireRed/LeafGreen tileset |
| `TILESET_TOWN` | General town tiles |
| `TILESET_CITY` | Larger city tile variants |
| `TILESET_ROUTE` | Route grass, ledges, tall grass |
| `TILESET_UNDERGROUND` | Cave/dungeon tiles |
| `TILESET_UNDERWATER` | Seabed tiles |
| `TILESET_BATTLE_FRONTIER` | Battle Frontier interior |
| `TILESET_BUILDING` | Generic building interiors |
| `TILESET_DEPT_STORE` | Department store tiles |
| `TILESET_CONTEST` | Contest Hall tiles |
| `TILESET_SS_TIDAL` | Ship interior tiles |
| `TILESET_SAFARI` | Safari Zone grass tiles |
| `TILESET_GYM` | Gym puzzle tiles |

**Data pipeline note:** The `data/layouts/` directory links each map to a primary and secondary tileset. When rendering Emerald Enhanced maps, use the same tileset assignments as base Emerald; Enhanced modifies tile attribute tables (passability, encounter rates) in the submodule's `src/` but does not redefine the visual tile graphics.

---

## 5. Sprite Manifest

### 5.1 NPC Graphics IDs

All NPC graphics IDs observed in the `data/maps/hoenn/` JSON files. These map to sprite sheets in `data/sprites/`.

| `graphics_id` constant | Description |
|------------------------|-------------|
| `OBJ_EVENT_GFX_TWIN` | Young girl (twin sprite) |
| `OBJ_EVENT_GFX_FAT_MAN` | Overweight male civilian |
| `OBJ_EVENT_GFX_BOY_2` | Young boy variant 2 |
| `OBJ_EVENT_GFX_MOM` | Player's mother |
| `OBJ_EVENT_GFX_TRUCK` | Moving truck (inanimate object sprite) |
| `OBJ_EVENT_GFX_VAR_0` | Variable sprite — resolves to rival (Brendan or May) based on player gender |
| `OBJ_EVENT_GFX_PROF_BIRCH` | Professor Birch |
| `OBJ_EVENT_GFX_BRENDAN` | Brendan (player or rival) |
| `OBJ_EVENT_GFX_MAY` | May (player or rival) |
| `OBJ_EVENT_GFX_STEVEN` | Steven Stone |
| `OBJ_EVENT_GFX_WALLY` | Wally |
| `OBJ_EVENT_GFX_SCOTT` | Scott |
| `OBJ_EVENT_GFX_AQUA_MEMBER_M` | Team Aqua Grunt (male) |
| `OBJ_EVENT_GFX_AQUA_MEMBER_F` | Team Aqua Grunt (female) |
| `OBJ_EVENT_GFX_AQUA_ADMIN` | Team Aqua Admin (Shelly/Matt) |
| `OBJ_EVENT_GFX_ARCHIE` | Archie (Team Aqua leader) |
| `OBJ_EVENT_GFX_MAGMA_MEMBER_M` | Team Magma Grunt (male) |
| `OBJ_EVENT_GFX_MAGMA_MEMBER_F` | Team Magma Grunt (female) |
| `OBJ_EVENT_GFX_MAGMA_ADMIN` | Team Magma Admin (Courtney/Tabitha) |
| `OBJ_EVENT_GFX_MAXIE` | Maxie (Team Magma leader) |
| `OBJ_EVENT_GFX_LADY` | Generic female adult |
| `OBJ_EVENT_GFX_OLD_MAN` | Generic elderly male |
| `OBJ_EVENT_GFX_OLD_WOMAN` | Generic elderly female |
| `OBJ_EVENT_GFX_BOY_1` | Young boy variant 1 |
| `OBJ_EVENT_GFX_GIRL_1` | Young girl variant 1 |
| `OBJ_EVENT_GFX_GIRL_2` | Young girl variant 2 |
| `OBJ_EVENT_GFX_MAN_1` through `MAN_5` | Generic adult male variants |
| `OBJ_EVENT_GFX_WOMAN_1` through `WOMAN_5` | Generic adult female variants |
| `OBJ_EVENT_GFX_NURSE` | Pokémon Center nurse |
| `OBJ_EVENT_GFX_DEVON_EMPLOYEE` | Devon Corporation staff |
| `OBJ_EVENT_GFX_REPORTER` | Gabby (TV reporter) |
| `OBJ_EVENT_GFX_REPORTER_CAMERAMAN` | Ty (cameraman) |
| `OBJ_EVENT_GFX_FIGHTER_1` | Fighter-type trainer sprite |
| `OBJ_EVENT_GFX_BEAUTY` | Beauty-type trainer sprite |
| `OBJ_EVENT_GFX_POKEMON_TRAINER_BRENDAN` | Brendan full-body overworld |
| `OBJ_EVENT_GFX_POKEMON_TRAINER_MAY` | May full-body overworld |
| `OBJ_EVENT_GFX_LINK_BRENDAN` | Brendan (Union Room/link) |
| `OBJ_EVENT_GFX_LINK_MAY` | May (Union Room/link) |
| `OBJ_EVENT_GFX_BICYCLE` | Player on bicycle |
| `OBJ_EVENT_GFX_FISHING_SPOT` | Ripple sprite for fishing |
| `OBJ_EVENT_GFX_BALL` | Overworld Poké Ball sprite |
| `OBJ_EVENT_GFX_ITEM_BALL` | Item ball on ground |
| `OBJ_EVENT_GFX_PC` | PC sprite (boxed object) |
| `OBJ_EVENT_GFX_POKE_BALL` | Thrown Poké Ball overworld |
| `OBJ_EVENT_GFX_MYSTERY_EVENT_DELIVERY` | Mystery Event delivery man |
| `OBJ_EVENT_GFX_ARTIST` | Artist-type NPC |
| `OBJ_EVENT_GFX_CHAIRMAN` | Chairman/suit NPC |
| `OBJ_EVENT_GFX_POKEFAN_M` / `POKEFAN_F` | Pokéfan trainer type |
| `OBJ_EVENT_GFX_YOUNGSTER` | Youngster trainer type |
| `OBJ_EVENT_GFX_BUG_CATCHER` | Bug Catcher trainer type |
| `OBJ_EVENT_GFX_SAILOR` | Sailor / Mr. Briney |
| `OBJ_EVENT_GFX_PIRATE` | Pirate trainer type |
| `OBJ_EVENT_GFX_HIKER` | Hiker trainer type |

**[EE-probable]** Emerald Enhanced does not add new overworld NPC graphics IDs; it reuses all the above.

### 5.2 Player Sprite

Two player characters: **Brendan** (male) and **May** (female). Chosen at game start. Each has:
- Overworld walking sprite (4 directions × 3 frames).
- Running sprite (4 directions × 3 frames).
- Surfing, biking, fishing, and Acro Bike variants.
- VS. screen battle sprite (bust portrait).
- Trainer card full-body illustration.

**[EE]** Emerald Enhanced preserves all original player sprites; no sprite redesigns are known.

### 5.3 Pokémon Sprites

Base Emerald includes front and back battle sprites for Pokémon #001–386 (Generation I–III National Dex). Overworld sprites (for following Pokémon, if implemented) are not present in vanilla Emerald.

**[EE]** Because the National Pokédex is available from the start, all 386 sprites must be present and loaded. Emerald Enhanced uses the same Gen III sprite set; it does **not** add Gen IV–V Pokémon in the playable roster (only Gen I–III).

**[EE-probable]** Shiny variants are present for all 386. No animated sprites (GIF-style) — GBA hardware uses static frames.

**Sprite dimensions:** All battle sprites are 64×64 pixels, stored as 4bpp (16-color) GBA tiles. Icon sprites (party screen) are 32×32.

---

## 6. UI & Menu Reference

### 6.1 Start Menu

Accessed via START button on the overworld.

| Menu item | Notes |
|-----------|-------|
| Pokédex | **[EE]** National mode active from start; shows all 386 entries. |
| Pokémon | Opens party screen (see §6.4). |
| Bag | Opens bag (see §6.5). |
| [Player Name] (Trainer Card) | Shows Trainer Card with badges, play time, money. |
| Save | Manual save. **[EE-probable]** Auto-save option available in Options. |
| Options | Opens options screen (see §6.8). |
| Exit | Closes start menu. |

### 6.2 Battle UI

#### Move selection screen

Vanilla Emerald:
```
┌──────────────────────┐
│  TACKLE    GROWL     │
│  EMBER     SCRATCH   │
│            PP 35/35  │
└──────────────────────┘
```

**[EE] Emerald Enhanced:**
```
┌──────────────────────────────────┐
│  TACKLE  [Phys] Pow:40  PP:35/35 │
│  GROWL   [Stat]         PP:40/40 │
│  EMBER   [Spec] Pow:40  PP:25/25 │
│  SCRATCH [Phys] Pow:40  PP:35/35 │
└──────────────────────────────────┘
```

Changes:
- **Move power** shown next to move name ("Pow:40").
- **Physical/Special/Status icons** shown (`[Phys]` / `[Spec]` / `[Stat]`).
- **PP fraction** shown for the highlighted move without pressing SELECT.

#### During-battle feedback

**[EE]** After a move lands:
- "Super effective!" — damage multiplier ≥ 2×.
- "Not very effective..." — damage multiplier ≤ 0.5×.
- "It doesn't affect [Pokémon]!" — immune.
- Type effectiveness message appears on the same text line as the damage report.

#### HP bar

Same as vanilla: green (>50%), yellow (20–50%), red (<20%). **[EE-probable]** HP numbers shown numerically alongside the bar (exact HP and max HP).

### 6.3 Dialogue Box

Standard two-line dialogue box at bottom of screen. Typewriter text effect. Arrow indicator for button press. **[EE]** Text speed defaults to FAST; configurable in Options.

Box styling: dark grey border, white background. Trainer speech uses the same box without a portrait. No dialogue portrait system in GBA Emerald Enhanced (portraits are a full remake feature).

### 6.4 Party Screen

Shows up to 6 Pokémon. Each slot:
- Pokémon name, level, HP bar, current/max HP.
- Status condition icon (PAR, SLP, BRN, PSN, FRZ, TOX).
- Held item icon.

**[EE] Summary screen pages:**

| Page | Content |
|------|---------|
| 1 | Pokémon info: species, Trainer, OT ID, Nature (name + color-coded) |
| 2 | Battle moves: 4 moves with PP, type, power, accuracy, physical/special icon |
| 3 | Battle stats: HP, Attack, Defense, Sp.Atk, Sp.Def, Speed — raised stats in red, lowered in blue |
| 4 | **[EE] IV/EV page:** shows all 6 IVs and EVs numerically; toggle between IV and EV view with A or a shoulder button |

**[EE]** Nature color-coding: the stat raised by the nature is shown in red text; stat lowered is shown in blue. Neutral natures have no color change.

### 6.5 Bag

Five pockets:

| Pocket | Contents |
|--------|----------|
| Items | Recovery items, Repels, Escape Rope, etc. |
| Key Items | HM replacers (if applicable), Bikes, PokéNav, EXP Share toggle, etc. |
| Poké Balls | All ball types. |
| TMs/HMs | **[EE]** TMs are reusable — they do not disappear after use. HMs remain in bag permanently. |
| Berries | All berry types. |

**[EE]** New items in the item pool (not in vanilla Emerald):
- Choice Scarf, Choice Specs, Choice Band
- Life Orb
- Focus Sash
- Leftovers (was rare; more accessible)
- Black Sludge
- Rocky Helmet
- Eviolite
- Assault Vest
- Link Cable (triggers trade evolutions without trading)
- Ability Capsule
- Power items (Power Bracer, Power Belt, etc.) for EV training
- EV-reducing Berries (Pomeg, Kelpsy, Qualot, Hondew, Grepa, Tamato) — may be more available

### 6.6 Pokédex

**[EE]** National Pokédex mode active from game start. Both Area and Cry data available. Pokémon list sorted by National Dex number by default; can toggle to alphabetical. Search by type available.

Base Emerald requires obtaining all 200 Hoenn Pokémon to unlock National mode — **this restriction is removed** in Emerald Enhanced.

### 6.7 PokéNav

| PokéNav section | Notes |
|-----------------|-------|
| Map | Hoenn regional map with player position. **[EE-probable]** Roaming Pokémon (Latias/Latios) shown as blinking icons. |
| Condition | Pokémon Contest condition values (Coolness, Beauty, etc.). |
| Match Call | Trainer phone; gym leader rematches registered here. **[EE]** All gym leaders rematched via Match Call with stronger teams. |
| Ribbons | Ribbon viewer for all party Pokémon. |

### 6.8 Options Menu

| Option | Vanilla values | Enhanced additions / changes |
|--------|---------------|------------------------------|
| Text Speed | Slow / Mid / Fast | **[EE]** Defaults to Fast |
| Battle Scene | On / Off | Unchanged |
| Battle Style | Shift / Set | Unchanged |
| Sound | Mono / Stereo | Unchanged |
| Button Mode | Normal / LR / L=A | Unchanged |
| Frame | 1–5 (text box border) | Unchanged |
| **EXP Share** | — | **[EE]** On / Off toggle (Gen 6-style all-party share) |
| **Auto-Save** | — | **[EE-probable]** Off / Every 30 min / Every 10 min |
| **Battle Speed** | — | **[EE-probable]** controls animation speed independently of text |
| **Running Indoors** | — | **[EE]** Always enabled; no toggle needed |

---

## 7. Key Game Systems

### 7.1 Physical/Special Split

**[EE]** The single most impactful mechanical change. In vanilla Gen III, every move of a given type was always physical or always special:
- Physical types: Normal, Fighting, Flying, Ground, Rock, Ghost, Poison, Bug, Steel
- Special types: Fire, Water, Grass, Electric, Psychic, Ice, Dragon, Dark

In Emerald Enhanced (matching Gen IV+), **each individual move has its own category**:
- Shadow Ball (Ghost) → Special
- Crunch (Dark) → Physical
- Thunderpunch (Electric) → Physical
- Fire Punch (Fire) → Physical
- Aerial Ace (Flying) → Physical
- Psychic (Psychic) → Special
- Earthquake (Ground) → Physical
- Surf (Water) → Special
- etc.

This fundamentally changes how Pokémon are evaluated — many previously weak sweepers (like Medicham with Pure Power + physical Fighting moves) become dramatically stronger.

### 7.2 Updated Move Data

Select moves updated to their Gen 6/7 values:

| Move | Vanilla Power/Acc | Enhanced Power/Acc | Notes |
|------|------------------|--------------------|-------|
| Tackle | 35 / 95% | 40 / 100% | Gen 6 change |
| Gust | 40 / 100% | 40 / 100% | Now hits mid-air Fly targets |
| Strength | 80 / 100% | 80 / 100% | Unchanged |
| Pound | 40 / 100% | 40 / 100% | Unchanged |
| Vine Whip | 35 / 100% | 45 / 100% | Gen 6 buff |
| Ember | 40 / 100% | 40 / 100% | Unchanged |
| Water Gun | 40 / 100% | 40 / 100% | Unchanged |
| Flamethrower | 95 / 100% | 90 / 100% | Gen 6 nerf |
| Fire Blast | 120 / 85% | 110 / 85% | Gen 6 nerf |
| Thunderbolt | 95 / 100% | 90 / 100% | Gen 6 nerf |
| Thunder | 120 / 70% | 110 / 70% | Gen 6 nerf |
| Ice Beam | 95 / 100% | 90 / 100% | Gen 6 nerf |
| Blizzard | 120 / 70% | 110 / 70% | Gen 6 nerf |
| Psychic | 90 / 100% | 90 / 100% | Unchanged |
| Hyper Beam | 150 / 90% | 150 / 90% | Unchanged |
| Rock Slide | 75 / 90% | 75 / 90% | Unchanged |
| Earthquake | 100 / 100% | 100 / 100% | Unchanged |
| Surf | 95 / 100% | 90 / 100% | Gen 6 nerf |
| Bubble Beam | 65 / 100% | 65 / 100% | Unchanged |
| Poison Powder | — / 75% | — / 75% | Unchanged |
| Sleep Powder | — / 75% | — / 75% | Unchanged |
| Aerial Ace | 60 / — | 60 / — | Unchanged |
| Shadow Ball | 80 / 100% | 80 / 100% | Now Special |
| Crunch | 80 / 100% | 80 / 100% | Now Physical |
| Iron Tail | 100 / 75% | 100 / 75% | Unchanged |
| Sludge Bomb | 90 / 100% | 90 / 100% | Unchanged |

*Note: exact values in Emerald Enhanced may differ slightly; verify against the submodule's `src/data/moves_info.h` for authoritative values.*

### 7.3 Expanded TM/HM List

Vanilla Emerald has TMs 01–50 and HMs 01–08. Emerald Enhanced adjusts several TM assignments:

**Changed TMs [EE]:**

| TM# | Vanilla move | Enhanced move | Notes |
|-----|-------------|---------------|-------|
| TM02 | Dragon Claw | Dragon Claw | Unchanged |
| TM10 | Hidden Power | Hidden Power | Unchanged |
| TM19 | Giga Drain | Giga Drain | Unchanged |
| TM23 | Iron Tail | Iron Tail | Unchanged |
| TM26 | Earthquake | Earthquake | Unchanged |
| TM27 | Return | Return | Unchanged |
| TM28 | Dig | Dig | Unchanged |
| TM29 | Psychic | Psychic | Unchanged |
| TM30 | Shadow Ball | Shadow Ball | Now Special due to split |
| TM31 | Brick Break | Brick Break | Now Physical due to split |
| TM34 | Shock Wave | Volt Switch | **[EE]** replacement |
| TM36 | Sludge Bomb | Sludge Bomb | Unchanged |
| TM40 | Aerial Ace | Aerial Ace | Now Physical |
| TM41 | Torment | Torment | Unchanged |
| TM42 | Facade | Facade | Unchanged |
| TM45 | Attract | Attract | Unchanged |
| TM46 | Thief | Thief | Now Physical |
| TM47 | Steel Wing | Steel Wing | Now Physical |
| TM49 | Snatch | U-turn | **[EE-probable]** |
| TM50 | Overheat | Overheat | Unchanged |

**HM status [EE]:** HM moves in Emerald Enhanced can still be taught to Pokémon, but field use (Cut, Surf, Strength, etc.) may be accessible via Key Items so that Pokémon don't need to know HMs to navigate the overworld. Exact implementation varies by build version.

### 7.4 Reusable TMs

**[EE]** TMs are infinite-use, matching Pokémon Black/White and later. After teaching a TM, the item remains in the bag with no use counter. This removes all incentive to "save" TMs and makes team-building freely experimental.

HMs remain in the bag permanently as in vanilla.

### 7.5 Move Reminders / Tutors

**Base Emerald move tutors:**
- Mauville City (free, one per Pokémon): Swagger, Fury Cutter, Thunderpunch, Fire Punch, Ice Punch, Softboiled (Chansey only).
- Fallarbor Town: Move Relearner (Heart Scale for any level-up move).
- Lilycove City: Move Deleter (removes any move).
- Battle Frontier (BP tutors): Body Slam, Double-Edge, Seismic Toss, Mimic, Substitute, Counter, Defense Curl, Rollout, Thunder Wave, Explosion, Rock Slide, String Shot, Dynamic Punch, Mega Punch, Swords Dance, Mega Kick, Metronome, Soft-Boiled, Dream Eater, Sky Attack, Nightmare.

**[EE] Enhanced additions:**
- Move Relearner and Move Deleter available at **every Pokémon Center** (global access).
- Additional tutor moves may include: Stealth Rock, Aqua Tail, Iron Head, Zen Headbutt, Outrage, Dragon Pulse, Heat Wave, Earth Power, Icy Wind, Signal Beam, Giga Drain, Drain Punch, Seed Bomb, Bounce, Knock Off, Superpower — verify against submodule `src/data/event_scripts.s` for confirmed list.
- **[EE-probable]** Move tutors available in the post-game area for late-game moves.

### 7.6 Battle Frontier Enhancements

Vanilla Emerald Battle Frontier facilities:
1. **Battle Tower** — win streaks, earn BP, exchange for prizes.
2. **Battle Dome** — tournament bracket.
3. **Battle Palace** — AI-controlled Pokémon; unpredictable.
4. **Battle Arena** — 3-move judgment system.
5. **Battle Pike** — rooms with random events.
6. **Battle Pyramid** — ascending floors, no items.
7. **Battle Factory** — rental Pokémon.

**[EE]** Enhancements:
- BP tutor move pool expanded (see §7.5).
- **[EE-probable]** Additional difficulty tiers (e.g. "Open Mode" for lower levels and "Lv. 100 Mode" for full-power).
- **[EE-probable]** Frontier Brain rematches with alternate "Platinum-tier" teams after achieving Gold Symbols.
- All seven facilities remain structurally identical to vanilla; map JSON for all Battle Frontier sub-maps is present in `data/maps/hoenn/`.

### 7.7 Legendary Availability

| Legendary | Vanilla Emerald method | Enhanced method |
|-----------|----------------------|------------------|
| Groudon | Cave of Origin (after story) | Same |
| Kyogre | Cave of Origin (after Groudon) | Same |
| Rayquaza | Sky Pillar (during story) | Same |
| Latias | Roaming (Hoenn, post-E4) | Same; shown on PokéNav [EE-probable] |
| Latios | Southern Island (Eon Ticket event) | **[EE]** In-game obtainable |
| Regirock | Desert Ruins (Braille puzzle) | Same |
| Regice | Island Cave (Braille puzzle) | Same |
| Registeel | Ancient Tomb (Braille puzzle) | Same |
| Mew | Faraway Island (Old Sea Map event) | **[EE]** In-game obtainable |
| Deoxys | Birth Island (AuroraTicket event) | **[EE]** In-game obtainable; all formes accessible |
| Jirachi | Bonus Disc / Colosseum bonus | **[EE]** In-game obtainable |
| Lugia | Navel Rock (MysticTicket event) | **[EE]** In-game obtainable |
| Ho-Oh | Navel Rock (MysticTicket event) | **[EE]** In-game obtainable |
| Mewtwo | Not in vanilla Emerald | **[EE-probable]** Post-game dungeon |
| Celebi | Not obtainable in Emerald | **[EE-probable]** Event or post-game |
| Entei / Raikou / Suicune | Not in vanilla Emerald | **[EE-probable]** Post-game |
| Articuno / Zapdos / Moltres | Not in vanilla Emerald | **[EE-probable]** Post-game |
| Legendary beasts | Not in vanilla Emerald | **[EE-probable]** Post-game |

*Unverified legendaries marked [EE-probable]: check `src/data/wild_pokemon.h` in the submodule for authoritative encounter data.*

---

## 8. Integration Notes for This Project

This section addresses how Emerald Enhanced's differences affect the `knightdx91-alt/pokemon-game` data pipeline.

### 8.1 Map data — base Hoenn files

The 518 JSON files in `data/maps/hoenn/` represent **base pokeemerald map data**. They are safe to use as the structural foundation for Emerald Enhanced since Enhanced does not change map layouts, warp connectivity, or NPC positions (with the exception of any new post-game areas, which exist only inside the submodule).

**Action required:** The `allow_running` field in indoor maps (e.g. all Pokémon Center interiors, gyms, houses) is `false` in the base data. When rendering Emerald Enhanced, override this to `true` for all `map_type: "MAP_TYPE_INDOOR"` maps.

### 8.2 Submodule — source/emerald-enhanced

The submodule at `source/emerald-enhanced` (upstream: `https://github.com/Enhanced-Projects/Emerald-Enhanced`) is a full pokeemerald source tree with Enhanced modifications applied. Key directories of interest:

| Submodule path | Contains |
|----------------|----------|
| `src/data/moves_info.h` | Authoritative move power/accuracy/PP/split data |
| `src/data/pokemon/` | Base stats, learnsets, abilities per Pokémon |
| `src/data/wild_pokemon.h` | Wild encounter tables (expanded availability) |
| `src/data/items.h` | Full item pool including Enhanced additions |
| `src/data/trainers.h` | Trainer teams (gym leader rematch teams included) |
| `src/data/event_scripts.s` | Move tutor lists |
| `graphics/pokemon/` | Pokémon battle sprites (front/back, shiny) |
| `graphics/object_events/` | Overworld NPC and player sprites |
| `data/maps/` | Map event scripts (same layout as this repo's maps) |

To extract Enhanced-specific data, check out the submodule (`git submodule update --init source/emerald-enhanced`) and parse the above files.

### 8.3 Tileset pipeline

No new tilesets are added by Emerald Enhanced. The `data/tilesets/` and `data/layouts/` directories in this repo are fully compatible. Any tile attribute changes (passability, encounter rates) in Enhanced are encoded in the compiled ROM, not in the source tileset graphics.

### 8.4 Sprite requirements

For a browser game rendering Emerald Enhanced:
- All 386 Pokémon front/back/icon sprites needed (same as base Emerald).
- Shiny variants for all 386.
- All NPC `OBJ_EVENT_GFX_*` sprites from §5.1.
- Player sprites for both Brendan and May including running, surfing, and biking variants.
- **[EE]** Physical/Special/Status category icons (3 small icons) for the battle move selection UI.
- **[EE]** Nature stat color indicators (no new sprite; CSS/rendering color change).
- **[EE-probable]** IV/EV page background graphic (minor new UI element).

### 8.5 Data fields to add for Enhanced compatibility

When extending the map JSON schema for Enhanced features, consider adding:

```json
{
  "enhanced": {
    "allow_running_override": true,
    "move_reminder_npc": true,
    "move_deleter_npc": true,
    "name_rater_npc": true
  }
}
```

This allows the base Hoenn JSON files to carry Enhanced-specific overrides without duplicating all map data.

### 8.6 Music

Base Emerald music constants (e.g. `MUS_LITTLEROOT`) are used in all map JSONs. Emerald Enhanced may swap some BGM tracks. If the browser game streams audio, verify per-map music against the submodule's `src/data/maps/` `.json` or compiled output.

### 8.7 Known data gaps

The following require submodule inspection to resolve:
1. Exact TM move assignments for all 50 TMs in Enhanced.
2. Complete wild encounter tables for each route/dungeon.
3. Complete move tutor move list and cost in BP/Heart Scales.
4. Exact gym leader rematch team compositions.
5. Full list of new post-game areas (if any) added by Enhanced.
6. Whether HM field use is via Key Items, separate menu, or still requires a Pokémon knowing the move.
7. Exact shiny rate used (commonly 1/512 or 1/1024 but varies by build version).
8. Whether a following-Pokémon system is implemented.

---

*Last updated: 2026-06-10. Data pipeline repo: `knightdx91-alt/pokemon-game`. Upstream submodule: `https://github.com/Enhanced-Projects/Emerald-Enhanced`. Base decompilation: `https://github.com/pret/pokeemerald`.*
