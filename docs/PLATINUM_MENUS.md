# Pokémon Platinum — EXHAUSTIVE Menu / UI Inventory

Ground-truthed from the extracted US Platinum ROM (`CPUE`, `source/nds/CPUE`),
not from memory. Every screen below is cross-referenced to the ROM asset that
renders it (a `graphic/*.narc` archive) and, where applicable, the decoded
message bank (`msgdata/pl_msg.narc` bank #, via `tools/gen4_text.py`).

Legend:  ✔ = archive present & decodable in ROM · 📖 = text bank located ·
🖼 = window-frame styles from `pl_winframe.narc` (22 frames).

Tools that produced/verify this:
- `tools/nds_decomp.py` → `source/nds/CPUE/` (214 NARCs, 52,802 members)
- `tools/nds_gfx.py` → decode any NCLR/NCGR/NSCR screen to PNG
- `tools/gen4_text.py` → decode any `pl_msg` text bank (Gen-4 cipher + charmap)

This is the build checklist for the Pokémon Unleashed Platinum-faithful UI.
Every leaf must be reimplemented AND screenshot-matched against the ROM.

---

## 0. Screen shell (frames the whole UI)
- **DS dual-screen frame** — top render screen + bottom touch screen.
- **Window frame styles** — 🖼 `pl_winframe.narc`: 22 frames (Options "Frame
  1–20" + 2). Decoded to `data/unleashed/platinum_ui/frame_00..21.png`.
  Corners/edges are a 3×3 (or 3×N) tile set → 9-slice each menu window.
- **Bottom-screen touch backgrounds** — ✔ `touch_subwindow.narc` (1 palette,
  1 tile sheet, ~30 NSCR screens = the different bottom-screen layouts).
- **Generic message window** — overworld/battle text box, ▶ continue arrow.
- **Generic Yes/No box** · **multi-choice list box** · **quantity/price
  spinner** (▲▼ + ×N + price).

## 1. Title / boot / save-select
- **Title screen** — ✔ `opening.narc`, `demo_trade.narc`.
- **Main Menu** (before load): New Game · Continue · Options · Mystery Gift ·
  Wi-Fi / Nintendo WFC. ✔ code in `application/` + `arc/`.
  - **Continue panel** — player name, badges, Pokédex count, time played.
  - **Mystery Gift** — ✔ `mystery.narc`; Wonder Cards list, receive via
    Wireless / Wi-Fi / friend.
- **Intro / Prof. Rowan sequence** — name entry, gender select (see §16 keyboard).
- **Save-file select / overwrite / "There is already a save" prompt.**

## 2. Overworld Start menu (X button)
Top-level list (exact order):
1. **Pokédex** → §5
2. **Pokémon** (party) → §3
3. **Bag** → §4
4. **[Player Name]** (Trainer Card) → §6
5. **Save** → §12
6. **Options** → §11
7. **Exit** (or B)
- Contextual extra rows inserted when active: **Pokétch** is always bottom-screen
  (§8); **Poké Radar**, **VS Seeker**, **Running Shoes** etc. are field, not menu.

## 3. Pokémon / Party menu + Summary
Archives: ✔ `pl_plist_gra.narc` (party list), ✔ `pl_pst_gra.narc` (summary),
`plist_gra`/`pst_gra` (DP fallback).
- **Party list** — up to 6, HP bars, status, held-item dot.
- **Per-Pokémon action menu** (A on a member):
  - **Summary** → summary screen (below)
  - **Switch** (reorder party)
  - **Item** → **Give** / **Take** / **Check** (held item)
  - **[Field Move]** — the mon's usable HM/field move(s): Cut, Fly, Surf,
    Strength, Rock Smash, Rock Climb, Waterfall, Defog, Flash, Dig, Teleport,
    Sweet Scent, Whirlpool, Milk Drink, Softboiled, Chatter, Secret Power.
  - **Cancel**
  - Egg variant: reduced action set (no Summary moves/ribbons).
- **Summary screen tabs** (L/R or ◀▶):
  1. **Info / Memo** — sprite, name, Lv, gender, ball, shiny mark, Pokérus,
     dex#, OT/ID, Exp, "to next Lv", **Trainer Memo** (nature, met date/place,
     characteristic), **Markings** (●▲■♥★◆).
  2. **Skills/Stats** — HP/Atk/Def/Sp.Atk/Sp.Def/Speed (nature ↑↓ color),
     Ability + description, Held Item.
  3. **Moves** — 4 moves (type icon + PP), **Move detail** (power/accuracy/
     category/description), **reorder moves**.
  4. **Ribbons** — grid, select for name+desc, reorder.
  - **Context on Info**: Give/Take Item · Pokédex entry · Markings editor · Cancel.

## 4. Bag
Archives: ✔ `pl_bag_gra.narc` (Platinum bag), `bag_gra` (DP fallback).
- **Pockets/tabs**: Items · Medicine · Poké Balls · TMs & HMs · Berries · Mail ·
  Battle Items · Key Items. (Registered Key Item shortcut = Y.)
- **Per-item action menu**: **Use** · **Give** (to party mon) · **Toss**
  (→ quantity confirm) · **Register** (Key Items) · **Check** · **Cancel**.
  - TM/HM → teach + compatibility (party list with ✔/✘) → §"waza_oshie" below.
  - Berry → plant info / firmness / sort.
  - Mail → read / move to mailbox.
- **Sort menu** · **quantity selector** (Toss/Sell/Give) · **"Where to move to?"**.
- **Move-teaching screen** — ✔ `waza_oshie_gra.narc` (teach move + forget-move
  4-slot picker + "1, 2, 3… poof!" flow).

## 5. Pokédex
Archives: ✔ `zukanlist` (application), `imageclip.narc`.
- **List view** (National ⇄ Sinnoh regional toggle) — Seen/Owned, ▲▼ scroll.
- **Search / sort** — by number, A–Z, heaviest/lightest, tallest/smallest,
  by type, by color, by name-letter; form filters.
- **Entry detail** — species, category, height/weight, dex text, **Cry** (play),
  **Area** (habitat map, ✔ `tmap_gra.narc`), **Size** compare vs player,
  **Forms** switch (Unown, Rotom, Deoxys, Burmy…).

## 6. Trainer Card
Archive: ✔ `trainer_case.narc`.
- **Front** — name, ID, money, Pokédex #, play time, 8 badges, star rank.
- **Back** — signature (drawn), records: Hall of Fame debut, link battles,
  trades, Wi-Fi trades/battles, Underground records.
- **Badge touch** — tap a badge on bottom screen → shine animation.

## 7. PC / Pokémon Storage System (Bill's/Someone's PC)
Archive: ✔ `box.narc`.  Access node: **Pokémon Storage** · **Item Storage** ·
**Mailbox** · **Turn off the PC** · (Hall-of-Fame PC ✔ `dendou_pc.narc`).
- **Box view** — 18 boxes × 30, box name + wallpaper header, cursor.
- **Box functions menu**: **Move Pokémon** (grab/place/multi-select via "Move
  mode") · **Move Items** (📖 bank 343 "Move Items") · **Summary** ·
  **Release** (→ confirm, farewell) · **Marking** · **Withdraw/Deposit** ·
  **Jump** (box list) · **Wallpaper** (picker: scenes + special unlockables) ·
  **Name Box** (keyboard).
- **Deposit / Withdraw** flows (📖 bank 361 "DEPOSITAR POKéMON").
- **Item Storage** — deposit/withdraw held/loose items.

## 8. Pokétch (bottom-screen apps)
Archive: ✔ `poketch.narc`.  Frame is always-on bottom screen; ⊕/⊖ cycles apps.
Full app set (unlock order varies): Digital Watch · Calculator · Memo Pad ·
Pedometer · Pokémon List · Friendship Checker · Dowsing Machine · Berry Searcher ·
Day-Care Checker · Pokémon History · Counter · Analog Watch · Marking Map ·
Link Searcher · Coin Toss · Move Tester · Calendar · Dot Artist · Roulette ·
Trainer Counter · Kitchen Timer · Color Changer · Matchup Checker · Stopwatch ·
Alarm Clock.

## 9. Battle menus
Archives: ✔ `battle/graphic/*`, `menu_gra.narc`, `waza_oshie_gra.narc`.
- **Main command**: **Fight** · **Bag** · **Pokémon** · **Run**.
- **Fight** → 4 moves (type + PP box); **target select** (doubles); "no PP" /
  "which move to forget" flows.
- **Bag (in battle)** — limited pockets (balls/medicine/battle items).
- **Pokémon (in battle)** — switch → summary/action; can't-switch cases.
- **Sequences**: catch/throw + shake + break/caught + nickname prompt; faint;
  **level-up stat window**; **learn move / give up learning** (Yes/No + 4-slot);
  **evolution** (+ "stop" B); EXP/EV; item pickup; run-fail; caught-data register.
- **Yes/No + message** boxes throughout.

## 10. Sinnoh Underground
Archives: ✔ `arc/` underground assets, `bucket.narc`, `application/bucket`.
- Bottom-screen **dig** view (hammer/pick, wall HP, tremors).
- **Goods** menu · **Spheres/Treasures/Traps** bag · **Secret Base** editor
  (place/move/remove Goods, dig new base) · **Flag** capture (multiplayer).
- **Radar** (bottom screen) for buried items / other diggers.

## 11. Options
Archive: ✔ `config_gra.narc`.
- **Text Speed** (Slow/Mid/Fast) · **Battle Scene** (On/Off) · **Battle Style**
  (Switch/Set) · **Sound** (Mono/Stereo) · **Button Mode** (Normal/Start=X/
  L=A) · **Frame** (window frame 1–20, 🖼) · **Confirm/Cancel**.

## 12. Save
- **Save prompt** (Yes/No) · report card (name/badges/dex/time) ·
  **overwrite existing** prompt · **saving…** animation · "saved" confirm ·
  Wi-Fi "don't turn off" variant.

## 13. Shops & services
Archives: ✔ `shop_gra.narc`.
- **Poké Mart** — Buy (list + quantity + price + confirm) · Sell (bag pockets +
  quantity + price) · "Anything else?" loop. (📖 bank 201 Mart lines.)
- **Poké Center** — nurse heal (Yes/No + heal animation) · **PC** access ·
  Wi-Fi Club stairs · Union Room · trade corner.
- **Specialty shops** — Veilstone dept. store floors, Herbalist, Berry Master,
  Move Tutor(s), Move Deleter/Reminder, Name Rater, Battle Frontier shop
  (BP exchange, ✔ `frontier/`, `btower.narc`).

## 14. Field / world UI
- **Town Map** — ✔ `tmap_gra.narc`: region map · **Fly** destination select ·
  cursor city info · Marking Map overlay.
- **Poké Radar** (grass shake) · **VS Seeker** · **Honey tree** · **Berry
  planting**/growth/mulch · **Great Marsh** (Safari: balls/mud/bait, step
  counter, ✔ `arc/ppark.narc` Pal Park) · **Amity Square** (walking mon) ·
  **Day-Care** (deposit/withdraw/compatibility, egg pickup).
- **Bike** (gears) · **Fishing** (Old/Good/Super rod bite) · **Headbutt**.
- **Signposts / bookshelf read** · **TV** (✔ `tv.narc`, `library_tv.narc`,
  `lobby_news.narc`) · **Jubilife TV** menu.

## 15. Contests (Super Contests)
Archives: ✔ `poru_gra.narc`, `poruact.narc`, `porudemo.narc`, `contest/graphic`.
- **Entry** (rank + category: Cool/Beauty/Cute/Smart/Tough) · **Visual**
  (dress-up accessories) · **Dance** (rhythm) · **Acting** (move appeal, judge
  hearts, jamming) · results.
- **Poffin Case** · **Poffin cooking** (stir mini-game, ✔ `nutmixer.narc`).

## 16. Text entry / naming
- **On-screen keyboard** — player name · Pokémon nickname · Box name ·
  Secret-base messages · mail. Upper/lower/others pages, backspace, OK.
- **Easy Chat / mail phrase picker** — ✔ `mail_gra.narc`, `email_gra.narc`.

## 17. Link / online (deferred to multiplayer phase)
Archives: ✔ `unionroom.narc`, `wifi_lobby*.narc`, `worldtrade.narc`,
`worldtimer.narc`, `pl_wifinote.narc`, `wifi2dchar.narc`, `wifi_unionobj.narc`.
- **Union Room** (local): trade · battle · chat · mix records · draw.
- **Trade screen** — offer/confirm, trade animation.
- **GTS / Global Trade Station** — deposit, search (species/level/gender),
  seek, world map (✔ `worldtrade.narc`, `wifi_earth` app).
- **Wi-Fi Club** — trade/battle with Pals/friend codes · Voice Chat frame.
- **Wireless mixing** · **friend-code register** · **Wonder Card** trade.

## 18. Misc modal/generic (used everywhere)
- Yes/No · multi-choice list · item/move/ribbon detail popup · markings panel ·
  quantity/price spinner · "Registered to Y" toast · error/confirm boxes ·
  "obtained X!" fanfare banner · badge-get / HM-get / evolution-item prompts.

---

### Text-bank crib (located so far, `pl_msg.narc` via gen4_text.py)
- Moves: banks 647 (Title/Case) / 648 (UPPER) — 468 entries.
- Species names/dex: banks 698–723 (494 entries each = per-field variants).
- Mart/shop lines: bank 201.  Move Items: bank 343.  Deposit: bank 361.
- (Portuguese/Spanish leftover option banks 19/361/442 exist — the ROM ships
  multiple localizations; use the English banks.)
- To find any label: `python3 tools/gen4_text.py <pl_msg.narc> --find "WORD"`.

### Build rule
Each leaf above is a build-and-verify unit: reimplement in the engine using the
decoded `pl_winframe` frame + `pl_font`, then screenshot-match against the ROM
screen (decode its NSCR via `nds_gfx.py`, or capture live in a DS emulator).
