# Emerald Enhanced source patches

Source modifications for the EE submodule (`source/emerald-enhanced`).
The submodule's working tree is **not** tracked by this repo and is wiped
when the container is recycled, so changes are kept here as patches and
applied before a ROM rebuild.

## Apply

```sh
git submodule update --init source/emerald-enhanced
cd source/emerald-enhanced
git apply ../../patches/ee_enable_devmode_from_start.patch
# (apply any other patches here)
```

Then build the ROM (needs the GBA decomp toolchain: agbcc + devkitARM /
arm-none-eabi-gcc + build deps) and copy the resulting `.gba` over
`pokeemerald_ee_debug.gba` in the repo root.

## Patches

- **ee_enable_devmode_from_start.patch** — In the Start menu, pressing
  **SELECT while holding L** runs EE's own "Enable Dev Mode?" prompt, so Dev
  Mode (and thus the full Debug menu via Start → SELECT) can be unlocked from
  the very start without reaching the Battle Frontier dev switch. Reuses the
  existing `Ryu_enableDevMode` script; touches only `src/start_menu.c`.
