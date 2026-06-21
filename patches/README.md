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
git apply ../../patches/ee_random_starters.patch
# (apply any other patches here)
```

## Build (verified recipe)

Tested on Ubuntu (root). Needs network to github.com (not api.github.com).

```sh
# 1. ARM toolchain (binutils as/ld/objcopy + cpp)
apt-get install -y binutils-arm-none-eabi gcc-arm-none-eabi

# 2. agbcc (the GBA C compiler) -> installs into the EE tree
git clone --depth 1 https://github.com/pret/agbcc.git /tmp/agbcc
cd /tmp/agbcc && ./build.sh
./install.sh /path/to/source/emerald-enhanced

# 3. poryscript (compiles .pory scripts) -> tools/poryscript/
apt-get install -y golang-go    # or use existing Go
git clone --depth 1 https://github.com/huderlem/poryscript.git /tmp/poryscript
cd /tmp/poryscript && go build -o poryscript .
mkdir -p /path/to/source/emerald-enhanced/tools/poryscript
cp poryscript *.json /path/to/source/emerald-enhanced/tools/poryscript/

# 4. apply patches (see above) then build the debug ROM
cd /path/to/source/emerald-enhanced
make tools -j$(nproc)
make DEBUG=1 -j$(nproc)        # produces pokeemerald.gba
cp pokeemerald.gba ../../pokeemerald_ee_debug.gba
```

Note: mutable file-scope data added in patches must use the `EWRAM_DATA`
macro, or agbcc linking fails with `referenced in discarded section .data`.

## Patches

- **ee_enable_devmode_from_start.patch** — In the Start menu, pressing
  **SELECT while holding L** runs EE's own "Enable Dev Mode?" prompt, so Dev
  Mode (and thus the full Debug menu via Start → SELECT) can be unlocked from
  the very start without reaching the Battle Frontier dev switch. Reuses the
  existing `Ryu_enableDevMode` script; touches only `src/start_menu.c`.

- **ee_random_starters.patch** — Every starter slot is rolled randomly across
  all real species (1..NUM_SPECIES-1, skipping empty base-stat slots) each time
  the starter screen opens, so the shown sprites match what you get. EE's
  existing boss/alpha roll (`RyuLegendaryDoBossRoll`) still runs on the chosen
  one, so any random starter can become a boss (special name icon + all-31
  IVs). Touches only `src/starter_choose.c`.
