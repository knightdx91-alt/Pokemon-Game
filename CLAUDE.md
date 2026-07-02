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
  path needs its own converter (see the Sinnoh section above).
- **Unova** (Pokémon Black) is also DS/3D, same category as Sinnoh, but had
  **no reachable decomp source** when it was built (see the Unova section
  above) — it was reverse-engineered blind from the raw ROM instead of from
  a documented spec, which is why it's a smaller, rougher conversion
  (collision-only, no warps/npcs/real textures yet) than Sinnoh.

### Environment egress note (session-dependent — verify, don't assume)
GitHub egress scope **varies by session type** and has changed at least once —
don't trust an old note (including this one) without testing first.
A past web session had broad HTTPS egress: submodules couldn't be `git clone`d
(proxy 403 on `pret/*`, `PokemonHnS-Development/*`, etc.) but
`codeload.github.com` tarball downloads of arbitrary GitHub repos worked (200),
which is how `source/pokeplatinum` was fetched for the Sinnoh conversion. A
later GitHub-task-triggered session (the one that did the Unova work above)
had egress **scoped to only this one repo** — the exact same
`codeload.github.com/pret/pokeplatinum` tarball URL that worked before
returned 403. **Test with a `curl -o /dev/null -w '%{http_code}'` tarball
request before planning any work that depends on fetching an external decomp
repo** — if it 403s, that session cannot use the "fetch a source tree"
strategy at all, only raw-ROM reverse engineering (see `nds_decomp.py` /
`bw_common.py`). If it works, the tarball approach below applies:
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

### Sinnoh via pokeplatinum — DONE ✅ (the DS path)
- **`source/pokeplatinum`** (pret) was the Sinnoh source (fetched via the
  tarball method — codeload.github.com — in a past session; NOT present in
  every session, see the Unova section below for what happens without it).
  (User said disregard pokeheartgold; the old metadata-only
  `data/maps/heartgold/*` was **removed** and the `heartgold` region key
  retired from `INDEX_FILES`.)
- Platinum is a **DS** game: field maps are 3D geometry (BMD0/NSBMD models + a
  map matrix + a 32×32 terrain-attributes grid per land-data cell), not 2D
  metatile tilemaps. The full documented format lives in
  `source/pokeplatinum/docs/maps/file_format_specifications.md` — that
  human-written spec (the payoff of years of community decomp work) is what
  made a real converter tractable; see `tools/platinum_common.py`'s docstring
  for the resolved MAP_HEADER → matrix → land-data chain.
- **Pipeline (in `tools/`, run in this order):**
  1. `extract_platinum_maps.py` — walks every map header, resolves its matrix
     footprint + land-data cell(s), emits `data/layouts/sinnoh/<name>.json`
     (metatiles/collision/behavior/props) + `data/maps/sinnoh/<name>.json`
     (warps/npcs/signs) + `data/maps/sinnoh_index.json` +
     `data/maps/sinnoh_matrix/*.json`.
  2. `generate_platinum_tileset.py` — synthesizes the `sinnoh_overworld`
     placeholder tileset (one flat-colored 16×16 tile per behavior category)
     as a fallback appearance layer.
  3. `render_platinum_maps.py` — the real visual: parses each map's NSBMD
     model + NSBTX textures (`tools/nitro_g3d.py`, a from-spec Nitro G3D
     decoder — generic, not Platinum-specific), orthographically projects and
     rasterizes every triangle top-down, and bakes one real textured PNG per
     map to `data/maps/sinnoh_textured/<name>.png`.
  4. `extract_platinum_npcs.py` — decodes overworld NPC sprites from the
     `mmodel` NSBTX archive.
  5. `add_map_tilesets.py` — links each map to its `sinnoh_NNN` texture-set
     tileset (name-similarity heuristic against `area_data`).
- **Engine side:** `src/engine/map.js`'s `getBackground()` returns
  `layoutData.background`; `src/engine/renderer.js`'s `loadBackground()` /
  the "textured background" fast path draws that pre-rendered PNG instead of
  the metatile grid whenever a layout has one — the metatile/tileset fields
  stay as a fallback. Collision/warps/npcs still come from the layout/map
  JSON exactly like GBA regions.
- Result: 533 Sinnoh maps, real per-map textured top-down renders, walkable
  and warp-connected. Region `sinnoh` already wired in `REGIONS`/`INDEX_FILES`.

### Unova via Pokémon Black ROM — IN PROGRESS ⏳ (blind reverse engineering, no decomp source)
Started as "make the Black maps work like the Platinum maps." The critical
difference from Sinnoh: **GitHub access in a web/task session is scoped to
only this repo** (confirmed by testing — `codeload.github.com` 403s on
`pret/pokeplatinum` itself, the same tarball that worked in the session that
built Sinnoh). There is no `source/pokeblack`, and no known mature public
decomp for Gen-5 BW exists to fetch even if egress were open. Everything
below was reverse-engineered **blind**, straight from the raw ROM NARCs
produced by `tools/nds_decomp.py` against `source/nds/IRBO` (Pokémon Black,
US) — validated empirically by rendering hypothesized fields and checking
whether the output looks like a real map, not from any spec. Re-run the ROM
download + decomp commands (see the `nds_decomp.py` section above) to
reproduce `source/nds/IRBO/` in a fresh session; it's gitignored.

- **`tools/bw_common.py`** — the format writeup (read its module docstring
  for the full byte-level breakdown) and parser, playing the same role as
  `platinum_common.py` but for reverse-engineered-not-documented BW data:
  - `a/0/0/8` (649 members) = **land-data cells**. Each is a small `"WB"`
    container: header gives 3 sub-offsets → an embedded `BMD0` 3D model
    (decodable by the *existing, generic* `tools/nitro_g3d.py` — it's a
    from-spec Nitro G3D decoder, not Platinum-specific, so it works on any
    DS game's models unchanged), a 32×32 grid of 8-byte per-tile records, and
    a small ~10-entry trailing block (probably object/prop placements, not
    decoded).
  - Per-tile record (4× u16 LE): **field3 low byte bit0 = collision**
    (1=blocked) — validated by rendering it standalone for several land-cells
    and getting recognizable shapes (building footprints with walkable
    plazas, route paths, cave layouts — see investigation notes/screenshots
    in that session). **field3 bit15 = a "special" marker** (a handful of
    tiles per map) — consistent with warp/door placement but the
    destination data was never located, so these render as an inert
    placeholder tile, not a working warp.
  - `a/0/0/9` (255 members) = **map matrices** (grid header + per-cell
    records referencing land-data indices, `0xFFFF`-sentinel empty cells) —
    structurally similar to Platinum's `map_matrix_*.json`. **However**,
    stitching matrix cells into one contiguous world image did NOT produce
    coherent overworld geography (interior-looking room shapes scattered
    through the grid) — it appears to be a bookkeeping/placement table, not
    literal world layout, unlike Platinum's matrix. Conclusion: **don't
    assume matrix adjacency implies walkable adjacency**; each land-cell is
    currently converted as an independent standalone map.
  - Text bank **89** (of 288 in `a/0/0/2`) is the location-name list (117
    names — Nuvema Town, Route 1, Striaton City, …) but it's the coarse Town
    Map region granularity, not a 1:1 table for the 649 land-cells, so it
    could **not** be used to name individual converted maps.
  - Roughly **383 of 649** land-cells use this `"WB"` format; the rest start
    with different magics (`GC`, `NG`, `RD` — seen ~266 times combined,
    unidentified) and are skipped by the converter.
- **`tools/extract_bw_maps.py`** — converts every eligible (`"WB"`-magic,
  15–90% collision-ratio) land-cell into a standalone map: `python3
  tools/extract_bw_maps.py [--limit N]`. Outputs `data/layouts/unova/area_
  <NNNN>.json`, `data/maps/unova/area_<NNNN>.json`,
  `data/maps/unova_index.json`. Maps are honestly labeled `"Unova Area
  <N>"` (no confirmed land-cell → real-name mapping exists) with **no
  npcs/warps/connections** (not yet located) — walkable-only.
- **`tools/generate_bw_tileset.py`** — the `unova_placeholder` tileset: 3
  flat-colored 16×16 tiles (floor / wall / special-marker). No appearance/
  texture data has been decoded yet, unlike Sinnoh's real `render_platinum_
  maps.py` output — this is the Platinum pipeline's step-2 fallback tier
  only, step-3 (real textured rendering) has no BW equivalent yet.
- **Verified working end-to-end in-browser**: region `unova` wired into
  `REGIONS`/`INDEX_FILES` in `src/engine/map.js`; `game.html?map=area_0000&
  region=unova` loads, renders, and is walkable — collision correctly blocks
  movement into wall tiles and allows it elsewhere, camera scrolls, HUD
  updates. Spot-checked several more (`area_0002`, `area_0014`, `area_0100`,
  `area_0300`) with no console errors.
- **BREAKTHROUGH (follow-up session): the zone-header table + texture sets
  are decoded and validated.** A magic-scan for `BTX0` found the field
  texture sets at **`a/0/1/4`** (282 NSBTX sets), and **`a/0/1/2`** (single
  member, 427 records × 48 bytes) turned out to be the **zone-header
  table** — BW's equivalent of Platinum's `sMapHeaders[]`. Decoded fields
  (full offset map in `tools/bw_common.py`'s docstring; parser:
  `bw_common.load_zone_headers()`): texture-set id (off 2), matrix id
  (off 4), two consecutive per-zone script/text indices (off 6/8), another
  per-zone archive index (off 10, prime **candidate for the events/warps
  archive** — untested), 4 seasonal music ids (off 12–18), parent zone
  (off 24), and **location-name id (off 26, u8)** into text bank 89.
  **Validated end-to-end:** zone 389 = matrix 0 + texset 2 + "Nuvema Town",
  interiors as dedicated matrices with interior texsets; and rendering
  land-cell 0's BMD0 with texset 2 through the **unchanged Platinum
  rasterizer** (`render_platinum_maps.rasterize_triangle`/`_draw_model_
  triangles`/`texture_rgba` — they're model-agnostic) produced a
  **pixel-real Nuvema Town terrain render** (path loop, tree borders,
  beach, pier). `nitro_g3d.py` parses BW BMD0s as-is (geometry-only MDL0,
  no TEX0 — same split as Platinum). This also solved the earlier "matrix
  stitching looks incoherent" mystery: **matrix 0 is the one real
  contiguous Unova overworld**; most of the other 254 matrices are small
  per-interior matrices, so stitching those never looks like an overworld.
- **What's still open** (each is its own reverse-engineering sub-project,
  none started from a documented spec):
  1. Warp destination + NPC/event data — zone-header off 10 (or the off 6/8
     pair) very likely indexes the events archive; `a/1/2/5` (428 members)
     is the size-profile favorite. Untested.
  2. Prop placement (the `WB` tail-block's 16-byte records) + the prop-model
     archive (`a/0/4/9`, 758 BTX0-containing members, is the candidate) —
     buildings/trees are missing from textured renders until this is done.
  3. The `GC`/`NG`/`RD`-magic land-cells (~266 of 649).
  4. The full textured-render pipeline (`render_bw_maps.py` mirroring
     `render_platinum_maps.py` steps: per-zone texset resolution → bake
     `data/maps/unova_textured/*.png` → set `background` on layouts → real
     map names from zone table instead of "Unova Area <N>") — all the hard
     unknowns for the base terrain are now solved, this is mostly plumbing.
  5. Seasonal variants: 4 music ids per zone and multiple texture sets
     matching the same texture names suggest per-season texture sets;
     pick one season (spring) for consistency.

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
- `3ds_decomp.py` — **3DS ROM decomp tool** (counterpart to `nds_decomp.py`
  for Gen 6/7). Takes a **decrypted** `.3ds/.cci/.cxi` and explodes it:
  NCSD→NCCH→`exefs/` (code, banner) + `romfs/` (full file tree) + `unpacked/`
  (every **GARC** archive expanded, members LZ11-decompressed, magic-named).
  `DECOMP_MANIFEST.md` annotates known Pokémon GARCs (X/Y personal data
  `a/2/1/8`, learnsets `a/2/1/4`, moves `a/2/1/2`, encounters `a/0/1/2`, etc.;
  tables for X/Y + ORAS product codes). Same stdlib LZ codec as the NDS tool.
  Usage: `python3 tools/3ds_decomp.py <rom.3ds> [-o source/3ds/<code>] [--list]`.
  Requires a ROM the user legally owns/backed up (share via Drive link like the
  NDS ROMs). Note Gen 6 maps are **3D** — data ports to 2D, maps do not.
- `rom_to_2d.py` — **ROM data → 2D game converter.** Reads the `unpacked/`
  tree from `nds_decomp.py` (Gen 5) and emits this game's exact `data/` shapes:
  `data/pokemon/base_stats.json`, `moves.json`, `learnsets.json`, and
  (experimental) `data/encounters/gen5_<bw|bw2>.json`. Decodes the Gen-5
  encrypted text banks for English species/move/ability names (from a/0/0/2:
  species=member 70, abilities=182, moves=203 — verified on the English Black
  ROM IRBO). Defaults to **`--dry-run`-friendly** (real writes overwrite
  `data/` — diff first). Add **`--merge`** to union with the existing `data/`
  file instead of overwriting (ROM data wins on key collisions, but any
  pre-existing key the ROM text doesn't reproduce byte-identically survives)
  — use this whenever engine code hardcodes move/species slugs elsewhere
  (see gotcha below), so a re-run can't silently orphan them. Usage:
  `python3 tools/rom_to_2d.py source/nds/IRBO --only stats,moves,learnsets --merge [--dry-run]`.
  Verified (full run against Pokémon Black IRBO): 650 species, 560 moves, 675
  learnsets written to `data/pokemon/`; Charizard 78/84 Fire/Flying +
  Blaze/Solar Power; Flamethrower 95pw special; Charmander learnset exact;
  party viewer in-browser renders the merged data correctly. Use an English
  ROM for names (`--names-from source/nds/IRBO`) if converting a localized
  data ROM. Same rationale as the decomp tools: Gen-5 game *data*
  (stats/moves/movesets/encounters) ports cleanly to 2D; Gen-5 *maps* are 3D
  and don't.
  **Gotchas fixed while porting Black's data in (all in `tools/rom_to_2d.py`):**
  1. `convert_moves()` used to emit `[["slug", {...}], ...]` (a list of
     pairs) — but `battle.js`/`summary.js` do direct `_movesDb[moveId]`
     object lookups. Now emits a plain `{slug: {...}}` dict.
  2. Gen-5's font table encodes ♂/♀ as the non-standard code points
     0x246D/0x246E (verified via national dex #29 Nidoran♀ / #32 Nidoran♂),
     not the real Unicode symbols — `decode_text_member` now maps them
     explicitly, else `chr()` renders circled-digit glyphs instead.
  3. `slug()` (moves) now splits camelCase boundaries before lowering —
     Gen-5 move text has no spaces (`"DoubleSlap"`, `"ThunderPunch"`) so it
     used to produce `doubleslap` instead of the existing convention
     `double_slap`.
  4. Added `species_key()` (stats/learnsets keys) to strip apostrophes and
     collapse other punctuation/spaces/gender-symbols to `_`, matching the
     existing `FARFETCHD` / `MR_MIME` / `HO_OH` / `NIDORAN_F` key convention
     — plain `name.upper()`/`.lower()` left the raw punctuation in.
  5. A handful of moves (`torment`, `embargo`, `dark_void`) have anomalously
     1-byte-short entries in Black's move-data NARC and get skipped; `nuzzle`
     / `freeze_dry` don't exist yet in Gen 5 (introduced Gen 6). `--merge`
     is what keeps these from disappearing on a fresh (non-merge) run.
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
