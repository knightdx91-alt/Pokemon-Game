# Pokémon Platinum — Game Reference Bible

> **Source of truth for this browser fan game's Sinnoh region implementation.**
> All map data is sourced from Platinum (field `"source": "platinum"`) and lives under `data/maps/sinnoh/` (534 named map files). The `data/maps/platinum/` directory (75 files) contains raw area-data records (`area_data_000.json` … `area_data_074.json`) that describe render properties (prop model sets, texture sets, lighting sets) rather than map event data.

---

## 1. Overview

| Property | Value |
|---|---|
| Platform | Nintendo DS |
| Screen resolution | 256 × 192 per screen (top + bottom) |
| Region | Sinnoh |
| Version | Platinum (definitive Sinnoh release) |
| Release | 2008 (JP) / 2009 (NA/EU) |
| Player characters | Lucas (♂) / Dawn (♀) |
| Rival | Barry (graphics ID `OBJ_EVENT_GFX_BARRY`) |
| Professor | Professor Rowan (graphics ID `OBJ_EVENT_GFX_PROF_ROWAN`) |
| Champion | Cynthia (graphics ID `OBJ_EVENT_GFX_CYNTHIA`) |
| Villain team | Team Galactic (Cyrus — `OBJ_EVENT_GFX_CYRUS`) |
| Pokédex | Sinnoh Dex (210 species) + National Dex (493 total) |

### 1.1 Platinum vs Diamond/Pearl differences
- Distortion World added as a unique dungeon (Giratina-Origin Form).
- Gym leader order changed: Fantina is now Gym 3 (before Maylene and Wake).
- Battle Frontier replaces the Battle Tower on Fight Area island.
- New forms: Shaymin-Sky, Rotom appliance forms (post-National Dex).
- Updated move animations, re-tuned trainer rosters, new areas (Stark Mountain interior, Sendoff Spring).
- Pokétch has 25 apps vs 20 in DP.
- Wi-Fi Plaza added.

### 1.2 Browser-game coordinate system
Each map NPC/warp/sign stores world-space coordinates as `x`, `y`, `z`. The `y` field is typically `0` (ground), `1` (slightly elevated), or small integers; `x` and `z` give the tile grid position in the continuous world coordinate space (shared across all outdoor maps — values range from ~31 to ~1000+).

---

## 2. Map Catalog

All maps share the schema:
```json
{
  "id": "<snake_case_id>",
  "name": "<Display Name>",
  "region": "sinnoh",
  "source": "platinum",
  "npcs": [...],
  "warps": [...],
  "signs": [...],
  "coord_events": [...]
}
```

### 2.1 Towns & Cities

| ID | Display Name | Key NPCs / Features | Notable warps |
|---|---|---|---|
| `twinleaf_town` | Twinleaf Town | Barry (rival), Pokemon Breeder F, Guitarist, Mailboxes (player + rival) | 4 house warps; Route 201 signpost |
| `sandgem_town` | Sandgem Town | Prof. Rowan, Barry, counterpart (dawn/lucas), Research Lab signboard | 5 warps; Route 201, 202, 219 signposts |
| `jubilife_city` | Jubilife City | Looker, Pokétch Co. President, 3 Clowns (Pokétch quest), Galactic Grunts (early story), Global Terminal, GTS, Jubilife TV | 14 warps; Route 202, 203 signposts |
| `oreburgh_city` | Oreburgh City | Barry, 3 Machop (construction), multiple Workers, Battle Girl, Gym signpost | 16 warps; mine entrance (south); Route 207 (north) |
| `floaroma_town` | Floaroma Town | Flower-themed; Fuego Ironworks access | — |
| `eterna_city` | Eterna City | Gardenia (Gym Leader, flag-gated), Cynthia, Cyrus, 3 Galactic Grunts, Cut Trees blocking Galactic HQ | 12 warps; Route 205N, Route 211W signposts |
| `hearthome_city` | Hearthome City | Fantina Gym, Poffin House, Contest Hall (2 Amity Square gates), Pokémon Fan Club, Mr. Goods (Artist), Buneary + Keira (flag-gated), Pachirisu | 20 warps; Route 208 east, Route 212 west |
| `solaceon_town` | Solaceon Town | Day Care, Pokémon News Press | Solaceon Ruins entrance |
| `veilstone_city` | Veilstone City | Maylene Gym, Team Galactic HQ, Department Store, Game Corner | — |
| `pastoria_city` | Pastoria City | Crasher Wake Gym, Great Marsh | — |
| `celestic_town` | Celestic Town | Elder (Expert F, flag-gated), Cynthia (flag-gated), Galactic Grunt, Celestic Cave (ruins), Dragon Fang item | 6 warps; Route 210N, Route 211E signposts |
| `canalave_city` | Canalave City | Byron Gym, Canalave Library (3F), Psyduck pair (lake story), Sailor Eldritch, Barry (bridge + library, flag-gated), Harbor Inn, Iron Island ferry | 11 warps; Route 218 |
| `snowpoint_city` | Snowpoint City | Candice (flag-gated), Cynthia (flag-gated), Snowpoint Temple guard, SS Spiral sailor (flag-gated) | 7 warps; Lake Acuity path |
| `sunyshore_city` | Sunyshore City | Volkner Gym, Vista Lighthouse, solar panels overworld |
| `fight_area` | Fight Area | Post-game hub; Battle Frontier gate | |
| `survival_area` | Survival Area | Post-game |
| `resort_area` | Resort Area | Post-game; Ribbon Syndicate |

### 2.2 Routes

| ID | Notes |
|---|---|
| `route201` | Starting route — Twinleaf→Sandgem; tall grass intro |
| `route202` | Sandgem→Jubilife; first Pokémon battles |
| `route203` | Jubilife→Oreburgh Gate; Bidoof/Starly |
| `route204` | North of Jubilife; Floaroma access |
| `route205_north` | Eterna Forest corridor north |
| `route205_south` | Valley Windworks south |
| `route206` | Cycling Road (requires Bicycle) |
| `route207` | Oreburgh→Mt Coronet south foot |
| `route208` | Hearthome east |
| `route209` | Hearthome→Solaceon; Lost Tower |
| `route210_north` | North of Celestic; foggy (Defog needed) |
| `route210_south` | South of Celestic |
| `route211_east` | Celestic east |
| `route211_west` | Eterna east |
| `route212` | Hearthome→Pastoria; rain/mud |
| `route213` | Pastoria east; Great Marsh gate |
| `route214` | Veilstone south |
| `route215` | Veilstone east; rain |
| `route216` | Mt Coronet north; blizzard |
| `route217` | Snowpoint approach; blizzard; requires Defog |
| `route218` | Canalave west (Surf needed) |
| `route219` | Sandgem south (Surf needed) |
| `route220` | Fishing route (Surf needed) |
| `route221` | Pal Park access |
| `route222` | Sunyshore west |
| `route223` | Sunyshore→Victory Road (Surf needed) |
| `route224` | Post-game; Shaymin meadow trigger |
| `route225` | Fight Area north |
| `route226` | Survival Area east |
| `route227` | Stark Mountain approach |
| `route228` | Sand storm route |
| `route229` | Resort Area north |
| `route230` | Resort Area east (Surf needed) |

### 2.3 Dungeons & Special Areas

#### Mt. Coronet (key Sinnoh chokepoint)
Mt. Coronet divides east Sinnoh from west Sinnoh. Multiple floors:

| ID | Notes |
|---|---|
| `mt_coronet_1f` | Multiple entrances; east/west crossings |
| `mt_coronet_2f` | Interior path |
| `mt_coronet_3f` | — |
| `mt_coronet_4f` | — |
| `mt_coronet_5f` | — |
| `mt_coronet_6f` | — |
| `mt_coronet_b1f` | Basement |
| `mt_coronet_b2f` | — |
| `mt_coronet_b3f` | — |
| `spear_pillar` | Summit; Team Galactic boss fight; portal to Distortion World |

> **Browser-game note:** Mt. Coronet is a critical routing constraint. The east side (Oreburgh/Hearthome/Veilstone/Pastoria) and west side (Eterna/Floaroma/Celestic/Snowpoint) are only connected through Mt. Coronet passages or water routes. Any overworld map renderer must honor this topology.

#### Distortion World
| ID | Notes |
|---|---|
| `distortion_world_1f` | Entrance floor; 1 warp (dest_warp_id=2), 1 sign (script 2), no NPCs. Gravity-defying puzzle area — platforms appear at arbitrary orientations. |
| `distortion_world_2f` | — |
| `distortion_world_3f` | — |
| `distortion_world_4f` | — |
| `distortion_world_5f` | Final chamber; Giratina-Origin Form boss encounter |

> **Unique design rule:** Distortion World ignores standard gravity. Tiles appear on walls and ceilings. The browser renderer will need a special render mode or camera transformation — standard top-down tile rendering will not represent the original accurately. Consider a side-scrolling or pseudo-3D layer approach for these maps.

#### Lakes (Lake Trio)
| ID | Notes |
|---|---|
| `lake_verity` | Twinleaf area; Mesprit |
| `lake_verity_cavern` | Interior; Mesprit encounter |
| `lake_valor` | Pastoria area; Azelf |
| `lake_valor_cavern` | Interior; Azelf encounter |
| `lake_acuity` | Snowpoint area; Uxie |
| `acuity_cavern` | Interior; Uxie encounter |
| `acuity_lakefront` | Route segment to Snowpoint |

#### Old Chateau
| ID | Notes |
|---|---|
| `old_chateau` | Eterna Forest; Ghost-type encounters; Rotom encounter in TV room (post-National Dex) |
| `old_chateau_*` | Multiple interior rooms (dining room, rooms 1-5) |

#### Solaceon Ruins
| ID | Notes |
|---|---|
| `solaceon_ruins_1f` | Entry floor |
| `solaceon_ruins_b1f` … `b4f` | Deeper floors with Unown; ancient writing panels relevant to Sinnoh lore |

> **Lore note:** Solaceon Ruins contain Unown writing describing the creation of the Sinnoh region by Arceus. Panels reference the lake guardians and the creation trio. Important for any lore-text implementation.

#### Iron Island
| ID | Notes |
|---|---|
| `iron_island` | Exterior island |
| `iron_island_1f` … `b3f` | Multi-floor mine dungeon; Riley (partner NPC) gives Riolu egg |

#### Stark Mountain
| ID | Notes |
|---|---|
| `stark_mountain` | Exterior |
| `stark_mountain_inside` | Interior (Platinum-only fully accessible); Buck NPC; Heatran encounter |

#### Victory Road
| ID | Notes |
|---|---|
| `victory_road_1f` | Entry; contains trainers (Psychic Bryce, Black Belt Miles, Ace Trainer Mariah, Veteran Edgar, Dragon Tamer Clinton) and items (Rare Candy, Max Repel, TM41, Razor Claw, Zinc); Collector NPC (flag-gated) |
| `victory_road_2f` | — |
| `victory_road_b1f` | Basement; rock smash puzzles |

#### Other Dungeons
| ID | Notes |
|---|---|
| `oreburgh_mine_1f` | First dungeon; Rock-type Pokémon; Roark found here before first gym |
| `oreburgh_mine_b1f` | Basement |
| `eterna_forest` | Dense forest; Cheryl partner section; Cascoon/Silcoon |
| `mt_pyre` | — (if present) |
| `sendoff_spring` | Platinum-only; near Turnback Cave; Giratina-Altered re-encounter |
| `turnback_cave` | Labyrinth cave; Giratina-Altered post-story |
| `snowpoint_temple` | Regigigas encounter (requires Regirock/Regice/Registeel in party) |
| `spring_path` | Path to Sendoff Spring (hidden in DP, open in Platinum) |

### 2.4 Interiors (selected)

Interior maps follow the naming convention `<city>_<building>[_<floor>].json`.

| Pattern | Examples |
|---|---|
| Pokémon Centers (3 floors) | `*_pokecenter_1f`, `*_pokecenter_2f` (Union Room), `*_pokecenter_b1f` (Wi-Fi Club) |
| Libraries | `canalave_library_1f/2f/3f` — 3F holds the Sinnoh creation myth books |
| Gyms | `*_gym` — one per city |
| Contest Hall | `contest_hall_lobby`, `contest_hall_stage_no_contest`, `contest_hall_stage_ongoing_contest` |
| Battle Frontier | `battle_frontier`, `battle_tower`, `battle_arcade`, `battle_castle`, `battle_factory`, `battle_hall`, plus corridor/elevator sub-maps |
| Amity Square | `amity_square` — walk with cute Pokémon; finds accessories |
| Global Terminal | Inside Jubilife City; GTS and Wi-Fi features |
| Pokétch Company | Inside Jubilife City; 3 floors |
| Jubilife TV | Inside Jubilife City |
| Jubilife Condominiums | Apartments |
| Galactic HQ Veilstone | `galactic_veilstone_building_*` |
| Galactic Eterna Building | Inside Eterna City (Cyrus/Galactic) |
| Safari Zone / Pal Park | `pal_park` (post-National Dex migration) |
| Café | `cafe` |
| Cycle Shop | `cycle_shop` — Rad Rickshaw's; get Bicycle |
| Harbor Inn | `canalave_city_harbor_inn` — Darkrai lore |
| Sailor Eldritch's House | Story NPC house |

### 2.5 Underground

| ID | Notes |
|---|---|
| (Underground maps are DS-local-play feature) | Players dig for fossils and spheres, decorate secret bases. Not standard overworld maps. |

> **Browser-game note:** The Underground was a DS local wireless feature (up to 8 players simultaneously). For a browser port, this would require a multiplayer server or a single-player simulation mode. Key features: fossil digging mini-game (yields Skull/Armor/Claw/Root/Cover/Dome fossils), sphere trading, secret base decoration, flag capture game. The Underground is accessed from any point in Sinnoh via the Explorer Kit (given by the Underground Man in Eterna City — `OBJ_EVENT_GFX_SIGNBOARD` for Underground Man's house).

---

## 3. Warp & Connection Graph

Warp entries in map JSON have the form:
```json
{ "x": 116, "y": null, "z": 885, "dest_map": null, "dest_warp_id": 0 }
```
`dest_map` is currently `null` in the extracted data (not yet resolved to target map IDs). `dest_warp_id` is the index into the destination map's warps array.

### High-level region topology

```
[Twinleaf Town] ──Route 201──> [Sandgem Town] ──Route 202──> [Jubilife City]
                                                                    │
                                                              Route 203
                                                                    │
                                                          [Oreburgh Gate] ──> [Oreburgh City]
                                                                                    │
                                                                              Route 207
                                                                                    │
                         ┌──────────────────────────── [Mt. Coronet] ─────────────────────────────────┐
                         │  (EAST SINNOH)                                          (WEST SINNOH)       │
                         │                                                                              │
                [Hearthome City] <──Route 208──> [Solaceon Town] <──Route 210──> [Celestic Town]       │
                    │   │                               │                              │               │
              Rt209 │   │ Rt212                  [Veilstone City]              Route 211               │
                    │   │                               │                              │               │
              [Lost │   │                          Route 214/215              [Eterna City] <──Rt205──[Floaroma]
               Tower]   │                               │                              │
                    │   └──────> [Pastoria City] <─Rt213┘                      Route 206 (Cycling)
                    │                   │                                              │
                    └───────────────────┘                                     [Jubilife City]
                                        │
                                   [Canalave City] ──ferry──> [Iron Island]
                                        │
                                   Route 218 (Surf)

[Snowpoint City] <──Route 217──< [Route 216] <── Mt. Coronet north passage
       │
  SS Spiral ferry ──> [Battle Zone islands]

[Sunyshore City] <──Route 222──< [Veilstone / Lake area]
       │
  Route 223 (Surf) ──> [Victory Road] ──> [Pokémon League]
                                                │
                                          [Elite Four] ──> [Champion Cynthia]

[Fight Area] / [Survival Area] / [Resort Area]  ← Post-game islands (ferry from Snowpoint or Sunyshore)
       │
  [Battle Frontier] (5 facilities)
```

### Critical routing constraints
1. **Mt. Coronet split**: Cannot cross between east and west Sinnoh without going through Mt. Coronet or using Surf to circumnavigate.
2. **HM gates**: Rock Smash (Oreburgh Mine), Cut (Eterna City Galactic HQ trees, `OBJ_EVENT_GFX_CUT_TREE`), Surf (Routes 218–223, lakes), Strength (various caves), Defog (Route 210N, Victory Road), Rock Climb (Route 217 cliff-faces, late game).
3. **Story gates**: `coord_events` with VAR checks block progress until story flags are set (e.g., `VAR_OREBURGH_STATE`, `VAR_ETERNA_CITY_STATE`, `VAR_HEARTHOME_CITY_STATE`).
4. **Ferry gates**: Iron Island and Battle Zone islands require talking to sailors who are flag-gated.

---

## 4. Tileset Catalog

> **Important note for implementers:** The `data/tilesets/` directory currently contains 60 tileset PNG+JSON pairs — all are **FireRed/Kanto** tilesets (pallet_town, viridian_city, celadon_city, silph_co, safari_zone, SS Anne, etc.). No Sinnoh-specific tilesets are present yet. Sinnoh tilesets will need to be added for a correct Platinum implementation.

### Current tilesets in data/tilesets/

| Tileset name | Region | Use |
|---|---|---|
| `pallet_town` | Kanto | Town exterior |
| `viridian_city` | Kanto | City exterior |
| `cerulean_city` | Kanto | City exterior |
| `vermilion_city` | Kanto | City exterior |
| `lavender_town` | Kanto | Town exterior |
| `celadon_city` | Kanto | City exterior |
| `fuchsia_city` | Kanto | City exterior |
| `saffron_city` | Kanto | City exterior |
| `cinnabar_island` | Kanto | Island exterior |
| `cave` | Generic | Rock tunnel, Mt. Moon interiors |
| `pokemon_center` | Generic | All Pokémon Centers |
| `mart` | Generic | All Poké Marts |
| `lab` | Generic | Professor labs |
| `school` | Generic | Trainer school |
| `condominiums` | Generic | Apartment buildings |
| `department_store` | Generic | Multi-floor shop |
| `game_corner` | Generic | Game Corner |
| `silph_co` | Kanto | Silph Company HQ |
| `pokemon_tower` | Kanto | Lavender Town tower |
| `pokemon_mansion` | Kanto | Cinnabar Mansion |
| `safari_zone_building` | Kanto | Safari Zone gatehouse |
| `ss_anne` | Kanto | Ship interior |
| `viridian_forest` | Kanto | Forest exterior |
| `rock_tunnel` | Kanto | Cave interior |
| `seafoam_islands` | Kanto | Cave/ice interior |
| `power_plant` | Kanto | Factory interior |
| `underground_path` | Kanto | Underground path |
| `indigo_plateau` | Kanto | Pokémon League exterior |
| `pokemon_league` | Kanto | Elite Four interior |
| `hall_of_fame` | Kanto | Hall of Fame room |
| `sevii_islands_123` | Sevii | Islands 1–3 |
| `sevii_islands_45` | Sevii | Islands 4–5 |
| `sevii_islands_67` | Sevii | Islands 6–7 |
| `berry_forest` | Sevii | Berry Forest |
| `mt_ember` | Sevii | Mt. Ember |
| `navel_rock` | Sevii | Navel Rock |
| `tanoby_ruins` | Sevii | Tanoby Ruins |
| `trainer_tower` | Sevii | Trainer Tower |
| `island_harbor` | Generic | Harbor/dock |
| `hoenn_building` | Hoenn | Building interior |
| `sea_cottage` | Kanto | Bill's Sea Cottage |
| *(gym variants)* | Kanto | Per-city gym interiors |
| `generic_building_1/2` | Generic | Generic NPC houses |
| `restaurant_hotel` | Generic | Restaurant/hotel |
| `bike_shop` | Generic | Bike shop |
| `burgled_house` | Generic | Story building |
| `cable_club` | Generic | Communication Club |
| `fan_club_daycare` | Generic | Fan Club / Day Care |
| `digletts_cave` | Kanto | Diglett's Cave |
| `cerulean_cave` | Kanto | Mewtwo cave |
| `museum` | Generic | Museum |

### Required Sinnoh tilesets (not yet present)
The following tileset categories need to be created for Platinum:
- `sinnoh_town` — Twinleaf, Sandgem, Floaroma, Solaceon, Celestic (grass, flower, snow variants)
- `sinnoh_city` — Jubilife, Oreburgh, Eterna, Hearthome, Veilstone, Pastoria, Canalave, Snowpoint, Sunyshore
- `mt_coronet` — Rocky mountain interior, multiple floor variants
- `distortion_world` — Special gravity-defying tileset (unique visual style: dark purple/black, crystalline platforms)
- `sinnoh_cave` — Oreburgh Mine, Iron Island, Victory Road, Turnback Cave
- `sinnoh_forest` — Eterna Forest, Old Chateau
- `sinnoh_building_interior` — Generic house, Galactic HQ, Library, Contest Hall
- `sinnoh_gym` — Per-city gym interiors
- `battle_frontier` — Battle Frontier facilities
- `underground` — Underground tunnel/mining area

---

## 5. Sprite Manifest

### 5.1 NPC Graphics IDs

All NPC graphics IDs observed across sampled maps (58 unique values). These are the constants referenced in map JSON `graphics_id` fields.

#### Story characters
| Constant | Character |
|---|---|
| `OBJ_EVENT_GFX_BARRY` | Barry (rival) |
| `OBJ_EVENT_GFX_PROF_ROWAN` | Professor Rowan |
| `OBJ_EVENT_GFX_CYNTHIA` | Cynthia (Champion) |
| `OBJ_EVENT_GFX_CYRUS` | Cyrus (Team Galactic leader) |
| `OBJ_EVENT_GFX_GARDENIA` | Gardenia (Gym Leader 2) |
| `OBJ_EVENT_GFX_CANDICE` | Candice (Gym Leader 7) |
| `OBJ_EVENT_GFX_LOOKER` | Looker (International Police) |
| `OBJ_EVENT_GFX_IDOL` | Keira (Pop Idol, Hearthome) |
| `OBJ_EVENT_GFX_GYM_GUIDE` | Gym Guide NPC |
| `OBJ_EVENT_GFX_VAR_0` | Variable sprite (switches between Lucas/Dawn counterpart at runtime) |

#### Generic trainer classes
| Constant | Trainer class |
|---|---|
| `OBJ_EVENT_GFX_ACE_TRAINER_F` | Ace Trainer (female) |
| `OBJ_EVENT_GFX_ACE_TRAINER_M` | Ace Trainer (male) |
| `OBJ_EVENT_GFX_ACE_TRAINER_SNOW_F` | Ace Trainer Snow (female, Snowpoint variant) |
| `OBJ_EVENT_GFX_BATTLE_GIRL` | Battle Girl |
| `OBJ_EVENT_GFX_BLACK_BELT` | Black Belt |
| `OBJ_EVENT_GFX_BUG_CATCHER` | Bug Catcher |
| `OBJ_EVENT_GFX_CAMPER` | Camper |
| `OBJ_EVENT_GFX_COLLECTOR` | Collector |
| `OBJ_EVENT_GFX_EXPERT_F` | Expert (female) / Elder |
| `OBJ_EVENT_GFX_EXPERT_M` | Expert (male) / Veteran |
| `OBJ_EVENT_GFX_FISHERMAN` | Fisherman |
| `OBJ_EVENT_GFX_GRUNT_M` | Team Galactic Grunt (male) |
| `OBJ_EVENT_GFX_GUITARIST` | Guitarist |
| `OBJ_EVENT_GFX_HIKER` | Hiker |
| `OBJ_EVENT_GFX_LASS` | Lass |
| `OBJ_EVENT_GFX_MIDDLE_AGED_MAN` | Middle-Aged Man (e.g. Pokétch Co. President) |
| `OBJ_EVENT_GFX_NINJA_BOY` | Ninja Boy |
| `OBJ_EVENT_GFX_OLD_MAN` | Old Man |
| `OBJ_EVENT_GFX_POKEFAN_F` | Pokéfan (female) |
| `OBJ_EVENT_GFX_POKEFAN_M` | Pokéfan (male) |
| `OBJ_EVENT_GFX_POKEMON_BREEDER_F` | Pokémon Breeder (female) |
| `OBJ_EVENT_GFX_POKEMON_BREEDER_M` | Pokémon Breeder (male) |
| `OBJ_EVENT_GFX_PSYCHIC` | Psychic |
| `OBJ_EVENT_GFX_SAILOR` | Sailor |
| `OBJ_EVENT_GFX_SCHOOL_KID_F` | School Kid (female) |
| `OBJ_EVENT_GFX_SCHOOL_KID_M` | School Kid (male) |
| `OBJ_EVENT_GFX_TWIN` | Twin |
| `OBJ_EVENT_GFX_WORKER` | Worker |
| `OBJ_EVENT_GFX_YOUNGSTER` | Youngster |
| `OBJ_EVENT_GFX_SNOWPOINT_NPC_F` | Snowpoint townsperson (female, bundled up) |
| `OBJ_EVENT_GFX_SNOWPOINT_NPC_M` | Snowpoint townsperson (male, bundled up) |
| `OBJ_EVENT_GFX_ARTIST` | Artist / Mr. Goods |
| `OBJ_EVENT_GFX_CLOWN` | Clown (Jubilife Pokétch quest) |
| `OBJ_EVENT_GFX_KID_WITH_NDS` | Kid With NDS (Jubilife Wi-Fi area) |
| `OBJ_EVENT_GFX_BABY_IN_PRAM` | Baby in Pram |

#### Overworld objects (non-character)
| Constant | Object |
|---|---|
| `OBJ_EVENT_GFX_POKEBALL` | Poké Ball (item pickup on ground) |
| `OBJ_EVENT_GFX_MAP_SIGNPOST` | Signpost (area name) |
| `OBJ_EVENT_GFX_ARROW_SIGNPOST` | Directional arrow sign |
| `OBJ_EVENT_GFX_SIGNBOARD` | Building signboard |
| `OBJ_EVENT_GFX_GYM_SIGNPOST` | Gym signpost |
| `OBJ_EVENT_GFX_MAILBOX` | Mailbox |
| `OBJ_EVENT_GFX_VENT` | Mine/city vent (animated, script 2027) |
| `OBJ_EVENT_GFX_BOLLARD` | Bollard / barrier post |
| `OBJ_EVENT_GFX_CUT_TREE` | Tree that can be Cut (HM01) |

#### Pokémon that appear as overworld objects
| Constant | Pokémon | Location |
|---|---|---|
| `OBJ_EVENT_GFX_MACHOP` | Machop | Oreburgh City (construction workers) |
| `OBJ_EVENT_GFX_PSYDUCK` | Psyduck | Canalave City (story) |
| `OBJ_EVENT_GFX_BUNEARY` | Buneary | Hearthome City (flag-gated with Keira) |
| `OBJ_EVENT_GFX_PACHIRISU` | Pachirisu | Hearthome City (with Hiker NPC) |

### 5.2 Player Sprite (Lucas / Dawn)

File: `data/sprites/player.png` (present in repo).

The DS player sprites for Platinum are 32×32 overworld sprites with 4 directions × walk animation frames. Lucas wears a blue hat + scarf; Dawn wears a pink beanie + scarf. Both have DS-era proportions (larger head, simplified limbs compared to GBA style).

For the browser game:
- Use `OBJ_EVENT_GFX_VAR_0` as the counterpart (non-player character) — it dynamically shows the opposite gender of the player.
- Player walk cycle: 4 directions, 4 frames each = 16-frame sprite sheet minimum.
- Running shoes: separate faster animation (same sprites, advanced frame timing).
- Bicycle: distinct sprite set.
- Surfing: player on Pokémon sprite.

### 5.3 Pokémon Sprites

`data/sprites/npcs/` directory exists (sub-directory of sprites). Pokémon battle sprites in Platinum are 80×80 front sprites (DS resolution). Overworld Pokémon sprites (Pokémon following, Underground Pokémon) are 32×32.

Platinum-specific sprite additions over DP:
- Shaymin-Sky Form (new form)
- Giratina-Origin Form (new form)
- Rotom alternate forms (Rotom-Heat, Rotom-Wash, Rotom-Frost, Rotom-Fan, Rotom-Mow) — available post-National Dex in Secret Key event room

---

## 6. UI & Menu Reference

### 6.1 Start Menu

Activated by pressing X (DS) or the browser equivalent key. Appears as a vertical list on the right side of the top screen.

Menu items (in order):
1. **Pokédex** — opens Pokédex (grayed out until received from Rowan)
2. **Pokémon** — party screen
3. **Bag** — inventory
4. **[Player Name]** — trainer card
5. **Save** — save game
6. **Options** — settings
7. **Exit** — close menu

> **Browser note:** Map this to a keyboard shortcut (e.g. Escape or a dedicated button). The menu should overlay the game without pausing background animations.

### 6.2 Battle UI (Platinum-specific)

Platinum battle UI uses a diagonal split design (top screen = battle field, bottom screen = moves/info).

**Top screen layout:**
- Enemy Pokémon sprite (upper left area) with HP bar + level + status
- Player Pokémon sprite (lower right area) with HP bar + XP bar + level + status
- Battle background (varies by map/terrain type)

**Bottom screen layout (touch input):**
- 4 move buttons (2×2 grid) — show move name, PP, type
- **Fight / Bag / Pokémon / Run** — 4 main action buttons
- During move selection: type effectiveness indicator (Platinum added move type icon)

**Platinum-specific battle additions vs DP:**
- Move type icon shown on move button
- VS Seeker usable from Bag to re-challenge trainers (obtained in Sandgem)
- New move animations for several moves
- Updated AI trainer rosters and held items
- Physical/Special split indicator per move (introduced in DP, refined in Platinum)

**Status conditions (display):**
| Abbreviation | Condition |
|---|---|
| PSN | Poison |
| BRN | Burn |
| PAR | Paralysis |
| SLP | Sleep |
| FRZ | Frozen |
| TOX | Badly Poisoned |

> **Browser note:** The bottom screen touch UI maps naturally to mouse/tap. The 2×2 move grid can be rendered as large clickable buttons. Consider a single-screen layout where the bottom UI slides up over the battle scene, or a side-by-side panel layout.

### 6.3 Dialogue Box

- Appears at the bottom of the top screen (or bottom screen for some interactions).
- Font: DS Pokemon font (proportional, uppercase + lowercase in Platinum).
- Box height: ~3 lines of text.
- Text speed: options Slow / Normal / Fast (instant).
- Arrow indicator blinks when waiting for A/tap to advance.
- NPC name header: small colored box above dialogue box with NPC name (Platinum introduced named dialogue boxes).
- Choice boxes (`choice_box`) overlay the dialogue box as a list of options (A to confirm, B to cancel).

### 6.4 Party Screen

Top screen: current Pokémon summary (sprite, name, level, HP).
Bottom screen: 6 party slots arranged in a 2-column layout. Each slot shows:
- Pokémon sprite (small icon)
- Nickname
- Level
- HP bar (color: green > yellow > red)
- Status badge if afflicted

Actions:
- Select → move Pokémon / use item on Pokémon / check summary
- Summary → 5 pages: Info, Memo, Skills (moves + PP), Contest stats, Ribbons

> **Browser note:** Party screen can be a modal overlay. Touch/click a party slot to select. Drag-and-drop for reordering is a natural browser extension of the DS stylus interaction.

### 6.5 Bag

Platinum bag has **6 pockets** (updated from DP's layout):

| Pocket | Contents |
|---|---|
| **Items** | General items (Repel, Escape Rope, etc.) |
| **Medicine** | Potions, Antidotes, Revives, status healers |
| **Poké Balls** | All Poké Ball variants |
| **TMs & HMs** | Technical and Hidden Machines |
| **Berries** | All berry types |
| **Key Items** | Story items (Bicycle, Explorer Kit, Poffin Case, etc.) |

Navigation: pocket tabs at top (touch-selectable). Item list scrolls vertically. Selected item shows description at bottom.

**Key Items relevant to world access:**
- Explorer Kit → Underground access
- Bicycle → faster movement, Cycling Road
- HM moves (Cut, Surf, Strength, Defog, Rock Smash, Fly, Rock Climb, Waterfall)
- VS Seeker → re-challenge trainers
- Pokétch → opens Pokétch app list
- Pal Pad → Wi-Fi friend list
- Poffin Case → stores Poffins for Contests
- Poké Radar → grass chain encounters

### 6.6 Pokédex

Dual-screen Pokédex with area data.

Top screen: Pokémon sprite (front/back toggle), name, type, height/weight, category.
Bottom screen: habitat map, Pokédex text description, cry button.

**Sinnoh Dex:** 210 Pokémon (#001 Turtwig → #210 Giratina in Sinnoh numbering).
After beating the Elite Four: National Dex unlocked (493 total).

Sinnoh Dex notable entries:
- Starters: Turtwig (#387), Chimchar (#390), Piplup (#393)
- New evolutions for old Pokémon: Budew, Roserade, Lucario, Electivire, Magmortar, Leafeon, Glaceon, Togekiss, Yanmega, Gliscor, Mamoswine, Porygon-Z, Gallade, Probopass, Dusknoir, Froslass, Rotom, Uxie, Mesprit, Azelf, Dialga, Palkia, Heatran, Regigigas, Giratina, Cresselia, Phione, Manaphy, Darkrai, Shaymin, Arceus

### 6.7 Pokétch (Pokémon Watch)

The Pokétch is the bottom-screen persistent device, received from the Pokétch Company President in Jubilife City (after completing the 3-Clown coupon quest). **25 apps in Platinum** (up from 20 in DP).

| # | App name | Function |
|---|---|---|
| 01 | Digital Watch | Clock display |
| 02 | Calculator | Simple calculator |
| 03 | Memo Pad | Freehand drawing |
| 04 | Pedometer | Step counter |
| 05 | Pokémon List | Party HP at a glance |
| 06 | Friendship Checker | Displays friendship hearts |
| 07 | Dowsing Machine | Hidden item radar (stylus) |
| 08 | Berry Searcher | Shows berry plants on region map |
| 09 | Day-Care Checker | Shows Day Care Pokémon / egg status |
| 10 | Pokémon History | Last 12 Pokémon caught |
| 11 | Counter | Tally counter |
| 12 | Analog Watch | Analog clock face |
| 13 | Marking Map | Region map with custom markers |
| 14 | Link Searcher | Detects nearby DS users (local wireless) |
| 15 | Coin Toss | Random coin flip |
| 16 | Move Tester | Shows move type effectiveness |
| 17 | Calendar | Monthly calendar, marks events |
| 18 | Dot Artist | Pixel drawing tool |
| 19 | Roulette | Random selection wheel |
| 20 | Trainer Counter | Counts trainers defeated |
| 21 | Kitchen Timer | Countdown timer |
| 22 | Color Changer | Changes Pokétch color theme |
| 23 | Matchup Checker | (Platinum new) Shows breeding compatibility |
| 24 | Stopwatch | Elapsed time display |
| 25 | Alarm Clock | Wake alarm |

Navigation: right arrow button cycles forward; pressing the Pokétch button (mapped to a key) opens/closes.

> **Browser note:** The Pokétch is a persistent bottom-screen widget. In a single-screen browser layout it can be a collapsible sidebar panel or a corner widget. The Dowsing Machine (app 07) requires stylus/touch → map to mouse movement. Apps 14 (Link Searcher) and 25 (Alarm Clock) are system-dependent; stub or omit for single-player browser.

### 6.8 Options Menu

Accessible from Start Menu → Options.

| Setting | Options |
|---|---|
| Text Speed | Slow / Normal / Fast |
| Battle Scene | On / Off (skip battle animations) |
| Battle Style | Shift / Set (whether to offer switch after fainting opponent) |
| Sound | Stereo / Mono |
| Button Mode | Help / LR / L=A |
| Frame | Frame style 1–20 (border around dialogue box) |

> **Browser note:** Map "Button Mode" to keyboard config. "Frame" is purely cosmetic — pick one default. "Sound" is always Stereo in browser. "Battle Scene" On/Off is an important performance toggle.

---

## 7. Key Game Systems

### 7.1 Gym Progression (8 Gyms)

**Platinum gym order differs from Diamond/Pearl for gyms 3–5.**

| # | Leader | City | Type | Badge | HM unlocked | Key move |
|---|---|---|---|---|---|---|
| 1 | Roark | Oreburgh City | Rock | Coal Badge | Rock Smash | Stealth Rock |
| 2 | Gardenia | Eterna City | Grass | Forest Badge | Cut | Magical Leaf |
| 3 | Fantina | Hearthome City | Ghost | Relic Badge | — | Shadow Claw |
| 4 | Maylene | Veilstone City | Fighting | Cobble Badge | Fly | Drain Punch |
| 5 | Crasher Wake | Pastoria City | Water | Fen Badge | Defog | Brine |
| 6 | Byron | Canalave City | Steel | Mine Badge | Strength | Flash Cannon |
| 7 | Candice | Snowpoint City | Ice | Icicle Badge | Rock Climb | Blizzard |
| 8 | Volkner | Sunyshore City | Electric | Beacon Badge | Waterfall | Discharge |

> **Note:** In DP, Fantina was gym 5 (after Maylene and Wake). Platinum moved Fantina to gym 3, requiring players to visit Hearthome earlier. The `FLAG_HIDE_HEARTHOME_CITY_GYM_GUIDE` and `FLAG_HIDE_HEARTHOME_ROUTE_209_ROADBLOCK` entries in hearthome_city.json reflect story gating that changed between versions.

**Elite Four (any order after 8 badges):**
1. Aaron — Bug type
2. Bertha — Ground type
3. Flint — Fire type
4. Lucian — Psychic type
5. Champion Cynthia — Mixed (Spiritomb, Roserade, Togekiss, Lucario, Milotic, Garchomp)

### 7.2 Team Galactic Arc

Team Galactic's plan: gather the lake trio's emotions/knowledge/willpower, power the Red Chain, summon Dialga and Palkia at Spear Pillar, destroy the current universe, create a new one under Cyrus's control.

**Story beat locations:**
1. Jubilife City — first encounter (`FLAG_HIDE_JUBILIFE_GALACTIC_GRUNTS`); Galactic Grunts at TV station
2. Eterna City — Galactic Building (`FLAG_HIDE_ETERNA_CITY_GALACTIC_GRUNTS`, `FLAG_HIDE_ETERNA_CITY_CYRUS`); Cyrus NPC; player rescues Bike Shop owner
3. Veilstone City — Galactic HQ; player rescues Lake Guardians
4. Lake Valor — Galactic bomb (Azelf captured)
5. Lake Verity — Galactic confrontation (Mesprit captured)
6. Lake Acuity — Uxie captured (story event)
7. Mt. Coronet / Spear Pillar — final Galactic battle; Cyrus summons creation duo; portal opens
8. Distortion World — Giratina drags Cyrus in; player follows; Cynthia assists

### 7.3 Distortion World

Unique to Platinum. A parallel dimension where the rules of space are inverted — gravity is inconsistent, platforms appear vertical and overhead, the world wraps around itself.

**Game mechanics:**
- No random encounters
- Puzzle-based navigation (push boulders off edges onto targets in other orientations)
- Cynthia accompanies player
- Cyrus is encountered and has a change of heart (or refuses to leave)
- Final encounter: Giratina-Origin Form (level 47)

**Map structure:** 5 floors (`distortion_world_1f` through `5f`). Floor 1 has one warp and one sign; floors grow more complex.

**Browser-game notes:**
- Distortion World cannot be faithfully rendered with standard top-down tiles. Options:
  a. Custom camera/layer system with platforms at multiple Y-levels
  b. Simplified 2.5D side view for this zone only
  c. Abstract the puzzle into a dedicated mini-game mode
- The sign in `distortion_world_1f` (script 2, facing North) likely contains a clue/tutorial for the gravity mechanic.

### 7.4 Legendary Locations

| Legendary | Location | Condition |
|---|---|---|
| Dialga | Spear Pillar (story) | Story event |
| Palkia | Spear Pillar (story) | Story event |
| Giratina (Origin) | Distortion World | Story event (also catch here in Platinum) |
| Giratina (Altered) | Turnback Cave / Sendoff Spring | Post-story |
| Uxie | Lake Acuity Cavern | Post-story |
| Mesprit | Lake Verity Cavern | Roaming after story (requires Pokéradar/Marking Map) |
| Azelf | Lake Valor Cavern | Post-story |
| Heatran | Stark Mountain | Buck escort quest (post-story) |
| Regigigas | Snowpoint Temple | Requires Regirock + Regice + Registeel in party |
| Cresselia | Full Moon Island (Sailor from Canalave) | Roaming after encounter |
| Darkrai | Newmoon Island (Member Card event item) | Event-only |
| Shaymin | Flower Paradise (Oak's Letter event item) | Event-only |
| Arceus | Hall of Origin (Azure Flute event item) | Event-only |

### 7.5 Battle Frontier (5 Facilities)

Located on the Battle Zone island (reached by ferry from Snowpoint or Sunyshore post-game).

| Facility | ID | Brain | Rules |
|---|---|---|---|
| Battle Tower | `battle_tower` | Palmer (player's father) | Standard 3v3 single/double battles, 7-battle sets |
| Battle Factory | `battle_factory` | Thorton | Rental Pokémon; swap after each battle |
| Battle Arcade | `battle_arcade` | Dahlia | Roulette modifiers before each battle |
| Battle Castle | `battle_castle` | Darach (Caitlin's butler) | Castle Points (CP) economy; buy info/heals |
| Battle Hall | `battle_hall` | Argenta | Solo 1v1, choose type each round, streak-based |

All facilities use a 3-Pokémon format with Level 50 or Open Level divisions. Print Points (BP) earned can be exchanged for rare items (TMs, held items, vitamins).

> **Browser note:** Battle Frontier can be implemented as a standalone mode accessible post-game. Each facility is a distinct sub-game. Start with Battle Tower (simplest rules) and add the others incrementally.

### 7.6 Underground (Fossil Mining & Secret Bases)

Accessed via Explorer Kit from any point in Sinnoh. A DS local wireless feature.

**Fossil mining mini-game:**
- Hammer (large area, cracks wall) and Chisel (small area, precise) tools
- Uncover buried items before wall integrity reaches 0
- Yields: fossils (Skull, Armor, Claw, Root, Cover, Dome — revive at Oreburgh Mining Museum), shards (exchange for move tutor in DP; TM shards), evolutionary stones, held items, rare items
- Fossil → Pokémon: Skull→Cranidos, Armor→Shieldon, Claw→Anorith, Root→Lileep, Cover→Tirtouga (via time machine), Dome→Kabuto (via time machine)

**Secret Bases:**
- Player digs out a room in Underground walls
- Decorate with furniture (obtained from spheres/trading Underground)
- Capture rival players' flags placed in their bases

> **Browser note:** The fossil mini-game translates well to browser (click/drag mechanic). Multiplayer flag capture requires server infrastructure. Single-player stub: procedurally generate fossil layouts, skip multiplayer flag feature.

---

## 8. Region Notes

### 8.1 Sinnoh East/West Split

Sinnoh is uniquely defined by Mt. Coronet running north–south through the center. The west side (Jubilife, Eterna, Floaroma, Celestic, Snowpoint) and east side (Oreburgh, Hearthome, Veilstone, Pastoria, Canalave, Sunyshore) are only connected by:
- Mt. Coronet interior passages (multiple floors, require Strength + Rock Smash for full access)
- Water routes (Routes 219–222 along the coast, require Surf and later Waterfall)

This forces a specific exploration order and creates natural pacing gates.

### 8.2 Distortion World Layout Rules

The Distortion World is a parallel dimension (Giratina's realm) that mirrors the Sinnoh region but with inverted physical laws. Key notes for implementation:
- Platform layout is non-standard — boulders and switches exist on vertical surfaces
- No random encounters — only scripted Giratina encounter
- Cynthia is always a companion here (she walks alongside the player)
- No Pokémon Center or save point inside — player must complete in one session or use Fly if they somehow escape
- In the original DS game, the area uses a pseudo-3D perspective with layered sprites to suggest vertical depth

### 8.3 Solaceon Ruins — Lore Significance

The Solaceon Ruins (`solaceon_ruins_1f` through `b4f`) contain chambers filled with Unown and stone tablets. The tablets describe the creation of the Sinnoh world:
- Arceus shaped the universe from chaos
- Dialga and Palkia were created first (time and space)
- Giratina was banished to the Distortion World for violence
- The Lake Guardians (Uxie, Mesprit, Azelf) gave knowledge, emotion, and willpower to living creatures

This lore is expanded in the Canalave Library (3F books in `canalave_library_3f`), which contains ancient Sinnoh legends and references to Darkrai, Cresselia, and the Sea Temple (Manaphy).

### 8.4 DS Features and Browser Translation

| DS Feature | Browser equivalent |
|---|---|
| Bottom touchscreen | Mouse click / tap (mobile) |
| Stylus drawing (Memo Pad, Dot Artist) | Canvas `<canvas>` element with mousedown events |
| Local wireless (Underground, Union Room, Link Searcher) | WebSocket server or stub/omit |
| GTS / Wi-Fi (Global Terminal) | REST API trade system or omit |
| Microphone (Pokétch apps) | Web Audio API (MediaDevices) or stub |
| Real-time clock (calendar, alarm) | `Date()` JS object |
| Rumble Pak | Vibration API (`navigator.vibrate()`) |
| DS Download Play (Pokémon demos) | Omit |
| Infrared (event distributions) | Server-side event flag |
| Dual screens | Single browser window — use panel layout or toggle |

### 8.5 Data Directories — Summary of What's Present

| Directory | Contents | Status |
|---|---|---|
| `data/maps/platinum/` | 75 area_data JSON files (render prop/texture/lighting sets, no event data) | Present |
| `data/maps/sinnoh/` | 534 named map JSON files with NPCs, warps, signs, coord_events | Present |
| `data/layouts/` | 365 layout JSON files (mostly Kanto/FireRed LAYOUT_* names) | Present (Kanto focus) |
| `data/tilesets/` | 60 tileset PNG+JSON pairs — all Kanto/FireRed/Sevii | Present (wrong region) |
| `data/sprites/player.png` | Player overworld sprite | Present |
| `data/sprites/npcs/` | NPC sprite sub-directory | Directory exists |

**Action items for Sinnoh implementation:**
1. Create Sinnoh-region tilesets in `data/tilesets/`
2. Resolve `dest_map: null` warp destinations in all sinnoh map JSON files
3. Add LAYOUT_* files for Sinnoh maps in `data/layouts/`
4. Populate `data/sprites/npcs/` with sprite sheets for all 58 NPC graphics IDs listed in Section 5.1
5. Add Pokémon overworld sprites for Machop, Psyduck, Buneary, Pachirisu and other overworld Pokémon
