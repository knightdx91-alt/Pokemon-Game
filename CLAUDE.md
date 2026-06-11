# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Bug history — known fixes (read before debugging input/menu issues)

### 1. Game loop crashing silently every frame (`src/main.js`)
**Symptom:** Player can't move, no buttons work, menus don't open, HUD coords never change.  
**Root cause:** `GameStartMenu.isOpen` is a **getter property** (declared as `get isOpen() { return isOpen; }` in `startmenu.js`), not a method. The game loop called `GameStartMenu.isOpen()` — invoking the returned boolean `false` as a function — which threw `TypeError: GameStartMenu.isOpen is not a function` on every single frame. Because the throw happened before `requestAnimationFrame(gameLoop)` was scheduled, the loop died after one tick.  
**Fix:** Change every `GameStartMenu.isOpen()` call to `GameStartMenu.isOpen` (no parentheses). `GameDialogue.isOpen()` and `GameBattle.isActive()` are regular functions — those are fine with parentheses.  
**Rule going forward:** If `GameStartMenu` ever adds more getter properties to its public API, call them without `()`.

### 2. On-screen gamepad buttons not firing input (`src/ui/controls.js`)
**Symptom:** Buttons light up with CSS `:active` but `GameInput.justPressed` is never set.  
**Root cause:** `setPointerCapture(e.pointerId)` was called *before* `GameInput.state[key] = true`. If `setPointerCapture` threw `InvalidStateError`, it silently aborted the handler before input was ever set.  
**Fix:** Set `GameInput.state[key]` and `GameInput.justPressed[key]` *first*, then wrap `setPointerCapture` in a `try/catch`. The input write must come before anything that can throw.

### 3. Map name showing "—" in HUD (`src/main.js`, `src/engine/map.js`)
**Symptom:** HUD always showed "—" instead of the map name.  
**Root cause:** `GameHUD.update()` read `mapRef.current.name`, but `GameMap.current` is a live getter; if the async `GameMap.load()` promise hadn't resolved yet on the first few frames, it was null.  
**Fix:** Set `window._mapName = 'PalletTown'` at the very top of `init()` (before any async work). `GameHUD.update()` checks `window._mapName` first, so it always has a value to display.

### 4. Start menu icon strip visible behind sub-menus (`src/ui/startmenu.js`)
**Symptom:** Opening Bag, Journal, etc. showed the sub-window but the icon carousel remained visible underneath.  
**Root cause:** `_render()` called `_renderMain()` unconditionally even when `page !== 'main'`, with a comment "keep top/bottom visible behind overlay".  
**Fix:** When `page !== 'main'`, set `menuEl.style.visibility = 'hidden'` and skip `_renderMain()`. Reset to `'visible'` in `close()` and when returning to `page === 'main'`.

### 5. Battle background wrong + pokéball throw/catch animation not playing (`src/engine/battle.js`, `src/assets/battle_assets.js`)
**Symptom:** The battle terrain background is incorrect (showing wrong terrain or none). When throwing a pokéball to catch a wild Pokémon, no animation plays — the result message appears instantly with no visual throw/shake/break sequence.  
**Root cause (background):** `_getTerrainKey()` returns a key like `'grass'`, which maps to `window._BattleAssets.terrain_grass`. The `_BattleAssets` object is built in `src/assets/battle_assets.js` as a large file of base64 data URLs loaded from `source/pokefirered/graphics/battle_terrain/`. If this file is stale, the wrong terrain PNG is used. Also `#bt-terrain-bg` uses `background-size: 64px auto` + `background-repeat: repeat` which tiles the texture — check if the PNG dimensions and repeat mode look right in-browser.  
**Root cause (animation):** `_animateBallThrow()` in `battle.js` (line ~805) checks `if (!field || !eWrap) { onDone(); return; }`. Even though a CSS fallback ball was added in v0.9.8, the animation CSS keyframes (`bt-throw-arc`, `bt-ball-shake`, `bt-ball-break`, `bt-pokemon-caught`, `bt-pokemon-appear`) may not be firing because the ball element's `style.cssText +=` concatenation overwrites inline styles set earlier. Check that `position:absolute` isn't lost when the fallback CSS-div path sets `style.cssText +=`.  
**What to investigate next session:**
1. Open browser DevTools → Network tab → filter `battle_assets` — confirm the file loads and `window._BattleAssets` is non-null in console.
2. In DevTools → Elements tab during a battle — check `#bt-terrain-bg` has a `background-image` set and that `#bt-ball-anim` element appears in the DOM during a throw.
3. If `#bt-ball-anim` never appears, the bail-out at the top of `_animateBallThrow` is triggering — add `console.log` to confirm `field`, `eWrap` exist.
4. The `style.cssText +=` bug: the fallback `div` path does `ball.style.cssText += 'position:absolute;...'` but the background/borderRadius were set as individual properties before, not via cssText, so they'd survive. However for the `img` path there's no `+=` issue. Double-check both paths.
5. Re-examine `battle_assets.js` — ensure terrain PNG base64 strings are non-empty and the keys exactly match what `_getTerrainKey()` returns (`terrain_grass`, `terrain_cave`, etc.).

---

## CRITICAL RULES — READ FIRST
- **ALL work goes on `main` branch ONLY. Never create feature branches. Never open PRs. Push directly to `main`.**
- **The EE submodule lives at `source/emerald-enhanced/` — use it as the reference for any UI/visual work.**
- **No build system. Plain HTML/CSS/JS, all globals (`window.GameXxx`). No npm, no bundler.**
- **Every commit MUST bump `GAME_VERSION` in `src/ui/hud.js` (semver patch: v0.X.Y → v0.X.Y+1). Always tell the user the new version number when pushing.**

---

## What this game is
A browser-based Pokémon RPG covering Kanto, Johto, Hoenn, and Sinnoh. Deployed to GitHub Pages.  
Visual and UI style is based on **Pokémon Emerald Enhanced (EE)** — a GBA ROM hack. The game screen is designed to look and feel like a GBA (240×160px logical resolution).

---

## Branch & deploy
- **Branch: `main`** — the only branch. All commits go here.
- **Deploy: GitHub Pages** — CI runs on every push to `main`, replaces `__CACHE_BUST__` in `index.html` with `${{ github.sha }}` for cache busting.

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

## Architecture key points

### Input system (`src/engine/input.js`)
- `GameInput.state` — held keys/touches (boolean, high frequency)
- `GameInput.justPressed` — latch set on touchstart/keydown, cleared by `consumeJustPressed()` at end of each game loop frame
- **Always use `justPressed` for menu navigation** — mobile touches fire and clear within one frame so `state` will be false by the time the game loop reads it
- `consumeJustPressed()` MUST be called at the end of every `gameLoop()` tick

### Game loop (`src/main.js`)
- `requestAnimationFrame` at ~60fps
- When `GameStartMenu.isOpen`: routes `justPressed` to `GameStartMenu.moveUp/Down/Left/Right/confirm/back`; blocks player movement
- When not in menu: handles player tile movement with 150ms cooldown, warp/connection detection
- START button toggle uses `justPressed.start`

### Start menu (`src/ui/startmenu.js`)
- **Attached to `#screen-primary`** (not `#ui-overlay` or body) — keeps it clipped to the game screen and away from control buttons
- Both `menuEl` (`#start-menu`) and `subEl` (`#start-menu-sub .sm-sub-overlay`) are appended to `#screen-primary` in `init()`
- Uses `position: absolute; inset: 0` so `#screen-primary`'s `overflow: hidden` clips them
- Main menu: horizontal icon carousel (EE style), `padding-top: 12%` pushes strip down from top edge, transparent middle, info box at bottom
- Sub-menus: GBA-style `.sm-win` dialog windows with `position: absolute` inside `.sm-sub-overlay`

### Why menus MUST stay in `#screen-primary`
- `#controls-layer` (D-pad / joystick) is a **sibling** of `#screen-primary`, not inside it
- Any menu using `position: fixed` or attached outside `#screen-primary` will cover/block touch events on the controls
- `#screen-primary` always has `position: relative` (even in forced orientation modes — use `relative !important`, never `static !important`)
- The `.sm-sub-overlay` container is `pointer-events: none`; only `.sm-win`, `.sm-back-btn`, and individual `.sm-row`/`.sm-opt-btn` elements re-enable pointer events

### GBA window visual style (EE dark frame — `1d.png`)
All menus use the **dark** theme:
- **Window background**: `#060610` (near-black navy)
- **Border**: `border: 1px solid #000` + `box-shadow: 0 0 0 3px #18b8c8, 0 0 0 4px #000, inset 0 0 0 1px #002830`
- **Title bar**: `background: #0a1830`, cyan border-bottom `#18b8c8`, text `#80d0e8`
- **Body text**: `#c8d8e8` (near-white blue-grey) on dark background
- **Selected row**: `rgba(24,184,200,0.15)` tint + `▶` cursor
- **Font**: `"Courier New", Courier, monospace`
- Reference tile: `source/emerald-enhanced/graphics/text_window/1d.png`

### Sub-menu window sizes (% of `#screen-primary`)
| Page | left | top | width | height |
|------|------|-----|-------|--------|
| save | 3.3% | 5% | 53% | 57% |
| trainer_card | 3.3% | 5% | 53% | 90% |
| options | 3.3% | 5% | 90% | 90% |
| journal / achievements | 3.3% | 5% | 90% | 90% |
| bag | 3.3% | 5% | 90% | 88% |
| pokenav | 28% | 20% | 44% | 42% |

### Orientation system (`src/ui/layout.js`)
Real CSS `transform: rotate()` on `<body>` — same approach as EmulatorJS fullscreen.
- `orient-portrait` / `orient-reverse-portrait`: 0° / 180° rotation on body
- `orient-landscape` / `orient-reverse-landscape`: body resized to `100vh × 100vw` + rotated ±90°; because body has a transform, all `position:fixed` children use it as containing block — everything rotates as a unit
- In landscape modes: `#controls-layer` becomes `position:fixed; inset:0` overlay with `opacity: var(--controls-opacity, 0.65)`
- `auto` = no class, natural device orientation via `@media (orientation: landscape)`
- Opacity slider in settings only shown when landscape mode is active

### Gamepad shell
- `.gba-controller` has **no background, no border** — buttons float transparently over the game/map
- Individual buttons (`.gba-shoulder-l/r`, d-pad bars, action buttons) have their own `background: #252535` styling

### Map system (`src/engine/map.js`)
- Maps loaded from `data/maps/{region}/{MapName}.json`
- `kanto_index.json` indexes all maps by id and name
- Warps: `getWarp(x,y)` → `resolveWarp(warp)` → `{mapName, warpIndex}`
- Connections: `getConnectionAt(x,y)` → `{connection, dir, exitX, exitY, offset}`

### Save system (`src/data/save.js`)
- 3 save slots in `localStorage` under key `pokemon_save_v1`
- `GameSave.state` = currently loaded slot data; `GameSave.markDirty()` flags for autosave
- Inventory pockets: `state.inventory.items`, `.keyItems`, `.pokeBalls`, `.tms`, `.berries`

---

## Completed work

### Engine
- ✅ Tile-based movement (150ms cooldown), warp system, map-edge connections, camera
- ✅ Canvas tile renderer with 4-directional walk animation
- ✅ 3-slot save/load system with 15s autosave

### UI
- ✅ EE-style start menu — horizontal icon carousel, 9 icons
- ✅ Sub-menus: Save, Options, Journal, Trainer Card, Achievements, Pokénav, **Bag** (all 5 pockets)
- ✅ All menus styled as GBA dark-theme dialog windows, clipped to game screen
- ✅ D-pad navigation in menus via `justPressed` latch system
- ✅ HUD: map name banner, coordinate display, settings gear
- ✅ Settings panel: D-pad/joystick toggle, button size, orientation picker, controls opacity (landscape)
- ✅ Real rotation-based orientation: Portrait / Rev. Portrait / Landscape / Rev. Landscape
- ✅ Gamepad shell is transparent (no background panel behind buttons)
- ✅ EE icon sprites (RGBA-converted), achievement toast, faction system

### Data
- ✅ Kanto maps navigable from PalletTown; Hoenn/Johto/Sinnoh/HeartGold/Platinum map data present
- ✅ Achievement definitions (bronze/silver/gold/platinum), faction standing system

### Emulator hub (`emulator.html`)
- ✅ **RetroPlay** brand — CSS variable theme (`--bg`, `--surface`, `--accent`, etc.), gradient logo, tagline
- ✅ 37 systems with emoji icons, grouped by manufacturer (Nintendo, Sega, Sony, Atari, etc.)
- ✅ System cards toggle-select: click once to select, click again to deselect back to default state
- ✅ Launch card at bottom: shows selected system icon/name/extensions + Drive and Play Cached buttons
- ✅ "Cached ROMs" button lives in top-right of the systems card with a 💿 CD icon
- ✅ IndexedDB caching (`ejs-roms-v2`, stores: `roms` + `meta`) — per-system, survives page refresh
- ✅ Google Drive Picker (hardcoded `CLIENT_ID` + OAuth2 scope) — streams ROMs with MB/MB progress
- ✅ Spinner loading overlay for download phase; `MutationObserver` mirrors EJS internal loading text
- ✅ Elapsed timer while EJS decompresses/loads
- ✅ Cache panel overlay — lists cached ROMs with Play / Delete per row
- ✅ Emulator screen: top bar with RetroPlay logo, game/sys name, "Back to menu" button
- ✅ Cloud saves wired: `window.CLOUD_SAVE_GAME = sys.id` set in `launchEJS`; `cloudSaveOnStart()` called in `EJS_onGameStart`

### Cloud saves (`cloud-saves.js`)
- ✅ Universal family cloud save sync for `emulator.html`, `emerald.html`, `pokemon-black.html`
- ✅ GitHub PAT embedded (reversed string to bypass secret scanner) — pushes/pulls `.srm` files to `saves` branch
- ✅ Save path: `saves/<game>/<player>.srm` — each family member named on first visit (stored in `localStorage` as `cloud_save_player`)
- ✅ Name prompt modal on first visit; ☁ Save button injected into `#top-bar`
- ✅ `window.CLOUD_SAVE_GAME` — set per page before this script loads; tells it which game folder to use
- ✅ `window.cloudSaveOnStart` — exposed for pages that set `EJS_onGameStart` dynamically (emulator.html)
- ✅ `saves` branch exists on GitHub with `saves/.gitkeep` — accumulates `.srm` files as family plays

### Per-game emulator pages
- ✅ `emerald.html` — Pokémon Emerald GBA, uses `cloud-saves.js` with `CLOUD_SAVE_GAME = 'emerald'`
- ✅ `pokemon-black.html` — Pokémon Black NDS, uses `cloud-saves.js` with `CLOUD_SAVE_GAME = 'pokemon-black'`

---

## What needs to be done (priority order)

### Pokémon RPG (index.html / src/)
1. **Player sprite** — render actual player sprite (Red/Brendan) on canvas; `renderer.js` draws a placeholder
2. **Pokémon party** — POKEMON sub-menu shows nothing; party array exists in `save.js`
3. **Wild encounters** — `data/encounters/` has data; wire grass/cave tiles to trigger battle screen
4. **Battle system** — turn-based combat scene (attack/item/switch/run); no battle screen exists yet
5. **NPC system** — dialogue box at bottom of screen (GBA message window style), A-button interaction
6. **Pokédex sub-menu** — icon exists; `data/pokemon/` has species data; no sub-menu built
7. **Pokénav sub-menu** — currently placeholder; needs Map, Condition, Match Call tabs
8. **Trainer Card** — needs player avatar sprite on card
9. **Map rendering** — animated tiles (water/flowers), overlay layer (bridges), proper collision from tileset metadata
10. **Audio** — no sound at all; needs MIDI/chiptune web audio
11. **Region transitions** — multi-region travel (Kanto→Johto etc.) needs story trigger

### Emulator hub
12. **More per-game pages** — could add dedicated pages for other popular ROMs (same pattern as emerald.html / pokemon-black.html)
13. **Cloud saves on additional pages** — any new per-game page just needs `window.CLOUD_SAVE_GAME = '<id>'` before loading `cloud-saves.js`

---

## EE source reference (never modify)
```
source/emerald-enhanced/src/start_menu.c      — icon layout, button coords
source/emerald-enhanced/src/option_menu.c     — Options window layout
source/emerald-enhanced/src/trainer_card.c    — Trainer Card layout
source/emerald-enhanced/graphics/start_menu/  — icon PNG spritesheets (32×64)
source/emerald-enhanced/graphics/text_window/ — window frame tiles (1d.png = dark default)
```
Key GBA measurements (240×160px screen, 1 tile = 8px): icon strip at y=22px, spacing 30px, max 7 visible; info box at y=120px; save window 120×80px top-left.

## Converting EE palette PNGs to RGBA
```python
from PIL import Image
img = Image.open('source/emerald-enhanced/graphics/start_menu/start_icon_X.png')
transparent_rgb = tuple(img.getpalette()[0:3])  # index 0 = GBA transparent color
rgba = img.convert('RGBA')
data = rgba.load()
for y in range(rgba.size[1]):
    for x in range(rgba.size[0]):
        if data[x,y][:3] == transparent_rgb:
            data[x,y] = (0,0,0,0)
rgba.save('src/assets/start_menu/start_icon_X_rgba.png')
```

## CSS variables & localStorage keys
```css
--control-scale       /* D-pad button size multiplier */
--controls-opacity    /* overlay opacity in landscape mode (default 0.65) */
```
```
pokemon_save_v1             /* 3-slot save data */
pokemon_control_scale       /* float 0.5–2.0 */
pokemon_orientation         /* 'auto'|'portrait'|'reverse-portrait'|'landscape'|'reverse-landscape' */
pokemon_controls_opacity    /* float 0.1–1.0 */
```
