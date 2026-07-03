# Open-World Multiplayer Pokémon — Game Plan

**Vision:** An "Old School RuneScape, but Pokémon" — a persistent, seamless,
multiplayer top-down world spanning all 7 regions. Click/tap-to-walk movement
(RS-style) with the current on-screen controls kept as an option. See other
players in real time. Walk region-to-region with no map transitions. Gyms and
Elite 4 in every region that players can *hold* as positions. Trading. Browser
first, Android/APK later. Visual + UI language of Pokémon Platinum (DS dual-screen
feel) over a 2D top-down world.

**Status of assets:** Regions 1–4 (Kanto, Hoenn, Johto, Sinnoh) have map data in
the repo today. Regions 5–7 (Unova, Kalos, Alola) come later — Unova is partially
reverse-engineered (see CLAUDE.md), Kalos/Alola need 3DS extraction.

---

## The one decision everything hangs on: the server

The repo today is **100% client-side** (localStorage saves, no backend). Every
headline feature you want — seeing other players, trading, holding a gym,
"screenshotted" static opponents — is **impossible without an authoritative
server + database.** So the architecture, not the art, is the real Phase 1.

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

## UI direction (per your call): menus = RPG card, everything else = Platinum
- **Menus:** match the **Pokémon RPG card** look (the EE dark-theme GBA window
  system already built in `src/ui/startmenu.js` + sub-menus). Keep that — it's the
  menu style you want.
- **Battle scenes, battle backgrounds, healthboxes, dialogue, HUD framing:**
  **Pokémon Platinum.** Re-skin `src/engine/battle.js` (DOM battle UI) and the
  battle overlay to Platinum's DS look — dual-screen framing, Platinum healthboxes,
  Platinum battle backdrops/terrain, Platinum message window. Art source:
  `source/pokeplatinum` (pret) + the Sinnoh textured renders already in the repo.
- "Both screens": emulate Platinum's dual-screen layout (main view + bottom
  status/menu screen) as the frame around the 2D top-down world and battles.
- True DS **3D overworld** rendering for all regions stays a **stretch goal** —
  regions 1–3 are 2D-native with no 3D models. The 2D top-down world wears a
  Platinum *skin*, it isn't re-rendered in 3D.

---

# PHASES

### Phase 0 — Foundation & prototype (client-only, no server yet)
- A* pathfinding + tap-to-walk on the current engine, D-pad kept as option.
- **Seamless movement is already built** (`seamlessConnectionStep` /
  `seamlessMatrixStep`) — extend prefetch from single-neighbor to a ring so fast
  movement can't outrun it; verify no black screens across a whole region.
- Player sprite rendering on canvas (currently a placeholder).
- Reuse the **Crater overlay pattern** (`overworld.js drawOverlay`) as the render
  hook that other players will later plug into.
- **Exit criteria:** walk seamlessly across a whole region, tap-to-move, no black
  screens.

### Phase 1 — Server & real-time multiplayer (the big one)
- Stand up authoritative server (Colyseus recommended) + DB + accounts.
- Move position/facing to server; render other players in the same zone in real
  time with interpolation.
- Server-side chunk/interest management (only send nearby players).
- **Exit criteria:** two devices see each other walking around one region live.

### Phase 2 — Persistence & core loop
- Server-side saves: party, box, inventory, dex, position, money.
- Wild encounters, PvE battles (wild + NPC) using existing battle logic.
- **Exit criteria:** log in on any device, resume your persistent character.

### Phase 3 — PvP, trading, gym/E4 holder system
- Server-authoritative PvP battles.
- Two-phase trading.
- Gym/E4/Champion slots with team snapshotting, challenge, replace, relinquish.
- **Exit criteria:** hold a gym, get challenged/replaced while offline; trade.

### Phase 4 — Full world & Platinum UI polish
- All available regions (1–4) streamed into one seamless world + inter-region
  land/sea bridges.
- Platinum-style dual-screen HUD, menus, battle framing.
- Audio, NPCs/dialogue, region-spanning progression.

### Phase 5 — Scale & port
- Zone sharding / multiple server processes as population grows.
- Android: wrap the optimized PWA in Capacitor/TWA for an APK (works because it's
  already mobile-web-optimized). Keep the web build as source of truth.
- Add regions 5–7 as their assets land (Unova RE, Kalos/Alola 3DS extraction).

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
