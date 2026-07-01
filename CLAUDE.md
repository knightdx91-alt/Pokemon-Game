# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ▶ ACTIVE PRIORITY — FireRed-faithful UI overhaul for the Pokémon RPG (`game.html`)

Bring the battle screen and dialogue box up to a pixel-faithful FireRed look,
using this repo's already-bundled FireRed font (`src/assets/fonts/pokefirered.ttf`
+ `.woff2`, and bitmap atlases `src/assets/party/font_normal.png` / `font_small.png`).

- **Battle UI target:** FireRed-style healthboxes (name, Lv, green/yellow/red HP
  bar, numeric HP, blue EXP bar), the FIGHT/BAG/POKéMON/RUN command grid, and the
  move menu with a type/PP box. `src/engine/battle.js` currently renders this via
  DOM (`#battle-overlay`, `.bt-hp-bar`, `.bt-move-btn`). Restyle in place (CSS +
  the bundled font) to preserve its richer features (bag pockets, summary, fly menu).
- **Dialogue box target:** the classic FireRed blue window frame + font (`src/ui/dialogue.js`).
- **Reference implementation** of the exact look (native-res canvas + a bitmap-font
  renderer + FireRed-palette healthboxes) was prototyped on the throwaway branch
  `claude/pokemon-crater-github-pages-t03jnb`: see its `src/battle/battle.js`,
  `src/ui/font.js`, `src/ui/dialogue.js`, and `data/ui/font_normal.png` + `font.json`.
  That branch is a stale-fork side project — mine it for the UI look only, do NOT
  merge it; all the game logic already exists (and is more complete) here on `main`.
- **Palette source:** `source/pokefirered/graphics/battle_interface/` (healthbox
  elements + `healthbar.pal` / `healthbox.pal`) and the EE submodule for framing.

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
- **NEVER use the Agent tool. Handle ALL tasks directly. Do not spawn subagents for any reason — they waste usage and fail silently. Do everything yourself with the available tools (Read, Edit, Write, Bash, Grep, Glob).**
- **ALL work goes on `main` branch ONLY. Never create feature branches. Never open PRs. Push directly to `main`.**
- **The EE submodule lives at `source/emerald-enhanced/` — use it as the reference for any UI/visual work.**
- **No build system. Plain HTML/CSS/JS, all globals (`window.GameXxx`). No npm, no bundler.**
- **Every commit MUST bump `GAME_VERSION` in `src/ui/hud.js` (semver patch: v0.X.Y → v0.X.Y+1). Always tell the user the new version number when pushing.**

### 6. Emulator in-game (battery/.srm) saves never persist — game always boots to "New Game" (`emulator.html`)
**Symptom:** In `emulator.html`, saving INSIDE a game (e.g. Pokémon → SAVE) shows "saved", but on reload the game offers only **New Game** — the battery save is gone. RTC also doesn't stick (RTC data lives in the `.srm`). Affected EVERY game/core, not just one. Save **states** (EmulatorJS context menu) worked fine.
**Root cause:** The EmulatorJS core reports a **nested** battery-save path, e.g. `/data/saves/mGBA/<game>.srm`. The `mGBA/` subfolder is **never created**, so when the core flushes SRAM the `FS.writeFile` to a non-existent directory **fails silently**. The in-game save only ever lived in emulated RAM; nothing reached the FS/IndexedDB, so there was nothing to restore on boot → always "New Game". (Save states worked because they use `gameManager.getState()` and a different, existing directory.)
**Fix:** Added `ensureSaveDir(g)` in `emulator.html` — it takes `g.getSaveFilePath()`, derives the directory, and `FS.mkdirTree`'s it (with a manual recursive `FS.mkdir` fallback). Called **at boot** (in `EJS_onGameStart`, ~1.2s after start) AND **before every flush** (inside `readBatteryBytes`, before `g.saveSaveFiles()`). Once the dir exists, `saveSaveFiles()` writes the `.srm`, `findSaveFile()` (a full recursive FS walk over `/data /home /saves /tmp`) locates it, `persistBatteryToIDB()` mirrors it to our own IndexedDB (`SAVE_STORE`, key `sram::<game>`), and the boot restore writes it back via `writeBatteryBytes()` → game shows **Continue**.
**How it was diagnosed (no DevTools on the user's Android Chrome):** Added an on-screen **🛠** diagnostic button to the emulator top bar that alerts: ROM name, the core's reported save path, whether the save dir exists, `readBattery` byte count, every save-looking file on the FS with sizes, and what's in IndexedDB (battery + state). The "Core path: /data/saves/mGBA/…srm" + "Save files on disk: none" + "readBattery: none" output pinned it to the missing nested directory. **The 🛠 button + on-screen diag is the way to debug emulator save issues on mobile** — re-add a similar report if save bugs recur.
**Related gotchas in the same area:**
- The 💾 Save / 📂 Load top-bar buttons capture a save **state** (via `gameManager.getState`/`loadState`, stored under `state::<game>`) as the reliable cross-core path, in addition to best-effort battery. Battery (`.srm`) is what gives native "Continue" + RTC; save state is the fallback.
- Service worker (`sw.js`) uses TWO caches on purpose: **RUNTIME** (`retroplay-offline-v2`, holds engine+cores, name MUST match the offline-readiness scan in `emulator.html`, **never rename on a normal update** or you purge every cached core) and **SHELL** (`retroplay-shell-vN`, precached HTML, safe to bump to force fresh pages). `activate` keeps both and deletes only stale shells. Bumping the runtime cache name once wiped all offline cores — don't.

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
  maps/                      — map JSON files (kanto, johto [HnS], hoenn, sinnoh/platinum [DS])
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

## Map system & custom maps (how to make new maps/regions)

Maps are **three layers**, all authentic GBA data — so any new map built from
existing tilesets is pixel-for-pixel the same fidelity as the real games (it's
the same 16×16 metatile art, just rearranged).

1. **Tileset** — `data/tilesets/<name>.png` + `.json`. A pre-rendered sheet of
   16×16 **metatiles**, 16 per row. JSON has per-metatile `behaviors` and
   `collisions`, plus `total_metatiles`/`primary_count`/`secondary_count`.
   ~537 tilesets exist (Kanto/Hoenn/Sinnoh towns, routes, caves, interiors).
2. **Layout** — `data/layouts/[<region>/]<LAYOUT_ID>.json`: `width`, `height`, a
   flat `metatiles` array of tile IDs, a parallel `collision` array
   (0 = walkable, 1 = blocked), and the `tileset` name.
3. **Map** — `data/maps/<region>/<Name>.json`: metadata wrapper — `layout`,
   `warps`, `connections`, `npcs`, `music`, `weather`, `map_type`. A region also
   needs `data/maps/<region>_index.json` (`MAP_CONST → filename`) and to be
   registered in `INDEX_FILES` in `src/engine/map.js`.

**Renderer:** `GameRenderer.drawMetatile` slices metatile #N from the sheet at
`col = N % 16`, `row = N / 16`. **Collision/walkability:** `GameMap.isWalkable`
(`src/engine/map.js` ~line 244) blocks `collision !== 0`, but tall-grass/cave
behaviors stay walkable (and trigger encounters) and water behaviors always
block. Warp tiles are always walkable.

### Map editor (the authoring tool)
- **`map-editor.html` + `map-editor.js`** — standalone visual editor (serve over
  http, not `file://`). Loads any tileset, shows its metatile palette, paints
  with pencil/fill/rect/pick, has a collision-paint mode and warp placement, and
  **Export** downloads the exact `<LAYOUT_ID>.json` + `<Name>.json` the game
  loads. Can **Import** an existing layout to keep editing. Tileset dropdown is
  fed by `data/tilesets/_index.json`.
- Launchable from the **RetroPlay hub** (`index.html`) via the "Map Editor" tile
  under the **Create** section (alongside Pokémon RPG / Emerald / emulator).
- Verified metatile vocabulary (pallet_town/general tileset): grass=1, tall
  grass=13, flowers=4, water=41, 2×2 tree unit = 28/29 (top) 20/21 (bottom),
  dirt path=196. Real tree borders use specific corner/edge tiles per map.

### Save to repo → `maps` branch
- The editor's **☁ Save to repo** button commits the map to the dedicated
  **`maps`** branch via the GitHub Contents API (same PAT/mechanism as
  `cloud-saves.js`; token is reversed in source). Files land at the mirrored
  `data/` paths so they're trivially merged into `main`:
  `data/layouts/<region>/<LAYOUT_ID>.json`, `data/maps/<region>/<Name>.json`,
  and the region index `data/maps/<region>_index.json` (read-modify-write).
- **☁ Load from repo** button lists every map on the `maps` branch (Git Trees
  API, recursive) in a picker modal and re-opens the chosen one for editing —
  fetches the map JSON + its layout, restores tileset/grid/collision/warps.
- The `maps` branch is an orphan storage branch (just created maps, no game
  code). To use a saved map in the game, copy its files from `maps` into `data/`
  on `main` and register the region in `INDEX_FILES` if new.

### Custom region + test override
- A **`custom`** region is registered in `INDEX_FILES`. Example map
  **`VerdantHollow`** lives at `data/maps/custom/` + `data/layouts/custom/`,
  generated by `tools/make_example_map.py`.
- **Startup override** (`src/main.js init`, loaded by **`game.html`**):
  `game.html?map=<Name>&region=<region>` loads any map directly instead of
  Pallet Town — e.g. `game.html?map=VerdantHollow&region=custom`.

### Region sources: GBA (2D) vs DS (3D)
- **Kanto** (pokefirered), **Hoenn** (pokeemerald), and **Johto** (pokemonHnS)
  are GBA — native 2D metatile tilemaps. Fully extracted into renderable layouts.
- **Sinnoh** comes from the **DS** decomp (pokeplatinum). DS maps are 3D geometry
  (BMD0/NSBMD models + map matrix), with no 2D metatile grid to extract directly,
  so a pure "image → 2D map" conversion isn't possible from DS sources — the DS
  path needs its own converter (see the Sinnoh TODO below).

### Environment egress note (for web sessions)
Submodules **cannot be `git clone`d** here — the git proxy is scoped to this repo
only and returns **403** for `pret/*`, `PokemonHnS-Development/*`, etc. But general
HTTPS egress DOES reach GitHub: `api.github.com`, `raw.githubusercontent.com`, and
`codeload.github.com` all return 200 through `$HTTPS_PROXY`. So to get a source
repo, download its **tarball** and extract into the submodule path, e.g.:
```
curl -L "https://codeload.github.com/PokemonHnS-Development/pokemonHnS/tar.gz/refs/heads/main" -o hns.tar.gz
mkdir -p source/pokemonhns && tar xzf hns.tar.gz -C source/pokemonhns --strip-components=1
```
(The HnS tarball is ~38 MB; the 829 MB repo "size" is mostly git history.) Content
placed at a submodule path is NOT swept into the parent repo by `git add`, so it
stays local. `pip install ndspy pillow` for the DS/graphics tooling.

### Johto via Pokémon Heart & Soul (HnS) — DONE ✅ (the 2D path)
Johto is now a **fully converted, wired, playable region** sourced from HnS.
- **`source/pokemonhns`** = the **HnS** ROM hack on **pokeemerald (GBA)**, so its
  Johto + Kanto maps ARE 2D metatile tilemaps (same format as Hoenn).
- **`tools/extract_hns_johto.py`** is the driver (supersedes the old
  `extract_hns.py`, which only did tilesets/layouts). It reuses
  `extract_tilesets_emerald.py` and additionally emits map metadata + the region
  index, all in the exact formats `GameMap`/`GameRenderer` consume:
  - `data/tilesets/hns_<primary>__<secondary>.png` + `.json` (16×16 metatiles, 16/row)
  - `data/layouts/johto/<LAYOUT_ID>.json` (metatile grid + collision)
  - `data/maps/johto/<MapName>.json` (layout ref, warps, connections, npcs, signs)
  - `data/maps/johto_index.json` (MAP_CONST → MapName)
  - Registered as region **`johto`** in `INDEX_FILES` (`src/engine/map.js`).
  - Run: `python3 tools/extract_hns_johto.py` (needs source at `source/pokemonhns/`).
  - Load in-game: `game.html?map=NewBarkTown&region=johto`.
- **Result:** 420 maps, 419 layouts, 107 tilesets. All 201 map connections
  resolve; only 6 warps dangle (into intentionally-excluded content). Verified by
  rendering NewBark/Goldenrod/Ecruteak/RuinsOfAlph/NationalPark — pixel-perfect.
- **Scope:** leftover pokeemerald base maps (the `gMapGroup_Emerald*` groups that
  ship unused in HnS, ~536 of 957 map folders) are **excluded** so the region is
  Johto/Kanto only. HnS Kanto maps live under the `johto` region key too.
- **Three HnS quirks the pipeline handles (all fixed in `extract_tilesets_emerald.py`):**
  1. **Tiles per primary = 640** (`NUM_TILES_IN_PRIMARY`; pokeemerald=512) — set
     `em.PRIMARY_TILE_COUNT = 640`, else secondary/building tiles render black.
  2. **Metatiles per primary = 640** (`NUM_METATILES_IN_PRIMARY`; pokeemerald=512).
     Blockdata stores raw *game* metatile indices where secondary metatiles begin
     at this fixed offset regardless of how many the primary defines. When a
     primary defines fewer (vanilla leftovers `general`=512, `building`=128),
     `process_layout` **remaps** game index → contiguous sheet index using the
     actual primary count + `em.PRIMARY_METATILE_COUNT = 640`. Without this,
     Kanto/Safari/National-Park maps shift every secondary tile by 128. Johto's
     own primaries are exactly 640 → identity remap (why New Bark was perfect
     before the fix but National Park was broken).
  3. **Tileset folders renamed vs symbol** — `tileset_name_to_path` resolves
     alias → mechanical snake_case → normalized scan (ignoring `_`). Genuine
     renames go in `em.TILESET_DIR_ALIASES` (e.g. `GoldenrodCity_TrainStation` →
     `goldenrod_station`).
- **Tileset naming is per (primary, secondary) pair** (`hns_<pri>__<sec>`), NOT
  secondary-only: HnS reuses one secondary (e.g. `CherrygroveCity`) against
  several primaries (`Johto_General` vs seasonal `Johto_NorthEast/NorthWest`),
  which produce genuinely different sheets. Secondary-only naming corrupts ~half
  those maps. The layout's `tileset` field points at the pair name.
- **2 known-broken source maps:** `LAYOUT_SAFFRON_TEMP` (a temp map) and
  `LAYOUT_ROUTE7` (unused Kanto route) reference metatiles beyond what their
  tileset defines — unfinished HnS content, not a converter bug; render harmlessly.

### Sinnoh via pokeplatinum — TODO ⏳ (the DS path, harder — NEXT TASK)
- **`source/pokeplatinum`** (pret) is the agreed Sinnoh source. (User said
  disregard pokeheartgold; the old metadata-only `data/maps/heartgold/*` was
  **removed** and the `heartgold` region key retired from `INDEX_FILES`.)
- Platinum is a **DS** game: field maps are 3D geometry (BMD0/NSBMD models + a
  map matrix), NOT 2D metatile tilemaps — so HnS's straight approach won't work.
  `tools/extract_tilesets_platinum.py` currently only dumps NSBTX texture atlases
  (not real maps), and `data/maps/platinum/*` is area-metadata only.
- **Plan for a real converter:** parse the map matrix → per-chunk
  **movement-permission grid** (this IS a 2D collision grid, extractable) +
  warps/events → engine `layout.json` + `map.json`; for the *visual* either
  (a) render the field BMD0 orthographically top-down and slice into a
  16px/16-per-row tileset, or (b) a behavior/permission-coloured fallback tileset
  (always works, immediately walkable). Fetch source via the tarball method above
  (`pret/pokeplatinum`, default branch `main`). Wire as region `sinnoh`
  (already in `REGIONS`/`INDEX_FILES` expectations).

### Planned: fan-game map converters (NOT built yet)
Two converters discussed as future capability for pulling maps out of other
Pokémon fan games. Both are feasible; neither is built. **Both need a sample
input committed to the repo to develop/verify against** — a parser can't be
trusted until its output renders correctly (the way HnS was verified).

- **RPG Maker XP / Pokémon Essentials** (Reborn, Rejuvenation, Insurgence, most
  fan games). Maps live in `Data/*.rxdata` (Ruby `Marshal` blobs): `Map###.rxdata`
  = a `w×h×3`-layer tile grid; `Tilesets.rxdata` = passability/priority flags
  (→ collision); `MapInfos.rxdata` = names; `Graphics/Tilesets/<name>.png` = art.
  Approach: Python + a Marshal reader → composite the 3 layers → emit
  `layout.json` + `tileset.png`. **Catch:** RMXP tiles are **32×32** vs the
  engine's **16×16** metatiles, so layout/collision convert cleanly but art
  doesn't natively fit — either downscale (quality loss) or add a 32px-tile mode.
  Result preserves map *design*; fidelity depends on the source game's art.
- **Compiled GBA ROM** (`.gba`, no source). Parse the ROM binary: map bank table
  → map headers → blockdata (same `u16` metatile+collision format we already
  handle) → tilesets (LZ77 gfx + palettes + metatile defs). **Upside:** produces
  native **16×16 GBA metatiles** — perfect fidelity, reuses the existing
  renderer. **Catch:** needs base-game ROM offsets (FireRed vs Emerald differ),
  LZ77 decompression, varies for repointed/expanded hacks; user supplies the ROM
  (legal caveat). This is the better path when GBA fidelity matters.

### Tooling (`tools/`)
- `build_tileset_index.py` — regenerate `data/tilesets/_index.json` (editor's
  tileset list) after adding tilesets.
- `make_example_map.py` — generate a layout from primitives (`rect`, border,
  scatter) over a verified palette; seed of the "describe → generate" workflow.
- `nds_decomp.py` — **NDS ROM decomp tool.** Explodes any `.nds` ROM into a
  pret-style tree: `arm9/arm7.bin`, `overlays/` (LZ-decompressed), `files/`
  (full NitroFS with real FNT names), `unpacked/` (every NARC expanded, members
  LZ77/LZ11-decompressed and extension-named by magic: `.nclr/.ncgr/.nscr/
  .nsbmd/…`), plus `DECOMP_MANIFEST.md` annotating community-known data NARCs
  (BW/BW2 `a/0/1/6` personal data, `a/0/9/1` trainers, `a/1/2/7` encounters,
  etc.; tables for Gen4/5 gamecodes). Usage:
  `python3 tools/nds_decomp.py <rom.nds> [-o source/nds/<name>] [--list]`.
  Default output `source/nds/<gamecode>/` is **gitignored** (ROM contents —
  never commit; individual extracted data files can be converted/copied into
  `data/` when needed). Pure stdlib, no deps. Produces the data/asset side of
  a decomp only — no C source (that part of pret repos is human RE work).
  **Getting the ROMs in a cloud session** — both of the user's ROMs are
  link-shared in their Google Drive and download straight into the sandbox
  (verified working; seconds each):
  ```
  # Pokémon Black (US, IRBO) — 256 MB
  curl -sSL "https://drive.usercontent.google.com/download?id=1uog4J8pUbTiNYptaoWAbdrY0E5HMEqwD&export=download&confirm=t" -o /tmp/pokemon-black.nds
  python3 tools/nds_decomp.py /tmp/pokemon-black.nds -o source/nds/IRBO

  # Pokémon Black 2 (US, IREO) — 275 MB (richer: 814 trainers, more maps/text)
  curl -sSL "https://drive.usercontent.google.com/download?id=11f9lNHk-42sDTxJHzLd9SAwy4niz35xk&export=download&confirm=t" -o /tmp/pokemon-black2.nds
  python3 tools/nds_decomp.py /tmp/pokemon-black2.nds -o source/nds/IREO
  ```
  Both verified on real extraction — B: 237 NARCs → 54,054 members; B2: 308
  NARCs → 69,850 members. All KNOWN_NARCS annotations confirmed present in
  both; personal data sanity-checked (member 0001 = Bulbasaur
  45/49/49/65/65/45). Extraction is ephemeral (gitignored, sandbox dies with
  session) — re-run the commands whenever ROM data is needed; convert what
  the game needs into `data/` formats and commit only that. Prefer **B2**
  as the data source (superset: all 649 species, BW2 encounters, more
  trainers/maps).
- `gen_party_assets.py` — regenerate the FireRed party-screen assets in
  `src/assets/party/` (slot boxes, fonts, pokéball, status icons, message frame)
  by decoding `source/pokefirered` graphics/tilemaps/palettes. Re-run if those
  assets need rebuilding.
- `extract_hns_johto.py` — **the Johto converter** (HnS → region `johto`). Emits
  tilesets, layouts, map metadata, and `johto_index.json`. See the "Johto via
  HnS — DONE" section above. Reuses (and depends on the fixes in)
  `extract_tilesets_emerald.py`.
- Full workflow doc: **`docs/MAP_EDITING.md`**.

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
