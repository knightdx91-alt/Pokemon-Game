# Pokémon HeartGold — Game Reference Bible

> **Purpose:** Authoritative reference for the browser-based fan game that uses HeartGold as its Johto source. All map IDs, warp destinations, tilesets, and sprite names are sourced directly from the repo's extracted data (`data/maps/heartgold/`, `data/tilesets/`, `data/sprites/`). Game-knowledge sections (UI, systems, lore) are filled from canonical HeartGold documentation.

---

## 1. Overview

| Property | Value |
|----------|-------|
| Original platform | Nintendo DS (dual 256×192 screens) |
| Display layout | Top screen: overworld map / battle field. Bottom screen: Pokétch app suite (touch). |
| Regions | Johto (primary) + Kanto (post-game) |
| Total map files (extracted) | 491 JSON files in `data/maps/heartgold/` |
| Player characters | Ethan (male) / Lyra (female) — DS-style redesign of Gold/Kris |
| Unique mechanic | Following Pokémon — lead party member walks behind player on the overworld |
| Save slots | 1 (internal DS save; fan game should expand to ≥3 browser localStorage slots) |

### DS-to-Browser Adaptation Notes
- The DS bottom screen (Pokétch) must be adapted to a persistent HUD panel or a toggleable overlay.
- Touch-based inputs (party reordering, bag drag-drop) translate to click/tap events.
- Dual-screen battle layout (top = field, bottom = move menu) collapses to a single canvas with an overlay action bar.
- The 256-wide tile world uses 16×16 px tiles on hardware; scale freely in browser (recommended 2× or 3× integer scaling).

---

## 2. Map Catalog

### Naming Convention (extracted files)
Files follow the pattern `NNN_MAPID.json` where `NNN` is a zero-padded index and `MAPID` is the internal identifier:
- `T##` — Towns (T20=New Bark, T21=Cherrygrove, T22=Violet, T23=Azalea, T24=Cianwood, T25=Goldenrod, T26=Olivine, T27=Ecruteak, T28=Mahogany, T29=Lake of Rage area, T30=Blackthorn, T31=Mt Silver entrance; T01–T11 = Kanto towns)
- `R##` — Routes
- `D##` — Dungeons / caves / special interiors
- `W##` — Water/sea routes
- `P##` — Pokémon League / Victory Road area
- `HIROBA` — Pokéwalker plaza
- `TXXRYYYZZ` — Interiors of town TX, room type YYY, room index ZZ
  - `FS` = Fly spot / Pokémon Center (Flight-service), `GYM` = Gym, `PC` = Pokémon Center, `R` = general building room, `SP` = special

---

### 2.1 Towns & Cities — Johto

#### New Bark Town (`064_T20.json` group)
The starting town. Professor Elm's Lab is the main warp. No Gym. Home of the player character.

**Warps (from `058_T20R0101.json` etc.):**
- Professor Elm's Lab interior
- Player's house
- Neighbor's house (rival's house)

**Key interior map IDs referenced in warps:** `MAP_NEW_BARK_ELMS_LAB`, `MAP_NEW_BARK_PLAYERS_HOUSE_1F`

---

#### Cherrygrove City (`064_T21.json`)
First city east of New Bark. Guide Gent gives Running Shoes intro.

**Warps extracted:**
| Destination | Notes |
|-------------|-------|
| `MAP_CHERRYGROVE_POKECENTER_1F` | Pokémon Center |
| `MAP_CHERRYGROVE_POKEMART` | Poké Mart |
| `MAP_CHERRYGROVE_SOUTHWEST_HOUSE` | |
| `MAP_CHERRYGROVE_GUIDE_GENT_HOUSE` | Running Shoes tutorial |
| `MAP_CHERRYGROVE_SOUTHEAST_HOUSE` | |

**Hidden items:** Nugget ×2 (on beach tiles).

---

#### Violet City (`070_T22.json`)
First Gym city. Home of Sprout Tower and the Pokémon School.

**Warps extracted:**
| Destination | Notes |
|-------------|-------|
| `MAP_VIOLET_GYM` | Gym — Falkner, Flying-type |
| `MAP_SPROUT_TOWER_1F` | Dungeon — north of city |
| `MAP_VIOLET_POKEMON_SCHOOL` | |
| `MAP_VIOLET_POKECENTER_1F` | |
| `MAP_VIOLET_POKEMART` | |
| `MAP_VIOLET_BELLSPROUT_ONYX_TRADE_HOUSE` | Trade: Bellsprout ↔ Onix |
| `MAP_VIOLET_NORTHWEST_HOUSE` | |
| `MAP_ROUTE_31_VIOLET_GATEHOUSE` | East exit |
| `MAP_VIOLET_ROUTE_36_GATEHOUSE` | West exit |

**Hidden items:** Hyper Potion, Poké Ball.

---

#### Azalea Town (`071_T23.json`)
Second Gym city. Slowpoke Well Team Rocket event. Kurt's Poké Ball house.

**Warps extracted:**
| Destination | Notes |
|-------------|-------|
| `MAP_AZALEA_GYM_ENTRANCE` | Gym — Bugsy, Bug-type |
| `MAP_AZALEA_ILEX_FOREST_GATEHOUSE` | West exit to Ilex Forest |
| `MAP_AZALEA_POKECENTER_1F` | |
| `MAP_AZALEA_POKEMART` | |
| `MAP_AZALEA_KURT_HOUSE` | Kurt makes Apricorn Balls |
| `MAP_AZALEA_CHARCOAL_KILN` | Charcoal item/NPC |
| `MAP_SLOWPOKE_WELL_ENTRANCE` | Dungeon — Team Rocket event |

**Hidden items:** Full Heal.

---

#### Goldenrod City (`073_T25.json`)
Largest Johto city. Department Store, Radio Tower, Magnet Train Station, Game Corner, Global Terminal.

**Warps extracted:**
| Destination | Notes |
|-------------|-------|
| `MAP_GOLDENROD_GYM` | Gym — Whitney, Normal-type |
| `MAP_GOLDENROD_DEPARTMENT_STORE_1F` | 6-floor department store |
| `MAP_GOLDENROD_RADIO_TOWER_1F` | Team Rocket arc later |
| `MAP_GOLDENROD_GAME_CORNER` | Voltorb Flip (HeartGold) |
| `MAP_GOLDENROD_MAGNET_TRAIN_STATION_1F` | Train to Saffron City |
| `MAP_GOLDENROD_GLOBAL_TERMINAL_1F` | Wi-Fi/GTS building |
| `MAP_GOLDENROD_POKECENTER_1F` | |
| `MAP_GOLDENROD_BIKE_SHOP` | Free bicycle |
| `MAP_GOLDENROD_FLOWER_SHOP` | Morning/Evening gifts |
| `MAP_GOLDENROD_TUNNEL_1F` | Underground path (2 entrances) |
| `MAP_GOLDENROD_BILLS_HOUSE` | Bill gives Eevee |
| `MAP_GOLDENROD_NAME_RATER_HOUSE` | |
| `MAP_GOLDENROD_FRIENDSHIP_CHECKER_HOUSE` | |
| `MAP_GOLDENROD_NORTHEAST_HOUSE` | |
| `MAP_ROUTE_35_GOLDENROD_GATEHOUSE` | North exit |

**Hidden items:** Super Potion.

---

#### Ecruteak City (`075_T27.json`)
Historic city. Burned Tower (legendary beasts), Bell Tower (Ho-Oh), Kimono Girls Dance Theater.

**Warps extracted:**
| Destination | Notes |
|-------------|-------|
| `MAP_ECRUTEAK_GYM` | Gym — Morty, Ghost-type |
| `MAP_BURNED_TOWER_1F` | Dungeon — legendary beast release event |
| `MAP_ECRUTEAK_BELL_TOWER_BARRIER_STATION` | Gatehouse to Bell Tower |
| `MAP_ECRUTEAK_DANCE_THEATER` | Kimono Girls event |
| `MAP_ECRUTEAK_POKECENTER_1F` | |
| `MAP_ECRUTEAK_POKEMART` | |
| `MAP_ECRUTEAK_DOWSING_MACHINE_HOUSE` | Itemfinder gift |
| `MAP_ECRUTEAK_SOUTHWEST_HOUSE` | |
| `MAP_ROUTE_38_ECRUTEAK_GATEHOUSE` | West exit |
| `MAP_ROUTE_42_ECRUTEAK_GATEHOUSE` | East exit |

**Hidden items:** Hyper Potion, Ether, Rare Candy, Ultra Ball.

---

#### Olivine City (`074_T26.json`)
Port city. Lighthouse/Glitter Lighthouse. SS Aqua ferry dock. Jasmine must be rescued before Gym.

**Warps extracted:**
| Destination | Notes |
|-------------|-------|
| `MAP_OLIVINE_GYM` | Gym — Jasmine, Steel-type |
| `MAP_OLIVINE_LIGHTHOUSE_1F` | Glitter Lighthouse (multi-floor) |
| `MAP_OLIVINE_POKECENTER_1F` | |
| `MAP_OLIVINE_POKEMART` | |
| `MAP_OLIVINE_CAFE` | Lemonade quest for Jasmine |
| `MAP_OLIVINE_NORTHWEST_HOUSE` | |
| `MAP_OLIVINE_NORTH_HOUSE` | |
| `MAP_OLIVINE_NORTHEAST_HOUSE` | |
| `MAP_SS_AQUA_OLIVINE_PORT_INTERIOR` | SS Aqua dock |

**Hidden items:** Rare Candy, Full Heal.

---

#### Cianwood City (`072_T24.json`)
Western island city. Safari Zone nearby. Pharmacy for Jasmine's SecretPotion.

**Warps extracted:**
| Destination | Notes |
|-------------|-------|
| `MAP_CIANWOOD_GYM` | Gym — Chuck, Fighting-type |
| `MAP_CIANWOOD_PHARMACY` | SecretPotion for Jasmine |
| `MAP_CIANWOOD_POKECENTER_1F` | |
| `MAP_CIANWOOD_KIRKS_HOUSE` | HM Fly gift |
| `MAP_CIANWOOD_CENTRAL_HOUSE` | |
| `MAP_CIANWOOD_CAMERONS_HOUSE` | Photo/Pokémon photo NPC |
| `MAP_CIANWOOD_NORTH_HOUSE` | |
| `MAP_CLIFF_EDGE_GATE` | North gate |

**Hidden items:** Revive, Stardust.

---

#### Mahogany Town (`084_T28.json`)
Small town. Rocket Hideout under the Souvenir Shop. Lake of Rage nearby.

**Warps extracted:**
| Destination | Notes |
|-------------|-------|
| `MAP_MAHOGANY_GYM_ROOM_1` | Gym — Pryce, Ice-type |
| `MAP_MAHOGANY_POKECENTER_1F` | |
| `MAP_MAHOGANY_SOUVENIR_SHOP` | Hidden entrance to Rocket Hideout |
| `MAP_MAHOGANY_EAST_HOUSE` | |
| `MAP_ROUTE_43_MAHOGANY_GATEHOUSE` | North exit to Lake of Rage |

---

#### Lake of Rage area (`085_T29.json`)
Not a town proper — the Lake of Rage exterior. Red Gyarados event. Lance appears here.

**Warps:** Hidden Power house, Fishing Guru house.
**Hidden items:** Full Restore, Rare Candy, Max Potion.

---

#### Blackthorn City (`086_T30.json`)
Final Johto Gym city. Dragon's Den behind the Gym. Move Tutor house.

**Warps extracted:**
| Destination | Notes |
|-------------|-------|
| `MAP_BLACKTHORN_GYM` | Gym — Clair, Dragon-type |
| `MAP_DRAGONS_DEN_ENTRANCE` | Dragon's Den dungeon |
| `MAP_ICE_PATH_1F` | Ice Path connects west |
| `MAP_BLACKTHORN_POKECENTER_1F` | |
| `MAP_BLACKTHORN_POKEMART` | |
| `MAP_BLACKTHORN_MOVE_TUTOR_HOUSE` | Draco Meteor tutor |
| `MAP_BLACKTHORN_WEST_HOUSE` | |
| `MAP_BLACKTHORN_EAST_HOUSE` | |

---

#### Mt Silver Entrance (`087_T31.json`)
Single-building "town" — Pokémon Center only. Gateway to Mt Silver (post-game). Red is at the summit.

**Warps:** `MAP_MOUNT_SILVER_CAVE_1F`, `MAP_MOUNT_SILVER_POKECENTER_1F`.
**Hidden items:** Full Restore.

---

### 2.2 Towns & Cities — Kanto (post-game)

Kanto towns use the `T01`–`T11` prefix. All are reachable after defeating the Elite Four.

| Map ID | Town | Gym Leader | Type | Key Warps |
|--------|------|------------|------|----------|
| `046_T01` | Pallet Town | — (no gym) | — | Red's House, Blue's House, Oak's Lab |
| `047_T02` | Viridian City | Blue | Mixed (post-game) | Gym, Trainer House, Poké Mart, Pokémon Center, Route 1 gatehouse |
| `048_T03` | Pewter City | Brock | Rock | Museum, Gym, Poké Mart, Pokémon Center |
| `049_T04` | Cerulean City | Misty | Water | Gym, Pokémon Center, Poké Mart, Bill's House |
| `050_T05` | Lavender Town | — (no gym) | — | Pokémon Center, Volunteer House, House of Memories, Name Rater, Radio Station |
| `051_T06` | Vermilion City | Lt. Surge | Electric | Gym, Pokémon Center, Poké Mart, Fan Club |
| `052_T07` | Celadon City | Erika | Grass | Gym, Department Store, Game Corner, Pokémon Center, Condominiums |
| `053_T08` | Fuchsia City | Janine | Poison | Gym, Safari Zone building, Pokémon Center, Warden's House |
| `054_T09` | Saffron City (minimal) | — | — | Pokémon Center |
| `055_T10` | Cinnabar Island | Blaine | Fire | Gym (Seafoam Islands relocated), Pokémon Center |
| `056_T11` | Saffron City (full) | Sabrina | Psychic | Gym, Silph Co., Magnet Train Station, Copycat House, Fighting Dojo, Poké Mart, Pokémon Center |

> Note: `T09` and `T11` both cover aspects of Saffron — `T09` appears to be a reduced shell while `T11` is the full city file with all warps.

---

### 2.3 Routes — Johto

Johto routes use the `R29`–`R48` numbering (continuing from Kanto's R1–R28).

| File ID | Route | Connects | Notable |
|---------|-------|----------|---------|
| `030_R29` | Route 29 | New Bark ↔ Cherrygrove | Starter route; Route 46 gatehouse |
| `031_R30` | Route 30 | Cherrygrove north | Mr. Pokémon's House, Route 31 junction |
| `032_R31` | Route 31 | Cherrygrove ↔ Violet (east gate) | Pokémon Center room |
| `033_R32` | Route 32 | Violet south | Ruins of Alph nearby; Pokémon Center |
| `034_R33` | Route 33 | Azalea (north) | Connects to Ilex Forest gatehouse |
| `035_R34` | Route 34 | Goldenrod south | Day Care Center |
| `036_R35` | Route 35 | Goldenrod north | Goldenrod gatehouse |
| `037_R36` | Route 36 | Violet west / Ruins of Alph | Sudowoodo blocking path |
| `038_R37` | Route 37 | Ecruteak south | Berry trees |
| `039_R38` | Route 38 | Ecruteak west | Ecruteak gatehouse; connects to Olivine area |
| `040_R39` | Route 39 | Olivine north | Miltank farm; connects to Ecruteak |
| `041_R42` | Route 42 | Ecruteak east | Mt. Mortar; Ecruteak gatehouse |
| `042_R43` | Route 43 | Mahogany north | Mahogany gatehouse; Lake of Rage |
| `043_R44` | Route 44 | Mahogany east | Ice Path entrance area |
| `044_R45` | Route 45 | Blackthorn south | Steep rocky descent |
| `045_R46` | Route 46 | New Bark / Route 29 junction | Route 29 gatehouse |
| `146_R47` | Route 47 | Cianwood area | Cliff Cave; Safari Zone |
| `147_R48` | Route 48 | Cianwood north | Safari Zone entrance |

---

### 2.4 Routes — Kanto

| File ID | Route | Connects |
|---------|-------|----------|
| `006_R01` | Route 1 | Pallet ↔ Viridian; Viridian gatehouse |
| `007_R02` | Route 2 | Viridian ↔ Pewter; Pokémon Center |
| `008_R03` | Route 3 | Pewter east |
| `009_R04` | Route 4 | Cerulean east; Mt. Moon |
| `010_R05` | Route 5 | Cerulean south; Saffron gatehouse |
| `011_R06` | Route 6 | Vermilion north; Saffron gatehouse |
| `012_R07` | Route 7 | Celadon east; Saffron gatehouse |
| `013_R08` | Route 8 | Lavender west; Saffron gatehouse |
| `014_R09` | Route 9 | Cerulean east |
| `015_R10` | Route 10 | Cerulean east (south section); Pokémon Center |
| `016_R11` | Route 11 | Vermilion east |
| `017_R12` | Route 12 | Lavender south; Silence Bridge |
| `018_R13` | Route 13 | Fuchsia west |
| `019_R14` | Route 14 | Fuchsia north |
| `020_R15` | Route 15 | Fuchsia west; Saffron gatehouse |
| `021_R16` | Route 16 | Celadon west; Cycling Road; Pokémon Center |
| `022_R17` | Route 17 | Cycling Road |
| `023_R18` | Route 18 | Fuchsia west end |
| `024_R22` | Route 22 | Viridian west; Victory Road gatehouse |
| `025_R24` | Route 24 | Cerulean north; Nugget Bridge |
| `026_R25` | Route 25 | Bill's Lighthouse area |
| `027_R26` | Route 26 | Victory Road east; Pokémon Center |
| `028_R27` | Route 27 | Victory Road north; connects Johto border |
| `029_R28` | Route 28 | Mt. Silver approach |

---

### 2.5 Water Routes

| File ID | Map | Notes |
|---------|-----|-------|
| `088_W19` | Whirl Islands outer sea | Surf route; Whirl Island dungeon entrance |
| `089_W20` | Sea east of Olivine | Surf to Cianwood |
| `090_W21` | Sea west of Cianwood | |
| `091_W40` | Sea near Kanto | |
| `092_W41` | Sea near Kanto | |

---

### 2.6 Dungeons & Special Areas

Dungeon files use the `D##` prefix. Room variants are named `D##R####.json`.

| Base ID | Location | Region | Key notes |
|---------|----------|--------|-----------|
| D01 | Sprout Tower | Johto | 3 floors; Sage trainers; HM Flash |
| D02 | Ruins of Alph | Johto | Unown puzzles; multiple chambers |
| D03 | Dark Cave | Johto | R31/R45 entrance; Quagsire |
| D05 | Mt. Mortar | Johto | R42 area; Tyrogue reward |
| D10 | Ilex Forest | Johto | Cut required; Farfetch'd; Celebi shrine |
| D11 | Slowpoke Well | Johto | Team Rocket event; B1F/B2F |
| D15 | Union Cave | Johto | R32/R33 connector; Lapras Fridays |
| D17 | Tin Tower (Bell Tower) | Johto | 10 floors; Ho-Oh encounter; Clear Bell |
| D18 | Burned Tower | Johto | 2 floors; beast release cutscene |
| D22 | Rocket Hideout | Johto | Under Mahogany Souvenir Shop; B1F-B3F |
| D23 | Radio Tower interior | Johto | Team Rocket takeover event; 5 floors |
| D24 | Ruins of Alph interiors | Johto | 16+ chamber variants (D24R0101–D24R0218) |
| D25 | Goldenrod Tunnel | Johto | Underground path beneath Goldenrod |
| D26 | Goldenrod Department Store | Johto | 6 floors + roof |
| D27 | Goldenrod Radio Tower | Johto | 5 floors |
| D31 | Dragons Den | Johto | Underwater shrine; Dragon Quiz |
| D32 | Victory Road | Kanto/border | Multi-floor; Pokémon Center rooms |
| D35 | Diglett's Cave | Kanto | R2/R11 connector |
| D36 | Rock Tunnel | Kanto | R9/R10; dark without Flash |
| D37 | Power Plant | Kanto | R10 area; Zapdos encounter |
| D38 | Cerulean Cave | Kanto | Post-game; Mewtwo encounter |
| D39 | Seafoam Islands | Kanto | R19/R20; Articuno encounter |
| D40 | Mt. Moon | Kanto | R3/R4 connector; Clefairy Moon Stone |
| D41 | Silph Co. | Kanto | 11 floors; in Saffron City |
| D42 | Pokémon Tower | Kanto | Lavender Town; Ghost; Mr. Fuji |
| D43 | Safari Zone | Johto | Customizable blocks; area system |
| D44 | Ice Path | Johto | R44/Blackthorn connector; HM Whirlpool |
| D45 | Whirl Islands | Johto | W19; Lugia encounter; 4 islands |
| D46 | Mt. Silver Cave | Johto/border | Post-game; Red at summit |
| D47 | Lake of Rage (interior) | Johto | Red Gyarados; Lance event |
| D48 | Cliff Cave | Johto | R47 area |
| D49 | Goldenrod Global Terminal | Johto | GTS/Wi-Fi; 7 floors |
| D50 | Pokéwalker Exchange | — | Special exchange room |
| D51 | Battle Frontier (area A) | Johto | Post-game facility |
| D52 | Battle Frontier (area B) | Johto | Post-game facility |

---

### 2.7 Interiors (naming pattern)

Interior maps follow `T##XXXNNNN.json` where `XXX` is the building type and `NNNN` is a 4-digit floor/room index.

**Building type codes:**
| Code | Meaning |
|------|---------|
| `PC` | Pokémon Center (1F, 2F, etc.) |
| `GYM` | Gym (room 1, 2, etc.) |
| `FS` | Fly destination / side house |
| `R` | Generic room / shop / house |
| `SP` | Special (e.g. Battle Frontier) |

**Examples from the dataset:**
- `T25PC0101` / `T25PC0102` — Goldenrod Pokémon Center floors
- `T25GYM0101` — Goldenrod Gym
- `T27GYM0101` — Ecruteak Gym
- `T25R0101`–`T25R1203` — Goldenrod buildings (Bike Shop, Flower Shop, Department Store floors, Radio Tower floors, Game Corner, Tunnel, etc.)
- `T21FS0101` — Cherrygrove Fly-service side building (warp back to `MAP_CHERRYGROVE`)
- `T07R0101`–`T07R0207` — Celadon buildings (Department Store floors, Game Corner, condominiums, etc.)
- `T10R0101`–`T10R0801` — Cinnabar / Seafoam area rooms

---

### 2.8 Pokémon League / Victory Road

| File ID | Map | Notes |
|---------|-----|---------|
| `226_P01R0101` | Indigo Plateau (League) | Elite Four entrance |
| `278_P01R0301`–`P01R0307` | Elite Four rooms | Will, Koga, Bruno, Karen chambers |
| `301_P01R0102` | Champion's room | Lance |
| `343_P01R0103`–`P01R0104` | Hall of Fame / post-battle | |
| `299_P01R0306` | Victory Road interiors | |

---

## 3. Warp & Connection Graph

### Johto Main Route
```
New Bark Town
  → Route 29 → Cherrygrove City
  → Route 30/31 → Violet City
      ↕ Sprout Tower (D01)
  → Route 32 → Ruins of Alph (D02/D24)
  → Union Cave (D15) → Route 33 → Azalea Town
      ↕ Slowpoke Well (D11)
  → Ilex Forest (D10) → Route 34 → Goldenrod City
      ↕ Magnet Train → Saffron City (Kanto)
  → Route 35/36 → National Park → Route 37 → Ecruteak City
      ↕ Burned Tower (D18) / Bell Tower (D17)
  → Route 38/39 → Olivine City
      ↕ Glitter Lighthouse
      ↕ SS Aqua → Vermilion City (Kanto, ticket required)
  Route 40/41 → Cianwood City (Surf required)
      ↕ Safari Zone (D43)
  Route 42 → Mt. Mortar (D05) → Mahogany Town
      ↕ Rocket Hideout (D22)
  → Route 43 → Lake of Rage (D47/T29)
  → Route 44 → Ice Path (D44) → Blackthorn City
      ↕ Dragon's Den (D31)
  → Route 45/46 → New Bark Town (loop)
```

### Johto → Kanto Transitions
1. **Magnet Train** (Goldenrod Station ↔ Saffron Station): fastest method; requires Pass item.
2. **Walking**: Route 27 → Route 26 → Victory Road (D32) → Indigo Plateau → Route 22 → Viridian City.
3. **SS Aqua ferry**: Olivine port ↔ Vermilion port (ticket required, periodic schedule).

### Mt. Silver Position
Mt. Silver sits at the Johto/Kanto border. Entrance via Route 28 (Kanto side). Red waits at the summit (D46 upper floors).

---

## 4. Tileset Catalog

All tilesets are in `data/tilesets/` as PNG+JSON pairs. The set appears to be drawn from FireRed/LeafGreen DS-era style (matching the Kanto post-game visual theme). Johto-specific tilesets are not separately listed — they likely share the base set or are embedded in the layout files.

### Confirmed Tilesets (from `data/tilesets/`)

| Tileset file (base name) | Likely usage |
|--------------------------|--------------|
| `pallet_town` | Pallet Town / small town exterior |
| `viridian_city` | Viridian City exterior |
| `pewter_city` | Pewter City exterior |
| `cerulean_city` | Cerulean City exterior |
| `vermilion_city` | Vermilion City exterior |
| `lavender_town` | Lavender Town exterior |
| `celadon_city` | Celadon City exterior |
| `fuchsia_city` | Fuchsia City exterior |
| `saffron_city` | Saffron City exterior |
| `cinnabar_island` | Cinnabar Island exterior |
| `indigo_plateau` | Indigo Plateau / League |
| `pokemon_center` | Pokémon Center interior (universal) |
| `mart` | Poké Mart interior |
| `lab` | Professor's Lab interior |
| `cave` | Generic cave interior |
| `rock_tunnel` | Rock Tunnel |
| `cerulean_cave` | Cerulean Cave (Mewtwo) |
| `seafoam_islands` | Seafoam Islands |
| `digletts_cave` | Diglett's Cave |
| `viridian_forest` | Viridian Forest |
| `mt_ember` | Mt. Ember (Sevii Islands) |
| `navel_rock` | Navel Rock (event island) |
| `pokemon_tower` | Pokémon Tower / ghost tower |
| `silph_co` | Silph Co. interior |
| `department_store` | Department Store interior |
| `game_corner` | Game Corner interior |
| `safari_zone_building` | Safari Zone building |
| `berry_forest` | Berry Forest (Sevii) |
| `ss_anne` | SS Anne / SS Aqua interior |
| `pokemon_mansion` | Pokémon Mansion |
| `power_plant` | Power Plant |
| `pokemon_league` | Elite Four / League interior |
| `hall_of_fame` | Hall of Fame |
| `underground_path` | Underground path/tunnel |
| `condominiums` | Celadon Condominiums |
| `museum` | Pewter Museum |
| `school` | Pokémon School |
| `restaurant_hotel` | Restaurant / hotel interior |
| `cable_club` | Cable Club / link room |
| `bike_shop` | Bike Shop interior |
| `burgled_house` | Burgled house (Cerulean) |
| `fan_club_daycare` | Fan Club / Day Care interior |
| `sea_cottage` | Sea Cottage (Bill) |
| `island_harbor` | Island harbor exterior |
| `tanoby_ruins` | Tanoby Ruins (Sevii) |
| `trainer_tower` | Trainer Tower |
| `hoenn_building` | Hoenn-style building |
| `generic_building_1` | Generic interior A |
| `generic_building_2` | Generic interior B |
| `sevii_islands_123` | One Island / Two Island / Three Island |
| `sevii_islands_45` | Four Island / Five Island |
| `sevii_islands_67` | Six Island / Seven Island |
| `cerulean_gym` | Cerulean Gym |
| `pewter_gym` | Pewter Gym |
| `vermilion_gym` | Vermilion Gym |
| `celadon_gym` | Celadon Gym |
| `fuchsia_gym` | Fuchsia Gym |
| `saffron_gym` | Saffron Gym |
| `cinnabar_gym` | Cinnabar Gym |
| `viridian_gym` | Viridian Gym |

> **Implementation note:** Each tileset JSON describes tile properties (passability, encounter rate tiles, etc.). Load `<name>.json` alongside `<name>.png`. Johto-specific exterior tilesets (New Bark, Goldenrod, Ecruteak, etc.) will need to be added — the current set covers Kanto exteriors and shared interiors.

---

## 5. Sprite Manifest

### 5.1 NPC Graphics IDs

All NPC sprites are in `data/sprites/npcs/`. 97 files total (96 PNGs + 1 `index.json`).

#### Gym Leaders & Elite Four
| File | Character |
|------|-----------|
| `brock.png` | Brock (Pewter Gym) |
| `misty.png` | Misty (Cerulean Gym) |
| `lt_surge.png` | Lt. Surge (Vermilion Gym) |
| `erika.png` | Erika (Celadon Gym) |
| `koga.png` | Koga (Elite Four / Fuchsia Gym FRLG) |
| `sabrina.png` | Sabrina (Saffron Gym) |
| `blaine.png` | Blaine (Cinnabar Gym) |
| `giovanni.png` | Giovanni (Viridian Gym / Rocket boss) |
| `lorelei.png` | Lorelei (Elite Four) |
| `bruno.png` | Bruno (Elite Four) |
| `agatha.png` | Agatha (Elite Four) |
| `lance.png` | Lance (Champion / Johto ally) |
| `blue.png` | Blue (Viridian Gym, post-game) |

#### Key Story NPCs
| File | Character |
|------|-----------|
| `prof_oak.png` | Professor Oak |
| `bill.png` | Bill |
| `mr_fuji.png` | Mr. Fuji |
| `mom.png` | Player's Mom |
| `daisy.png` | Daisy (Blue's sister) |
| `celio.png` | Celio (One Island) |
| `mg_deliveryman.png` | Mystery Gift deliveryman |
| `teachy_tv_host.png` | Teachy TV host |
| `trainer_tower_dude.png` | Trainer Tower guide |
| `union_room_receptionist.png` | Union Room receptionist |
| `cable_club_receptionist.png` | Cable Club receptionist |

#### Player Overworld Sprites
| File | Character / State |
|------|-------------------|
| `red_normal.png` | Ethan/Red — walking |
| `red_bike.png` | Ethan/Red — on bicycle |
| `red_surf.png` | Ethan/Red — surfing |
| `red_surf_run.png` | Ethan/Red — surf (running) |
| `red_fish.png` | Ethan/Red — fishing |
| `red_item.png` | Ethan/Red — picking up item |
| `red_vs_seeker_bike.png` | Ethan/Red — Vs. Seeker on bike |
| `green_normal.png` | Lyra/Green — walking |
| `green_bike.png` | Lyra/Green — on bicycle |
| `green_surf.png` | Lyra/Green — surfing |
| `green_surf_run.png` | Lyra/Green — surf (running) |
| `green_fish.png` | Lyra/Green — fishing |
| `green_item.png` | Lyra/Green — picking up item |
| `green_vs_seeker_bike.png` | Lyra/Green — Vs. Seeker on bike |

#### Rival
| File | Character |
|------|-----------|
| `rs_brendan.png` | Silver (male rival sprite, FRLG-RS style) |
| `rs_may.png` | Kris/rival female sprite |

#### Generic Trainer Classes
| File | Trainer Class |
|------|---------------|
| `youngster.png` | Youngster |
| `lass.png` | Lass |
| `bug_catcher.png` | Bug Catcher |
| `hiker.png` | Hiker |
| `camper.png` | Camper |
| `picnicker.png` | Picnicker |
| `fisher.png` | Fisher |
| `swimmer_f_land.png` | Swimmer (F, on land) |
| `swimmer_f_water.png` | Swimmer (F, in water) |
| `swimmer_m_land.png` | Swimmer (M, on land) |
| `swimmer_m_water.png` | Swimmer (M, in water) |
| `black_belt.png` | Black Belt |
| `beauty.png` | Beauty |
| `crush_girl.png` | Crush Girl |
| `cooltrainer_f.png` | Cool Trainer (F) |
| `cooltrainer_m.png` | Cool Trainer (M) |
| `biker.png` | Biker |
| `rocker.png` | Rocker |
| `poke_maniac.png` | PokéManiac |
| `scientist.png` | Scientist |
| `gentleman.png` | Gentleman |
| `rich_boy.png` | Rich Boy |
| `sailor.png` | Sailor |
| `captain.png` | Captain |
| `tuber_f.png` | Tuber (F) |
| `tuber_m_land.png` | Tuber (M, land) |
| `tuber_m_water.png` | Tuber (M, water) |
| `channeler.png` | Channeler |
| `rocket_m.png` | Team Rocket Grunt (M) |
| `rocket_f.png` | Team Rocket Grunt (F) |
| `gym_guy.png` | Gym guide |
| `cameraman.png` | Cameraman |

#### Civilians
| File | Type |
|------|------|
| `man.png` | Generic adult man |
| `woman_1.png` | Generic woman (variant 1) |
| `woman_2.png` | Generic woman (variant 2) |
| `woman_3.png` | Generic woman (variant 3) |
| `old_man_1.png` | Old man (variant 1) |
| `old_man_2.png` | Old man (variant 2) |
| `old_man_lying_down.png` | Old man lying down (Route 2 sleeping man) |
| `old_woman.png` | Old woman |
| `boy.png` | Generic boy |
| `little_boy.png` | Small boy |
| `little_girl.png` | Small girl |
| `fat_man.png` | Fat man |
| `balding_man.png` | Balding man |
| `sitting_boy.png` | Seated boy |
| `nurse.png` | Nurse Joy |
| `clerk.png` | Poké Mart clerk |
| `chef.png` | Chef |
| `policeman.png` | Policeman |
| `worker_m.png` | Male worker |
| `worker_f.png` | Female worker |
| `gba_kid.png` | GBA-playing kid |
| `unused_male_receptionist.png` | Unused NPC |
| `unused_man.png` | Unused NPC |
| `unused_woman.png` | Unused NPC |

---

### 5.2 Player Sprite — Ethan / Lyra (DS style)

`data/sprites/player.png` — single file for the chosen player character.

- DS overworld sprite: small chibi style, 16×16 base tile but rendered at higher internal resolution.
- 4-directional walking: down (south), up (north), left, right.
- Each direction has a 4-frame walk cycle (left-foot, neutral, right-foot, neutral) + 1 idle frame.
- Additional states: bicycle, surfing, fishing, item-get. These are separate sprite files in the NPC folder prefixed `red_` / `green_`.
- **Browser adaptation:** Load all direction strips from a single spritesheet or individual state PNGs. Recommend a unified spritesheet with rows = states, columns = frames.

---

### 5.3 Following Pokémon Sprite System (HeartGold unique feature)

In HeartGold, the lead Pokémon follows the player on the overworld. This is one of the game's signature features.

**How it works:**
- The following Pokémon is always 1 tile behind the player, mirroring the player's last facing direction.
- It has its own idle animation (2-frame loop) and a walk animation matching the player's movement speed.
- The Pokémon can be talked to (A button while facing it) — it gives a happiness-based message.
- Special event: at Bell Tower, the following Pokémon interacts with Ho-Oh's event trigger.
- The Pokémon is rendered between the player layer and the object layer (behind the player sprite, in front of the floor).

**Sprite format (original DS):**
- Each Pokémon has a 32×32 overworld sprite (or 48×48 for large Pokémon).
- The sprite sheet includes: front-walk (2 frames) + back-walk (implied mirror) + idle.
- All 493 Pokémon (Gen I–IV, plus Rotom forms etc.) have overworld sprites in HG.

**Browser implementation notes:**
- Store following Pokémon sprites in `data/sprites/pokemon/overworld/` (to be created).
- On each player move: update follower position to player's previous tile, face same direction player was facing.
- On player stop: follower idles after 1-step lag.
- Collision: follower does not block the player; player walks through it.

---

### 5.4 Pokémon Sprites

**Battle sprites (DS style):**
- Front sprite: shown for opponent's Pokémon and in the party menu.
- Back sprite: shown for player's Pokémon during battle.
- DS resolution: roughly 80×80 px for front, 64×64 for back (upscaled from 40×30 DS pixels).
- HeartGold uses Gen IV sprite art (same as Diamond/Pearl/Platinum) with some improvements.
- Recommended storage: `data/sprites/pokemon/front/<dex_number>.png`, `data/sprites/pokemon/back/<dex_number>.png`.
- Shiny variants: `data/sprites/pokemon/front/shiny/<dex_number>.png`.

**Icon sprites (party menu):**
- 32×32 animated icons (2-frame bounce cycle) used in the party screen, bag, and status displays.
- Recommended storage: `data/sprites/pokemon/icons/<dex_number>.png`.

---

## 6. UI & Menu Reference

### 6.1 Start Menu

Opened with the Start button (or equivalent browser key / hamburger button).

**Menu items (in order):**
1. Pokédex
2. Pokégear
3. Pokémon (party screen)
4. Bag
5. Player Card (trainer info)
6. Save
7. Options
8. Exit (closes menu)

**Visual style:** Dark blue overlay panel, right-aligned. Cursor highlights items in yellow. Player name, Johto badge count, and playtime shown at top.

---

### 6.2 Battle UI — DS Dual-Screen Layout

**Top screen (field):**
- Opponent's Pokémon sprite (front, large) — upper left.
- Opponent's HP bar, name, level, gender icon — upper right.
- Player's Pokémon sprite (back, large) — lower right.
- Player's HP bar, name, level, HP numbers, XP bar — lower left.
- Animated battle background matches zone tileset.
- Status conditions displayed as colored icons on the HP bar.

**Bottom screen (action menu — touch):**
- 4 large touch buttons arranged in a 2×2 grid:
  - **FIGHT** — opens move selection
  - **BAG** — opens bag in battle
  - **POKÉMON** — opens party for switching
  - **RUN** — attempt to flee
- On FIGHT: 4 move buttons displayed (each shows move name, PP, type badge). Touch to select.
- In double battles: same layout, second Pokémon's action resolves after first.

**Browser adaptation:**
- Collapse to single canvas. Top area = field. Bottom area = action bar.
- Touch/click on action buttons.
- Show move type color badge and remaining PP on each move button.
- Animate sprite entrance (slide in from sides) and faint (fall down + fade).

---

### 6.3 Dialogue Box

- Fixed to the bottom of the top screen (or bottom screen depending on context).
- 2-line text display, proportional font, white text on dark blue/black box.
- Typewriter effect: ~2–3 characters per frame (adjustable in Options → Text Speed).
- Arrow indicator in bottom-right corner pulses to prompt button press.
- Portraits: not used in HG overworld dialogue (unlike later games). Speaker name may appear above box.
- Choice prompts: a small bordered box appears above the dialogue box with selectable options (up/down cursor + A to confirm, B to cancel).

---

### 6.4 Party Screen

- 6 party slots displayed as panels. Each panel shows: Pokémon icon, nickname, level, HP bar, status icon, held item icon.
- Touch to select a Pokémon. Brings up action submenu: Summary / Switch / Item / Cancel.
- Drag-and-drop reordering is available (touch/mouse).
- Following Pokémon indicator: a small footprint icon or paw symbol marks the lead Pokémon (the follower).
- In battle, fainted Pokémon panels are greyed out. "Send Out" button replaces "Switch" for the first valid Pokémon.

---

### 6.5 Bag

HeartGold bag uses 5 pocket tabs (icons across the top of the screen):

| Pocket | Contents |
|--------|----------|
| Items | Poké Balls, medicine, battle items, repels, vitamins, Berries |
| Key Items | Key items (Bicycle, Running Shoes, Town Map, HM items, tickets, etc.) |
| TM/HM | All Technical and Hidden Machines |
| Mail | Mail items |
| Treasures | Sellable items (Nuggets, Star Pieces, etc.) |

- Items within each pocket are listed alphabetically. Quantity shown.
- Select item → Use / Give / Toss / Cancel.
- In battle only Items pocket is accessible (no TM/HM use in battle).

---

### 6.6 Pokédex

- Top screen: Pokémon list with icons (seen = silhouette, caught = color).
- Bottom screen: area map showing habitat / obtained location.
- Search filters: type, name (keyboard), A-Z or National Dex order.
- Entry view: front sprite, description text (2 paragraphs), height/weight, type badges, footprint.
- Johto Dex order (152 entries, Chikorita #152 → Celebi) shown first; National Dex (493) unlocked after obtaining National Pokédex upgrade from Professor Oak post-E4.

---

### 6.7 Pokégear

A multi-function device given to the player early in the game. Opens from the Start Menu.

**Tabs:**

| Tab | Function |
|-----|----------|
| Phone | Call registered trainers / Mom / Professor Elm. Trainers call to rematch or give tips. |
| Map | Johto/Kanto region map. Shows player location (flashing icon). Town names labeled. Route numbers shown. |
| Radio | Tunes to radio stations by frequency (bottom-screen dial). Affects wild Pokémon music, events (Pokéflute channel wakes Snorlax at 8:00–9:00, Buena's Password gives BP). |
| Clock | Displays current in-game time and day of week. Time affects Pokémon availability, events, and day/night cycle. |

**Browser adaptation:**
- Pokégear is a modal overlay (full screen or large panel).
- Phone: show contact list, tap to call, display scrolling dialogue.
- Map: render region tile map with player marker.
- Radio: slider or frequency input widget; play looping audio track for selected station.
- Clock: read system clock or game clock variable.

---

### 6.8 Pokétch (Bottom Screen Persistent HUD)

The Pokétch is unique to HeartGold/SoulSilver and runs on the bottom DS screen permanently while the bottom screen is active. It cycles through apps via left/right arrow buttons.

**Pokétch Apps (in order, unlocked progressively):**

| # | App Name | Function |
|---|----------|----------|
| 01 | Digital Watch | Displays in-game time |
| 02 | Calculator | Basic arithmetic |
| 03 | Memo Pad | Touch-draw free notes |
| 04 | Pedometer | Step counter |
| 05 | Pokémon List | Party HP bars (quick glance) |
| 06 | Friendship Checker | Displays lead Pokémon happiness as hearts |
| 07 | Dowsing Machine | Radar for hidden items (pulsing dots) |
| 08 | Berry Searcher | Shows Berry locations on map |
| 09 | Day-Care Checker | Shows Day Care Pokémon and egg status |
| 10 | Pokémon History | Last 12 Pokémon caught |
| 11 | Counter | Tap counter (tracks things manually) |
| 12 | Analog Watch | Analog clock face |
| 13 | Marking Map | Region map with sticker markers |
| 14 | Link Searcher | Detects nearby wireless players |
| 15 | Coin Toss | Randomizer |
| 16 | Move Tester | Calculates type effectiveness |
| 17 | Calendar | In-game calendar with event markers |
| 18 | Dot Artist | Pixel art drawing app |
| 19 | Roulette | 2-section or 6-section spin wheel |
| 20 | Trainer Counter | Counts trainer battles |
| 21 | Kitchen Timer | Countdown timer |
| 22 | Color Changer | Changes Pokétch background color |
| 23 | Matchup Checker | Breeding compatibility |
| 24 | Stop Watch | Stopwatch |
| 25 | Alarm Clock | Sets in-game alarm |

**Browser adaptation:**
- The Pokétch becomes a collapsible sidebar or bottom panel.
- Implement the most-used apps first: Pokémon List (05), Dowsing Machine (07), Day-Care Checker (09), Marking Map (13), Move Tester (16).
- Analog/Digital Watch apps should read the game clock.

---

### 6.9 Options Menu

| Option | Values |
|--------|--------|
| Text Speed | Slow / Mid / Fast |
| Battle Scene | On / Off (toggle battle animations) |
| Battle Style | Shift / Set (Set = no prompt to switch after KO) |
| Sound | Mono / Stereo |
| Pokétch | On / Off (hide/show bottom screen app) |
| Frame | 1–8 (dialogue box border art) |
| Button Mode | Help / LR / L=A (control remapping presets) |

---

## 7. Key Game Systems

### 7.1 Gym Progression

#### Johto Gyms (8 badges → Elite Four)

| Order | Badge | Gym Location | Leader | Type | Required HM/Item |
|-------|-------|--------------|--------|------|------------------|
| 1 | Zephyr Badge | Violet City | Falkner | Flying | — |
| 2 | Hive Badge | Azalea Town | Bugsy | Bug | Cut (to reach Ilex) |
| 3 | Plain Badge | Goldenrod City | Whitney | Normal | — |
| 4 | Fog Badge | Ecruteak City | Morty | Ghost | Surf (to Cianwood) |
| 5 | Storm Badge | Cianwood City | Chuck | Fighting | Surf; SecretPotion for Jasmine |
| 6 | Mineral Badge | Olivine City | Jasmine | Steel | Surf + SecretPotion from Cianwood |
| 7 | Glacier Badge | Mahogany Town | Pryce | Ice | Surf; clear Rocket Hideout |
| 8 | Rising Badge | Blackthorn City | Clair | Dragon | Whirlpool; Dragon Quiz |

**Post-Johto:** Earn all 8 Johto badges → Elite Four (Victory Road) → Champion Lance. Then Kanto opens.

#### Kanto Gyms (8 more badges → Red)

| Order (suggested) | Badge | Gym Location | Leader | Type |
|-------------------|-------|--------------|--------|------|
| 9 | Boulder Badge | Pewter City | Brock | Rock |
| 10 | Cascade Badge | Cerulean City | Misty | Water |
| 11 | Thunder Badge | Vermilion City | Lt. Surge | Electric |
| 12 | Rainbow Badge | Celadon City | Erika | Grass |
| 13 | Soul Badge | Fuchsia City | Janine | Poison |
| 14 | Marsh Badge | Saffron City | Sabrina | Psychic |
| 15 | Volcano Badge | Cinnabar Island | Blaine | Fire |
| 16 | Earth Badge | Viridian City | Blue | Mixed |

**After all 16 badges:** Professor Oak gives permission to enter Mt. Silver → Red battle.

---

### 7.2 Team Rocket Return Arc

Team Rocket makes two major appearances in HeartGold:

1. **Slowpoke Well (Azalea):** Grunts cutting Slowpoke tails for profit. Defeat them all → Bugsy becomes accessible.
2. **Mahogany Radio Tower arc (mid-game, post-Pryce):**
   - Rocket Hideout under Mahogany Souvenir Shop (D22): multi-floor dungeon, defeat Executives Proton and Petrel.
   - Radio Tower takeover (D23/D27): Goldenrod Radio Tower occupied. Clear 5 floors. Defeat Executive Ariana. Retrieve Director → he gives Clear Bell (HeartGold) or Tidal Bell (SoulSilver).
   - Completing the arc causes the three legendary beasts (Raikou, Entei, Suicune) to begin roaming.

---

### 7.3 Legendary Encounters

| Legendary | Location | Method | Notes |
|-----------|----------|--------|-------|
| Ho-Oh | Bell Tower (D17, 10F) | Requires Rainbow Wing + all 16 Johto badges (or Wil Clear Bell after Radio Tower arc) | HeartGold exclusive main legendary |
| Lugia | Whirl Islands (D45, B2F) | Requires Silver Wing | SoulSilver main; obtainable in HG with Silver Wing (event) |
| Raikou | Roaming Johto | Encounter in grass after Rocket arc | Flee-then-track mechanic; Lv.40 |
| Entei | Roaming Johto | Same as Raikou | Lv.40 |
| Suicune | Fixed encounters (multiple) → Cianwood → Route 25 → Bell Tower gate | Scripted approach events before final encounter | Lv.40 |
| Celebi | Ilex Forest Shrine | Event item (GS Ball) | Requires Wi-Fi event / cheat |
| Kyogre | Safari Zone (post-Rayquaza) | Obtain Blue Orb from Mr. Pokémon | SoulSilver: Groudon |
| Groudon | Safari Zone | Obtain Red Orb | HeartGold |
| Rayquaza | Embedded Tower (Route 47 cliff) | After Kyogre+Groudon | Bring both to Prof. Elm |
| Mewtwo | Cerulean Cave (D38) | Post-game, all 16 badges | Classic location |
| Articuno | Seafoam Islands (D39) | Post-game | |
| Zapdos | Power Plant (D37) | Post-game | |
| Moltres | Mt. Silver (D46) | Post-game | |
| Red | Mt. Silver summit | All 16 Kanto+Johto badges | Strongest trainer in game |

---

### 7.4 Safari Zone (Johto)

**Map IDs:** `D43` (main area), `043_R47`, `044_R48`.

HeartGold's Safari Zone (near Cianwood) uses a **customizable block system** unique to this game:
- The Zone Warden Baoba allows the player to rearrange area blocks (terrain types: plains, forest, rocky, wetland, etc.).
- Different block configurations unlock different Pokémon species.
- Some Pokémon only appear after a set number of in-game days after placing blocks.
- Required items: Safari Ball (special Poké Ball), step limit (500 steps per session).
- HM Surf is needed to access some sections.

**Browser adaptation note:** Implement the block grid as a drag-and-drop configuration UI. Track day counter for delayed spawns.

---

### 7.5 Battle Frontier (Johto-side)

**Map IDs:** `D51`, `D52` (3 room variants each).

The Battle Frontier in HeartGold is located on the western coast accessible after beating Red.

**Facilities:**
| Facility | Format | Currency |
|----------|--------|----------|
| Battle Tower | Single / Double / Multi battles (7-win streak) | Battle Points (BP) |
| Battle Hall | 1v1 by type, rank 1–10 | BP |
| Battle Castle | Battle with CP resource management | BP |
| Battle Arcade | Roulette modifiers before each battle | BP |
| Battle Factory | Rental Pokémon, swap after wins | BP |

**BP Shop:** Exchange BP for rare held items (Choice Scarf, Life Orb, etc.) and TMs.

---

## 8. Region Notes

### Johto — Primary Region
- 8 towns with Gyms, plus Cherrygrove (no Gym), New Bark (start), Lake of Rage (landmark), and Mt Silver entrance.
- The region is smaller than Kanto in total map tiles but has more vertical exploration (Bell Tower, Sprout Tower, Glitter Lighthouse, Ice Path).
- Day/night cycle is central: time of day affects NPC schedules, wild Pokémon availability (morning/day/night groups), and some events (Lapras in Union Cave on Fridays).
- Apricorn trees respawn daily. Kurt (Azalea) crafts Apricorn Balls: 1 per day per Apricorn type.

### Kanto — Post-Game Region
- Accessible after defeating Champion Lance. Fully explorable.
- Gym leaders are significantly stronger than in Gen I (levels 50–70+).
- Some areas are blocked until specific Johto events complete (e.g., Power Plant Rocket event to restore electricity for Cerulean Gym access).
- Key Kanto-only events: Copycat's Pokédoll (leads to Magnet Train pass), Power Plant Part (Machine Part in Cerulean Gym), Lt. Surge calls for rematches.

### Two-Region Scope — Implementation Priorities
1. Build Johto first (T20–T31 exterior maps, core dungeons D01–D47).
2. Add Kanto as a post-game content expansion (T01–T11).
3. Magnet Train and SS Aqua should be the primary connectors between regions in early builds; Victory Road walking route is secondary.
4. The world coordinate system should be designed to accommodate both regions side-by-side or as separate scene loads.

### Mt. Silver — Boundary Zone
- Physically exists between Johto (Route 28 west entrance) and Kanto (Route 28 east).
- The Pokémon Center (`MAP_MOUNT_SILVER_POKECENTER_1F`) is the last heal point before the summit.
- Red's team: Pikachu (Lv.88), Lapras, Snorlax, Charizard, Blastoise, Venusaur — the strongest fixed trainer in the game.
