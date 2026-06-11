# Progression & Stats — Levels, Attributes, the Soft Cap

> Design for player/creature leveling, the LitRPG attribute model, XP, skill growth, and the ~450
> soft cap. Sets the **level scale** every zone, encounter, and recipe hangs on. Companion to
> `DESIGN.md`, `WORLD.md`, `ENCOUNTERS.md`. **Status:** brainstorming / pre-implementation.
> Built **fresh** (not from the old Drive crafting/loot docs, which are tied to the original dex).

---

## 1. Two leveled entities: Player & Creatures

- **The player levels** (LitRPG core) — you are a character with attributes and skills, not just a
  trainer. This is what makes non-Tamer classes viable (Combat/Crafter/Espionage builds rely on
  *player* power, `CLASSES.md`).
- **Creatures level** independently — your Bound party has its own levels/stats (the catch-and-battle
  pillar).
- Both share the **1 → 500+** scale and the **era tiers** (T1 1–125 · T2 126–250 · T3 251–375 ·
  T4 376–500+) used by zones and recipes.

---

## 2. Player Attributes (original set — 6)

The System grants attribute points on level-up; you allocate them (class nudges the spread).

| Attribute | Governs |
|---|---|
| **Might** | Physical self-combat damage, carry capacity |
| **Finesse** | Tempo regen/speed, accuracy, stealth |
| **Endurance** | **Vigor pool (HP) + its regen/min**, Stamina pool & drain resistance, Exposure resistance |
| **Focus** | **Affinity-Energy pool size**, affinity/arcane power, Bind strength |
| **Resolve** | **Affinity-Energy regen/min**, damage resistances, resistance to System effects (Surveillance, conversion) |
| **Insight** | Skill effectiveness, crafting quality, detection range, Appraisal/luck |

> Endurance and Resolve are the **survival/anti-System** stats — they tie attributes directly into the
> survival layer and the Surveillance theme, not just combat.

### Two-pool model — size vs. regen are separate stats
Each resource pool has one attribute for its **size** and another for its **regen-per-minute**, so
power and recovery are independent:
- **Vigor (HP):** size + regen both from **Endurance**.
- **Affinity-Energy (the "mana" you spend on abilities):** size from **Focus**, regen from **Resolve**.

### Vigor = System-embedded energy, not flesh (theme mechanic)
Your "HP" is **Vigor** — the System's energy woven into your body. It works as a **damage-absorption
buffer**: incoming hits are blunted by spending Vigor, and the pool drains as it absorbs. It won't
stop a true instakill, but a large pool defrays ordinary damage.
- **Thematic weight:** losing health = running out of the thing the System put in you. Hitting zero
  Vigor is the "downed" state (`ENCOUNTERS.md §4`), not literal death.
- Vigor (defensive, embedded) is **separate** from Affinity-Energy (offensive, spent on abilities) —
  two different energies, two different pools.

### Allocation
- Points awarded per level; **player-assigned** (LitRPG agency). Class sets a recommended spread and
  small starting bonuses.
- Framing: *the System "awards" your points* — another act of it classifying/shaping you.

---

## 2.5 Abilities — Class Skills, Affinity Arts, Perks

Three categories of acquired power:

| Category | What it is | Source | Cost |
|---|---|---|---|
| **Class Skills** | Active abilities that break ordinary physics (conjure flame, plate your body, blink a step). The "cool" toolkit. | Class + Designation Grade (`CLASSES.md`) | Affinity-Energy |
| **Affinity Arts** | The caster magic — ranged/utility affinity effects for Arcane builds | Class/Focus, learned/scrolls | Affinity-Energy |
| **Perks** | **Passive** edges — small or large advantages | Quests, relics (`HIDDEN_LAYER.md`), discovery, "wrong place at the wrong time" | none (passive) |

> We deliberately keep Skills and Arts as **one fuel** (Affinity-Energy) and don't over-split them —
> the active/caster distinction is flavor, not two economies. **Perks** are the discovery-reward
> hook: hidden-layer relics and odd events grant them, so exploration literally makes you stronger.

---

## 3. XP & Skill Growth

- **XP sources:** combat (creature + self), **surviving expeditions** (extraction bonus), discovery
  milestones, crafting, quests/bounties. No daily-quest grind (matches the lean economy).
- **Skills level by use** (espionage/craft/survival skills improve as you use them — the System
  tracks your activity). Separate from character level.
- **Creature XP** from battles; sharing/route rules TBD (see open calls).

---

## 4. The Soft Cap (~450) — the System's leash

- **Soft cap at ~450.** You *can* push past it, but the System starts treating you as a threat:
  - Approaching it: Calamity death-line warnings surface (*"Don't level past 450"*).
  - Past it: **Surveillance spikes hard**, elite Audits escalate, and a **conversion risk** begins —
    the System tries to remake you into a construct (the lore behind every Calamity Boss).
- **Endings hook:** pushing past the cap unprotected is the path to the *Submit* ending (you become
  next cycle's boss). Surviving past it requires Off-Grid / Resolve / hidden-layer protection —
  which ties the cap into the finale rather than being a flat wall.
- It is a **soft** cap (consistent with the soft-survival philosophy): not a hard stop, a rising danger.
- **Class Designation Grades** (`CLASSES.md §3.5`) climb alongside level; the top grade (**Paragon**)
  lands right at the soft cap — top-grade power is exactly where conversion risk peaks.

---

## 5. Level Differential — danger telegraphing

Player/creature level vs. zone/enemy level drives the **HUD color** (from `DESIGN.md`/`WORLD.md`):
- **Red** = lethal gap (one-shot territory past +100) · **Yellow** = challenging · **White** =
  matched · **Grey** = trivial.
This is the readout that makes "danger by depth" legible and lets a player judge an expedition.

---

## 6. Interlock Summary
- **Survival:** Endurance scales Stamina/Exposure; Resolve resists System effects. Stats *are* part
  of survival.
- **Classes:** attribute spreads + the player-leveling track make non-creature builds real.
- **World/Encounters:** the 1–500 scale + era tiers + level-diff coloring define every zone's danger.
- **Surveillance/Endings:** the soft cap turns "max level" into a story/Surveillance decision.

---

## 7. Scope Honesty
- **Cheap / early:** level + XP counters, the 6 attributes as data, level-diff HUD coloring.
- **Medium:** attribute effects wired into combat/survival, skill-by-use leveling, allocation UI.
- **Defer:** soft-cap conversion mechanic + elite Audits, ending-tilt bookkeeping.

## 8. Open Calls
1. **XP curve** — how steep 1→500 is, and how era tiers pace it across the 60h.
2. **Creature XP sharing** — party-wide share, active-only, or an Exp-Share-style craftable?
3. **Attribute points per level** — flat, or scaling with tier?
4. **Respec scope** — does the Shop respec token reset attributes too, or only class/skills?
