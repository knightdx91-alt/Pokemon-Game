# Open-World Multiplayer Pokémon — Game Plan

**Vision:** An "Old School RuneScape, but Pokémon" — a seamless top-down world
spanning all 7 regions, with **every graphic faithful to Pokémon Platinum** (DS
dual-screen, all menus, all battles). Click/tap-to-walk movement (RS-style) with
the current on-screen controls kept as an option. Walk region-to-region with no map
transitions. Gyms and Elite 4 in every region that players can *hold* as positions.
Trading. Browser first, Android/APK later.

**Build order (per the user):** get the **single-player game working exactly the
way I want it first** — seamless world, Platinum-faithful UI, battles, the full
game loop. **Multiplayer (seeing other players, trading, gym-holding) comes LAST**,
after everything else works. The server sections below are real and necessary, but
they are the FINAL phase, not the first.

**Status of assets:** Regions 1–4 (Kanto, Hoenn, Johto, Sinnoh) have map data in
the repo today. Regions 5–7 (Unova, Kalos, Alola) come later — Unova is partially
reverse-engineered (see CLAUDE.md), Kalos/Alola need 3DS extraction.

---

## The multiplayer server (LAST phase — documented here, built last)

The repo today is **100% client-side** (localStorage saves, no backend). The
multiplayer features — seeing other players, trading, holding a gym,
"screenshotted" static opponents — are **impossible without an authoritative
server + database.** Per the build order, this is deferred to the final phase; it's
documented here so the earlier single-player architecture doesn't paint us into a
corner (e.g. keep movement tile-locked and state serializable so it ports cleanly
to server authority later).

**Authoritative-server model (the OSRS model, and the right one here):**
- The server owns truth: player positions, world state, gym holders, trades.
- The client *predicts* movement locally for responsiveness, then reconciles to
  what the server confirms. This is what makes OSRS feel fine on bad mobile
  connections — and Android browser is exactly that environment.
- Never trust the client for anything that affects other players (anti-cheat 101).

**Recommended stack (pragmatic, cheap to start, scales later):**
- **Realtime transport:** WebSocket. Node server (`ws` or `uWebSockets.js`) or a
  managed layer (Colyseus is purpose-built for authoritative room-based multiplayer
  and would save weeks). Colyseus is the recommendation for a first version.
- **Persistence:** Postgres (players, party, gym holders, trades) + Redis for
  hot/ephemeral state (who's online, positions per zone). SQLite is fine to start.
- **Auth:** simple account system (email or OAuth). Needed before persistence
  means anything.
- **Hosting:** a small VPS or Fly.io/Railway to start. One region-server process
  can hold a lot of players before you need sharding.

---

## Movement model: RS '04 tap-to-walk + current controls

Keep BOTH input styles, they're not in conflict:
- **Tap/click a tile → pathfind → walk there** (the RS feel you want). Add A* over
  the existing collision grid. This is a self-contained client feature you can
  build on the current engine before any server work.
- **D-pad / joystick** (current Pokémon Crater / RPG controls) stays as the direct
  option for players who prefer it and for precise movement.
- Movement is **still tile-locked** under the hood (like both OSRS and Pokémon),
  which keeps it netcode-friendly: you sync tile coordinates + facing + a movement
  intent, not raw pixel positions.

---

## Seamless world (no map transitions) — ALREADY BUILT, extend it

**This already works today** — I was wrong to call it greenfield. `src/main.js`
implements it:
- `seamlessConnectionStep()` (GBA-style connections) and `seamlessMatrixStep()`
  (DS matrix seams) prefetch neighbor maps and step the player across the seam by
  shifting into the new map's local frame **mid-walk**, so the walk interpolation
  continues with no black screen. `switchToNeighbor()` / `switchToMap()` in
  `src/engine/map.js` do the frame swap.
- The async `transitionToConnection()` / `transitionToMatrix()` are only
  *fallbacks* for the first few frames before prefetch completes.
- The map `connections` data + matrix origins are the neighbor-offset inputs.

**So the remaining work is extension, not invention:**
- Widen prefetch from immediate neighbors to a ring (keep player's chunk + all
  chunks within N tiles loaded) so fast movement never outruns the prefetch.
- **Regions connect via land bridges/sea routes** authored as normal connected
  maps, so "walk from Kanto to Johto" is just more chunks — no special-casing.
- Interiors (buildings, caves) can stay as discrete door-fade loads — OSRS does
  the same; only the overworld must be seamless (and is).

---

## Gym / Elite 4 holder system (the original hook — this is great)

Server-side persistent world roles. Design as you described:
- Each region has 8 Gym Leader slots + Elite 4 (4) + Champion (1) slots.
- A player may hold **exactly one** position globally at a time.
- On taking a slot, the server **snapshots** the player's current team +
  stats/levels/movesets ("screenshotted") into the slot record. That frozen team
  is what challengers battle — the holder doesn't have to be online.
- Challengers who win can **replace** the holder; the displaced player is marked
  "taking a break" (slot freed / bumped).
- To relinquish voluntarily, the holder walks to their gym/position and removes
  themselves.
- All of this is server records + a battle against a snapshot — very tractable
  once the server exists. No holder data ever lives on the client.

---

## Battle & trading
- **Battle engine:** the repo already has verified Gen-3/4 damage math, type
  chart, catch/AI servers (the USUM decomp `decomp/`), plus working DOM battle
  UIs in `src/crater/` and `src/engine/battle.js`. Reuse the logic; PvE (wild +
  gym snapshots) can resolve client-side at first, but **PvP battles must be
  server-authoritative** (both clients submit moves, server resolves) to prevent
  cheating.
- **Trading:** server-mediated, two-phase confirm (both players lock in, server
  executes atomically). Classic trade-window pattern.

---

## UI direction: EVERY graphic is Pokémon Platinum

**Hard rule: ALL graphics — every menu, every screen, every window frame, the HUD,
battles, dialogue — match Pokémon Platinum.** The current RPG-card / EE menu style
is replaced, not kept. "Both screens" = emulate Platinum's DS dual-screen layout
(top view + bottom touch screen) as the frame around the 2D world and every menu.

- **Art source:** `source/pokeplatinum` (pret decomp) graphics/palettes/tilemaps +
  the Sinnoh textured renders already in the repo.
- True DS **3D overworld** rendering stays a **stretch goal** — regions 1–3 are
  2D-native with no 3D models. The 2D top-down world wears a Platinum *skin*; the
  UI/menus/battles are pixel-faithful Platinum.

### Verification: headless DS pass (deferred — needs ROM + emulator)
Every screen below must be **visually matched against the real game**. That
requires a session with (a) a Platinum ROM or a built pokeplatinum ROM, and (b) a
DS emulator (melonDS/DeSmuME headless). **Neither is available in the current
session** — egress is repo-scoped (`codeload.github.com` 403 on pret), no ROM
(only `pokemon-black.nds`), no emulator installed. Bootstrap for a capable session:
1. Get the source: `curl -L codeload.github.com/pret/pokeplatinum/tar.gz/main`
   (when egress allows) → build the ROM, OR use a user-supplied Platinum `.nds`.
2. Install melonDS (headless/SDL) or DeSmuME-cli.
3. Script inputs + save states to navigate to each screen; screenshot each;
   diff against the reimplementation.

### FULL Platinum screen/menu inventory (the "ALL PLATINUM" checklist)

**System frame & HUD**
- DS dual-screen frame (top render screen + bottom touch screen)
- Overworld HUD; Pokétch always-on bottom-screen app frame
- Window/message frame styles (Options "Frame" 1–20)

**Start (X) menu**
- Pokédex · Pokémon (party) · Bag · Trainer Card ([PLAYER]) · Save · Options

**Pokédex**
- National/Regional list view · detail (info/area map/cry/size) · form switch ·
  search & sort (A–Z, heaviest, tallest, type…)

**Party (Pokémon) menu**
- Party list · per-mon action menu (Summary / Switch / Item Give-Take-Check /
  field move) · field-move (HM) menu

**Summary (all pages)**
- Info / Trainer Memo · Skills+Stats (6 stats, ability, held item) · Moves list
  (PP) · Move detail (power/acc/desc) · Ribbons · Contest condition (Cool/Beauty/
  Cute/Smart/Tough + sheen) · Markings editor

**Bag (all pockets)**
- Items · Medicine · Poké Balls · TMs & HMs · Berries · Mail · Battle Items ·
  Key Items · use/give/toss · quantity selector · registration

**Battle UI (full)**
- Command menu (Fight/Bag/Pokémon/Run) · move select (type + PP box) · target
  select (doubles) · both healthboxes + EXP bar + status · in-battle party switch ·
  in-battle bag · catch/throw sequence · level-up stat window · learn/forget move ·
  message + Yes/No box

**PC / Pokémon Storage System (Bill's PC)**
- Box grid (30) · box list · wallpaper picker · box naming · Move mode · Item mode ·
  Deposit / Withdraw · summary-from-box · release confirm

**Trainer Card** — front (name/ID/money/dex/time/badges) · back (signature/records)

**Options** — Text Speed · Battle Scene · Battle Style · Sound (mono/stereo) ·
Button Mode · Frame

**Save** — save prompt · overwrite-existing prompt · saving animation

**Text-entry (keyboard)** — player name · Pokémon nickname · box name

**Shops & services** — Poké Mart buy/sell + quantity + confirm · Poké Center nurse/
heal · PC access menu

**Dialogue & choice boxes** — overworld message window · Yes/No · multi-choice
list · price/quantity spinner

**Pokétch (25 apps)** — Digital Watch, Calculator, Memo Pad, Pedometer, Pokémon
List, Dowsing Machine, Berry Searcher, Day-Care Checker, Pokémon History, Counter,
Analog Watch, Marking Map, Link Searcher, Coin Toss, Move Tester, Calendar, Dot
Artist, Roulette, Trainer Counter, Kitchen Timer, Color Changer, Matchup Checker,
Stopwatch, Alarm Clock

**Town Map / Fly** — region map · Fly destination select

**Sinnoh Underground** — dig view · Secret Base editor · goods menu · flag/capture-
the-flag UI

**Super Contests** — entry · Visual · Dance · Acting (move appeal) · Poffin case /
Poffin cooking

**Link / online (later, with multiplayer)** — Union Room · trade screen · GTS ·
Wi-Fi Club · Voice Chat frame

**Misc field UI** — Poké Radar · VS Seeker · Honey tree · Berry planting/growth ·
Amity Square · Day-Care · Battle Tower/Frontier menus

> Each entry is a build-and-verify unit: reimplement in the engine, then match it
> against the headless-DS screenshot in the deferred verification pass.

---

# PHASES

Single-player first, fully the way you want it. Multiplayer is the **last** phase.

### Phase 0 — Movement & world foundation (client-only)
- A* pathfinding + tap-to-walk on the current engine (RS feel); D-pad kept as option.
- **Seamless movement is already built** (`seamlessConnectionStep` /
  `seamlessMatrixStep`) — extend prefetch from single-neighbor to a ring so fast
  movement can't outrun it; verify no black screens across a whole region.
- Player sprite rendering on canvas (currently a placeholder).
- Keep movement tile-locked + state serializable (so multiplayer ports cleanly later).
- **Exit:** walk seamlessly across a whole region, tap-to-move, no black screens.

### Phase 1 — Platinum UI conversion (the big art/UI phase)
- Build the **DS dual-screen frame** (top + bottom touch screen).
- Reskin/reimplement **every screen in the inventory above** to pixel-faithful
  Platinum: Start menu, Bag, Party, Summary (all pages), Pokédex, Trainer Card,
  Options, Save, PC/Box, dialogue/choice boxes, text-entry keyboard, shops.
- **Deferred headless-DS verification pass:** with a ROM + emulator, screenshot
  each real Platinum screen and diff against the reimplementation.
- **Exit:** every menu matches Platinum, verified against the real game.

### Phase 2 — Core single-player game loop
- Player party/party menu wired to real data; wild encounters on grass/cave tiles.
- **Battle system, fully Platinum** — reskin `src/engine/battle.js`: command menu,
  move select, healthboxes + EXP bar, catch sequence, level-up/learn-move,
  in-battle bag/switch. Reuse the verified damage/type/catch/AI logic (`decomp/`).
- NPCs + dialogue (Platinum message window), trainer battles.
- Server-independent saves stay in localStorage for now (structured to port later).
- **Exit:** start → catch → battle → gyms, a complete single-player loop.

### Phase 3 — Full world & content
- All available regions (1–4) streamed into one seamless world + inter-region
  land/sea bridges. Gyms + Elite 4 as single-player content in every region.
- Pokétch apps, Town Map/Fly, Underground, Super Contests as scope allows.
- Audio (Platinum-style), region-spanning progression.
- **Exit:** the full single-player game, all four regions, working the way you want.

### Phase 4 — Android/port
- Wrap the optimized PWA in Capacitor/TWA for an APK (already mobile-web-optimized).
  Keep the web build as source of truth.
- Add regions 5–7 as their assets land (Unova RE, Kalos/Alola 3DS extraction).

### Phase 5 — Multiplayer (LAST — only after everything above works)
- Stand up authoritative server (Colyseus recommended) + DB + accounts; migrate
  saves server-side.
- Render other players in the same zone in real time (reuse the Crater
  `drawOverlay` hook); server-side interest management.
- Server-authoritative PvP battles; two-phase trading.
- **Gym/E4/Champion holder system:** slots with team snapshotting ("screenshot"),
  challenge, replace (displaced holder → "taking a break"), walk-to-relinquish.
- Scale: zone sharding as population grows.
- **Exit:** see other players live, trade, hold/lose a gym.

---

## Reality checks / risks
- **Server is now core infrastructure** — hosting cost, uptime, and anti-cheat
  become real concerns the moment multiplayer ships. Budget for it.
- **Seamless streaming + a global coordinate space** is the hardest engineering
  piece; do it early (Phase 0) because everything sits on it.
- **Scope:** this is a large, multi-month project. The phases are ordered so each
  one is independently playable/demoable — resist building Phase 3 features before
  Phase 1's server exists.
- **Legal:** fan MMO with real-time multiplayer draws more attention than a
  single-player fan game. Keep it non-commercial; never commit ROM bytes (repo
  already follows this).
