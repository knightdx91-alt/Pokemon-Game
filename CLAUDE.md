# Pokémon — Kanto: Codebase Guide

## CRITICAL RULES — READ FIRST
- **ALL work goes on `main` branch ONLY. Never create feature branches. Never open PRs. Push directly to `main`.**
- **The EE submodule lives at `source/emerald-enhanced/` — use it as the reference for any UI/visual work.**
- **No build system. Plain HTML/CSS/JS, all globals (`window.GameXxx`). No npm, no bundler.**

---

## What this game is
A browser-based Pokémon RPG covering Kanto, Johto, Hoenn, and Sinnoh. Deployed to GitHub Pages.  
The visual and UI style is based on **Pokémon Emerald Enhanced (EE)** — a GBA ROM hack. The game screen is designed to look and feel like a GBA (240×160px logical resolution).

---

## File structure
```
index.html                   — single-page app, loads all scripts in order
styles.css                   — all CSS
src/
  engine/
    input.js                 — keyboard + touch input; justPressed latch system
    camera.js                — tile-based camera/viewport
    map.js                   — map loading, warp/connection resolution
    renderer.js              — canvas tile renderer, player sprite
  ui/
    layout.js                — drag/resize screens, orientation override
    controls.js              — D-pad / joystick on-screen controls
    hud.js                   — HUD overlay: map name banner, coords, settings gear
    startmenu.js             — EE-style start menu (icon carousel + sub-menus)
  data/
    save.js                  — 3-slot save system (localStorage)
    achievements.js          — achievement definitions + unlock logic
    factions.js              — faction standing management
  main.js                    — game loop, player movement, warp/connection transitions
  assets/
    start_menu/              — EE icon PNGs converted to RGBA (_rgba.png variants)
    journal/                 — journal tab icons (RGBA)
data/
  maps/                      — map JSON files (kanto, johto, hoenn, sinnoh, heartgold, platinum)
  tilesets/                  — tileset JSON files (2802 total)
  layouts/, encounters/, pokemon/, sprites/
source/
  emerald-enhanced/          — EE GBA ROM source (reference only, never modify)
```

---

## Branch & deploy
- **Branch: `main`** — the only branch. All commits go here.
- **Deploy: GitHub Pages** — CI runs on every push to `main`, replaces `__CACHE_BUST__` in `index.html` with `${{ github.sha }}` for cache busting.

---

## Architecture key points

### Input system (`src/engine/input.js`)
- `GameInput.state` — held keys/touches (boolean, high frequency)
- `GameInput.justPressed` — latch set on touchstart/keydown, cleared by `consumeJustPressed()` at end of each game loop frame
- **Always use `justPressed` for menu navigation** — mobile touches fire and clear within one frame so `state` will always be false by the time the game loop reads it
- `consumeJustPressed()` MUST be called at the end of every `gameLoop()` tick

### Game loop (`src/main.js`)
- `requestAnimationFrame` at ~60fps
- When `GameStartMenu.isOpen`: routes `justPressed` to `GameStartMenu.moveUp/Down/Left/Right/confirm/back`; blocks player movement
- When not in menu: handles player tile movement with 150ms cooldown, warp/connection detection
- START button toggle uses `justPressed.start`

### Start menu (`src/ui/startmenu.js`)
- **Attached to `#screen-primary`** (not `#ui-overlay` or body) — this is what keeps it clipped to the game screen and away from the control buttons
- Both `menuEl` (`#start-menu`) and `subEl` (`#start-menu-sub .sm-sub-overlay`) are appended to `#screen-primary` in `init()`
- Uses `position: absolute; inset: 0` so `#screen-primary`'s `overflow: hidden` clips them
- Main menu: horizontal icon carousel (EE style), transparent middle, info box bottom
- Sub-menus: GBA-style dialog windows floating over the map (`position: absolute` inside `.sm-sub-overlay`)

### Why menus MUST stay in `#screen-primary`
- `#controls-layer` (D-pad / joystick) is a **sibling** of `#screen-primary`, not inside it
- Any menu using `position: fixed` or attached outside `#screen-primary` will visually cover and/or block touch events on the controls
- `#screen-primary` has `position: relative; overflow: hidden` in default mode
- In forced orientation modes, `position: relative !important` is set (NOT `static`) to preserve the containing block

### Pointer-events rule for menus
- The menu container and sub-overlay: `pointer-events: none`
- Only specific interactive elements re-enable: `.sm-top-strip`, `.sm-back-btn`, `.sm-win`, individual `.sm-row` and `.sm-opt-btn` elements
- The `sm-sub-content` scroll area itself stays `pointer-events: none` — navigation is via D-pad/game loop, not direct touch on content

### EE icon sprites (`src/assets/start_menu/`)
- Source icons are GBA 4bpp palette-mode PNGs from `source/emerald-enhanced/graphics/start_menu/`
- GBA transparent color = palette index 0 = RGB `(40, 255, 0)` — must be made alpha=0 for web
- Converted via Python/Pillow: open palette PNG → convert to RGBA → replace index-0 color → save as `*_rgba.png`
- Each file is 32×64px: top 32px = normal/dark frame, bottom 32px = selected/cyan frame
- CSS `background-position: 0 0` for normal, `0 -32px` for selected

### GBA window visual style (EE frame 1 — the default)
All menus must match this exactly:
- **Background**: `#f0f0e8` (near-white cream)
- **Border**: `border: 1px solid #101018` + `box-shadow: 0 0 0 4px #7890b0, 0 0 0 5px #101018, inset 0 0 0 1px #b0b8c8`
- **Title bar**: `background: #4060a0`, white text
- **Body text**: `#101018` (near-black) on cream background
- **Selected row**: faint grey tint `rgba(0,0,0,0.07)` + ▶ cursor — no bold highlight
- **Font**: `"Courier New", Courier, monospace` (closest web approximation to GBA pixel font)
- Reference tile: `source/emerald-enhanced/graphics/text_window/1.png` (vanilla) and `1d.png` (dark variant)

### Sub-menu window sizes (% of `#screen-primary`, based on EE tile coordinates × 8px)
| Page | left | top | width | height |
|------|------|-----|-------|--------|
| save | 3.3% | 5% | 53% | 57% |
| trainer_card | 3.3% | 5% | 53% | 90% |
| options | 3.3% | 5% | 90% | 90% |
| journal / achievements | 3.3% | 5% | 90% | 90% |
| pokenav | 28% | 20% | 44% | 42% |

### Map system (`src/engine/map.js`)
- Maps loaded from `data/maps/{region}/{MapName}.json`
- `kanto_index.json` indexes all maps by id and name
- `GameMap.load(name, region)` — load by display name
- `GameMap.loadById(id, region)` — load by internal map id
- Warps: `getWarp(x,y)` → `resolveWarp(warp)` → `{mapName, warpIndex}`
- Connections: `getConnectionAt(x,y)` → `{connection, dir, exitX, exitY, offset}`

### Save system (`src/data/save.js`)
- 3 save slots in `localStorage` under key `pokemon_save_v1`
- `GameSave.state` = currently loaded slot data
- `GameSave.markDirty()` flags for autosave (runs every 15s via `setInterval` in main.js)
- Save state includes: player position/inventory/party, visitedMaps (Set), achievements, factions, lifeSkills, meta (playtime, badges, trainerId)

### Achievements (`src/data/achievements.js`)
- `GameAchievements.unlock(id)` — unlocks achievement, fires `showAchievementToast` on HUD
- Tiers: bronze (5 AP), silver (15 AP), gold (30 AP), platinum (50 AP)
- Toast appears bottom-center of screen for 3s

### Factions (`src/data/factions.js`)
- 7 factions: naturalists, students, nobles, pokefans, outcasts, professionals, pokemonLeague
- Standing tracked in save state: `GameSave.state.factions.standings[factionId]`
- Factions have `opposes` lists — raising one lowers opponents

---

## What has been done (completed work)

### Engine
- ✅ Tile-based movement with 150ms cooldown
- ✅ Warp system (interior/exterior building transitions)
- ✅ Map-edge connection system (seamless region travel)
- ✅ Camera following player
- ✅ Canvas tile renderer with player sprite (4-directional walk animation)
- ✅ Autosave every 15s
- ✅ 3-slot save/load system

### UI
- ✅ EE-style start menu — horizontal icon carousel (9 icons)
- ✅ Sub-menus: Save, Options, Journal, Trainer Card, Achievements, Pokénav
- ✅ Sub-menus styled as GBA dialog windows (frame 1 visual style), floating over map
- ✅ D-pad navigation works inside menus (justPressed latch system)
- ✅ Menus never cover control buttons (all menu DOM in `#screen-primary`)
- ✅ HUD: map name banner (fades after 2s), coordinate display, settings gear button
- ✅ Settings panel: D-pad/joystick toggle, button size slider, orientation picker
- ✅ Orientation picker: Auto / Portrait / Rev. Portrait / Landscape / Rev. Landscape
- ✅ Draggable/resizable game screen in auto mode
- ✅ EE icon sprites (RGBA-converted, transparent background, selected frame)
- ✅ Achievement toast notifications
- ✅ Faction system

### Data
- ✅ Kanto maps loaded and navigable (PalletTown as start)
- ✅ Hoenn, Johto, Sinnoh, HeartGold, Platinum map data present
- ✅ Achievement definitions (bronze/silver/gold/platinum tiers)
- ✅ Faction standing system

---

## What needs to be done (priority order)

### 1. Player sprite & Pokémon party
- Render the actual player sprite (Red/Brendan/etc.) on the canvas
- Implement Pokémon party display in start menu (POKEMON sub-menu)
- Party data structure exists in save.js but nothing renders it

### 2. Wild encounter system
- `data/encounters/` has encounter data — wire it up
- Grass/cave tiles trigger random encounters
- Battle screen (turn-based combat)

### 3. NPC system
- NPCs with dialogue boxes (GBA-style message window at bottom of screen)
- Interaction via A button when facing NPC
- Dialogue branching

### 4. Battle system
- Turn-based combat (attack/item/switch/run)
- Move data exists in data structure, needs a battle scene
- Wild encounters + trainer battles

### 5. Bag / Items
- BAG sub-menu currently closes the menu — needs full item list UI
- Items: usable (potions, etc.), key items, TMs/HMs, berries

### 6. Pokédex
- POKEDEX icon exists, no sub-menu built yet
- `data/pokemon/` has species data

### 7. DexNav (EE feature)
- EE has a DexNav icon — shows nearby Pokémon species with encounter rates
- Low priority but part of EE's distinctive feature set

### 8. Trainer Card sub-menu
- Currently shows data from save state
- Needs player avatar/sprite displayed on the card (like EE's trainer card)

### 9. Pokénav sub-menu  
- Currently shows placeholder — needs Map, Condition, Match Call tabs

### 10. Map rendering improvements
- Animated tiles (water, flowers)
- Second layer / overlay tiles (bridges, cave entrances)
- Proper tile collision from tileset metadata

### 11. Music / SFX
- No audio at all currently
- EE uses GBA music; we'd need MIDI or chiptune web audio

### 12. Region transitions
- Player can walk to map edges and transition between maps within Kanto
- Multi-region travel (Kanto → Johto etc.) needs a menu or story trigger

---

## EE source reference paths (never modify these)
```
source/emerald-enhanced/src/start_menu.c      — icon layout, button coords, info box
source/emerald-enhanced/src/option_menu.c     — Options window layout
source/emerald-enhanced/src/trainer_card.c    — Trainer Card layout
source/emerald-enhanced/graphics/start_menu/  — icon PNG files (32×64 spritesheets)
source/emerald-enhanced/graphics/text_window/ — window frame tiles (1.png = default)
source/emerald-enhanced/gflib/window.h        — WindowTemplate struct
```

Key EE measurements (GBA: 240×160px, 1 tile = 8px):
- Icon strip Y position: 22px from top
- Icon spacing: 30px, max 7 visible
- Action name window: 240×48px (tiles 0,1 → 30×6)
- Info box: starts at Y=120px (tile row 15)
- Save window: 120×80px, top-left (tile 1,1 → 15×10)
- Options window: 208×112px (tile 2,5 → 26×14)

---

## Converting EE palette PNGs to RGBA (for new icons)
```python
from PIL import Image
img = Image.open('source/emerald-enhanced/graphics/start_menu/start_icon_X.png')
palette = img.getpalette()  # flat list: R,G,B,R,G,B,...
transparent_rgb = tuple(palette[0:3])  # index 0 = GBA transparent color
rgba = img.convert('RGBA')
data = rgba.load()
w, h = rgba.size
for y in range(h):
    for x in range(w):
        if data[x,y][:3] == transparent_rgb:
            data[x,y] = (0, 0, 0, 0)
rgba.save('src/assets/start_menu/start_icon_X_rgba.png')
```

---

## CSS variable reference
```css
--control-scale   /* D-pad / button size multiplier, saved to localStorage */
```

## localStorage keys
```
pokemon_save_v1          /* 3-slot save data (JSON) */
pokemon_settings_v1      /* settings (currently unused, merged into save) */
pokemon_control_scale    /* float 0.5–2.0, button size */
pokemon_orientation      /* 'auto'|'portrait'|'reverse-portrait'|'landscape'|'reverse-landscape' */
```
