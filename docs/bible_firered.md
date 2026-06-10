# Pokémon FireRed — Game Reference Bible

> **Purpose:** Permanent reference for all Kanto-region development in this browser-based fan game.
> All map data sourced from `data/maps/kanto/` (425 JSON files). GBA platform context: 240×160 pixels, 8×8 tile font, 32×32 tile overworld cells.

---

## 1. Overview

| Field | Value |
|---|---|
| Source game | Pokémon FireRed Version (GBA, 2004) |
| Region | Kanto |
| Total map files | 425 |
| Map format | JSON (id, name, region, layout, music, weather, map_type, connections, npcs, warps, triggers, signs) |
| Tileset format | PNG + JSON pairs in `data/tilesets/` |
| Sprite location | `data/sprites/` (player.png, npcs/ subdirectory) |
| GBA resolution | 240×160 px native; browser canvas scales up |
| Tile size | 16×16 px per overworld tile (2×2 of the 8×8 hardware tiles) |
| Coordinate system | (x, y) — x increases right, y increases down |

### Map Types Used
| `map_type` value | Meaning |
|---|---|
| `MAP_TYPE_TOWN` | Named settlement with gym and/or Pokémon Center |
| `MAP_TYPE_ROUTE` | Outdoor route between locations |
| `MAP_TYPE_UNDERGROUND` | Cave, tunnel, or dungeon |
| `MAP_TYPE_INDOOR` | Building interior |

### Weather Values
| Value | Effect |
|---|---|
| `WEATHER_SUNNY` | Clear sky, normal lighting |
| `WEATHER_NONE` | No weather (used in caves, indoors) |
| `WEATHER_SHADE` | Dimmed lighting (used in Viridian Forest) |

---

## 2. Map Catalog

### 2.1 Towns & Cities

All towns have `map_type: MAP_TYPE_TOWN`, `allow_running: true`, `allow_cycling: true`, `show_map_name: true`, `weather: WEATHER_SUNNY` unless noted.

| map_id | Name | Layout | Music | Connections | Warp Count | Notes |
|---|---|---|---|---|---|---|
| `MAP_PALLET_TOWN` | Pallet Town | `LAYOUT_PALLET_TOWN` | `MUS_PALLET` | Route 1 (up), Route 21 North (down) | 3 | Starting town; Oak's Lab, Player's House, Rival's House |
| `MAP_VIRIDIAN_CITY` | Viridian City | `LAYOUT_VIRIDIAN_CITY` | `MUS_PEWTER` | Route 2 (up), Route 1 (down), Route 22 (left) | 5 | Gym locked until late game; Old Man tutorial |
| `MAP_PEWTER_CITY` | Pewter City | `LAYOUT_PEWTER_CITY` | `MUS_PEWTER` | Route 3 (right), Route 2 (down) | — | Badge 1 (Brock); Museum |
| `MAP_CERULEAN_CITY` | Cerulean City | `LAYOUT_CERULEAN_CITY` | `MUS_FUCHSIA` | Route 24 (up), Route 5 (down), Route 4 (left), Route 9 (right) | 14 | Badge 2 (Misty); Bike Shop; Cerulean Cave entrance |
| `MAP_VERMILION_CITY` | Vermilion City | `LAYOUT_VERMILION_CITY` | — | Route 11 (right), Route 6 (up) | — | Badge 3 (Lt. Surge); S.S. Anne dock; Fan Club |
| `MAP_LAVENDER_TOWN` | Lavender Town | `LAYOUT_LAVENDER_TOWN` | `MUS_LAVENDER` | Route 10 (up), Route 12 (down), Route 8 (left) | 6 | Pokémon Tower; Mr. Fuji's house (Volunteer Pokémon House) |
| `MAP_CELADON_CITY` | Celadon City | `LAYOUT_CELADON_CITY` | `MUS_CELADON` | Route 16 (left), Route 7 (right) | 13 | Badge 4 (Erika); Dept. Store; Game Corner; Rocket Hideout below |
| `MAP_FUCHSIA_CITY` | Fuchsia City | `LAYOUT_FUCHSIA_CITY` | — | Routes 15/18/13/19 | — | Badge 5 (Koga); Safari Zone; Zoo |
| `MAP_SAFFRON_CITY` | Saffron City | `LAYOUT_SAFFRON_CITY` | `MUS_PEWTER` | Route 5 (up), Route 6 (down), Route 7 (left), Route 8 (right) | 15 | Badge 6 (Sabrina); Silph Co.; Fighting Dojo; Copycat's house |
| `MAP_CINNABAR_ISLAND` | Cinnabar Island | `LAYOUT_CINNABAR_ISLAND` | `MUS_CINNABAR` | Route 21 South (up), Route 20 (right) | 5 | Badge 7 (Blaine); Pokémon Lab; Pokémon Mansion |
| `MAP_VIRIDIAN_CITY` | Viridian City (Gym) | — | — | — | — | Badge 8 (Giovanni); gym locked until 7 other badges |
| `MAP_INDIGO_PLATEAU_EXTERIOR` | Indigo Plateau | `LAYOUT_INDIGO_PLATEAU_EXTERIOR` | — | Route 23 (down) | — | Elite Four + Champion; Hall of Fame |

#### Sevii Island Towns

| map_id | Name | Music | Notes |
|---|---|---|---|
| `MAP_ONE_ISLAND` | One Island (Knot Island) | — | Harbor; Kindle Road; Treasure Beach |
| `MAP_TWO_ISLAND` | Two Island (Boon Island) | — | Cape Brink; Joyful Game Corner |
| `MAP_THREE_ISLAND` | Three Island (Kin Island) | — | Berry Forest; Bond Bridge; Dunsparce Tunnel |
| `MAP_FOUR_ISLAND` | Four Island (Floe Island) | — | Icefall Cave; Lorelei's House; Pokémon Day Care |
| `MAP_FIVE_ISLAND` | Five Island (Chrono Island) | — | Meadow; Memorial Pillar; Resort Gorgeous; Rocket Warehouse; Water Labyrinth; Lost Cave |
| `MAP_SIX_ISLAND` | Six Island (Fortune Island) | — | Dotted Hole; Green Path; Ruin Valley; Water Path; Altering Cave; Outcast Island; Pattern Bush |
| `MAP_SEVEN_ISLAND` | Seven Island (Quest Island) | — | Sevault Canyon; Tanoby Ruins; Trainer Tower |

---

### 2.2 Routes

All routes have `map_type: MAP_TYPE_ROUTE`, `allow_running: true`, `allow_cycling: true`, `show_map_name: true`, `weather: WEATHER_SUNNY` unless noted.

| map_id | Name | Music | Connections | Key Features |
|---|---|---|---|---|
| `MAP_ROUTE1` | Route 1 | `MUS_ROUTE1` | Viridian City (up), Pallet Town (down) | First route; Potion handout from Mart Clerk NPC |
| `MAP_ROUTE2` | Route 2 | — | Pewter City (up), Viridian City (down) | Viridian Forest split; Route 2 East Building (HM Flash tutor) |
| `MAP_ROUTE3` | Route 3 | — | Pewter City (left), Mt. Moon/Route 4 (right) | — |
| `MAP_ROUTE4` | Route 4 | — | Route 3/Mt. Moon (left), Cerulean City (right) | Pokémon Center on route |
| `MAP_ROUTE5` | Route 5 | — | Cerulean City (up), Saffron City (down) | Underground Path north entrance; Day Care north of here |
| `MAP_ROUTE6` | Route 6 | — | Saffron City (up), Vermilion City (down) | Underground Path south entrance |
| `MAP_ROUTE7` | Route 7 | — | Celadon City (left), Saffron City (right) | Underground Path east entrance |
| `MAP_ROUTE8` | Route 8 | — | Saffron City (left), Lavender Town (right) | Underground Path west entrance |
| `MAP_ROUTE9` | Route 9 | — | Cerulean City (left), Route 10 (right) | — |
| `MAP_ROUTE10` | Route 10 | — | Route 9 (up), Lavender Town (down) | Pokémon Center on route; Rock Tunnel access |
| `MAP_ROUTE11` | Route 11 | — | Vermilion City (left), Route 12 (right) | Gate building with 2F |
| `MAP_ROUTE12` | Route 12 | — | Lavender Town (up), Route 13 (down) | Fishing House; gate buildings |
| `MAP_ROUTE13` | Route 13 | — | Route 12 (north), Route 14 (south) | Maze-like layout |
| `MAP_ROUTE14` | Route 14 | — | Route 13 (north), Route 15 (south) | — |
| `MAP_ROUTE15` | Route 15 | — | Route 14 (right), Fuchsia City (left) | Gate with 2F |
| `MAP_ROUTE16` | Route 16 | — | Celadon City (right), Route 17 (down) | Cycling Road gate; House with Fly user |
| `MAP_ROUTE17` | Route 17 | — | Route 16 (north), Route 18 (south) | Cycling Road (fast downhill); no random encounters on bike path |
| `MAP_ROUTE18` | Route 18 | — | Route 17 (north), Fuchsia City (right) | Gate with 2F |
| `MAP_ROUTE19` | Route 19 | — | Fuchsia City (north), Route 20 (south/west) | Surf required; unused house |
| `MAP_ROUTE20` | Route 20 | — | Route 19 (east), Cinnabar Island (right) | Seafoam Islands midpoint |
| `MAP_ROUTE21_NORTH` | Route 21 North | — | Pallet Town (up), Route 21 South (down) | Surf required |
| `MAP_ROUTE21_SOUTH` | Route 21 South | — | Route 21 North (up), Cinnabar Island (down) | Surf required |
| `MAP_ROUTE22` | Route 22 | — | Viridian City (right), Route 23 gate (left) | Rival battle 1 here early game |
| `MAP_ROUTE23` | Route 23 | — | Route 22 gate (south), Victory Road (north) | Badge gates (8 guard NPCs); unused house |
| `MAP_ROUTE24` | Route 24 | `MUS_ROUTE24` | Cerulean City (down), Route 25 (right) | Nugget Bridge; 5 trainers + Rocket grunt reward |
| `MAP_ROUTE25` | Route 25 | — | Route 24 (left) | Bill's Sea Cottage at east end |

---

### 2.3 Dungeons & Caves

All dungeons have `map_type: MAP_TYPE_UNDERGROUND`, `weather: WEATHER_NONE`, unless noted.

| map_id | Name | Music | Floors | Key Features |
|---|---|---|---|---|
| `MAP_VIRIDIAN_FOREST` | Viridian Forest | `MUS_VIRIDIAN_FOREST` | 1 | `weather: WEATHER_SHADE`; map_type ROUTE; Bug Catcher trainers; items: PokéBall, Antidote, Potions |
| `MAP_MT_MOON_1F` | Mt. Moon 1F | `MUS_MT_MOON` | 3 (1F, B1F, B2F) | Zubat/Clefairy; Fossil choice (Dome/Helix) on B2F; items: TM09, Rare Candy, Moon Stone |
| `MAP_MT_MOON_B1F` | Mt. Moon B1F | `MUS_MT_MOON` | — | Mid-level; connects 1F to B2F |
| `MAP_MT_MOON_B2F` | Mt. Moon B2F | `MUS_MT_MOON` | — | Fossil room; Supersonic Zubat; Team Rocket scientist battle |
| `MAP_ROCK_TUNNEL_1F` | Rock Tunnel 1F | — | 2 (1F, B1F) | No Flash = nearly dark; Hiker trainers |
| `MAP_ROCK_TUNNEL_B1F` | Rock Tunnel B1F | — | — | — |
| `MAP_POKEMON_TOWER_1F` | Pokémon Tower 1F | `MUS_POKE_TOWER` | 7 (1F–7F) | map_type INDOOR; Ghost-type enemies 3F–6F; Marowak ghost on 5F; Mr. Fuji rescued on 7F |
| `MAP_SAFARI_ZONE_CENTER` | Safari Zone (Center) | — | 4 areas | 500-step limit; rest houses; Secret House (HM Surf on west side) |
| `MAP_SAFARI_ZONE_EAST` | Safari Zone East | — | — | — |
| `MAP_SAFARI_ZONE_NORTH` | Safari Zone North | — | — | — |
| `MAP_SAFARI_ZONE_WEST` | Safari Zone West | — | — | HM03 Surf in Secret House |
| `MAP_SEAFOAM_ISLANDS_1F` | Seafoam Islands 1F | — | 5 (1F, B1F–B4F) | Articuno on B4F; boulder puzzles for current redirection |
| `MAP_SEAFOAM_ISLANDS_B1F` | Seafoam Islands B1F | — | — | — |
| `MAP_SEAFOAM_ISLANDS_B2F` | Seafoam Islands B2F | — | — | — |
| `MAP_SEAFOAM_ISLANDS_B3F` | Seafoam Islands B3F | — | — | — |
| `MAP_SEAFOAM_ISLANDS_B4F` | Seafoam Islands B4F | — | — | Articuno at (x, y center) |
| `MAP_VICTORY_ROAD_1F` | Victory Road 1F | `MUS_MT_MOON` | 3 (1F–3F) | Strength boulders; CoolTrainer battles; connects Route 23 to Indigo Plateau |
| `MAP_VICTORY_ROAD_2F` | Victory Road 2F | `MUS_MT_MOON` | — | — |
| `MAP_VICTORY_ROAD_3F` | Victory Road 3F | `MUS_MT_MOON` | — | — |
| `MAP_CERULEAN_CAVE_1F` | Cerulean Cave 1F | `MUS_ROCKET_HIDEOUT` | 3 (1F, 2F, B1F) | Post-game only (all 8 badges + defeat Elite Four); Mewtwo on B1F; Rock Smash rocks block paths |
| `MAP_CERULEAN_CAVE_2F` | Cerulean Cave 2F | — | — | — |
| `MAP_CERULEAN_CAVE_B1F` | Cerulean Cave B1F | — | — | Mewtwo (Lv. 70) |
| `MAP_POKEMON_MANSION_1F` | Pokémon Mansion 1F | — | 4 (1F–3F, B1F) | Burned-down lab; journals re: Mew/Mewtwo experiment; Moltres NOT here (moved to Mt. Ember in FR) |
| `MAP_POKEMON_MANSION_2F` | Pokémon Mansion 2F | — | — | — |
| `MAP_POKEMON_MANSION_3F` | Pokémon Mansion 3F | — | — | — |
| `MAP_POKEMON_MANSION_B1F` | Pokémon Mansion B1F | — | — | — |
| `MAP_POWER_PLANT` | Power Plant | — | 1 | Zapdos at end; no trainers; Electric-type Pokémon |
| `MAP_DIGLETTS_CAVE_B1F` | Diglett's Cave | — | 1 | Route 2 shortcut to Pewter; only Diglett/Dugtrio encounter |
| `MAP_UNDERGROUND_PATH_NORTH_SOUTH_TUNNEL` | Underground Path (N-S) | — | 1 | Connects Route 5/6 under Saffron |
| `MAP_UNDERGROUND_PATH_EAST_WEST_TUNNEL` | Underground Path (E-W) | — | 1 | Connects Route 7/8 under Saffron |
| `MAP_ROCKET_HIDEOUT_B1F` | Rocket Hideout B1F | — | 4 (B1F–B4F) | Under Celadon Game Corner; Giovanni boss on B4F; Silph Scope reward |
| `MAP_ROCKET_HIDEOUT_B2F` | Rocket Hideout B2F | — | — | — |
| `MAP_ROCKET_HIDEOUT_B3F` | Rocket Hideout B3F | — | — | — |
| `MAP_ROCKET_HIDEOUT_B4F` | Rocket Hideout B4F | — | — | Giovanni + Silph Scope |
| `MAP_SILPH_CO_1F` | Silph Co. 1F | `MUS_SILPH` | 11 floors + elevator | map_type INDOOR; Team Rocket invasion; Rival battle 3; Giovanni boss on 11F; Master Ball reward |

#### Sevii Island Dungeons

| map_id | Name | Floors | Notes |
|---|---|---|---|
| `MAP_FIVE_ISLAND_LOST_CAVE_*` | Lost Cave | 14 rooms | Mazes; Selphy's lost Pokémon quest |
| `MAP_FOUR_ISLAND_ICEFALL_CAVE_*` | Icefall Cave | 4 (1F, B1F, Back, Entrance) | Lapras encounter; HM07 Waterfall |
| `MAP_SIX_ISLAND_DOTTED_HOLE_*` | Dotted Hole | 5 (1F, B1F–B4F, Sapphire Room) | Cut required to enter; Sapphire gem |
| `MAP_SEVEN_ISLAND_SEVAULT_CANYON` | Sevault Canyon | — | Route-like; TanobyKey puzzle entrance |
| `MAP_SEVEN_ISLAND_TANOBY_RUINS_*` | Tanoby Ruins | 7 chambers | Unown encounter chambers (after solving TanobyKey) |
| `MAP_MT_EMBER_*` | Mt. Ember | Summit + Ruby Path (5 levels) | Moltres at summit; Ruby gem in path |
| `MAP_FIVE_ISLAND_ROCKET_WAREHOUSE` | Rocket Warehouse | 1 | Five Island; post-Silph Rocket sub-plot |
| `MAP_SIX_ISLAND_ALTERING_CAVE` | Altering Cave | 1 | Event-only Pokémon (normally only Zubat) |
| `MAP_SIX_ISLAND_PATTERN_BUSH` | Pattern Bush | 1 | Heracross, Scyther, etc. post-game |
| `MAP_THREE_ISLAND_BERRY_FOREST` | Berry Forest | 1 | Part of Lostelle rescue quest |
| `MAP_NAVEL_ROCK_*` | Navel Rock | Base + 16 floors | Event-only (MysticTicket); Lugia (base) + Ho-Oh (summit) |
| `MAP_BIRTH_ISLAND_*` | Birth Island | Exterior + Harbor | Event-only (AuroraTicket); Deoxys encounter |

---

### 2.4 Interiors / Buildings

Grouped by parent location. All interiors have `map_type: MAP_TYPE_INDOOR`, `allow_running: false`, `allow_cycling: false`, `weather: WEATHER_NONE` unless noted. `show_map_name: false` for most house interiors.

#### Pallet Town
| map_id | Name | Warps to/from | NPCs | Notes |
|---|---|---|---|---|
| `MAP_PALLET_TOWN_PLAYERS_HOUSE_1F` | Player's House 1F | Pallet Town, Player's House 2F | Mom (`OBJ_EVENT_GFX_MOM`) | TV sign; game start here |
| `MAP_PALLET_TOWN_PLAYERS_HOUSE_2F` | Player's House 2F | Player's House 1F | — | Player's bedroom; NES console; game begins in 2F |
| `MAP_PALLET_TOWN_RIVALS_HOUSE` | Rival's House | Pallet Town | — | Blue's sister gives Town Map |
| `MAP_PALLET_TOWN_PROFESSOR_OAKS_LAB` | Professor Oak's Lab | Pallet Town | Prof. Oak, Rival | Starter Pokémon selection |

#### Viridian City
| map_id | Name | Notes |
|---|---|---|
| `MAP_VIRIDIAN_CITY_POKEMON_CENTER_1F` | Pokémon Center 1F | Nurse Joy; Cable Club (2F) |
| `MAP_VIRIDIAN_CITY_POKEMON_CENTER_2F` | Pokémon Center 2F | Wireless/cable trading |
| `MAP_VIRIDIAN_CITY_MART` | Poké Mart | Only delivers Oak's Parcel early; full stock after Parcel |
| `MAP_VIRIDIAN_CITY_GYM` | Viridian Gym | Badge 8 (Giovanni); Ground-type; requires all 7 other badges |
| `MAP_VIRIDIAN_CITY_HOUSE` | Viridian City House | Dream Eater TM tutor |
| `MAP_VIRIDIAN_CITY_SCHOOL` | Viridian City School | Trainer tips; Youngster NPC tutorial |

#### Pewter City
| map_id | Name | Notes |
|---|---|---|
| `MAP_PEWTER_CITY_GYM` | Pewter Gym | Badge 1 (Brock); Rock-type |
| `MAP_PEWTER_CITY_MUSEUM_1F` | Pewter Museum 1F | Old Amber (Aerodactyl); exhibits |
| `MAP_PEWTER_CITY_MUSEUM_2F` | Pewter Museum 2F | Space exhibits |
| `MAP_PEWTER_CITY_POKEMON_CENTER_1F` | Pokémon Center 1F | — |
| `MAP_PEWTER_CITY_POKEMON_CENTER_2F` | Pokémon Center 2F | — |
| `MAP_PEWTER_CITY_MART` | Poké Mart | — |
| `MAP_PEWTER_CITY_HOUSE1` | House 1 | — |
| `MAP_PEWTER_CITY_HOUSE2` | House 2 | — |

#### Cerulean City
| map_id | Name | Notes |
|---|---|---|
| `MAP_CERULEAN_CITY_GYM` | Cerulean Gym | Badge 2 (Misty); Water-type |
| `MAP_CERULEAN_CITY_BIKE_SHOP` | Bike Shop | Bike Voucher → free Bicycle |
| `MAP_CERULEAN_CITY_POKEMON_CENTER_1F/2F` | Pokémon Center | — |
| `MAP_CERULEAN_CITY_MART` | Poké Mart | — |
| `MAP_CERULEAN_CITY_HOUSE1–5` | Houses 1–5 | House 2 has burglar event (Rocket steals TM28) |
| `MAP_ROUTE25_SEA_COTTAGE` | Bill's Sea Cottage | Bill (PC → human); gives S.S. Ticket |

#### Vermilion City
| map_id | Name | Notes |
|---|---|---|
| `MAP_VERMILION_CITY_GYM` | Vermilion Gym | Badge 3 (Lt. Surge); Electric-type; trash-can puzzle for lock |
| `MAP_VERMILION_CITY_POKEMON_FAN_CLUB` | Pokémon Fan Club | Chairman gives Bike Voucher after listening to story |
| `MAP_VERMILION_CITY_POKEMON_CENTER_1F/2F` | Pokémon Center | — |
| `MAP_VERMILION_CITY_MART` | Poké Mart | — |
| `MAP_VERMILION_CITY_HOUSE1–3` | Houses | — |
| `MAP_SS_ANNE_EXTERIOR` | S.S. Anne (Exterior) | Docked in Vermilion; leaves after player gets HM01 Cut |
| `MAP_SS_ANNE_DECK` | S.S. Anne Deck | — |
| `MAP_SS_ANNE_CAPTAINS_OFFICE` | Captain's Office | HM01 Cut given here |
| `MAP_SS_ANNE_1F_CORRIDOR` | S.S. Anne 1F Corridor | — |
| `MAP_SS_ANNE_2F_CORRIDOR` | S.S. Anne 2F Corridor | Rival battle 2 |
| `MAP_SS_ANNE_B1F_CORRIDOR` | S.S. Anne B1F Corridor | — |
| `MAP_SS_ANNE_KITCHEN` | S.S. Anne Kitchen | — |

#### Lavender Town
| map_id | Name | Notes |
|---|---|---|
| `MAP_POKEMON_TOWER_1F–7F` | Pokémon Tower | 7 floors; Marowak ghost on 5F (unbeatable without Silph Scope); Mr. Fuji on 7F |
| `MAP_LAVENDER_TOWN_VOLUNTEER_POKEMON_HOUSE` | Volunteer Pokémon House | Mr. Fuji's home; gives Poké Flute after rescue |
| `MAP_LAVENDER_TOWN_POKEMON_CENTER_1F/2F` | Pokémon Center | — |
| `MAP_LAVENDER_TOWN_MART` | Poké Mart | — |
| `MAP_LAVENDER_TOWN_HOUSE1/2` | Houses | — |

#### Celadon City
| map_id | Name | Notes |
|---|---|---|
| `MAP_CELADON_CITY_GYM` | Celadon Gym | Badge 4 (Erika); Grass-type; fragrant garden layout |
| `MAP_CELADON_CITY_DEPARTMENT_STORE_1F–5F` | Department Store | 5 floors + Elevator + Roof; TMs, evolution stones, vending machines on Roof |
| `MAP_CELADON_CITY_DEPARTMENT_STORE_ELEVATOR` | Dept. Store Elevator | — |
| `MAP_CELADON_CITY_DEPARTMENT_STORE_ROOF` | Dept. Store Roof | Vending machines (Fresh Water/Soda Pop/Lemonade) for Gym NPC |
| `MAP_CELADON_CITY_GAME_CORNER` | Game Corner | Slot machines; coins; Rocket Hideout entrance behind poster |
| `MAP_CELADON_CITY_GAME_CORNER_PRIZE_ROOM` | Prize Exchange Room | Pokémon prizes (Abra, Clefairy, Scyther/Pinsir, Dratini) |
| `MAP_CELADON_CITY_CONDOMINIUMS_1F–ROOF` | Condominiums | Eevee on Roof |
| `MAP_CELADON_CITY_POKEMON_CENTER_1F/2F` | Pokémon Center | — |
| `MAP_CELADON_CITY_RESTAURANT` | Restaurant | — |
| `MAP_CELADON_CITY_HOTEL` | Hotel | — |
| `MAP_CELADON_CITY_HOUSE1` | House | — |

#### Saffron City
| map_id | Name | Notes |
|---|---|---|
| `MAP_SAFFRON_CITY_GYM` | Saffron Gym | Badge 6 (Sabrina); Psychic-type; warp tile maze |
| `MAP_SAFFRON_CITY_DOJO` | Fighting Dojo | Rival dojo; win = choose Hitmonlee or Hitmonchan |
| `MAP_SILPH_CO_1F–11F` | Silph Co. | 11 floors + Elevator; Master Ball on 9F; Giovanni on 11F; Lapras gift on 7F |
| `MAP_SILPH_CO_ELEVATOR` | Silph Co. Elevator | — |
| `MAP_SAFFRON_CITY_COPYCATS_HOUSE_1F/2F` | Copycat's House | Copycat; give her Clefairy doll → get Ticket to Sevii post-game |
| `MAP_SAFFRON_CITY_MR_PSYCHICS_HOUSE` | Mr. Psychic's House | TM29 Psychic |
| `MAP_SAFFRON_CITY_POKEMON_TRAINER_FAN_CLUB` | Trainer Fan Club | — |
| `MAP_SAFFRON_CITY_POKEMON_CENTER_1F/2F` | Pokémon Center | — |
| `MAP_SAFFRON_CITY_MART` | Poké Mart | — |
| `MAP_SAFFRON_CITY_HOUSE` | House | — |

#### Fuchsia City
| map_id | Name | Notes |
|---|---|---|
| `MAP_FUCHSIA_CITY_GYM` | Fuchsia Gym | Badge 5 (Koga); Poison-type; invisible wall maze |
| `MAP_FUCHSIA_CITY_SAFARI_ZONE_ENTRANCE` | Safari Zone Entrance | Entry fee 500 PokéDollars; 30 Safari Balls; 500-step limit |
| `MAP_FUCHSIA_CITY_SAFARI_ZONE_OFFICE` | Safari Zone Warden's Office | — |
| `MAP_FUCHSIA_CITY_WARDENS_HOUSE` | Safari Zone Warden's House | Give Gold Teeth → HM04 Strength |
| `MAP_FUCHSIA_CITY_POKEMON_CENTER_1F/2F` | Pokémon Center | — |
| `MAP_FUCHSIA_CITY_MART` | Poké Mart | — |
| `MAP_FUCHSIA_CITY_HOUSE1–3` | Houses | — |

#### Cinnabar Island
| map_id | Name | Notes |
|---|---|---|
| `MAP_CINNABAR_ISLAND_GYM` | Cinnabar Gym | Badge 7 (Blaine); Fire-type; quiz machines unlock doors |
| `MAP_CINNABAR_ISLAND_POKEMON_LAB_ENTRANCE` | Pokémon Lab Entrance | — |
| `MAP_CINNABAR_ISLAND_POKEMON_LAB_LOUNGE` | Pokémon Lab Lounge | — |
| `MAP_CINNABAR_ISLAND_POKEMON_LAB_RESEARCH_ROOM` | Research Room | Fossil revival (Dome → Kabuto, Helix → Omanyte, Old Amber → Aerodactyl) |
| `MAP_CINNABAR_ISLAND_POKEMON_LAB_EXPERIMENT_ROOM` | Experiment Room | Journal lore on Mew/Mewtwo |
| `MAP_CINNABAR_ISLAND_POKEMON_CENTER_1F/2F` | Pokémon Center | — |
| `MAP_CINNABAR_ISLAND_MART` | Poké Mart | — |

#### Indigo Plateau / Elite Four
| map_id | Name | Notes |
|---|---|---|
| `MAP_POKEMON_LEAGUE_LORELEISROOM` | Elite Four — Lorelei | Ice-type specialist |
| `MAP_POKEMON_LEAGUE_BRUNOSROOM` | Elite Four — Bruno | Fighting-type specialist |
| `MAP_POKEMON_LEAGUE_AGATHASROOM` | Elite Four — Agatha | Ghost-type specialist |
| `MAP_POKEMON_LEAGUE_LANCESROOM` | Elite Four — Lance | Dragon-type specialist |
| `MAP_POKEMON_LEAGUE_CHAMPIONSROOM` | Champion's Room | Rival (Blue) as Champion |
| `MAP_POKEMON_LEAGUE_HALL_OF_FAME` | Hall of Fame | Credits roll; data saved |
| `MAP_INDIGO_PLATEAU_POKEMON_CENTER_1F/2F` | Pokémon Center | Last heal before Elite Four |

#### Route Buildings
| map_id | Name | Notes |
|---|---|---|
| `MAP_ROUTE2_EAST_BUILDING` | Route 2 East Building | HM05 Flash (if 10+ Pokémon caught) |
| `MAP_ROUTE2_HOUSE` | Route 2 House | — |
| `MAP_ROUTE4_POKEMON_CENTER_1F/2F` | Route 4 Pokémon Center | Only Pokémon Center on a route |
| `MAP_ROUTE5_POKEMON_DAY_CARE` | Pokémon Day Care | Leave one Pokémon; no breeding in FireRed |
| `MAP_ROUTE12_FISHING_HOUSE` | Fishing House | Super Rod |
| `MAP_ROUTE16_HOUSE` | Route 16 House | HM02 Fly (if 30+ Pokémon caught) |
| `MAP_ROUTE25_SEA_COTTAGE` | Bill's Sea Cottage | Bill rescue; S.S. Anne ticket |
| `MAP_ROUTE10_POKEMON_CENTER_1F/2F` | Route 10 Pokémon Center | Before Rock Tunnel |

#### Special / Multiplayer Maps
| map_id | Name | Notes |
|---|---|---|
| `MAP_UNION_ROOM` | Union Room | Wireless multiplayer lobby |
| `MAP_TRADE_CENTER` | Trade Center | Cable/wireless Pokémon trading |
| `MAP_RECORD_CORNER` | Record Corner | Mix records with other players |
| `MAP_BATTLE_COLOSSEUM_2P` | Battle Colosseum (2P) | Wireless battle |
| `MAP_BATTLE_COLOSSEUM_4P` | Battle Colosseum (4P) | 4-player wireless battle |
| `MAP_SEVEN_ISLAND_TRAINER_TOWER` | Trainer Tower | 8 floors of battles; time trials; post-game |

---

## 3. Warp & Connection Graph

### Main Kanto Overworld Flow

```
Pallet Town
  │ up (Route 1)
  ▼
Viridian City ─── left ──► Route 22 ──► Route 23 ──► Victory Road ──► Indigo Plateau
  │ up (Route 2)
  ▼
[Viridian Forest via Route 2 south/north entrances]
  │
  ▼
Pewter City
  │ right (Route 3)
  ▼
Mt. Moon (1F → B1F → B2F)
  │ exit east
  ▼
Route 4 ──► Cerulean City
  │ up (Route 24/25)         │ right (Route 9)
  ▼                          ▼
Nugget Bridge/Bill      Route 10 → Rock Tunnel
                               │
                               ▼
                         Lavender Town ─── left (Route 8) ──► Saffron City
                               │ down (Route 12)               │ up (Route 5)
                               ▼                               ▼
                         Route 13/14/15 ──► Fuchsia City   Cerulean City
                                                │
                                       left (Route 19)
                                                │
                                               Route 20 ──► Seafoam Islands ──► Cinnabar Island
                                                                                    │ up (Route 21)
                                                                                    ▼
                                                                               Pallet Town

Celadon City ─── right (Route 7) ──► Saffron City
     │ left (Route 16)
     ▼
Cycling Road (Route 17)
     │
     ▼
Route 18 ──► Fuchsia City
```

### Key Underground/Interior Warp Chains

| Chain | Path |
|---|---|
| Player's House | PalletTown → PlayersHouse_1F (warp x6,y7) → PlayersHouse_2F (stair x10,y2) |
| Oak's Lab | PalletTown → ProfessorOaksLab (warp x16,y13) |
| Rocket Hideout | CeladonCity_GameCorner → RocketHideout_B1F → B2F → B3F → B4F (Giovanni) |
| Silph Co. | SaffronCity (warp x33,y30) → SilphCo_1F → 2F … → 11F (via stairs at x31,y2 or Elevator x22,y3) |
| Cerulean Cave | CeruleanCity (warp x1,y12) → CeruleanCave_1F → 2F / B1F (Mewtwo) |
| Pokémon Tower | LavenderTown (warp x18,y6) → Tower_1F → 2F → 3F → 4F → 5F (Marowak) → 6F → 7F (Mr. Fuji) |
| Victory Road | Route23 → VictoryRoad_1F (warp x11,y20) → 2F → 3F → IndigoPlateau |
| Safari Zone | FuchsiaCity_SafariZone_Entrance → Center / East / North / West (rest houses mid-zone) |
| Underground N-S | Route5_SouthEntrance ↔ UndergroundPath_NorthSouthTunnel ↔ Route6_NorthEntrance |
| Underground E-W | Route7_EastEntrance ↔ UndergroundPath_EastWestTunnel ↔ Route8_WestEntrance |
| Seafoam Islands | Route20 → SeafoamIslands_1F → B1F → B2F → B3F → B4F (Articuno) |
| Mt. Moon | Route3 → MtMoon_1F → B1F → B2F → Route4 |
| Rock Tunnel | Route10 → RockTunnel_1F → B1F → Route10 (other side) |

### Sevii Islands Access

```
Pallet Town / Vermilion City
  │ (Seagallop Ferry — S.S. Ticket or Rainbow/Mystic Pass)
  ├──► One Island  ──► Kindle Road ──► Mt. Ember
  ├──► Two Island  ──► Cape Brink
  ├──► Three Island ──► Bond Bridge ──► Berry Forest
  ├──► Four Island  ──► Icefall Cave
  ├──► Five Island  ──► Meadow / Water Labyrinth / Lost Cave / Rocket Warehouse
  ├──► Six Island   ──► Green Path / Ruin Valley / Dotted Hole / Pattern Bush / Altering Cave
  └──► Seven Island ──► Sevault Canyon / Tanoby Ruins / Trainer Tower
```

---

## 4. Tileset Catalog

All tilesets live in `data/tilesets/` as paired `<name>.png` + `<name>.json` files.
60 unique tileset names (120 files total).

### Outdoor / Town Tilesets

| Tileset File | Maps That Use It | Type |
|---|---|---|
| `pallet_town` | PalletTown, Route1 southern section | Outdoor town |
| `viridian_city` | ViridianCity, Route 1/2 north section | Outdoor town |
| `viridian_forest` | ViridianForest | Outdoor forest |
| `pewter_city` | PewterCity, Route 3 | Outdoor town |
| `cerulean_city` | CeruleanCity, Route 4/24/25 | Outdoor town |
| `vermilion_city` | VermilionCity, Route 6/11 | Outdoor town |
| `lavender_town` | LavenderTown, Route 8/10/12 | Outdoor town |
| `celadon_city` | CeladonCity, Route 7/16 | Outdoor town |
| `fuchsia_city` | FuchsiaCity, Route 15/18/19 | Outdoor town |
| `saffron_city` | SaffronCity, Route 5 | Outdoor town |
| `cinnabar_island` | CinnabarIsland, Route 20/21 | Outdoor island |
| `indigo_plateau` | IndigoPlateau_Exterior, Route 23 | Outdoor plateau |
| `sevii_islands_123` | One/Two/Three Island exteriors | Outdoor island |
| `sevii_islands_45` | Four/Five Island exteriors | Outdoor island |
| `sevii_islands_67` | Six/Seven Island exteriors | Outdoor island |
| `island_harbor` | All island harbor maps | Outdoor dock |
| `berry_forest` | ThreeIsland_BerryForest | Outdoor forest |
| `mt_ember` | MtEmber_Exterior, MtEmber_Summit | Outdoor mountain |

### Dungeon / Cave Tilesets

| Tileset File | Maps That Use It | Type |
|---|---|---|
| `cave` | MtMoon, RockTunnel, VictoryRoad | Cave |
| `cerulean_cave` | CeruleanCave all floors | Cave (special) |
| `digletts_cave` | DiglettsCave_B1F, entrances | Cave |
| `rock_tunnel` | RockTunnel 1F, B1F | Dark cave |
| `seafoam_islands` | SeafoamIslands all floors | Ice cave |
| `pokemon_tower` | PokemonTower 1F–7F | Haunted tower |
| `pokemon_mansion` | PokemonMansion 1F–3F, B1F | Burned mansion |
| `power_plant` | PowerPlant | Industrial |
| `safari_zone_building` | SafariZone rest houses, entrance | Safari interior |
| `navel_rock` | NavelRock all floors | Legendary cave |
| `tanoby_ruins` | TanobyRuins chambers | Ancient ruins |
| `underground_path` | UndergroundPath tunnels | Underground tunnel |
| `trainer_tower` | TrainerTower 1F–8F, lobby, roof | Tower |

### Interior / Building Tilesets

| Tileset File | Maps That Use It | Type |
|---|---|---|
| `generic_building_1` | Most house interiors, Poké Centers basic rooms | Generic interior |
| `generic_building_2` | Alternate house style interiors | Generic interior |
| `pokemon_center` | PokémonCenter 1F/2F (all cities) | Pokémon Center |
| `mart` | Poké Mart interiors (all cities) | Mart |
| `lab` | ProfessorOaksLab, CinnabarIsland PokémonLab | Lab |
| `school` | ViridianCity_School | School |
| `museum` | PewterCity_Museum 1F/2F | Museum |
| `department_store` | CeladonCity_DepartmentStore 1F–5F, Elevator, Roof | Department store |
| `game_corner` | CeladonCity_GameCorner, Prize Room | Game corner |
| `condominiums` | CeladonCity_Condominiums 1F–Roof | Condominiums |
| `restaurant_hotel` | CeladonCity_Restaurant, Hotel | Restaurant/hotel |
| `silph_co` | SilphCo 1F–11F, Elevator | Corporate building |
| `ss_anne` | SSAnne all maps | Ocean liner |
| `fan_club_daycare` | VermilionCity_PokemonFanClub, Route5_DayCare | Fan club/daycare |
| `cable_club` | PokémonCenter 2F cable rooms | Cable club |
| `hoenn_building` | RecordCorner, TradeCenter, UnionRoom, BattleColosseum | Multiplayer rooms |
| `hall_of_fame` | PokemonLeague_HallOfFame | Hall of fame |
| `pokemon_league` | Elite Four rooms, Champion's Room | Pokémon League |
| `bike_shop` | CeruleanCity_BikeShop | Bike shop |
| `burgled_house` | CeruleanCity_House2 (burglar event) | Special interior |
| `sea_cottage` | Route25_SeaCottage (Bill's) | Cottage interior |
| `cerulean_gym` | CeruleanCity_Gym | Gym (Water) |
| `viridian_gym` | ViridianCity_Gym | Gym (Ground) |
| `pewter_gym` | PewterCity_Gym | Gym (Rock) |
| `celadon_gym` | CeladonCity_Gym | Gym (Grass) |
| `cinnabar_gym` | CinnabarIsland_Gym | Gym (Fire) |
| `fuchsia_gym` | FuchsiaCity_Gym | Gym (Poison) |
| `saffron_gym` | SaffronCity_Gym | Gym (Psychic) |
| `vermilion_gym` | VermilionCity_Gym | Gym (Electric) |

---

## 5. Sprite Manifest

### 5.1 NPC Graphics IDs

All unique `graphics_id` values found across sampled maps. These are the sprites that must exist in `data/sprites/npcs/`.

| graphics_id | Character / Type | Notes |
|---|---|---|
| `OBJ_EVENT_GFX_BALDING_MAN` | Bald civilian man | Generic male NPC |
| `OBJ_EVENT_GFX_BILL` | Bill | Pokémon Storage System creator; appears at Sea Cottage and Cinnabar |
| `OBJ_EVENT_GFX_BLUE` | Blue (Rival) | Player's rival; used in scripted battle scenes |
| `OBJ_EVENT_GFX_BOY` | Boy / Young male | Generic child NPC |
| `OBJ_EVENT_GFX_BUG_CATCHER` | Bug Catcher | Trainer class; shorts + net |
| `OBJ_EVENT_GFX_CAMPER` | Camper | Trainer class; outdoors male |
| `OBJ_EVENT_GFX_CHANNELER` | Channeler | Trainer class; Pokémon Tower ghost communicator |
| `OBJ_EVENT_GFX_CLERK` | Mart Clerk | Poké Mart / department store staff |
| `OBJ_EVENT_GFX_COOLTRAINER_F` | Cool Trainer (Female) | Trainer class; Victory Road and late-game |
| `OBJ_EVENT_GFX_COOLTRAINER_M` | Cool Trainer (Male) | Trainer class; Victory Road and late-game |
| `OBJ_EVENT_GFX_CRUSH_GIRL` | Crush Girl | Trainer class; post-game Saffron City |
| `OBJ_EVENT_GFX_CUT_TREE` | Cut Tree (shrub) | Environment object; removable with HM01 Cut |
| `OBJ_EVENT_GFX_FAT_MAN` | Overweight man | Generic civilian NPC |
| `OBJ_EVENT_GFX_HIKER` | Hiker | Trainer class; mountains/caves |
| `OBJ_EVENT_GFX_ITEM_BALL` | Item Ball | On-map item pickup; not a character |
| `OBJ_EVENT_GFX_LASS` | Lass | Trainer class; young female |
| `OBJ_EVENT_GFX_LITTLE_BOY` | Little Boy | Small child NPC |
| `OBJ_EVENT_GFX_LITTLE_GIRL` | Little Girl | Small child NPC |
| `OBJ_EVENT_GFX_MAN` | Generic Man | Generic adult male NPC |
| `OBJ_EVENT_GFX_MOM` | Mom (Player's mother) | Appears in Player's House 1F |
| `OBJ_EVENT_GFX_OLD_MAN_1` | Old Man (variant 1) | Used for Viridian Old Man tutorial, general elderly male |
| `OBJ_EVENT_GFX_OLD_MAN_2` | Old Man (variant 2) | Sofboiled tutor, Celadon; alternate elderly design |
| `OBJ_EVENT_GFX_PIDGEOT` | Pidgeot | Pokémon overworld sprite; Saffron City boy's Pidgeot |
| `OBJ_EVENT_GFX_POLICEMAN` | Policeman | Guard NPC; Cerulean burglary scene |
| `OBJ_EVENT_GFX_POLIWRATH` | Poliwrath | Pokémon overworld sprite; Celadon City |
| `OBJ_EVENT_GFX_PROF_OAK` | Professor Oak | Key story NPC; Pallet Town lab |
| `OBJ_EVENT_GFX_PUSHABLE_BOULDER` | Pushable Boulder | Environment object; Strength puzzle |
| `OBJ_EVENT_GFX_ROCKET_M` | Team Rocket Grunt (Male) | Trainer/NPC class; used for all male Rocket grunts |
| `OBJ_EVENT_GFX_ROCK_SMASH_ROCK` | Rock Smash Rock | Environment object; smashable with HM06 |
| `OBJ_EVENT_GFX_SCIENTIST` | Scientist | Trainer class; labs and caves |
| `OBJ_EVENT_GFX_SEAGALLOP` | Seagallop Ferry | Vehicle NPC; Cinnabar harbor; Sevii ferry |
| `OBJ_EVENT_GFX_SLOWBRO` | Slowbro | Pokémon overworld sprite; Cerulean City |
| `OBJ_EVENT_GFX_VAR_0` | Variable (story-driven) | Graphic determined at runtime by game variable; Viridian tutorial man |
| `OBJ_EVENT_GFX_WOMAN_1` | Woman (variant 1) | Generic adult female NPC |
| `OBJ_EVENT_GFX_WOMAN_2` | Woman (variant 2) | Generic adult female NPC (alternate design) |
| `OBJ_EVENT_GFX_WOMAN_3` | Woman (variant 3) | Generic adult female NPC (alternate design) |
| `OBJ_EVENT_GFX_WORKER_F` | Worker (Female) | Office worker female; Silph Co., Pokémon Tower |
| `OBJ_EVENT_GFX_WORKER_M` | Worker (Male) | Office/construction worker male |
| `OBJ_EVENT_GFX_YOUNGSTER` | Youngster | Trainer class; young male with shorts |

**Additional graphics_ids expected (not yet sampled but present in FireRed):**
`OBJ_EVENT_GFX_RED`, `OBJ_EVENT_GFX_FISHER`, `OBJ_EVENT_GFX_SWIMMER_M`, `OBJ_EVENT_GFX_SWIMMER_F`,
`OBJ_EVENT_GFX_SAILOR`, `OBJ_EVENT_GFX_GENTLEMAN`, `OBJ_EVENT_GFX_BEAUTY`,
`OBJ_EVENT_GFX_BIKER`, `OBJ_EVENT_GFX_PICNICKER`, `OBJ_EVENT_GFX_JUGGLER`,
`OBJ_EVENT_GFX_SUPER_NERD`, `OBJ_EVENT_GFX_PSYCHIC_M`, `OBJ_EVENT_GFX_PSYCHIC_F`,
`OBJ_EVENT_GFX_TAMER`, `OBJ_EVENT_GFX_BIRD_KEEPER`, `OBJ_EVENT_GFX_BLACK_BELT`,
`OBJ_EVENT_GFX_ROCKER`, `OBJ_EVENT_GFX_GIOVANNI`, `OBJ_EVENT_GFX_ROCKET_F`,
`OBJ_EVENT_GFX_LORELEI`, `OBJ_EVENT_GFX_LANCE`, `OBJ_EVENT_GFX_AGATHA`

---

### 5.2 Player Sprite

| Property | Value |
|---|---|
| File | `data/sprites/player.png` |
| Format | Spritesheet |
| Directions | 4: Down (0), Left (1), Right (2), Up (3) |
| Walk frames per direction | 3 (stand, step-left, step-right) |
| Run frames per direction | 4 (stand, step-left, full-stride-left, full-stride-right) |
| GBA frame size | 16×16 px per frame (2×2 hardware tiles) |
| Palette | 16 colors, 4bpp indexed |

**Player variants:** FireRed has two playable characters — Red (boy, default) and Leaf (girl). Both share the same directional frame layout, different color palettes/designs.

**Animation state machine:**
- Idle → face direction of last movement
- Walk → cycle frames 0→1→0→2→0 per direction at ~8 steps/sec
- Run → cycle frames 0→1→2→3→0 at ~16 steps/sec (with Running Shoes)
- Surf → seated on Lapras/Dewgong sprite, player sprite hidden
- Bike → bicycle sprite replaces player legs

---

### 5.3 Pokémon Sprites

FireRed includes 386 Pokémon (Generation I–III National Dex).

| Sprite type | Expected filename pattern | Dimensions | Notes |
|---|---|---|---|
| Front battle sprite | `pokemon/front/<id>.png` | 64×64 px (GBA: up to 64×64) | Used during wild/trainer battles |
| Back battle sprite | `pokemon/back/<id>.png` | 64×64 px | Used for player's active Pokémon |
| Icon (party/box) | `pokemon/icon/<id>.png` | 32×32 px, 2-frame animation | Used in party screen, PC box |
| Overworld follower | N/A in base FireRed | — | Not present; added by fan patches |
| Shiny front | `pokemon/front_shiny/<id>.png` | 64×64 px | Alternate color palette |
| Shiny back | `pokemon/back_shiny/<id>.png` | 64×64 px | Alternate color palette |

**Pokémon present in this region's wild encounter tables (Kanto highlights):**
- Route 1: Pidgey, Rattata
- Viridian Forest: Caterpie, Weedle, Pikachu, Metapod, Kakuna
- Mt. Moon: Zubat, Geodude, Paras, Clefairy
- Rock Tunnel: Zubat, Geodude, Machop, Onix
- Pokémon Tower: Gastly, Haunter, Cubone
- Safari Zone: Nidoran♂/♀, Exeggcute, Kangaskhan, Scyther/Pinsir, Chansey, Tauros, Dratini (water)
- Seafoam Islands: Seel, Dewgong, Slowpoke, Slowbro, Horsea, Staryu, Shellder
- Cerulean Cave: Golbat, Kadabra, Ditto, Chansey, Wobbuffet, Lickitung, Electrodes
- Power Plant: Pikachu, Raichu, Magnemite, Magneton, Electabuzz, Electrode, Zapdos

---

## 6. UI & Menu Reference

> All measurements in GBA screen pixels (240×160 native). Browser canvas scales from this base.
> Font: 8×8 pixel tiles (hardware text tiles); variable-width rendering in FireRed (unlike Gen I/II).
> Color depth: 15-bit BGR (GBA), 5 bits per channel.

---

### 6.1 Start Menu

**Trigger:** Press Start on the overworld.

**Position:** Right-aligned panel, approximately x=140–239, y=0–(option_count×16+16). Slides in from right edge.

**Options (vary by game progress):**

| Order | Option | Available When |
|---|---|---|
| 1 | POKéDEX | After receiving Pokédex from Oak |
| 2 | POKéMON | Always (after getting first Pokémon) |
| 3 | BAG | Always |
| 4 | \<PLAYER NAME\> (Trainer Card) | Always |
| 5 | SAVE | Always (outside buildings that disable it) |
| 6 | OPTIONS | Always |
| 7 | EXIT | Always |

**Visual spec:**
- Background: solid dark-blue/navy panel with 1px white border
- Text: white, 8×8 font
- Cursor: right-pointing arrow (►) that moves between options
- Each option row: 16px tall
- Panel auto-sizes to number of available options

---

### 6.2 Battle UI

**Screen layout (240×160):**

```
┌─────────────────────────────────────────────┐  y=0
│  ENEMY POKEMON SPRITE (right side, y=0–72)  │
│  Enemy HP box: x=0, y=0 → w=120, h=36      │
│  [Enemy name | Lv.XX]                        │
│  [HP bar: ~88px wide, green/yellow/red]      │
├─────────────────────────────────────────────┤  y=80
│  PLAYER POKEMON SPRITE (left side, y=56–120)│
│  Player HP box: x=120, y=80 → w=120, h=48  │
│  [Player name | Lv.XX | M/F]                │
│  [HP: XXX/XXX]   [HP bar]                   │
│  [EXP bar at bottom of player box]           │
├─────────────────────────────────────────────┤  y=112
│  DIALOGUE/MENU BOX  (x=0, y=112, w=240 h=48)│
│  "What will PKMN do?"   [Fight] [Bag]       │
│                          [POKéMON] [Run]     │
└─────────────────────────────────────────────┘  y=160
```

**Fight sub-menu (move selection):**
- Replaces bottom box with 2×2 grid of move names
- Below the grid: move TYPE and PP (e.g. `NORMAL  PP 35/35`)
- No PP = move grayed out; Struggle used if all PP = 0

**HP bar color thresholds:**
- Green: HP > 50% of max
- Yellow: HP 20–50%
- Red: HP < 20%
- Bar depletes left to right; animated pixel-by-pixel

**Battle message timing:**
- Standard message: ~60 frames display, then auto-advance or A-button
- Typewriter speed: controlled by Options Text Speed setting

**Catch sequence:**
1. Player throws ball (animation: ball arc across screen)
2. Wild Pokémon drawn into ball (shrink + flash)
3. Ball lands; shake 0–3 times based on catch rate calculation
4. Catch success: star burst + "Gotcha! [Name] was caught!"
5. Nickname prompt appears

**Run mechanics:**
- Escape Factor = (Player speed × 32 / Enemy speed) + 30 × escape_attempts
- If Escape Factor ≥ 255: guaranteed escape
- Cannot run from trainer battles

---

### 6.3 Dialogue Box

**Position:** x=0, y=112, width=240, height=48 px (bottom 30% of screen).

**Visual spec:**
- Background: white interior, 2px dark-blue border
- Inner padding: 8px left/right, 4px top/bottom
- Text area: 224×40 px
- Font: proportional, based on 8×8 tile grid; most characters 6–7px wide
- Color: black text on white background
- Two text rows visible at once
- Scroll indicator: small ▼ or ► arrow flickers at bottom-right when more text remains
- A-button: advance text / close box

**Typewriter effect:**
- Slow: 1 character per 8 frames (~7.5 chars/sec)
- Mid: 1 character per 4 frames (~15 chars/sec)
- Fast: 1 character per 2 frames (~30 chars/sec)
- Instant: full line appears immediately (Options setting)

**Choice prompts (YES/NO or multi-choice):**
- Small box appears overlapping dialogue box, right-aligned
- Cursor (►) navigates options; A confirms, B cancels (selects NO/bottom option)

---

### 6.4 Party Screen

**Trigger:** Select "POKéMON" from Start Menu, or B during bag/battle prompts.

**Layout:**
- Full screen takeover (240×160)
- Slot 1 (active/first): large panel, left side (~120×80 px); shows Pokémon icon, name, level, HP bar, current/max HP, status icon
- Slots 2–6: smaller panels stacked on right (~120×16 px each); icon, name, level, HP bar
- Empty slots: dimmed "---" placeholder

**Slot interaction:**
- A on a slot: opens sub-menu (SUMMARY / SWITCH / ITEM / CANCEL)
- SUMMARY: detailed stat screen
- SWITCH: select two Pokémon to swap order
- ITEM: give/take held item

**Status icons (displayed as colored label):**
| Status | Display | Color |
|---|---|---|
| Paralysis | `PAR` | Yellow |
| Sleep | `SLP` | Teal |
| Poison | `PSN` | Purple |
| Burn | `BRN` | Orange |
| Freeze | `FRZ` | Cyan/light blue |
| Faint | `FNT` | Gray |

**HP bar:** Same color thresholds as battle (green / yellow / red).

---

### 6.5 Bag / Item Menu

**Trigger:** Select "BAG" from Start Menu.

**Pockets (4 tabs in FireRed):**

| Tab | Icon | Contents |
|---|---|---|
| Items | Backpack | Potions, Repels, Berries, general consumables |
| Key Items | Key | Story items (Bicycle, Town Map, S.S. Ticket, etc.) — cannot be tossed |
| Poké Balls | Poké Ball | All ball types (Poké Ball, Great Ball, Ultra Ball, Master Ball, etc.) |
| TMs & HMs | CD disc | Technical and Hidden Machines — TMs are single-use in Gen III |

**Layout:**
- Full screen; left panel = item list (scrollable); right panel = item description + quantity
- Item list: ~8 items visible; scrolls with up/down
- A on item: USE / GIVE / TOSS / REGISTER (for Key Items registered to Select)
- Registered item: usable directly from overworld with Select button
- HMs cannot be tossed; TMs can be tossed (one-time use, gone after)

**Sorting:** Items are sorted in acquisition order within each pocket; no manual sort in FireRed (unlike later generations).

---

### 6.6 Pokédex

**Trigger:** Select "POKéDEX" from Start Menu (after receiving from Oak).

**Modes:**

| Mode | Description |
|---|---|
| List view | Scrollable numbered list (#001–#386 for National Dex); seen entries show name, caught entries show everything |
| Detail view | Full entry: name, category, height, weight, flavor text (2 pages), area data |
| Area view | Map showing where Pokémon was seen/caught |
| Size comparison | Player character silhouette vs. Pokémon size |
| Cry player | A button plays Pokémon's cry |

**Dex modes:**
- Original (Kanto): #001–#151
- National: #001–#386 (unlocked after trading or receiving from Oak post-game)

**Seen/Caught counters:** Displayed on main Dex screen (e.g., `SEEN: 45  OWN: 12`).

**Search function:** Can filter by name (alphabetical search), type, or A-Z listing.

---

### 6.7 Map Screen (Town Map)

**Trigger:** Use Town Map from Bag > Key Items (received from Blue's sister).

**Layout:**
- Full screen map of Kanto (and Sevii Islands on second page)
- Player location: blinking cursor (red arrow)
- Fly destinations: all towns/locations previously visited; selecting one confirms Fly
- Location name: displayed in text box at bottom when cursor hovers
- Zoom: single fixed zoom level (no scroll; entire Kanto fits on screen)

**Kanto map layout (approximate screen positions of major locations):**
```
  [Pallet] [Route1] [Viridian] [Route22] [Route23]
  [Route21] ........[Route2] ............[Victory Rd]
  [Cinnabar][Route20][Seafoam][Route19][Fuchsia]
  .........[Route18][Route17][Route16][Celadon]
  .........[Route15][Route14][Route13][Route12]
  .........[Vermilion][Route11]........[Lavender]
  .........[Route6].[Saffron].[Route8]
  [Cerulean][Route5].........[Route10]
  [Route24][Route25].[Pewter][Route9]
  .........[Route3].[Route4]
  .........[MtMoon]
```

**Sevii Islands:** Accessible via second page of Town Map (shown after first Ferry ride).

---

### 6.8 Options Menu

**Trigger:** Select "OPTIONS" from Start Menu.

**Settings available:**

| Setting | Options | Default | Notes |
|---|---|---|---|
| TEXT SPEED | Slow / Mid / Fast | Mid | Controls typewriter character rate |
| BATTLE SCENE | On / Off | On | Toggles battle move animations |
| BATTLE STYLE | Shift / Set | Shift | Shift = offered switch after KO; Set = no offer |
| SOUND | Mono / Stereo | Stereo | GBA speaker mono; headphone stereo |
| BUTTON MODE | Help / LR / L=A | Help | Help = L opens context help; LR = L/R scroll menus; L=A = L duplicates A |
| FRAME | 1–5 | 1 | Border frame style for Game Boy Player / GBA screen border |

**Navigation:** D-pad cycles options left/right; A/B to close.

---

## 7. Key Game Systems

### 7.1 Badge Progression & HM Gates

| # | Badge | Gym | City | Leader | Type | Level Cap* | HM Unlocked | HM Effect |
|---|---|---|---|---|---|---|---|---|
| 1 | Boulder Badge | Pewter Gym | Pewter City | Brock | Rock | 20 | HM01 Cut (teach) | Cut small trees on overworld |
| 2 | Cascade Badge | Cerulean Gym | Cerulean City | Misty | Water | 30 | HM01 Cut (use) | Trees now actually cuttable |
| 3 | Thunder Badge | Vermilion Gym | Vermilion City | Lt. Surge | Electric | 40 | HM05 Flash | Reduce accuracy in cave (optional) |
| 4 | Rainbow Badge | Celadon Gym | Celadon City | Erika | Grass | 50 | HM02 Fly | Fly to any visited town |
| 5 | Soul Badge | Fuchsia Gym | Fuchsia City | Koga | Poison | 60 | HM03 Surf | Surf across water |
| 6 | Marsh Badge | Saffron Gym | Saffron City | Sabrina | Psychic | 70 | HM04 Strength | Push boulders in dungeons |
| 7 | Volcano Badge | Cinnabar Gym | Cinnabar Island | Blaine | Fire | 80 | HM06 Rock Smash | Smash cracked rocks |
| 8 | Earth Badge | Viridian Gym | Viridian City | Giovanni | Ground | — | HM07 Waterfall | Climb waterfalls |

*Level cap: traded Pokémon obedience cap (player's own Pokémon always obey).

**HM acquisition locations:**
| HM | Location | Given by |
|---|---|---|
| HM01 Cut | S.S. Anne, Captain's Office | Ship Captain |
| HM02 Fly | Route 16 House | Girl (if 30+ Pokémon caught) |
| HM03 Surf | Safari Zone West, Secret House | — (floor item) |
| HM04 Strength | Fuchsia City Warden's House | Safari Zone Warden (Gold Teeth trade) |
| HM05 Flash | Route 2 East Building | Professor Oak's Aide (10+ Pokémon caught) |
| HM06 Rock Smash | One Island, Ember Spa | Scientist |
| HM07 Waterfall | Icefall Cave, Four Island | Lorelei |

---

### 7.2 Rival Encounters

| # | Location | Map | Trigger | Rival's Team (approx.) |
|---|---|---|---|---|
| 1 | Oak's Lab | `MAP_PALLET_TOWN_PROFESSOR_OAKS_LAB` | After player chooses starter | Starter that beats player's (Lv. 5) |
| 2 | Route 22 | `MAP_ROUTE22` | Walking west before first gym | Starter Lv. 9–10; Pidgey |
| 3 | Cerulean City (north bridge) | `MAP_CERULEAN_CITY` trigger | After Nugget Bridge | Starter Lv. 18; Pidgeotto; type coverage |
| 4 | S.S. Anne | `MAP_SS_ANNE_2F_CORRIDOR` | Scripted encounter on 2F | Lv. 19–21 team |
| 5 | Pokémon Tower | `MAP_POKEMON_TOWER_*` | Scripted (some versions) | Mid-game team |
| 6 | Silph Co. 7F | `MAP_SILPH_CO_7F` | Scripted | Evolved starter Lv. 40+; Gyarados; Alakazam |
| 7 | Route 22 (pre-Victory Road) | `MAP_ROUTE22` | Walking west post-Gym 7 | Full team Lv. 44–47 |
| 8 | Champion's Room | `MAP_POKEMON_LEAGUE_CHAMPIONSROOM` | Defeating Elite Four | Full team Lv. 59–65; Pidgeot, Alakazam, Rhydon, Gyarados, Arcanine/Exeggutor, evolved starter |

---

### 7.3 Team Rocket Events

| Event | Location | Map(s) | Outcome |
|---|---|---|---|
| Old Man / Parcel | Viridian City | `MAP_VIRIDIAN_CITY` | Triggers when Oak's Parcel delivered; Old Man teaches catching |
| Nugget Bridge Grunt | Route 24 | `MAP_ROUTE24` | Grunt offers "join Rocket" after 5 trainers; battle required |
| Cerulean Burglary | Cerulean City | `MAP_CERULEAN_CITY`, House 2 | Grunt steals TM28; pursue north; Grunt battles player; leaves |
| Rocket Hideout | Celadon Game Corner → B4F | `MAP_ROCKET_HIDEOUT_B1F–B4F` | Giovanni boss fight; drop Silph Scope |
| Pokémon Tower invasion | Lavender Town | `MAP_POKEMON_TOWER_*` | Rockets block access; Silph Scope reveals Marowak ghost; Mr. Fuji rescued |
| Silph Co. Takeover | Saffron City | `MAP_SILPH_CO_1F–11F` | All 11 floors occupied; Giovanni on 11F; Master Ball reward; Lapras gift (7F) |
| Celadon City streets | Celadon City | `MAP_CELADON_CITY` | Grunts patrol outside Game Corner (flag-gated; disappear after hideout cleared) |
| Saffron City streets | Saffron City | `MAP_SAFFRON_CITY` | 8 grunts patrol city (flag `FLAG_HIDE_SAFFRON_ROCKETS`; disappear after Silph cleared) |
| Rocket Warehouse | Five Island | `MAP_FIVE_ISLAND_ROCKET_WAREHOUSE` | Post-Silph Sevii subplot; Giovanni-adjacent commanders |

---

### 7.4 Legendary Locations

| Legendary | Map | Level | Method | Notes |
|---|---|---|---|---|
| Zapdos | `MAP_POWER_PLANT` | 50 | Walk-up encounter at end of dungeon | Only Electric bird; Power Plant off Route 10 |
| Articuno | `MAP_SEAFOAM_ISLANDS_B4F` | 50 | Walk-up encounter; boulder puzzle required | Boulder puzzle redirects water currents to access room |
| Moltres | `MAP_MT_EMBER_SUMMIT` | 50 | Walk-up encounter at summit of Mt. Ember | Moved from original Blue/Red (was Victory Road); requires Sevii access |
| Mewtwo | `MAP_CERULEAN_CAVE_B1F` | 70 | Walk-up encounter; post-game only | Requires all 8 badges + defeat Elite Four; strongest non-event |
| Deoxys | `MAP_BIRTH_ISLAND_EXTERIOR` | 30 | Triangle puzzle then encounter | Event-only (AuroraTicket); Attack Forme in FireRed |
| Lugia | `MAP_NAVEL_ROCK_BASE` | 70 | Walk-up encounter | Event-only (MysticTicket); Navel Rock |
| Ho-Oh | `MAP_NAVEL_ROCK_SUMMIT` | 70 | Walk-up encounter | Event-only (MysticTicket); same Navel Rock |

---

## 8. Region Notes

### 8.1 Sevii Islands — Connectivity & Unlock Sequence

The Sevii Islands are a FireRed/LeafGreen-exclusive set of seven islands south of Kanto. They are accessed via Seagallop Ferry from **Vermilion City harbor** and later from island harbors.

**Unlock gates:**

| Gate | Requirement | Islands Unlocked |
|---|---|---|
| Initial access | Defeat Blaine (Badge 7) at Cinnabar; Bill appears, offers ferry ride | One Island, Two Island, Three Island |
| Extended access | Complete Ruby/Sapphire gem fetch quest (give gems to Celio on One Island) | Four Island, Five Island, Six Island, Seven Island |
| Trainer Tower | Reach Seven Island | Trainer Tower (post-game battle facility) |

**Ferry routes:**
- Vermilion City → One Island → Two Island → Three Island (initial)
- All seven islands interconnected by ferry after extended access unlocked
- Each island has its own harbor map (`MAP_ONEISLAND_HARBOR`, etc.)

**Island summaries:**

| Island | Common Name | Key Content | Dungeon |
|---|---|---|---|
| One Island (Knot Island) | One Island | PC Storage (Celio's Network Machine); Kindle Road; Ember Spa | Mt. Ember (Moltres + Ruby Path) |
| Two Island (Boon Island) | Two Island | Joyful Game Corner; Cape Brink (ultimate move tutor — Blast Burn/Hydro Cannon/Frenzy Plant) | — |
| Three Island (Kin Island) | Three Island | Biker gang; Lostelle rescue; Dunsparce Tunnel | Berry Forest |
| Four Island (Floe Island) | Four Island | Lorelei's house; Pokémon Day Care | Icefall Cave (Lapras + HM Waterfall) |
| Five Island (Chrono Island) | Five Island | Resort Gorgeous; Selphy quest | Lost Cave (14 rooms); Rocket Warehouse; Water Labyrinth |
| Six Island (Fortune Island) | Six Island | Sapphire gem location; Ruin Valley (Unown) | Dotted Hole (Sapphire); Altering Cave; Pattern Bush |
| Seven Island (Quest Island) | Seven Island | Trainer Tower (timed battle facility); Tanoby Key | Sevault Canyon; Tanoby Ruins (7 Unown chambers) |

**Seagallop Ferry NPC:** `OBJ_EVENT_GFX_SEAGALLOP` appears as ferry vehicle sprite at harbor docks. Ferry transition uses a screen fade + map warp chain through the harbor maps.

### 8.2 Post-Game Content

After defeating the Elite Four and entering the Hall of Fame:

- **Cerulean Cave** unlocks (guard `FLAG_HIDE_CERULEAN_CAVE_GUARD` removed) → Mewtwo
- **National Pokédex** offered by Professor Oak (if 60+ Kanto species registered)
- **Sevii extended access** unlocks after completing Ruby/Sapphire quest
- **Trainer Tower** (Seven Island) becomes primary battle challenge
- **Elite Four** can be re-challenged with stronger teams (level scaling)
- **Wild Pokémon** in some areas change/expand (e.g., Cerulean Cave Pokémon variety)

### 8.3 Notable Scripted Scene Variables

These `VAR_MAP_SCENE_*` variables control story progression and NPC visibility:

| Variable | Map | Controls |
|---|---|---|
| `VAR_MAP_SCENE_PALLET_TOWN_OAK` | PalletTown | Prof. Oak ambush trigger on Route 1 (value 0 = active) |
| `VAR_MAP_SCENE_VIRIDIAN_CITY_OLD_MAN` | ViridianCity | Old Man tutorial (0 = blocking road; 1 = tutorial active) |
| `VAR_MAP_SCENE_VIRIDIAN_CITY_GYM_DOOR` | ViridianCity | Gym locked until all 7 other badges (0 = locked) |
| `VAR_MAP_SCENE_CERULEAN_CITY_RIVAL` | CeruleanCity | Rival encounter north of city (0 = active) |
| `VAR_MAP_SCENE_CERULEAN_CITY_ROCKET` | CeruleanCity | Rocket grunt burglary event |
| `VAR_MAP_SCENE_ROUTE24` | Route24 | Nugget Bridge Rocket grunt (0 = present) |
| `VAR_MAP_SCENE_VICTORY_ROAD_1F` | VictoryRoad_1F | Floor switch puzzle state |

### 8.4 Prototype / Unused Maps

The data includes four prototype Sevii Island maps not in the final game:

| map_id | Note |
|---|---|
| `MAP_PROTOTYPE_SEVII_ISLE_6` | Prototype Six Island layout |
| `MAP_PROTOTYPE_SEVII_ISLE_7` | Prototype Seven Island layout |
| `MAP_PROTOTYPE_SEVII_ISLE_8` | Unused eighth island (cut from final) |
| `MAP_PROTOTYPE_SEVII_ISLE_9` | Unused ninth island (cut from final) |

These maps exist in the extracted data but have no ferry/warp connections in the final game. They may be used for future fan-game expansion areas.

---

## Appendix A — Music Track Reference

| Music ID | Location / Theme |
|---|---|
| `MUS_PALLET` | Pallet Town; Player's House interior |
| `MUS_ROUTE1` | Route 1 |
| `MUS_PEWTER` | Viridian City; Saffron City; Pewter City |
| `MUS_FUCHSIA` | Cerulean City; Fuchsia City |
| `MUS_CELADON` | Celadon City |
| `MUS_LAVENDER` | Lavender Town |
| `MUS_CINNABAR` | Cinnabar Island |
| `MUS_VIRIDIAN_FOREST` | Viridian Forest |
| `MUS_MT_MOON` | Mt. Moon; Victory Road 1F–3F |
| `MUS_POKE_TOWER` | Pokémon Tower 1F–7F |
| `MUS_SILPH` | Silph Co. all floors |
| `MUS_ROCKET_HIDEOUT` | Rocket Hideout B1F–B4F; Cerulean Cave |
| `MUS_ROUTE24` | Route 24 (Nugget Bridge) |

---

## Appendix B — Map JSON Field Reference

All `data/maps/kanto/*.json` files share this schema:

```jsonc
{
  "id": "MAP_*",              // Unique map constant (e.g. MAP_PALLET_TOWN)
  "name": "PalletTown",       // Human-readable name (used as filename base)
  "region": "kanto",          // Always "kanto" for this directory
  "layout": "LAYOUT_*",       // References data/layouts/ for tile grid dimensions
  "music": "MUS_*",           // BGM track constant
  "weather": "WEATHER_*",     // Weather effect
  "map_type": "MAP_TYPE_*",   // See Section 1 table
  "allow_running": bool,       // Running Shoes allowed
  "allow_cycling": bool,       // Bicycle allowed
  "show_map_name": bool,       // Display location name banner on entry
  "connections": [             // Adjacent outdoor maps (null for indoor/cave)
    { "map": "MAP_*", "offset": int, "direction": "up|down|left|right" }
  ],
  "npcs": [
    {
      "local_id": "LOCALID_*" | null,    // Named if referenced by scripts
      "graphics_id": "OBJ_EVENT_GFX_*", // Sprite to use (see Section 5.1)
      "x": int, "y": int,               // Tile position on map
      "movement_type": "MOVEMENT_TYPE_*",// Idle movement behavior
      "trainer_type": "TRAINER_TYPE_*", // NONE or NORMAL (sight-range battles)
      "script": "Script_Function_Name", // Event script to run on interaction
      "flag": "FLAG_*" | "0"            // Hide flag (NPC invisible when flag set)
    }
  ],
  "warps": [
    {
      "x": int, "y": int,              // Tile that triggers the warp
      "dest_map": "MAP_*",             // Destination map
      "dest_warp_id": "int_as_string"  // Which warp point in destination to arrive at
    }
  ],
  "triggers": [
    {
      "x": int, "y": int,             // Tile position
      "var": "VAR_*",                 // Game variable to check
      "var_value": "int_as_string",   // Trigger fires if var equals this value
      "script": "Script_Function_Name"
    }
  ],
  "signs": [
    {
      "x": int, "y": int,             // Tile position (examine to read)
      "script": "Script_Function_Name"
    }
  ]
}
```

**Movement type values seen in data:**
- `MOVEMENT_TYPE_FACE_DOWN/UP/LEFT/RIGHT` — stationary, facing fixed direction
- `MOVEMENT_TYPE_WANDER_AROUND` — random walk in all directions
- `MOVEMENT_TYPE_WANDER_UP_AND_DOWN` / `WANDER_LEFT_AND_RIGHT` — constrained wander
- `MOVEMENT_TYPE_LOOK_AROUND` — turn to face random directions without moving
- `MOVEMENT_TYPE_FACE_DOWN_AND_UP` / `FACE_LEFT_AND_RIGHT` — alternating facing
- `MOVEMENT_TYPE_FACE_DOWN_AND_LEFT` — alternating between two directions
- `MOVEMENT_TYPE_WALK_SEQUENCE_LEFT_DOWN_RIGHT_UP` — walks a fixed square loop
- `MOVEMENT_TYPE_WALK_SEQUENCE_RIGHT_DOWN_LEFT_UP` — walks a fixed square loop (reversed)

---

*Document generated from `data/maps/kanto/` (425 map files), `data/tilesets/` (60 tileset pairs), and `data/sprites/` as of 2026-06-10.*
