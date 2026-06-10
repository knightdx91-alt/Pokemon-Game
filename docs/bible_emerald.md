# Pokémon Emerald — Game Reference Bible

> Source of truth for the browser-based Hoenn fan game. All map data is extracted
> directly from `data/maps/hoenn/` (518 JSON map files). Tileset data is in
> `data/tilesets/` (60 tileset pairs, currently named after Kanto/FireRed tilesets —
> see §4 for notes on what Hoenn-specific ones are needed). This document covers the
> canonical Emerald game logic that the fan game must replicate.

---

## 1. Overview

**Game:** Pokémon Emerald (Game Freak / Nintendo / The Pokémon Company, 2004 JP / 2005 US)
**Platform:** Game Boy Advance
**Region:** Hoenn
**Player characters:** Brendan (male) / May (female) — the unchosen one becomes the rival
**Starter Pokémon:** Treecko (Grass), Torchic (Fire), Mudkip (Water) — chosen from Prof. Birch's bag on Route 101
**Pokédex:** 386 Pokémon (202 obtainable in-game before post-game events; National Dex unlocked after defeating Champion Wallace)
**Victory condition:** Defeat all 8 Gym Leaders → defeat the Elite Four + Champion → stop both Team Magma and Team Aqua → awaken Rayquaza to stop Groudon/Kyogre
**Post-game exclusive:** Battle Frontier (7 facilities on a separate island west of Battle Tower)

### Key Emerald differences from Ruby/Sapphire
- Both Teams Magma AND Aqua are antagonists (not just one)
- Rayquaza plays a central story role (stops Kyogre and Groudon at Sootopolis)
- Battle Frontier replaces the single Battle Tower
- Gym leader rematches available via PokéNav Match Call after obtaining the National Dex
- Wallace is the Champion (Steven Stone retired); Steven has a side-quest at Granite Cave
- Contest Halls in multiple cities; Master Rank Contests at Lilycove
- Pokémon animated sprites in battle (GBA hardware permitting)
- New Battle Mode: "Frontier Brain" encounters at each facility

---

## 2. Map Catalog

The repository contains **518 map JSON files** in `data/maps/hoenn/`. Each file has
the structure: `id`, `name`, `region`, `layout`, `music`, `weather`, `map_type`,
`allow_running`, `allow_cycling`, `show_map_name`, `connections`, `npcs`, `warps`,
`triggers`, `signs`.

### 2.1 Towns & Cities

Hoenn has **7 towns** and **9 cities** (plus Ever Grande City which functions as the
Pokémon League entrance).

#### Towns

| Map ID | Name | Music | Notable features |
|---|---|---|---|
| `MAP_LITTLEROOT_TOWN` | Littleroot Town | `MUS_LITTLEROOT` | Player's starting home; Prof. Birch's Lab; rival's house |
| `MAP_OLDALE_TOWN` | Oldale Town | `MUS_OLDALE` | First town north of Littleroot; Poké Center + Mart |
| `MAP_DEWFORD_TOWN` | Dewford Town | `MUS_DEWFORD` | Island town; Brawly's Gym; Granite Cave nearby; Slateport ferry |
| `MAP_LAVARIDGE_TOWN` | Lavaridge Town | `MUS_LAVARIDGE` | Hot springs; Flannery's Gym; herb shop; Mt. Chimney cable car south |
| `MAP_FALLARBOR_TOWN` | Fallarbor Town | `MUS_FALLARBOR` | Ash-covered; Contest Hall; Professor Cozmo's house; Move Reminder |
| `MAP_VERDANTURF_TOWN` | Verdanturf Town | `MUS_VERDANTURF` | Serene town; Wanda's house (connects Rusturf Tunnel); Battle Tent |
| `MAP_PACIFIDLOG_TOWN` | Pacifidlog Town | `MUS_PACIFIDLOG` | Built on logs over the sea; access to Mirage Island; near Sky Pillar |

#### Cities

| Map ID | Name | Music | Connections | Notable features |
|---|---|---|---|---|
| `MAP_PETALBURG_CITY` | Petalburg City | `MUS_PETALBURG` | Routes 102 (east), 104 (west) | Norman's Gym (dad); Wally's first catch scene |
| `MAP_RUSTBORO_CITY` | Rustboro City | `MUS_RUSTBORO` | Routes 115 (north), 104 (south), 116 (east) | Roxanne's Gym (Rock); Devon Corp 3F; Pokémon School; Cutter's House |
| `MAP_SLATEPORT_CITY` | Slateport City | `MUS_SLATEPORT` | Routes 109 (south), 110 (north) | Oceanic Museum; Contest Hall; Harbor (SS Tidal); Stern's Shipyard |
| `MAP_MAUVILLE_CITY` | Mauville City | `MUS_RUSTBORO` | Routes 111 (north), 110 (south), 117 (west), 118 (east) | Wattson's Gym (Electric); Bike Shop; Game Corner; New Mauville underground |
| `MAP_FORTREE_CITY` | Fortree City | `MUS_FORTREE` | Routes 119 (west), 120 (east) | Winona's Gym (Flying); treetop houses; Kecleon blocking Gym; Decoration Shop |
| `MAP_LILYCOVE_CITY` | Lilycove City | `MUS_LILYCOVE` | Routes 121 (west), 124 (east) | Phoebe's ancestor town; Department Store 5F; Contest Hall (Master Rank); Museum; Aqua Hideout; Harbor (S.S. Tidal); Move Deleter; Cove Lily Motel |
| `MAP_MOSSDEEP_CITY` | Mossdeep City | `MUS_MOSSDEEP` | Routes 124 (west), 125 (north) | Tate & Liza's Gym (Psychic); Space Center (Magma rocket subplot); Steven's House; Game Corner |
| `MAP_SOOTOPOLIS_CITY` | Sootopolis City | `MUS_SOOTOPOLIS` | No land connections (enter via dive or fly) | Juan's Gym (Water); Cave of Origin; Rayquaza climax scene; Mystery Events House |
| `MAP_EVER_GRANDE_CITY` | Ever Grande City | `MUS_EVER_GRANDE` | Route 128 (west) | Pokémon League 1F; Pokémon Center; Victory Road entrance |

### 2.2 Routes

Hoenn has **34 routes** (101–134). All route maps have `map_type: MAP_TYPE_ROUTE`.

| Route | Key connections | HM / feature |
|---|---|---|
| Route 101 | Littleroot Town ↔ Oldale Town | Prof. Birch rescue / starter pick |
| Route 102 | Oldale Town ↔ Petalburg City | Grass; first wild Pokémon |
| Route 103 | Oldale Town ↔ (sea) | First rival battle (after Oldale) |
| Route 104 | Petalburg City ↔ Rustboro City | Petalburg Woods splits north section |
| Route 105 | Dewford area ↔ Route 106 | Surf required |
| Route 106 | Route 105 ↔ Dewford Town (surf) | Island approach |
| Route 107 | Dewford area | Surf |
| Route 108 | Slateport approach | Abandoned Ship at sea |
| Route 109 | Slateport City (south beach) | Surfing; beach trainers |
| Route 110 | Slateport ↔ Mauville | Cycling Road (bike required for speed); Trick House |
| Route 111 | Mauville ↔ Fallarbor (via desert) | Mirage Tower; desert (requires Acro Bike/GoGoggles) |
| Route 112 | Mt. Chimney approach | Cable Car at north end |
| Route 113 | Fallarbor approach | Ash-covered; Soot Sack for Glass Flute |
| Route 114 | Fallarbor Town ↔ Meteor Falls | Fossil Maniac; Lanette's House |
| Route 115 | Rustboro (north) | Surf section; Return Cave |
| Route 116 | Rustboro (east) ↔ Rusturf Tunnel | Aqua Grunt early event |
| Route 117 | Mauville ↔ Verdanturf | Day Care Centre |
| Route 118 | Mauville (east) | Steven encounter (post-Mossdeep) |
| Route 119 | Route 118 ↔ Fortree City | Rain weather; Weather Institute; Rival battle 2 |
| Route 120 | Fortree City (east) ↔ Route 121 | Ancient Tomb; Kecleon encounters |
| Route 121 | Route 120 ↔ Lilycove | Safari Zone entrance |
| Route 122 | Mt. Pyre approach | Surf |
| Route 123 | Route 122 ↔ Mauville (roundabout) | Berry shops |
| Route 124 | Lilycove ↔ Mossdeep | Dive spots; underwater routes |
| Route 125 | Mossdeep (north) ↔ Shoal Cave | Shoal Cave; Articuno event |
| Route 126 | Sootopolis approach | Dive required |
| Route 127 | Mossdeep (south) | Surf/Dive |
| Route 128 | Ever Grande approach | Seafloor Cavern dive spot |
| Route 129 | Post-game eastern sea | |
| Route 130 | Mirage Island / Faraway Island area | |
| Route 131 | Sky Pillar approach | |
| Route 132–134 | Eddying currents (swept west) | Strong currents; Sealed Chamber (Regis) |

### 2.3 Dungeons & Caves

#### Major story dungeons

| Map group | Floors | Purpose |
|---|---|---|
| `GraniteCave` (1F, B1F, B2F, StevensRoom) | 4 | Dewford — Steven's room; Moon Stone; Hiker flash puzzle |
| `PetalburgWoods` | 1 | Between Routes 104; Devon Researcher subplot; Shroomish/Slakoth |
| `RusturfTunnel` | 1 | Connects Routes 116/117; Whismur; Wanda & boyfriend reunite |
| `MeteorFalls` (1F_1R, 1F_2R, B1F_1R, B1F_2R, StevensCave) | 5 | Early Aqua/Magma confrontation; Bagon; Steven post-game cave |
| `MtChimney` | 1 exterior | Cable car summit; Magma Meteor fight; Jagged Pass south |
| `JaggedPass` | 1 | Mt. Chimney → Lavaridge; Camper trainers |
| `MtPyre` (Exterior, 1F–6F, Summit) | 8 | Ghost-type tower; Magma/Aqua steal orbs from summit |
| `AquaHideout` (1F, B1F, B2F) | 3 | Lilycove; Archie's base; Master Ball stolen |
| `MagmaHideout` (1F, 2F_1R/2R/3R, 3F_1R/2R/3R, 4F) | 9 | Magma's volcano base; Groudon captured |
| `SeafloorCavern` (Entrance, Rooms 1–9) | 10 | Deep ocean; Kyogre captured |
| `CaveOfOrigin` (Entrance, 1F, B1F) | 3 | Sootopolis; Kyogre/Groudon encounter (not battled — Rayquaza stops them) |
| `VictoryRoad` (1F, B1F, B2F) | 3 | Before Pokémon League; Wailord/Relicanth puzzles near exit |
| `SkyPillar` (Outside, Entrance, 1F–5F, Top) | 8 | Route 131; Rayquaza's tower; crumbling floors require Mach Bike |

#### Post-game / side dungeons

| Map group | Notes |
|---|---|
| `NewMauville` (Entrance, Inside) | Underground power plant; Electrode, Magneton; Wattson quest |
| `ShoalCave` (high tide / low tide variants) | Tidal puzzle; Snorunt; Shell Bell crafting |
| `AncientTomb` | Route 120; Registeel |
| `IslandCave` | Route 105; Regice |
| `DesertRuins` | Route 111; Regirock |
| `SealedChamber` | Route 134 dive; Braille puzzle to unlock Regi caves |
| `MirageTower` (1F–4F) | Route 111 desert; appears/disappears; Dome/Helix Fossil |
| `TerraCave` (Entrance, End) | Groudon's roaming cave (requires Magma Emblem event) |
| `MarineCave` (Entrance, End) | Kyogre's roaming cave |
| `AlteringCave` | Route 103; normally empty; intended for event Pokémon via Mystery Gift |
| `ArtisanCave` (1F, B1F) | Battle Frontier island; Smeargle |
| `BirthIsland` (Exterior, Harbor) | Event-only; Deoxys encounter |
| `NavelRock` (full set of floors) | Event-only; Ho-Oh (top) + Lugia (bottom) |
| `Underwater_*` (Routes 124–129, Seafloor Cavern, Sealed Chamber, Sootopolis) | Dive zones |

### 2.4 Interiors / Buildings

Key interior map groups (each city/town has its own Pokémon Center 1F/2F and Mart):

| Building group | Location | Notes |
|---|---|---|
| `LittlerootTown_ProfessorBirchsLab` | Littleroot | Starter Pokémon; Pokédex given |
| `LittlerootTown_BrendansHouse_1F/2F` | Littleroot | Brendan's room (rival's house if player is May) |
| `LittlerootTown_MaysHouse_1F/2F` | Littleroot | May's room (player's if female) |
| `RustboroCity_DevonCorp_1F/2F/3F` | Rustboro | Devon Goods subplot; PokéNav given; Devon Scope later |
| `RustboroCity_PokemonSchool` | Rustboro | Battle mechanics tutorial boards |
| `SlateportCity_OceanicMuseum_1F/2F` | Slateport | Stern's research; Aqua confrontation |
| `SlateportCity_SternsShipyard` | Slateport | Link to SS Tidal construction |
| `MauvilleCity_BikeShop` | Mauville | Rydel's Bikes — Mach Bike or Acro Bike |
| `MauvilleCity_GameCorner` | Mauville | Roulette (Emerald only; not slots like RSE cousins) |
| `NewMauville_*` | Under Route 110 | Post-Wattson quest; Generator |
| `WeatherInstitute_1F/2F` | Route 119 | Castform given; Aqua Grunt battle |
| `MossdeepCity_SpaceCenter_1F/2F` | Mossdeep | Team Magma rocket subplot; Max Elixir rewards |
| `MossdeepCity_StevensHouse` | Mossdeep | Steven gives Beldum after becoming Champion |
| `LilycoveCity_DepartmentStore_1F–5F + Rooftop + Elevator` | Lilycove | Largest shop; rooftop vending machines |
| `LilycoveCity_LilycoveMuseum_1F/2F` | Lilycove | Paintings; Secret Power TM available |
| `LilycoveCity_ContestLobby` + Contest Hall variants | Lilycove | Master Rank Contests |
| `LilycoveCity_Harbor` | Lilycove | S.S. Tidal to Battle Frontier / Southern Island |
| `LilycoveCity_MoveDeletersHouse` | Lilycove | Delete HM moves |
| `SootopolisCity_MysteryEventsHouse_1F` | Sootopolis | Event-distribution house |
| `AbandonedShip_*` (Deck, Corridors 1F/B1F, Rooms, HiddenFloor, Underwater) | Route 108 | Storage Key puzzle; Scanner for Deep Sea items |
| `MagmaHideout_*` | Route 112 area | 9 rooms; Groudon |
| `AquaHideout_*` | Lilycove | 3 floors; Master Ball stolen; Submarine |
| `BattleFrontier_*` | Battle Frontier island | 7 facilities + lounges + Pokémon Center + Mart + Scott's House |
| `ContestHall` / `ContestHallBeauty` / `ContestHallCool` / etc. | Various cities | Per-attribute Contests |
| `RecordCorner` | Wireless Club | Link-play record mixing |
| `UnionRoom` | Wireless Club | Trade / battle wireless |
| `SecretBase_*` (Blue/Red/Yellow/Brown caves, trees, shrubs) | Various routes | Player's Secret Base via Secret Power |

---

## 3. Warp & Connection Graph

Connections are directional map edges (seamless scrolling). Warps are tile-based
teleports (doors, cave entrances, stairs). The following covers the main overworld
route graph; interior warps are implicit per building.

### Main overworld connection chain

```
LittlerootTown
  └─[up]─► Route101
             └─[up]─► OldaleTown
                         ├─[left]─► Route102 ─► PetalburgCity
                         │                           ├─[west]─► Route104 ─► PetalburgWoods ─► Rustboro
                         │                           └─[east]─► Route102 (loop)
                         └─[right]─► Route103 (dead end east, connects back to sea)

RustboroCity
  ├─[up]─► Route115 (surf section north)
  ├─[down]─► Route104 (south ─► Petalburg)
  └─[right]─► Route116 ─► RusturfTunnel ─► Route117 ─► VerdanturfTown
                                                            └─ Route117 ─► MauvilleCity

MauvilleCity (central hub)
  ├─[up]─►    Route111 (desert)
  │              ├─► FallarborTown
  │              └─► Route112 ─► MtChimney ─► JaggedPass ─► LavaridgeTown
  ├─[down]─►  Route110 (Cycling Road) ─► SlateportCity
  ├─[left]─►  Route117 ─► VerdanturfTown
  └─[right]─► Route118 ─► Route119 ─► FortreeCity
                                           └─[right]─► Route120 ─► Route121
                                                                       ├─► LilycoveCity
                                                                       └─► Route122 ─► MtPyre
                                                                                         └─► Route123

LilycoveCity
  ├─[left]─►  Route121
  └─[right]─► Route124 ─► MossdeepCity
                             ├─[north]─► Route125 ─► ShoalCave
                             └─[south]─► Route127 ─► Route128 ─► EverGrandeCity
                                                         └─[dive]─► SeafloorCavern

EverGrandeCity
  ├─► VictoryRoad (1F ─► B1F ─► B2F ─► PokéLeague)
  └─► PokémonLeague_1F ─► EliteFour rooms ─► Champion's room

SootopolisCity (island, access via Route126 dive + emerge)
  └─► CaveOfOrigin

Route131 ─► SkyPillar_Outside ─► SkyPillar_Entrance ─► 1F ─► 2F ─► 3F ─► 4F ─► 5F ─► Top

Route130 / Route131 / Pacifidlog ─► (currents) ─► Route132 ─► 133 ─► 134 ─► SealedChamber (dive)

Special island warps (S.S. Tidal from Lilycove Harbor):
  ─► SouthernIsland (Latios/Latias — gender-dependent)
  ─► BattleFrontier_OutsideWest / OutsideEast
```

### Key warp notes from map data
- **Sootopolis** has no route connections (`"connections": []`); must enter via Dive (Route 126)
  or Fly. Warps: Pokémon Center, Mart, Gym 1F, Cave of Origin Entrance, 7 Houses,
  Lotad/Seedot House, Mystery Events House.
- **Ever Grande City** connects Route 128 to the west (`offset: 40`). Has two
  VictoryRoad warp entries (`dest_warp_id: 0` and `1`).
- **SkyPillar 1F** exits to `MAP_SKY_PILLAR_OUTSIDE` and ascends to `MAP_SKY_PILLAR_2F`.
  Music is `MUS_MT_CHIMNEY` (reused). Weather is `WEATHER_NONE`. `map_type` is
  `MAP_TYPE_UNDERGROUND`.
- **Lilycove** connects to `MAP_AQUA_HIDEOUT_1F` directly from the outdoor map at
  coordinates (70, 5).

---

## 4. Tileset Catalog

The repository's `data/tilesets/` currently contains **60 tileset pairs** (PNG + JSON),
all named after **Kanto / FireRed-Leaf Green** locations. There are **no Hoenn-specific
tilesets yet** in the repository. The lone Hoenn-related entry is `hoenn_building.json`
/ `hoenn_building.png`.

### Current tilesets (from `data/tilesets/`)

| Tileset name | Original game region |
|---|---|
| `hoenn_building` | Hoenn (interiors) |
| `cave`, `cerulean_cave`, `rock_tunnel`, `seafoam_islands`, `digletts_cave` | Kanto caves |
| `pallet_town`, `viridian_city`, `pewter_city`, `cerulean_city` | Kanto towns/cities |
| `lavender_town`, `vermilion_city`, `celadon_city`, `fuchsia_city`, `saffron_city` | Kanto cities |
| `cinnabar_island`, `viridian_forest`, `berry_forest` | Kanto outdoor |
| `pokemon_center`, `mart`, `lab`, `school` | Shared interiors |
| `pokemon_tower`, `silph_co`, `museum`, `department_store`, `game_corner` | Kanto buildings |
| `*_gym` (viridian, pewter, cerulean, vermilion, celadon, fuchsia, saffron, cinnabar, celadon) | Kanto gyms |
| `ss_anne`, `underground_path`, `power_plant`, `pokemon_mansion` | Kanto specials |
| `safari_zone_building`, `restaurant_hotel`, `condominiums`, `fan_club_daycare` | Kanto specials |
| `hall_of_fame`, `indigo_plateau`, `pokemon_league` | Kanto end-game |
| `sevii_islands_123`, `sevii_islands_45`, `sevii_islands_67` | FireRed/LeafGreen |
| `island_harbor`, `sea_cottage`, `bike_shop`, `cable_club`, `burgled_house` | FRLG interiors |
| `mt_ember`, `tanoby_ruins`, `navel_rock`, `trainer_tower` | FRLG dungeons |
| `generic_building_1`, `generic_building_2` | Shared |

### Required Hoenn tilesets (not yet in repo)

For faithful Emerald rendering, the following tileset categories are needed:

| Tileset category | Used by |
|---|---|
| `hoenn_general` (exterior towns, routes) | All outdoor Hoenn maps |
| `hoenn_cave` | GraniteCave, VictoryRoad, CaveOfOrigin, SeafloorCavern, SkyPillar |
| `hoenn_desert` | Route 111 desert, MirageTower |
| `hoenn_ocean` | Routes 105–109, 122–134, underwater maps |
| `hoenn_lavaridge` | Lavaridge Town, MtChimney, JaggedPass |
| `hoenn_gym_*` (×8) | Each gym's interior |
| `hoenn_mt_pyre` | MtPyre exterior + floors |
| `hoenn_abandoned_ship` | AbandonedShip multi-floor |
| `hoenn_aqua_hideout`, `hoenn_magma_hideout` | Team bases |
| `hoenn_battle_frontier` | BattleFrontier OutsideEast/West + interiors |
| `hoenn_contest_hall` | ContestHall variants |
| `hoenn_sky_pillar` | SkyPillar 1F–Top |
| `hoenn_fortree` | Fortree City treehouse style |
| `hoenn_sootopolis` | Sootopolis crater city |

---

## 5. Sprite Manifest

### 5.1 NPC Graphics IDs

The following `graphics_id` values appear in the sampled map JSON files
(LittlerootTown, Route101, MauvilleCity, SootopolisCity, SkyPillar_1F,
RustboroCity, LilycoveCity, EverGrandeCity, FortreeCity). This is not exhaustive —
all 518 maps should be scanned to build the complete manifest.

| Graphics ID | Description / character |
|---|---|
| `OBJ_EVENT_GFX_AQUA_MEMBER_M` | Team Aqua Grunt (male) — blue-and-white uniform |
| `OBJ_EVENT_GFX_ARCHIE` | Archie — Team Aqua Leader; navy captain look |
| `OBJ_EVENT_GFX_BIRCHS_BAG` | Prof. Birch's bag (overworld object, not humanoid) |
| `OBJ_EVENT_GFX_BLACK_BELT` | Black Belt trainer class |
| `OBJ_EVENT_GFX_BOY_1` | Generic boy sprite (brown/blue palette 1) |
| `OBJ_EVENT_GFX_BOY_2` | Generic boy sprite (alternate palette 2) |
| `OBJ_EVENT_GFX_BOY_3` | Generic boy sprite (alternate palette 3) |
| `OBJ_EVENT_GFX_DEVON_EMPLOYEE` | Devon Corporation staff — white lab coat variant |
| `OBJ_EVENT_GFX_EXPERT_F` | Expert / Ace trainer (female) |
| `OBJ_EVENT_GFX_EXPERT_M` | Expert / Ace trainer (male) |
| `OBJ_EVENT_GFX_FAT_MAN` | Heavy-set adult male NPC |
| `OBJ_EVENT_GFX_GAMEBOY_KID` | Child holding a Game Boy Advance |
| `OBJ_EVENT_GFX_GENTLEMAN` | Gentleman trainer class — suit |
| `OBJ_EVENT_GFX_GIRL_1` | Generic girl sprite (palette 1) |
| `OBJ_EVENT_GFX_GIRL_2` | Generic girl sprite (palette 2) |
| `OBJ_EVENT_GFX_GIRL_3` | Generic girl sprite (palette 3) |
| `OBJ_EVENT_GFX_GROUDON_SIDE` | Groudon overworld sprite (side-facing) |
| `OBJ_EVENT_GFX_ITEM_BALL` | Item Poké Ball on the ground |
| `OBJ_EVENT_GFX_KECLEON` | Kecleon (invisible until Devon Scope used) |
| `OBJ_EVENT_GFX_KYOGRE_SIDE` | Kyogre overworld sprite (side-facing) |
| `OBJ_EVENT_GFX_LITTLE_BOY` | Small child boy |
| `OBJ_EVENT_GFX_LITTLE_GIRL` | Small child girl |
| `OBJ_EVENT_GFX_MAN_1` | Generic adult male (palette 1) |
| `OBJ_EVENT_GFX_MAN_2` | Generic adult male (palette 2) |
| `OBJ_EVENT_GFX_MAN_3` | Generic adult male (palette 3) |
| `OBJ_EVENT_GFX_MAN_4` | Generic adult male (palette 4) |
| `OBJ_EVENT_GFX_MANIAC` | Pokémaniac / collector type NPC |
| `OBJ_EVENT_GFX_MAXIE` | Maxie — Team Magma Leader; dark red uniform |
| `OBJ_EVENT_GFX_MOM` | Player's Mom (Mrs. Birch / player's mother NPC) |
| `OBJ_EVENT_GFX_NINJA_BOY` | Ninja Boy trainer class |
| `OBJ_EVENT_GFX_OLD_MAN` | Elderly male NPC |
| `OBJ_EVENT_GFX_POKEFAN_M` | Pokémon Fan Club member (male) |
| `OBJ_EVENT_GFX_PROF_BIRCH` | Professor Birch — large man, lab coat, brown hair |
| `OBJ_EVENT_GFX_RAYQUAZA` | Rayquaza overworld sprite |
| `OBJ_EVENT_GFX_RICH_BOY` | Rich Boy trainer class |
| `OBJ_EVENT_GFX_SAILOR` | Sailor NPC |
| `OBJ_EVENT_GFX_SCHOOL_KID_M` | School Kid (male) trainer class |
| `OBJ_EVENT_GFX_SCIENTIST_1` | Scientist NPC (lab coat variant 1) |
| `OBJ_EVENT_GFX_SCOTT` | Scott — mysterious man who scouts for Battle Frontier |
| `OBJ_EVENT_GFX_STEVEN` | Steven Stone — silver hair, suit, Devon heir |
| `OBJ_EVENT_GFX_TRUCK` | Moving truck (Littleroot intro object) |
| `OBJ_EVENT_GFX_TWIN` | Twin trainer class (female pair sprite) |
| `OBJ_EVENT_GFX_VAR_0` | Variable sprite resolved at runtime — used for the rival (Brendan or May depending on player gender) |
| `OBJ_EVENT_GFX_WALLACE` | Wallace — Sootopolis Gym Leader / Champion; blue cape |
| `OBJ_EVENT_GFX_WALLY` | Wally — recurring NPC; pale, green hair |
| `OBJ_EVENT_GFX_WATTSON` | Wattson — Mauville Gym Leader; jolly large man, yellow outfit |
| `OBJ_EVENT_GFX_WOMAN_2` | Generic adult female (palette 2) |
| `OBJ_EVENT_GFX_WOMAN_3` | Generic adult female (palette 3) |
| `OBJ_EVENT_GFX_WOMAN_4` | Generic adult female (palette 4) |
| `OBJ_EVENT_GFX_WOMAN_5` | Generic adult female (palette 5) |
| `OBJ_EVENT_GFX_YOUNGSTER` | Youngster trainer class — shorts |
| `OBJ_EVENT_GFX_ZIGZAGOON_1` | Zigzagoon overworld sprite |

**Additional IDs expected but not yet confirmed in sampled maps** (from Emerald ROM data):
`OBJ_EVENT_GFX_MAGMA_MEMBER_M`, `OBJ_EVENT_GFX_MAGMA_MEMBER_F`,
`OBJ_EVENT_GFX_AQUA_MEMBER_F`, `OBJ_EVENT_GFX_BRENDAN`, `OBJ_EVENT_GFX_MAY`,
`OBJ_EVENT_GFX_POKEFAN_F`, `OBJ_EVENT_GFX_SCHOOL_KID_F`,
`OBJ_EVENT_GFX_LADY`, `OBJ_EVENT_GFX_BEAUTY`, `OBJ_EVENT_GFX_LASS`,
`OBJ_EVENT_GFX_PHOEBE`, `OBJ_EVENT_GFX_GLACIA`, `OBJ_EVENT_GFX_DRAKE`,
`OBJ_EVENT_GFX_SIDNEY`, `OBJ_EVENT_GFX_BIRCH_AIDE`,
`OBJ_EVENT_GFX_FRONTIER_BRAIN_*` (×7).

### 5.2 Player Sprite (Brendan / May — frame layout)

The player sprite sheet uses the standard GBA 4bpp sprite format.

**Overworld sprite:** 16×32 px per frame (1×2 tiles at 8×8 each, scaled).
Actual GBA hardware uses 16×32 OBJ size.

**Walk animation directions and frame indices:**
```
Direction  Frames (0-based)
  Down     0, 1, 2, 1      (neutral, left-step, neutral, right-step)
  Up       4, 5, 6, 5
  Left     8, 9, 10, 9
  Right    12, 13, 14, 13
```

**Additional overworld states:**
- Running: same direction groups but faster frame advance rate
- Biking (Mach / Acro): separate larger sprite (32×32) with lean frames
- Surfing: player + Pokémon combined sprite
- Fishing: single facing-down frame

**Brendan colors:** red bandana, black-and-white outfit, dark shoes
**May colors:** red bandana, white top, blue shorts, red shoes

Both have separate battle-screen "trainer back" sprites (80×80 px) and
wild-encounter side-view sprites.

### 5.3 Pokémon Sprites

Emerald introduced **animated front sprites** (two-frame idle animation in battle).
Frames are stored as two sequential 64×64 bitmaps.

**Sprite types per Pokémon:**
| Type | Size | Usage |
|---|---|---|
| Front (frame 1) | 64×64 | Battle — displayed for enemy/chosen |
| Front (frame 2) | 64×64 | Animation second frame |
| Back | 64×64 | Battle — player's own Pokémon |
| Overworld (if applicable) | 16×16 | Surfing Pokémon, following Pokémon |
| Icon | 32×64 (2 frames) | Party screen cycling icon |
| Footprint | 16×16 | Pokédex entry |

**Shiny palettes:** Each Pokémon has a secondary 16-color palette for the shiny form.
Shiny chance is 1/8192 in Emerald (standard GBA-era rate).

---

## 6. UI & Menu Reference

### 6.1 Start Menu

**Trigger:** Press START on the overworld.
**Appearance:** A white/cream panel slides in from the right edge of the screen.
Panel width is approximately half the screen (120 px of 240 px GBA width).
Blue header bar at the top shows the player's name.

**Menu items (in order, context-dependent):**
```
POKéDEX
POKéMON
BAG
[PLAYER NAME]
SAVE
OPTIONS
EXIT
```
- `BRENDAN` / `MAY` opens the Trainer Card (ID, money, play time, badges).
- `POKéDEX` is greyed out until the player receives the Pokédex from Birch.
- `SAVE` writes to SRAM (one save slot).
- Pressing B or EXIT dismisses the menu.

**Badge display on Trainer Card:**
All 8 badges shown as small icons in a 4×2 grid:
Stone Badge, Knuckle Badge, Dynamo Badge, Heat Badge,
Balance Badge, Feather Badge, Mind Badge, Rain Badge.

### 6.2 Battle UI (Emerald-specific)

**Layout (GBA 240×160 screen):**
```
┌─────────────────────────────────────┐
│  Enemy Pokémon sprite (top-right)   │
│  Enemy HP bar + name + level        │  ← top half (96 px)
│  [shiny star if shiny]              │
│  Player Pokémon sprite (bottom-left)│
│  Player HP bar + name + Lv + EXP   │
├─────────────────────────────────────┤
│  FIGHT   BAG                        │  ← bottom half message box (64 px)
│  POKéMON RUN                        │
└─────────────────────────────────────┘
```

**FIGHT sub-menu (4 moves):**
```
┌─────────────────┬─────────────────┐
│  [Move 1 name]  │  [Move 2 name]  │
├─────────────────┼─────────────────┤
│  [Move 3 name]  │  [Move 4 name]  │
├─────────────────┴─────────────────┤
│  TYPE: [type]   PP: [n] / [max]   │
└───────────────────────────────────┘
```
Type icon appears as a colored pill-shaped label.
PP colors: normal (black), low (yellow at ≤ half), critical (red at 1–0).

**Emerald-specific battle features:**
- Pokémon Contest move descriptions carry 3-star ratings (Appeal and Jam values)
  visible in the Pokémon Contest version of this screen.
- Double Battle layout: two Pokémon on each side; HP bars stack vertically.
- Battle Frontier facilities each have unique rule overlays (see §7.4).
- Status icons (PAR, SLP, BRN, FRZ, PSN, TOX) appear as colored blocks on the HP bar.

**HP bar color:**
- Green: > 50% HP
- Yellow: 20–50% HP
- Red: < 20% HP

**EXP bar:** Thin blue bar below the player's HP bar. Fills left-to-right;
auto-advances level if it fills completely during battle.

### 6.3 Dialogue Box

**Appearance:** Black-outlined white box at the bottom of the screen, 2 lines of text,
full width (240 px), approximately 32 px tall. Small arrow blinks at bottom-right
corner when waiting for A/B input.

**Font:** Pokémon font (proportional, uppercase-heavy). Character limit per line: ~36 chars.

**Name tag:** For named NPCs and the rival, a small name label box appears above the
dialogue box (dark frame, NPC name in white text).

**Scrolling:** Text appears character-by-character at a configurable speed
(Fast / Mid / Slow in Options). Pressing A skips to end of current page.

**Choice prompt:** When a yes/no or multi-option prompt appears, a small overlay box
appears to the right of or above the dialogue box with the options, cursor arrow
selects with D-pad, A confirms, B cancels (usually = "No").

### 6.4 Party Screen

**Access:** START → POKéMON.
**Layout:** Six Pokémon slots arranged in a specific GBA pattern:
```
[Slot 1 — large, left side]
[Slot 2][Slot 3]
[Slot 4][Slot 5]
[Slot 6]
[CANCEL button]
```
Slot 1 (lead Pokémon) has a larger panel. Slots 2–6 are smaller side panels.
Each slot shows: Pokémon icon (animated 2-frame), nickname, HP bar, current/max HP.
Fainted Pokémon: slot panel is darker/greyed; "FNT" in HP area.

**Selecting a Pokémon opens sub-menu:**
```
SUMMARY  SWITCH  ITEM  [context action]  CANCEL
```
Context action changes: `CUT`, `SURF`, `FLY`, etc. if usable outside battle.

**SUMMARY screen tabs:**
1. Info tab: Trainer, Original Trainer, ID No., Item held
2. Skills & Exp tab: Exp, next level, stats (HP/Atk/Def/SpA/SpD/Spe)
3. Moves tab: 4 move slots with PP, type color
4. Ribbon tab: Contest ribbons earned

### 6.5 Bag

**Access:** START → BAG.
**Emerald Bag has 5 pockets:**

| Pocket | Icon color | Contents |
|---|---|---|
| Items | Red cross | Potions, Repels, X items, battle items, TMs sold as items |
| Poké Balls | Red-white ball | All Poké Ball varieties |
| TMs & HMs | Compact disc | All TMs (01–50) and HMs (01–08) |
| Berries | Berry icon | All berry types |
| Key Items | Gold key | Story-critical items (Bike, Devon Goods, Pokédex, etc.) |

**Navigation:** L/R buttons cycle between pockets. D-pad scrolls item list.
Items show name + quantity. Selecting an item: USE / GIVE / TOSS / REGISTER (for Bicycle / Super Rod / Vs. Seeker).

**Registered item:** Shown in HUD; activated with SELECT.

### 6.6 Pokédex

**Mode:** Switches between Hoenn Dex (202 entries, #001–#202 Hoenn-regional numbering)
and National Dex (386 entries) after defeating Champion Wallace.

**Entry screen:**
- Left: Pokémon sprite (animated in Emerald); height/weight silhouette comparison
- Right: Species name, category ("Tiny Mouse Pokémon"), height, weight
- Dex text: one paragraph of flavor text
- Cry button (A): plays the Pokémon's cry
- Habitat map: shows Hoenn region map with habitat dots if owned

**Search features:** Alphabetical, by type, by number.

**Seen vs. Owned:** Seen entries show silhouette only; Owned entries show full color sprite.

### 6.7 PokéNav

**Received from:** Mr. Stone (Devon Corp president) after returning the Devon Letter.
**Three functions:**

#### Map
Full Hoenn region map. Player's position shown as flashing dot.
Can zoom to show route names. Accessed via PokéNav → MAP.
Flying: select destination from map (only visited towns/cities).

#### Match Call
Phone-book style contact list. Registered trainers call the player after a rematch
criteria is met (post-National Dex). Shows trainer name, class, last area.
GyM Leaders available for rematch after National Dex + their call.
Record mixing via wireless can share trainer data.

#### Condition
Shows Pokémon Contest condition stats for each party Pokémon:
Coolness, Beauty, Cuteness, Smartness, Toughness (0–255 each, displayed as stars).
Affected by Pokéblocks fed to the Pokémon.

### 6.8 Options Menu

**Access:** START → OPTIONS.

| Setting | Values |
|---|---|
| Text Speed | Slow / Mid / Fast |
| Battle Scene | On / Off |
| Battle Style | Shift / Set |
| Sound | Mono / Stereo |
| Difficulty | (not present in vanilla Emerald — this is a romhack-only field) |
| Button Mode | Help / LR / L=A |
| Frame | 1–10 (border frame for the in-battle UI border style in GBA player) |

---

## 7. Key Game Systems

### 7.1 Gym Progression (8 Gyms + Rematch System)

| # | Gym Leader | Location | Type | Badge | HM unlocked | Signature move / Pokémon |
|---|---|---|---|---|---|---|
| 1 | Roxanne | Rustboro City | Rock | Stone Badge | Cut | Nosepass (Lv 15) |
| 2 | Brawly | Dewford Town | Fighting | Knuckle Badge | Flash | Makuhita → Hariyama (Lv 18) |
| 3 | Wattson | Mauville City | Electric | Dynamo Badge | Rock Smash | Manectric (Lv 24) |
| 4 | Flannery | Lavaridge Town | Fire | Heat Badge | Strength | Torkoal (Lv 29) |
| 5 | Norman (Dad) | Petalburg City | Normal | Balance Badge | Surf | Slaking (Lv 31) |
| 6 | Winona | Fortree City | Flying | Feather Badge | Fly | Altaria (Lv 35) |
| 7 | Tate & Liza | Mossdeep City | Psychic | Mind Badge | Dive | Solrock + Lunatone (Lv 45, Double) |
| 8 | Juan | Sootopolis City | Water | Rain Badge | Waterfall | Kingdra (Lv 46) |

**Badge effects on wild Pokémon obedience (level thresholds):**
Stone ≤20, Knuckle ≤30, Dynamo ≤40, Heat ≤50, Balance ≤60, Feather ≤70, Mind ≤80, Rain — all obey.

**Rematch system (Emerald-exclusive):**
After obtaining the National Dex, Gym Leaders register in PokéNav Match Call and call
the player. Rematch teams are stronger (Lv 54–84 range). Must be at least a set number
of steps walked after the initial badge win before the rematch call triggers.

### 7.2 Evil Teams (Magma + Aqua Dual-Team Structure)

Emerald is unique in the main series for making **both** Teams the player's active enemies.

**Team Magma** (red uniforms, fire/earth motif)
- Leader: Maxie
- Admins: Tabitha, Courtney
- Goal: Expand the land mass using Groudon's power
- Base: `MagmaHideout` (accessible from Route 112 via cable car / pass)
- Key events: steal Meteorite from Prof. Cozmo (Mt. Chimney), steal Red Orb from
  Mt. Pyre summit, awaken Groudon in Seafloor Cavern

**Team Aqua** (blue uniforms, wave motif)
- Leader: Archie
- Admins: Matt, Shelly
- Goal: Expand the sea using Kyogre's power
- Base: `AquaHideout` (Lilycove City, via hidden entrance at (70,5))
- Key events: steal Devon submarine plans from Oceanic Museum, steal Blue Orb from
  Mt. Pyre summit, steal Master Ball from Aqua Hideout, awaken Kyogre in Seafloor Cavern

**Emerald-specific twist:** Both teams act simultaneously. Groudon and Kyogre are both
awakened and clash at Sootopolis, causing extreme weather (permanent harsh sunlight +
heavy rain conflict). Neither team achieves their goal — Rayquaza must intervene.

**Sootopolis resolution sequence:**
1. Player reaches Sootopolis via dive.
2. Groudon and Kyogre are in the lake (`FLAG_HIDE_SOOTOPOLIS_CITY_GROUDON` /
   `FLAG_HIDE_SOOTOPOLIS_CITY_KYOGRE`).
3. Steven brings player to Sky Pillar to awaken Rayquaza.
4. Rayquaza descends to Sootopolis, separates the two legendaries.
5. Cave of Origin becomes accessible; Wallace (or Juan in post-game) allows gym entry.
6. Maxie and Archie sprites appear at Sootopolis (`FLAG_HIDE_SOOTOPOLIS_CITY_MAXIE` /
   `FLAG_HIDE_SOOTOPOLIS_CITY_ARCHIE`) for their post-event dialogue.

### 7.3 Weather Trio (Groudon / Kyogre / Rayquaza Story Arc)

| Legendary | Type | Level | Location (story) | Catch opportunity |
|---|---|---|---|---|
| Groudon | Ground | 45 | Seafloor Cavern (awakened by Magma) | TerraCave (roaming event post-game) |
| Kyogre | Water | 45 | Seafloor Cavern (awakened by Aqua) | MarineCave (roaming event post-game) |
| Rayquaza | Dragon/Flying | 70 | Sky Pillar Top (story climax) | Sky Pillar Top (re-encounter if fled) |

**Overworld sprites in Sootopolis:**
- `OBJ_EVENT_GFX_GROUDON_SIDE` at (28, 44) — `MOVEMENT_TYPE_WALK_SLOWLY_IN_PLACE_RIGHT`
- `OBJ_EVENT_GFX_KYOGRE_SIDE` at (34, 44) — `MOVEMENT_TYPE_WALK_SLOWLY_IN_PLACE_LEFT`
- `OBJ_EVENT_GFX_RAYQUAZA` at (31, 41) — `MOVEMENT_TYPE_FACE_RIGHT`

All three are hidden by flags and revealed via script progression.

**Post-game roaming:**
After the National Dex, either Groudon (if weather is sunny in southern Hoenn) or Kyogre
(if rainy) appears in a cave accessible from a specific route. The other is in the
alternate cave type. The Magma Emblem key item (found in MagmaHideout) triggers Groudon's
cave; Kyogre's cave is triggered by the Blue Orb possession check.

### 7.4 Battle Frontier (7 Facilities, Symbols)

Located on a large island west of Hoenn, accessed by S.S. Tidal from Lilycove Harbor
or by Fly after first visit.

| Facility | Map prefix | Brain | Symbol (Silver → Gold) | Rules |
|---|---|---|---|---|
| Battle Tower | `BattleTower` | Anabel | Ability Symbol | 7 battles in a row, standard singles or doubles; no two same species/item |
| Battle Dome | `BattleDome` | Tucker | Tactics Symbol | 16-trainer tournament bracket; see opponent's team before choosing |
| Battle Palace | `BattlePalace` | Spenser | Courage Symbol | Pokémon act autonomously based on their nature; player gives no move commands |
| Battle Arena | `BattleArena` | Greta | Guts Symbol | 3-turn knockout rounds; judged on Mind/Skill/Body if no KO |
| Battle Pike | `BattlePike` | Lucy | Luck Symbol | Corridor rooms with random encounters: wild, trainer, or restore |
| Battle Factory | `BattleFactory` | Noland | Knowledge Symbol | Uses rental Pokémon; swap after battles; no player's own Pokémon |
| Battle Pyramid | `BattlePyramid` | Brandon | Brave Symbol | Multi-floor dungeon in the dark; items depleted on entry; find the top |

**Symbol earning:** 21 consecutive wins (or equivalent) → Silver Symbol (Brain challenge
battle). Another run of 42+ → Gold Symbol (Brain rematch, harder team).

**Exchange Service Corner:** Prize exchange shop. BP (Battle Points) earned from streaks.
Common prizes: Held items (Salac Berry, Leichi Berry, etc.), TMs, vitamins.

**Scott** (`OBJ_EVENT_GFX_SCOTT`) appears multiple times throughout the main game
(Mauville, Fortree, Lilycove, Sootopolis) before revealing himself as the Battle
Frontier's founder. His house is in `BattleFrontier_ScottsHouse`.

**Battle Pyramid map structure:** `BattlePyramidSquare01`–`BattlePyramidSquare16`
are 16 procedurally-selected square room layouts assembled into floors.

### 7.5 Legendary Locations

| Pokémon | Location | Access requirement |
|---|---|---|
| Rayquaza | SkyPillar_Top | Mach Bike (navigate crumbling floors); story or rematch |
| Groudon | TerraCave_End | Post-game roaming event (Magma Emblem) |
| Kyogre | MarineCave_End | Post-game roaming event (Blue Orb check) |
| Latios | Roaming Hoenn | Male player default; or Eon Ticket for SouthernIsland |
| Latias | Roaming Hoenn | Female player default; or Eon Ticket for SouthernIsland |
| Regice | IslandCave | Sealed Chamber Braille solution + 2 min walk |
| Regirock | DesertRuins | Sealed Chamber + Dig + strength puzzles |
| Registeel | AncientTomb | Sealed Chamber + Fly in center |
| Deoxys | BirthIsland | Aurora Ticket Mystery Gift event |
| Ho-Oh | NavelRock_Top | MysticTicket Mystery Gift event |
| Lugia | NavelRock_B1F | MysticTicket Mystery Gift event |
| Jirachi | N/A (bonus disc) | Pokémon Channel / Colosseum bonus disc transfer |

**Sealed Chamber solution:** Requires Wailord in front slot + Relicanth in rear slot
of the party, then read all Braille inscriptions and use Dig at the correct tile.
This unlocks all three Regi caves simultaneously.

---

## 8. Region Notes

### Southern Island
Small island south of Hoenn. Home to Latios (if player is male) or Latias (female).
Accessed via Eon Ticket (Mystery Gift event item). One-time encounter, Level 50.
After capture, the other lati begins roaming Hoenn.

### Birth Island
Accessed via **Aurora Ticket** (Mystery Gift event). Map files: `BirthIsland_Exterior`,
`BirthIsland_Harbor`. Deoxys (Level 30) encountered after solving a block-pushing
puzzle with a triangle stone. Deoxys has a unique forme system on GBA: its forme
is determined by which game cartridge it is in (Attack/Defense/Speed in FRLG,
Normal in RSE/Emerald).

### Faraway Island
Accessed via **Old Sea Map** (Japan-only Mystery Gift event). Mew (Level 30) is found
in tall grass on a small island. The island has unique Braille text. Not included
in North American events. `data/maps/hoenn/` may contain `FarAwayIsland.json`.

### Navel Rock
Accessed via **MysticTicket** (Mystery Gift event). A large multi-floor island tower.
Map files: `NavelRock_Exterior`, `NavelRock_Harbor`, `NavelRock_Entrance`,
`NavelRock_Fork`, `NavelRock_Up1`–`Up4` (leads to Ho-Oh Lv 70),
`NavelRock_Down01`–`Down11`, `NavelRock_Bottom` (leads to Lugia Lv 70).
Both can be encountered, but only one can be caught without event exploitation.

### Weather-related region events
During the Groudon/Kyogre crisis (story chapter):
- All outdoor Hoenn maps switch to conflict weather (alternating harsh sun and heavy rain)
- This is a global weather state override, not per-map
- Resolves after Rayquaza descends

### Mirage Island (Route 130)
A rare island that only appears on certain days based on a daily random value matching
a value in the player's party Pokémon data. When visible, it contains a wild Wynaut
and the rare Leichi Berry. `MirageTower` (Route 111 desert) is separate — it appears
and disappears based on steps walked and contains fossil Pokémon.

### Rusturf Tunnel
Connects Route 116 (east of Rustboro) and Route 117 (west of Verdanturf). Initially
blocked by rocks; Rock Smash clears them and reunites Wanda with her boyfriend,
receiving HM Strength as thanks.

### Underwater maps
All `Underwater_Route*` and `Underwater_SeafloorCavern` maps are accessed via HM Dive
(surf over dark water patches). Underwater maps use a blue-tinted tileset and
contain seaweed (tall-grass equivalent for wild encounters).
Surfacing requires pressing A on light-shaded tiles.

---

*Last updated: 2026-06-10. Generated from `data/maps/hoenn/` (518 map files, sampled
LittlerootTown, Route101, MauvilleCity, SootopolisCity, SkyPillar_1F, RustboroCity,
LilycoveCity, EverGrandeCity, FortreeCity) plus canonical Emerald game knowledge.*
