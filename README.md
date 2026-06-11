# Created Maps

This branch stores maps built with the **RetroPlay Map Editor** (`map-editor.html`).
It is intentionally separate from `main` — a storage branch for player-created maps.

## Structure (mirrors the game's `data/` layout, so files can be copied/merged into `main` directly)

```
data/
  layouts/<region>/<LAYOUT_ID>.json   — the metatile grid + collision
  maps/<region>/<Name>.json           — the map metadata (warps, music, etc.)
  maps/<region>_index.json            — MAP_CONST -> filename index for the region
```

## Using a created map in the game

1. Copy the map's `layouts/...` and `maps/...` files (and the `_index.json`) from this
   branch into `data/` on `main`.
2. If the region is new, register it in `INDEX_FILES` in `src/engine/map.js`.
3. Test it with `game.html?map=<Name>&region=<region>`.

The editor saves here automatically via the GitHub Contents API.
