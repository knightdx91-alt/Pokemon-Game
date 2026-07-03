# Building Citra to boot USUM (for the live-battle RAM capture)

The effect→sequence remap and the battle-pokemon *scalar* field names both need a
**live-battle 3DS RAM image** (static + blind emulation are exhausted). Plan:
build a 3DS emulator here, run USUM to a battle, dump RAM, feed it to
`tools/usum_effect_remap.py`.

## STATUS: the build WORKS and boots USUM ✅

`StonedEdge/citra-1` was called "buildable" (submodules resolve) but had **never
been compile-validated** — its tree is internally inconsistent (frontend newer
than core/video_core) and does NOT build clean on Ubuntu 24.04 / GCC 13. Five
fixes were needed, captured in **`citra1_build_fixes.patch`** (apply after clone).

Verified: the built SDL binary boots the decrypted USUM `.3ds` with **NO AES keys**
— Citra sees the decrypted exheader and "Force no crypto scheme", then loads
Program ID `00040000001B5100` (Ultra Moon USA) and parses the ExHeader. The
`Secure1/2 KeyX missing` lines are non-fatal.

## Reproduce (≈20 min, all in /tmp — ephemeral)

```
# 1. Clone + recursive submodules (git works through the proxy; curl/codeload 403)
git clone --depth 1 https://github.com/StonedEdge/citra-1 /tmp/citra2
cd /tmp/citra2 && git submodule update --init --recursive   # 22 submodules incl. dynarmic

# 2. Apply the build fixes (see "What the patch fixes" below)
git apply /home/user/Pokemon-Game/decomp/citra/citra1_build_fixes.patch

# 3. Build deps + configure SDL-only + build
apt-get update && apt-get install -y build-essential cmake ninja-build pkg-config libsdl2-dev
cmake -B build -G Ninja -DENABLE_QT=OFF -DENABLE_QT_TRANSLATION=OFF \
  -DENABLE_WEB_SERVICE=OFF -DUSE_DISCORD_PRESENCE=OFF -DCMAKE_BUILD_TYPE=Release
ninja -C build bin/Release/citra          # ~10 min on 4 cores → build/bin/Release/citra

# 4. Headless boot (llvmpipe software GL). ROM: re-pull per the CLAUDE.md bootstrap.
xvfb-run -a env LIBGL_ALWAYS_SOFTWARE=1 ./build/bin/Release/citra \
  "/tmp/Pokemon Ultra Moon (USA) (En,Ja,Fr,De,Es,It,Zh,Ko) Decrypted.3ds"
```

## What the patch fixes (5 fork-inconsistency issues, GCC 13)

1. **`core/frontend/mic.h`** — add `#include <string>` (incomplete `std::string`).
2. **`core/frontend/scope_acquire_context.h`** — the header is *referenced by all
   three frontends but missing from the tree*. Recreated as a small templated
   RAII wrapper (works with either `EmuWindow` or `GraphicsContext`).
3. **`core/frontend/emu_window.h`** — the frontends expect the newer
   `Frontend::GraphicsContext` split that this 2014-era `EmuWindow` predates. Add
   a `GraphicsContext` base (`MakeCurrent`/`DoneCurrent`), derive `EmuWindow` from
   it, add `CreateSharedContext()`, and make `ShouldDeferRendererInit()` const.
4. **Render-model skew** (`citra/emu_window/emu_window_sdl2.{h,cpp}`, `citra/citra.cpp`)
   — the frontend uses a threaded-present loop (`emu_window->Present()` →
   `g_renderer->Present()`), but this fork's `video_core` is the older
   *synchronous* `SwapBuffers` model. Align the frontend DOWN: `Present()` →
   `SwapBuffers() override` (plain `SDL_GL_SwapWindow`), drop the render thread in
   `main()`. Zero `video_core` changes.
5. **`core/hle/service/cfg/cfg.cpp`** — the fork leaked a libretro global
   (`LibRetro::settings`) into core unconditionally → undefined reference when the
   libretro frontend is off. Guard the include + use with `#ifdef ENABLE_LIBRETRO`.

## Headless autopilot + FCRAM capture (in the patch, VERIFIED)

The patch adds a decomp-research navigation harness to the SDL frontend, all
gated by env `CITRA_AUTOPILOT=1` (no effect otherwise):

- **Scripted input** — reads `/tmp/autopilot.txt`, whitespace-separated
  `<frame> <down> <scancode>` per line (down 1=press/0=release; SDL scancode;
  frame = SwapBuffers tick). Injected via `InputCommon::GetKeyboard()`.
  Default key map (this fork's `config.cpp`): A=`A` B=`S` X=`Z` Y=`X`,
  d-pad=`T`/`G`/`F`/`H`, **circle pad=arrow keys** (overworld walking),
  Start=`M` Select=`N`, L=`Q` R=`W`.
- **FCRAM dump** — when `/tmp/dump_now` appears, writes the full 256 MB N3DS
  FCRAM to `/tmp/fcram.bin` (+ `/tmp/fcram.done`). VERIFIED: a mid-run dump
  contains the live CRO cluster — `CRO0` magic + `Battle`/`Savedata`/`PokeTool`/
  `gfl2`/`Field` module strings (e.g. Battle.cro CRO0 header ~`0x73a4080` in one
  run; **CROs are relocated, so resolve the base per-boot, don't hardcode**).
- **Framebuffer PPM** — `/tmp/frames/f*.ppm` every `CITRA_SHOT_EVERY` frames.
  WORKS (fix #6): the earlier black frames were because `EmuWindow_SDL2::MakeCurrent`
  bound the 0×0 hidden shared `core_context`, so the renderer's final
  `DrawScreens` (renderer_opengl.cpp ~L263) composed to a 0×0 FBO. Fix #6 makes
  `MakeCurrent` bind the real `window_context` (400×480 `render_window`); the
  frame now lands where `glReadPixels` reads it. VERIFIED: the USUM title screen
  and the loaded save's overworld render correctly. This gives a full see→act
  navigation loop (drive input, screenshot, read state, repeat).
- **Save states** (fix: `ApMaybeState`) — `/tmp/save_state` → `SaveState(1)`,
  `/tmp/load_state` → `LoadState(1)` (`~/.local/share/citra-emu/states/
  00040000001B5100.01.cst`). Lets a driver checkpoint after the slow boot+load
  (~80s) and cheaply branch navigation (~24s resume). VERIFIED: save at the
  Pokémon-Center PC, resume returns to the exact spot.

Save install: the user's decrypted USUM `main` save (0x6CC00 = 445440 bytes)
goes at `~/.local/share/citra-emu/sdmc/Nintendo 3DS/<0*32>/<0*32>/title/00040000/001b5100/data/00000001/main`.
Citra boots it with NO keys (decrypted-exheader → force no crypto). The loaded
save (OT "Lylliana") starts standing at a **Pokémon-Center PC** — reaching a
wild battle is an overworld navigation grind (exit building → route grass →
walk until an RNG encounter → FIGHT + pick a move), done via the see→act loop
with save-state checkpoints between steps.

## NEXT: capture the mid-battle RAM image

The infrastructure is done and verified (boot+save+input+FCRAM dump). Remaining,
via the **memory route** (sidesteps the black-frame issue entirely):
1. **Battle detection from memory** — poll FCRAM (dump on a cadence, or add a
   lighter in-process probe) for the in-battle signature: Battle.cro's dispatch
   tables live + the battle event-queue / battlemon objects present (out-of-
   battle they are not). Resolve Battle.cro's relocated base first.
2. **Blind-ish navigation** — script: skip title (tap A), the save auto-continues
   to where it was saved, then hold a walk direction (arrows) to trigger a wild
   encounter; on the battle menu, tap A to FIGHT + pick a move so the effect
   object is live. Correlate against the memory probe to know when each phase
   lands (no visuals needed).
3. **Dump + solve** — on in-battle detection, `touch /tmp/dump_now`, then feed
   `/tmp/fcram.bin` to `tools/usum_effect_remap.py` (seed the real effect-object /
   event-queue global `bss+0x394`, read the sequence id off the `rodata+0x45a0`
   watch per move → the effect→sequence remap) and read the battle-pokemon
   struct scalars directly → the `BattlePokemon.h` field names.

## Original MEMORY-CAPTURE / trace notes

The build is the means; the remaining work is getting FCRAM from an in-battle
state and feeding it to `tools/usum_effect_remap.py`:
- **Fastest / no scripting:** user supplies (or we create on a machine with input)
  a **mid-battle `.cst` savestate** — zstd-decompress → scan FCRAM. Drop it in
  Drive.
- **Headless here:** needs input automation to drive title → load save → walk into
  grass → pick a move (so the effect object is live). Use the user's USUM save.
- **No-rebuild alt:** GDB stub (`use_gdbstub=true`) + `rwatch` on the watch ranges.

Then per README "MEMORY-CAPTURE ROUTE": correlate writes to event-queue global
`bss+0x394` (effectId) with reads of the 153-seq table `rodata+0x45a0` → the
effect→sequence remap; read the battle-pokemon struct scalars directly → the
`BattlePokemon.h` field names. **First resolve `Battle.cro`'s runtime load base**
(CROs are relocated) and express every watch address relative to it.
