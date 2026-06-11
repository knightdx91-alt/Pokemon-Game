# Pokemon Game — Feature Inventory
_Generated before UI overhaul. All features listed here are coded and must be preserved._

---

## Save System (`src/data/save.js`)

| Feature | File:Function | State |
|---------|--------------|-------|
| 3-slot save system (localStorage `pokemon_save_v1`) | `save.js:load/save/deleteSlot` | Working |
| Default new-game slot structure | `save.js:DEFAULT_SLOT_DATA` | Working |
| Pokemon object schema (species, level, moves, HP, EVs/IVs, nature, ability, status, shiny, etc.) | `save.js:DEFAULT_POKEMON` | Working |
| PC Box storage (20 boxes × 30 slots) | `save.js:DEFAULT_BOX` | Working |
| 7-pocket inventory (items, medicine, valuables, key items, pokeballs, TMs, berries) | `save.js:DEFAULT_SLOT_DATA.inventory` | Working |
| Badge tracking (4 regions × 8 badges) | `save.js:DEFAULT_SLOT_DATA.badges` | Working |
| World flags (story progression, stored as Set) | `save.js:DEFAULT_SLOT_DATA.worldFlags` | Working |
| Visited maps tracking | `save.js:DEFAULT_SLOT_DATA.visitedMaps` | Working |
| Achievement tracking (unlocked IDs, total AP, spent AP, active powers) | `save.js:DEFAULT_SLOT_DATA.achievements` | Working |
| Faction standings (7 factions, 0–200 range) | `save.js:DEFAULT_SLOT_DATA.factions` | Working |
| Daily quest tracker (per-faction, last reset date) | `save.js:DEFAULT_SLOT_DATA.factions.dailyQuests` | Working |
| Life skills — Alchemy, Botany, Mining (xp, level, recipes/plants/sites) | `save.js:DEFAULT_SLOT_DATA.lifeSkills` | Working |
| Slot metadata cache (playerName, playtime, badgeCount, mapName, lastSaved) | `save.js:DEFAULT_SLOT_DATA.meta` | Working |
| Badge counter helper | `save.js:countBadges` | Working |
| Autosave dirty flag | `save.js:markDirty / autosave` | Working |
| Settings persistence (separate key `pokemon_settings_v1`) | `save.js:loadSettings / saveSettings` | Working |
| Real estate (properties array) | `save.js:DEFAULT_SLOT_DATA.realEstate` | Placeholder — structure only |
| Quest system (active + completed with stage/date) | `save.js:DEFAULT_SLOT_DATA.quests` | Placeholder — structure only |
| Dynamic deliveries (active job, total completed) | `save.js:DEFAULT_SLOT_DATA.deliveries` | Placeholder — structure only |
| Rivals/Companions (unlocked rivals, active companion) | `save.js:DEFAULT_SLOT_DATA.rivals` | Placeholder — structure only |
| Following Pokemon (single pokemon out of party) | `save.js:DEFAULT_SLOT_DATA.followingPokemon` | Placeholder — structure only |
| Pokenav rematch scheduler | `save.js:DEFAULT_SLOT_DATA.pokenav.rematch` | Placeholder — structure only |
| Challenge modifiers (Nuzlocke, Hardcore, Monochrome flags) | `save.js:DEFAULT_SLOT_DATA.challenge` | Placeholder — no enforcement |
| Game statistics (battles won/lost, caught, steps, money, etc.) | `save.js:DEFAULT_SLOT_DATA.statistics` | Placeholder — not incremented |
| Save migration stub | `save.js:migrate` | Placeholder |

---

## Achievement System (`src/data/achievements.js`)

| Feature | File:Function | State |
|---------|--------------|-------|
| 116 achievement definitions across 13 categories (story, regions, combat, collection, exploration, factions, life skills, real estate, quests, challenge) | `achievements.js:ACHIEVEMENTS` | Working |
| Tier AP rewards: bronze=5, silver=15, gold=30, platinum=50 | `achievements.js:TIER_AP` | Working |
| Unlock by ID (prevent double-unlock, award AP, fire toast) | `achievements.js:unlock` | Working |
| Check if unlocked | `achievements.js:isUnlocked` | Working |
| Get all achievements with unlock status | `achievements.js:getAll` | Working |
| Tier lookup by ID | `achievements.js:getTier` | Working |

---

## Faction System (`src/data/factions.js`)

| Feature | File:Function | State |
|---------|--------------|-------|
| 7 faction definitions with opposing factions and Honoured achievement ID | `factions.js:FACTIONS` | Working |
| Adjust standing (clamp 0–200, penalize opposing factions 50%) | `factions.js:adjust` | Working |
| Get current standing | `factions.js:getStanding` | Working |
| Rank tiers: Hostile/Unfriendly/Neutral/Friendly/Allied/Honoured | `factions.js:getRank` | Working |
| Auto-unlock faction achievements at Honoured (175+); unlock "The Universalist" when all 7 Honoured | `factions.js:checkFactionAchievements` | Working |

---

## Start Menu (`src/ui/startmenu.js`)

| Feature | File:Function | State |
|---------|--------------|-------|
| 9-icon horizontal carousel (Pokédex, Pokémon, Pack, Pokénav, Journal, Player, Save, Options, Exit) | `startmenu.js:ITEMS` | Working |
| Icon sprites from `src/assets/start_menu/` (RGBA-converted PNGs) | `startmenu.js:_iconFile` | Working |
| Theme system: Dark/Light/Vanilla + 4 presets (BlueSteel, RoyalPurple, Synthwave, Mocha) | `startmenu.js:_getThemeColors / _applyThemeCSS` | Working |
| CSS variable injection for theme colors | `startmenu.js:_applyThemeCSS` | Working |
| Main menu: icon strip + transparent middle + info bar (playtime, map, clock, weather) | `startmenu.js:_renderMain` | Working |
| Time/clock display with season and time-of-day label | `startmenu.js:_timeOfDay / _clockStr / _season` | Working |
| Player name, money, badges, AP display | `startmenu.js:_playerName / _money / _badges / _ap` | Working |
| Trainer ID (6-digit padded, currently placeholder 000000) | `startmenu.js:_trainerId` | Working |
| Sub-menu overlay system (canvas-based full-screen pages) | `startmenu.js:_renderSub` | Working |
| Menu open/close/toggle | `startmenu.js:toggle / open / close` | Working |
| D-pad navigation via justPressed latch | `startmenu.js:moveUp/Down/Left/Right/confirm/back` | Working |
| Carousel scroll with auto-nudge to keep selection visible | `startmenu.js:_carouselScroll` | Working |
| **Bag sub-menu** — 7 pockets, item list with icons, description box, scroll arrows | `startmenu.js:_buildBag / _drawBagCanvas` | Working |
| Item icon loader with caching (`src/assets/bag/item_icons/`) | `startmenu.js:_loadItemIcon` | Working |
| Pocket switching via L/R or pocket icons | `startmenu.js:_buildBag click handler` | Working |
| **Journal sub-menu** — 4 tabs (Factions, Ach. Atlas, Powers, Quests) | `startmenu.js:_buildJournal / _drawJournalCanvas` | Working |
| Journal Factions tab — 6 stat sub-pages (General, Life Skills, Battle, Training, Financial, Social) | `startmenu.js:JOURNAL_PAGES` | Working |
| Journal Ach. Atlas tab — tier filter, list with AP values, description box | `startmenu.js:_drawJournalAchAtlas` | Working |
| Journal Powers tab — 4 tier tabs, AP cost display | `startmenu.js:_drawJournalPowers` | Placeholder — no purchase logic |
| Journal Quests tab — list display | `startmenu.js:_drawJournalQuests` | Placeholder — no quest data |
| **Achievements sub-menu** — full canvas, tier tabs, 6-item list, description, AP counter | `startmenu.js:_buildAchievements / _drawAchievementsCanvas` | Working |
| **Trainer Card sub-menu** — name, ID, money, location, badges, AP, playtime, life skill levels | `startmenu.js:_buildTrainerCard` | Working (no avatar sprite) |
| Canvas shell wrapper (480×320, pixelated rendering, back button) | `startmenu.js:_makeCanvasShell` | Working |
| Background image loader with caching and queue | `startmenu.js:_loadSimpleBg` | Working |
| Bag asset preloader (bg, 7 pocket icon pairs, 6 bag frame sprites) | `startmenu.js:_loadBagAssets` | Working |

---

## HUD (`src/ui/hud.js`)

| Feature | File:Function | State |
|---------|--------------|-------|
| Version display (`GAME_VERSION`) | `hud.js:GAME_VERSION` | Working |
| Map name display | `hud.js:_mapLine` | Working |
| Coordinate display (x, y) | `hud.js:_coordLine` | Working |
| FPS display (updated every 500ms) | `hud.js:setFps` | Working |
| Map name banner (flash on map change, fades after 2s) | `hud.js:_showBanner` | Working |
| Visited maps tracking on map change | `hud.js:update` | Working |
| Settings button (⚙ gear icon) | `hud.js:settingsBtn` | Working |
| Settings panel: D-pad/joystick toggle, button size slider, orientation picker, reset layout | `hud.js:initSettings` | Working |
| Button size persistence (`pokemon_control_scale` localStorage) | `hud.js:initSettings sizeSlider` | Working |

---

## Controls (`src/ui/controls.js`)

| Feature | File:Function | State |
|---------|--------------|-------|
| D-pad mode (4 directional buttons) | `controls.js` | Working |
| Joystick mode (virtual analog) | `controls.js` | Working |
| Mode toggle (D-pad ↔ Joystick) | `controls.js:setMode` | Working |
| Drag-to-reposition controls (edit mode) | `controls.js:toggleEditMode` | Working |
| Layout reset | `controls.js:resetLayout` | Working |
| Layout rebuild on scale change | `controls.js:rebuild` | Working |
| Pointer capture for reliable touch input | `controls.js` (input write before capture) | Working |

---

## Layout / Orientation (`src/ui/layout.js`)

| Feature | File:Function | State |
|---------|--------------|-------|
| Orientation modes: Portrait / Reverse Portrait / Landscape / Reverse Landscape / Auto | `layout.js:setOrientation` | Working |
| CSS body transform rotation (same approach as EmulatorJS) | `layout.js` | Working |
| Controls opacity slider (landscape mode only) | `layout.js / hud.js` | Working |
| Orientation persistence (`pokemon_orientation` localStorage) | `layout.js` | Working |

---

## Game Engine

| Feature | File:Function | State |
|---------|--------------|-------|
| Tile-based player movement (150ms cooldown) | `main.js:gameLoop` | Working |
| 4-directional walk animation (frame cycle 0→1→2→1) | `main.js:player.walkFrame` | Working |
| Sprite movement interpolation over 150ms | `renderer.js:_getVisualPos` | Working |
| Warp system (load destination map, place player at warp) | `main.js:transitionToWarp` | Working |
| Map-edge connection transitions (north/south/east/west) | `main.js:transitionToConnection` | Working |
| Fly/teleport (instant travel with region change) | `main.js:flyTo` | Working |
| NPC interaction (A button, dialogue script) | `main.js:_interact` | Working |
| Sign interaction (A button) | `main.js:_interact` | Working |
| Wild encounter (10% chance per step in grass/cave) | `main.js:_checkEncounter` | Working |
| Collision detection via `GameMap.isWalkable` | `main.js:gameLoop` | Working |
| Camera/viewport system | `camera.js` | Working |
| Canvas tile renderer (metatile spritesheet) | `renderer.js` | Working |
| Tileset loading with cache-busting (`?v=metatiles_primary`) | `renderer.js:loadTileset` | Working |
| Player sprite rendering (4 directions, 3 frames) | `renderer.js:render` | Working |
| NPC/object sprite rendering (16×16 and 16×32) | `renderer.js:render` | Working |
| NPC sprite index + lazy loading | `renderer.js:_getNpcImg / _loadNpcIndex` | Working |
| FPS tracking (500ms window) | `renderer.js:loop` | Working |
| Map loading from `data/maps/{region}/{MapName}.json` | `map.js` | Working |
| Warp resolution | `map.js:resolveWarp` | Working |
| Connection resolution | `map.js:getConnectionAt` | Working |
| Kanto map index | `data/maps/kanto_index.json` | Working |

---

## Battle System (`src/engine/battle.js`)

| Feature | File:Function | State |
|---------|--------------|-------|
| Gen 4 type effectiveness chart | `battle.js:TYPE_CHART` | Working |
| Nature stat modifiers (25 natures) | `battle.js:NATURE_MODS` | Working |
| Stat stage system (-6 to +6) | `battle.js:STAGE_MULT / _stageMult` | Working |
| Move effect database | `battle.js:MOVE_FX` | Partial |
| Legendary species exclusion from wild encounters | `battle.js:LEGENDARIES` | Working |
| Wild Pokemon entry animation (slide-in from right) | `battle.js:_playEntryAnimation` | Working |
| Pokéball throw animation with CSS fallback | `battle.js:_animateBallThrow` | Partial — animation may not fire |
| Battle terrain background | `battle.js:_getTerrainKey` | Partial — terrain PNG not displaying |

---

## Emulator Hub (`emulator.html`)

| Feature | State |
|---------|-------|
| RetroPlay brand, 37 systems with emoji icons grouped by manufacturer | Working |
| System card toggle-select | Working |
| Google Drive Picker (OAuth2, MB/MB progress) | Working |
| IndexedDB ROM caching (`ejs-roms-v2`) | Working |
| Spinner overlay + MutationObserver for EJS load text | Working |
| Cache panel (list ROMs, Play/Delete per row) | Working |
| Emulator screen with top bar, back button | Working |
| Cloud saves wired to `EJS_onGameStart` | Working |

---

## Cloud Saves (`cloud-saves.js`)

| Feature | State |
|---------|-------|
| GitHub PAT push/pull `.srm` files to `saves` branch | Working |
| Per-player name (stored in localStorage `cloud_save_player`) | Working |
| Name prompt modal on first visit | Working |
| ☁ Save button injected into `#top-bar` | Working |
| `window.CLOUD_SAVE_GAME` per-page selector | Working |
| `window.cloudSaveOnStart` for dynamic `EJS_onGameStart` | Working |

---

## Per-Game Emulator Pages

| Page | Game | State |
|------|------|-------|
| `emerald.html` | Pokémon Emerald GBA | Working |
| `pokemon-black.html` | Pokémon Black NDS | Working |

---

## Assets

| Asset | Location | Notes |
|-------|----------|-------|
| Start menu icons (RGBA PNGs) | `src/assets/start_menu/` | 9 icons, EE-derived |
| Bag pocket icons + frames | `src/assets/bag/` | Working |
| Journal/AP backgrounds | `src/assets/journal/` | Working |
| NPC sprites (142 sprites) | `data/sprites/npcs/index.json` | Base64 data URLs |
| Player sprite sheet | `data/sprites/player.png` | 9-frame 144×32 sheet |
| Tileset PNGs + JSON | `data/tilesets/` | 55+ tilesets regenerated |
| Map JSON files | `data/maps/` | Kanto, Johto, Hoenn, Sinnoh, HeartGold, Platinum |
| Encounter tables | `data/encounters/` | Present, partially wired |
| Pokemon species data | `data/pokemon/` | Present, not yet displayed in UI |

---

## What Is NOT Yet Implemented (planned)

- Player sprite on Trainer Card
- Pokemon party sub-menu (data exists, no UI)
- Pokedex sub-menu (data exists, no UI)
- Pokenav sub-menu (placeholder only)
- NPC dialogue box UI (currently logs to console)
- Pokemon Center healing
- Trainer battles
- Shop/PokeMart system
- Animated tiles (water, flowers)
- HM mechanics (Cut, Surf, Strength, Flash)
- Audio (no sound at all)
- Region transitions beyond Kanto
- The System UI overlay (LitRPG layer — planned feature)
- Guild system (planned feature)
- Credit economy (planned feature)
