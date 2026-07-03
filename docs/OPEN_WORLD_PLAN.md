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

## Seamless world (no map transitions) — chunk streaming

This is the hardest single piece. Today the engine loads one map and swaps on
warp/connection. Replace that with:
- **Chunk streaming:** keep the player's current map plus all neighboring
  connected maps loaded at once; load/unload chunks as the player crosses
  boundaries, so there's never a black-screen transition.
- The map `connections` data already defines neighbor offsets — that's the input a
  streaming system needs. The work is a coordinate system that spans chunks (a
  global world-space) instead of per-map local coordinates.
- **Regions connect via land bridges/sea routes** authored as normal connected
  maps, so "walk from Kanto to Johto" is just more chunks — no special-casing.
- Interiors (buildings, caves) can stay as discrete loads with a door
  fade — OSRS does the same; only the *overworld* must be seamless.

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

## Platinum look, over a 2D world
- "Looks/acts like Platinum" = **DS dual-screen HUD + menu + battle framing**
  wrapped around the existing 2D top-down overworld. Mine the Platinum pret
  (`source/pokeplatinum`) and the Sinnoh textured renders for the UI art.
- True DS 3D overworld rendering for all regions is a **stretch goal**, not
  Phase 1 — regions 1–3 are 2D-native and have no 3D models at all.

---

# PHASES

### Phase 0 — Foundation & prototype (client-only, no server yet)
- A* pathfinding + tap-to-walk on the current engine, D-pad kept as option.
- Global world-space coordinate system; chunk streaming for 2+ connected maps
  with zero transition (prove it across one region).
- Player sprite rendering on canvas (currently a placeholder).
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
