# Storage branches — pending migration onto `main`

Goal: the repo should eventually have **no branches other than `main`**. The
`claude/*` work branches are gone (their work is on `main` or was superseded).
What remains are 5 **storage branches** that hold live application data written
by the running apps via the GitHub API. They are kept **for now** because
deleting them would lose data AND break running features — the app code targets
these branch names directly.

## The branches and who writes them

| Branch | Contents | Written by |
|---|---|---|
| `saves` | Family cloud saves (`saves/<game>/<player>.srm`) | `cloud-saves.js` (emulator.html, emerald.html, pokemon-black.html) |
| `maps` | Maps authored in the map editor (`data/layouts/…`, `data/maps/…`) | `map-editor.js` (☁ Save/Load to repo) |
| `traces` | Emulator RAM/frame capture dumps | `emulator-debug.js` (🔬 panel) |
| `screenshots` | Frame captures pushed from the emulator | `emulator-screenshot.js` |
| `uploads` | Misc uploads pushed from the client | client tooling |

## Why they can't just be deleted yet

The client code has the target branch name hard-coded (and a reversed PAT). It
does read-modify-write against these branches. If the branch is deleted, the
next save either recreates it or errors. So migrating requires a **code change**
in lockstep with moving the data.

## Migration plan (when we do it)

For each branch:
1. Copy its current tree into a folder on `main`
   (e.g. `storage/saves/`, `storage/maps/`, …) in a single commit.
2. Rewrite the corresponding app module to write to `main` under that folder
   (or to a proper backend) instead of the dedicated branch:
   - `cloud-saves.js` — `saves` branch → `storage/saves/`
   - `map-editor.js` — `maps` branch → `storage/maps/` (Save/Load-to-repo)
   - `emulator-debug.js` — `traces` branch
   - `emulator-screenshot.js` — `screenshots` branch
   - uploads path — `uploads` branch
3. Verify a real save/load round-trips against the new location.
4. Only then delete the now-unused storage branch.

Until steps 1–3 are done for a branch, **leave it in place.**
