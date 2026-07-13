# Storage branches — MIGRATED to `main` under `storage/` ✅

**Status: done.** The data that lived on the `saves`, `screenshots`, `traces`,
`maps`, and `uploads` branches was copied into `storage/<kind>/` on `main`, and
every app that read/wrote those branches was repointed to `main` + the new
folder (with `[skip ci]` in write messages so data writes don't trigger the
Pages deploy). See `storage/README.md` for the live layout.

The only thing left is **deleting the now-unused branches on the remote** — that
can't be done from the cloud session (the git relay 403s ref deletions), so run
it from a normal terminal / the GitHub UI:
`git push origin --delete saves screenshots traces maps uploads`
(Do this only after confirming the apps work against `storage/`.)

---

## Historical plan (for reference)

Goal was: the repo should have **no branches other than `main`**. The
`claude/*` work branches are gone (their work is on `main` or was superseded).
The 5 **storage branches** held live application data written by the running
apps via the GitHub API, so migrating required moving data AND rewriting the app
code in lockstep — now complete.

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
