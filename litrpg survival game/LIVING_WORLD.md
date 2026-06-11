# Living World — Roaming NPCs, Time & Persistence

> Design for a world that feels alive: NPCs that roam across all four regions, simulated cheaply,
> and a **persistent, time-consistent** world where NPCs only ever move as far as they plausibly
> could in the time that actually elapsed. Companion to `DESIGN.md`, `WORLD.md`, `HIDDEN_LAYER.md`.
> **Status:** brainstorming / pre-implementation.

---

## 0. The Goal

The world should feel alive — you meet a merchant in Verdara and genuinely run into the same
merchant in Halveth hours later, because they actually traveled there. But the game must never
render thousands of sprites at once, and the world must stay **consistent**: log off, come back
15 minutes later, and an NPC that was on one side of the world is **not** suddenly on the opposite
side — there's no way they walked that far that fast.

Two systems achieve this: a **two-layer simulation** (cheap, scalable) and a **time-driven,
speed-bounded clock** (consistent, persistent).

---

## 1. Two-Layer Simulation

### Layer 1 — Abstract simulation (the "world brain")
Every roaming NPC is a small record in **world state** (not player state):
```
NPC = {
  id, name, role,
  currentZone, destinationZone,
  path: [zoneA, zoneB, ...],   // route through the world-graph
  pathProgress: 0.0–1.0,        // how far along the current leg
  x, y,                         // exact tile within currentZone
  speed,                        // zones per in-game hour (bounded)
  schedule,                     // home/work/sleep or travel loop
  flags                         // e.g. "remembers-before", "vanishing", "construct"
}
```
A lightweight ticker advances these between zones over in-game time. **No sprites, no rendering** —
an NPC "traveling Goldfield → Tidecrown" is just numbers ticking. Hundreds run for almost free.

### Layer 2 — Materialization (the "actor")
On entering a zone, the game asks the world brain *"who is here right now?"* and spawns real walking
sprites **only** for those NPCs, at their stored `x,y`. On leaving, they de-spawn back into abstract
records — the brain keeps moving them whether or not you're watching.

> The player only ever renders the handful on the current screen; the world *feels* fully populated.
> This is the Majora's-Mask-schedule / RDR2-population / roguelike-off-screen-sim technique.

### Don't over-simulate
- **Most NPCs:** cheap abstract layer (town schedules + a few dozen named cross-region travelers).
- **Story-critical NPCs:** can be pinned/scripted when continuity must be exact (escort, quest).
- Skip: full real-time pathfinding for *every* NPC across all regions — unnecessary; the illusion
  is indistinguishable and far more stable.

---

## 2. Time-Driven, Speed-Bounded Movement (the consistency rule)

**An NPC never teleports to its destination.** It has a `speed` and a `path`, and the brain only
ever advances it by `elapsed_time × speed`.

- Log off with an NPC in Verdara heading east → return **15 min** later → brain advances 15 min of
  travel → NPC moved 15 minutes' worth down its path (still in Verdara, maybe one zone over).
- Return **2 days** later → brain advances 2 days of travel → it *could* now legitimately be in
  Halveth, because enough time actually passed.

> The guarantee is **not** "the NPC stays put" — it's "the NPC only ever moved as far as it could
> have walked in the time that actually elapsed." Always physically plausible.

### World clock
- A **world clock** with a time-scale (e.g. 1 real minute = N in-game minutes), driving — and driven
  by — the existing day/night cycle (`state.worldClock`).
- NPC `speed` is defined in **in-game time**, so "15 real minutes" maps cleanly to an in-game journey.

---

## 3. Offline Advancement — Catch-up with a Cap

**Recommended: catch-up, not freeze.** On load, advance the world brain by the real time elapsed —
*bounded by travel speed* so it's always plausible — so the world genuinely changed while you were
away, but no one ever teleports.

- **Cap offline simulation** at a ceiling (e.g. 24–48 in-game hours). Returning after a month
  fast-forwards only up to the cap — bounded plausibility *and* bounded surprise (the world is still
  recognizable).
- **Freeze** is the simpler fallback (world only ticks while playing); choose per how alive you want
  the world to feel between sessions. Catch-up is the richer default.

### The mechanism — one timestamp, no drift
```
on save:  store lastSimTime = worldClock
on load:  delta = min(now - lastSimTime, OFFLINE_CAP)
          advance every NPC by delta (speed-bounded along their paths)
          lastSimTime = worldClock
```
Single source of truth = `lastSimTime`. No drift, no teleports, deterministic.

### Persist EXACT state, not just the zone
Save `{ currentZone, pathProgress, x, y }` per NPC so reload restores the precise spot — never
snaps an NPC to a zone center or its destination.

### Deterministic & multiplayer-ready
- Advance via a **seeded** simulation so identical elapsed time always yields identical results.
- This is the multiplayer hook: the world brain can later move to a thin server and every client
  computes the **same** world. Keep NPC/world state cleanly separated from player state (already a
  locked architecture decision).

---

## 4. Theme Hooks — the Living World supercharges the story

- **"NPCs who remember before" who vanish** — with the world brain it's literal: flag the record
  `vanishing`; one day the ticker removes it (leaving a note). They don't blink across the map —
  they plausibly traveled somewhere over real elapsed time, *then* the record is flagged gone. Eerie
  because the world genuinely tracked them.
- **Surveillance-reactive NPCs** — high-Surveillance flags let System Constructs actually *path
  toward* the player across zones. The watcher feels alive.
- **Pseudo-MMO feel, single-player** — delivers the "sandbox MMO" vibe of the concept doc without
  needing multiplayer yet.

---

## 5. Scope Honesty

- **Cheap / early:** abstract NPC records + the world clock + the `lastSimTime` catch-up rule +
  exact-position persistence. Town schedule loops. A dozen named travelers.
- **Medium:** materialization spawn/de-spawn polish, schedules reacting to time/weather/cleared
  Calamities, the vanishing-NPC flag pipeline.
- **Defer:** Surveillance pathing-toward-player constructs, large named-traveler casts, server-side
  world brain (multiplayer).

---

## 6. Open Calls
1. **Offline mode:** catch-up-with-cap (recommended) vs. freeze.
2. **Offline cap value:** 24h? 48h? (How much can change while away.)
3. **Time scale:** how many in-game minutes per real minute (ties to NPC speeds + day/night).
4. **Traveler roster size:** how many named cross-region roamers to author (affects "alive" feel vs. work).
