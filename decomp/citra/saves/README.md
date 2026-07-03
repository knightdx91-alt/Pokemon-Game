# USUM capture save — Route 4 tall grass

`usum_route4_grass_main.sav` (445440 bytes = 0x6CC00) is the user's real Pokémon
Ultra Moon `main` save (OT **Lylliana**, TID 37488), re-saved **standing in the
tall grass on Route 4** so a fresh Citra boot lands one step away from a wild
encounter — no more overworld navigation grind to reach the battle-capture point.

This is the user's own save data (same file they share via Drive), **not ROM
bytes** — safe to keep in the repo. The party is battle-ready
(slot 0 = Magearna #721, plus Charizard, Zeraora, etc.).

## Install into Citra (per decomp/citra/README.md)

```
DST="$HOME/.local/share/citra-emu/sdmc/Nintendo 3DS/00000000000000000000000000000000/00000000000000000000000000000000/title/00040000/001b5100/data/00000001"
mkdir -p "$DST"
cp decomp/citra/saves/usum_route4_grass_main.sav "$DST/main"
```

If Citra reports `OpenArchive archive_id=0x6 ... failed` and starts a NEW game,
boot once (it will format the SaveData archive, creating `00000001.metadata`),
then re-copy this file over `main` and reboot → the title screen offers
**Continue** straight into the Route 4 grass.

## Reaching a wild battle from here

Boot with `CITRA_AUTOPILOT=1`, tap **A** to skip the title → Continue loads onto
Route 4 in the grass, then hold a walk direction (arrow key) a few steps to
trigger an encounter, `A` to FIGHT + pick a move so the battle/effect objects
are live, then `touch /tmp/dump_now` to dump FCRAM for
`tools/usum_battle_capture.py` / `tools/usum_effect_remap.py`.
