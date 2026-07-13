# storage/ — app data (was separate GitHub branches)

Live application data that the RetroPlay apps read/write via the GitHub API.
This used to live on dedicated orphan branches (`saves`, `screenshots`, `traces`,
`maps`, `uploads`); it now lives here on `main`, one folder per kind of data, so
there are no side branches to manage.

| Folder | What | Written by |
|---|---|---|
| `saves/` | Family cloud saves (`<game>/<player>.srm`, `<game>/save.srm`, `state.bin`) | `cloud-saves.js`, `emulator.html`, `emulator-saves.js` |
| `screenshots/` | Emulator/RPG screenshots (`*.png`) | `src/ui/hud.js`, `emerald.html`, `emulator.html` |
| `traces/` | Emulator RAM/frame captures (`frames/`, `regions/`) | `emulator-debug.js` |
| `maps/` | Maps authored in the map editor (`data/layouts/`, `data/maps/`) | `map-editor.js` |
| `uploads/` | Files pushed from Google Drive (ROMs, APKs, …) | `drive-to-github.js` |

## Why writes use `[skip ci]`

Every app write now commits to `main`. To avoid triggering the GitHub Pages
deploy (`.github/workflows/deploy.yml` runs on push to `main`) on every save or
screenshot, all data-write commit messages include **`[skip ci]`**, which GitHub
Actions honors to skip the workflow. Do not remove that tag from these writers.

## Notes

- `maps/` starts effectively empty (`.gitkeep` placeholders) — the old `maps`
  branch never had a real authored map saved to it.
- `map-editor.js` writes under `storage/maps/data/...` specifically so it can
  never overwrite the real game data trees (`data/layouts/`, `data/maps/`) that
  ship on `main`.
- Large binaries (ROMs/APKs via `uploads/`) still hit GitHub's 100 MB/file limit
  — use Git LFS for anything larger.
