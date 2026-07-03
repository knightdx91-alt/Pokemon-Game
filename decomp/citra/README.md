# Building Citra to boot USUM (for the live-battle RAM capture)

The effect→sequence remap and the battle-pokemon *scalar* field names both need a
**live-battle 3DS RAM image** (static + blind emulation are exhausted). Plan:
build a 3DS emulator here, run USUM to a battle, dump RAM / hook the JIT.

> **▶ CURRENT STATE (both items resolved):** the battlemon scalars are confirmed,
> and the **effect→sequence dispatch is captured live by an in-process JIT
> read-watch hook** — build with **`effect_seq_hook.patch`** (below), not the
> older `citra1_build_fixes.patch`. That standalone patch = the 5 build fixes +
> the missing `scope_acquire_context.h` (fix #2, which was described but absent
> from `citra1_build_fixes.patch`) + the hook. See `decomp/battle_effects/
> EFFECT_DISPATCH.md` for the capture and `tools/citra_gdb/README.md` for why the
> gdbstub route (Z0/Z3/registers) does NOT work and had to be replaced.

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

# 2. Apply the hook patch (standalone: build fixes + scope_acquire_context.h + the
#    effect→sequence JIT read-watch hook). Use THIS, not citra1_build_fixes.patch.
git apply /home/user/Pokemon-Game/decomp/citra/effect_seq_hook.patch
#    (the older citra1_build_fixes.patch is kept for reference but is INCOMPLETE —
#     it omits the src/core/frontend/scope_acquire_context.h it claims to add.)

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

## LIVE RUN DONE — Battle.cro map resolved; the queue read is a dead end ✅/⚠️

A full live capture was driven this session: prebuilt Citra + the committed Route 4
grass save → boot → tap A → Continue → walk the grass → wild encounter → FIGHT →
Steam Eruption, with `/tmp/dump_va` snapshots and `/tmp/shot` screenshots
throughout. Findings (details + tool in `decomp/battle_effects/EFFECT_DISPATCH.md`
and `tools/usum_battle_resolve.py`):

- **Battle.cro runtime map resolved from an in-battle VA dump** (all seg sizes
  match disk): text `0x6dd180`, rodata `0x7da000` (**seq table @ `0x7de5a0`**),
  data `0x8145c90`, bss `0x8146af8`. Base is **deterministic across battles**;
  Battle.cro is **unloaded on the overworld** (resolve inside a battle).
- **Queue base CONFIRMED live:** `sub_8790c` @ runtime `0x764a8c`; its
  reloc-filled literal → `0x8146e8c == bss+0x394`.
- **The tag-0x1f event never appears in the queue** across 25 frozen bursts + 2
  free-run single dumps over full move executions — it is a **sub-frame
  transient** (pushed by `sub_86e48`, drained same frame). A file-triggered dump
  freezes ~1 frame and always misses it. **Do not chase the queue.**

### GDBSTUB ROUTE TESTED — memory-read only; BP/WP/registers are dead ⚠️
A follow-up session attached to the prebuilt Citra's RSP gdbstub
(`--gdbport 24689`, client in `tools/citra_gdb/`) to try catching the dispatch by
breakpoint/watchpoint. Battle.cro's base was re-confirmed live first (the
queue-base literal at VA `0x764b54` read back `0x8146e8c` exactly), so addresses
were correct — yet:
- **memory read** and **halt-on-interrupt**: work.
- **register read** (`g`): returns **all zeros** even when halted.
- **exec breakpoint `Z0`** (`sub_8790c`) and **read-watch `Z3`** (seq table
  `0x7de5a0`): accepted `OK` but **never fire**.

So you cannot break on the push site, watch the seq-table, or read `r4`(=`work`)
with this binary. See `tools/citra_gdb/README.md` for the full matrix.

### RESOLVED — in-process JIT read-watch hook ✅ (`effect_seq_hook.patch`)
The chosen fix (option 2 below) is BUILT and WORKING. The hook builds the A32 JIT
with `config.page_table = nullptr` (full-callback mode) and, in `MemoryRead32`,
records every guest read landing in an armed VA range — set it to the seq-handler
table and each read gives the dispatched seqId directly. No gdbstub, no frame
race.

**Usage (in a live battle, at the move menu):**
```
# 1. confirm this boot's Battle.cro base / seq-table VA:
echo "00100000 00F00000" > /tmp/dump_va   # then:
python3 tools/usum_battle_resolve.py      # -> seq table @ 0x7de5a0 (base 0x6dd180)
# 2. arm the read-watch over the seq table [0x7de5a0, +0x4c8):
rm -f /tmp/hook_out; echo "7de5a0 7dea68" > /tmp/hook_arm   # waits -> /tmp/hook_armed
# 3. execute the move (hold A ~500 ms; emulation is slower in full-callback mode)
# 4. disarm + analyze:
: > /tmp/hook_disarm
python3 tools/citra_gdb/hookcap.py 0x7de5a0    # seqId = (vaddr-0x7de5a0)/8
```
Each `/tmp/hook_out` line is `<vaddr> <r0..r15>` (hex). A move runs a *script* of
handlers; the shared prologue is `[6,11,5,4,62,65,22,23,58,28]` and the
effect-specific handlers diverge in the tail. Captured traces:
`decomp/battle_effects/seq_dispatch_traces.json`. **Remaining:** non-KO captures
across effectIds (the Lv85 lead one-shots wild mons before the secondary-effect
step) to pin each effectId→seqId.

The two finishes originally considered (kept for the record):
1. **Static + halt/memread:** find the battle-`work` global, launch a move,
   interrupt mid-move, deref `[work_global]+0xa94` = seqId. Uses only the working
   gdb primitives. (Not needed — the hook reads seqId directly from the table.)
2. **In-process hook (chosen):** the read-watch above — no frame-freeze race, no
   reliance on the broken gdbstub control.

Gotchas nailed: default `/tmp/dump_va` window (16 MB) misses data/bss — dump with
an explicit base (`echo "08140000 00020000" > /tmp/dump_va`); first boot after
save install formats the archive & starts a new game — kill, re-copy the save
over `main`, reboot → Continue loads into the grass.

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

## VA-space dump (added) — the correct route for the effect→sequence remap

A physical FCRAM dump (`/tmp/dump_now`) is scattered by the MMU: you can find a
CRO's `.text` by matching code bytes, but `.bss` (zero-init, where the effect
event-queue at `bss+0x394` lives) can't be located by offset. So the patch adds a
**virtual-address dump**:

- **Trigger:** write `"<hexbase> <hexsize>"` to **`/tmp/dump_va`** (default
  `100000 f00000`). The frontend reads that VA range from the running app process
  (`Kernel().GetCurrentProcess()` + `Memory().ReadBlock`) → **`/tmp/va.bin`**
  (VA-contiguous, VA = base + offset) + `/tmp/va.meta` + `/tmp/va.done`.
- It's small/fast (~15 MB, ~0.2 s) so it can be fired repeatedly — BUT each dump
  blocks a SwapBuffers frame, so a tight burst **freezes the game**. To catch a
  move mid-execution: confirm the move, let it run ~0.4 s (dispatch happens early),
  THEN take a single dump (or a short burst that freezes it mid-animation).

**What's resolved in a VA dump (in-battle):**
- `|static|` (static.crs) header CRO0 @ **VA 0x8b2000**; segs: text@0x100000
  (0x4b99f8), rodata@0x5ba000, data@0x667000, bss@0x6d4000(size 0).
- **Battle.cro** loads right after static.crs — its `.text` sits at **VA ~0x6de000**
  (found by matching `source/3ds/ultramoon/romfs/Battle.cro` disk seg0 bytes; its
  own CRO0 magic is consumed by the loader, so locate it by content, then its
  header is `text_va - 0x180`, seg table at `header+0xC8`). rodata (holds the
  `0x45a0` 153-seq table) and bss (event queue `+0x394`, work/step-state `+0xa94`)
  are read at their runtime VAs straight out of `va.bin` (offset = VA - 0x100000).

**REMAINING to finish the remap (next session, all infra now in place):**
1. Genuinely execute a move (confirm on the move menu — verify with a screenshot
   that it's animating; wild Lv1x mon can't act first vs Lv85 so ours always goes).
2. ~0.4 s in, take ONE `/tmp/dump_va` → `va.bin` has the live dispatch.
3. Read Battle.cro's seg table (via `text_va-0x180`) → rodata_va, bss_va. Read the
   active **sequence id** from the step-state work field (`work+0xa94`) and the
   queued **effectId** from the event queue (`bss+0x394`, tag 0x1f). That pair is
   one (effectId→seqId) remap entry; repeat for a few moves to fill the table, or
   seed `tools/usum_effect_remap.py probe_queue()` with the live bss image.
