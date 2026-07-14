# Dynamic-trace harness (`analysis/drastic_emu.py`)

Because DraStic is a dynarec that *assembles* host ARM code, static constant
search can't find the DS memory/wireless dispatch (see `FINDINGS_JIT.md`). This
harness runs the real `libdrastic.so` under **Unicorn (ARM/A32)** so we can
observe behaviour instead of guessing from constants.

## What it does (built & validated)

- Loads the real ELF: maps both PT_LOAD segments at their vaddrs (incl. the
  ~48 MB `.bss` code-cache region), applies all relocations
  (**2812**: 2559 `R_ARM_RELATIVE`, 239 `JUMP_SLOT`, 14 `GLOB_DAT`).
- **Stubs 251 imports** (libc/pthread/OpenSLES): calls into them return cleanly;
  `malloc`/`calloc`/`realloc` hand out a bump-heap pointer.
- Executes a chosen function (`call(addr, args)`), ARM **or** Thumb entry, with:
  - branch trace (`bl`/`blx` targets),
  - full memory read/write trace,
  - **wireless-region watch** (`0x04800000–0x0480ffff`) — any access is logged
    with PC/size/value,
  - on-demand mapping + fault capture so a stray pointer doesn't abort the run.

Validated: loads clean (`--load-only` lists segments/relocs/imports), and
executes+traces real code (smoke-tested on the `getVersionString` export — the
instruction/branch/mem hooks fire and faults are caught, not fatal).

## Usage

```
# extract the core from the armeabi-v7a APK first:
unzip -o DraStic_r2.6.0.4a_armeabi-v7a.apk lib/armeabi-v7a/libdrastic.so
pip install unicorn capstone

python3 analysis/drastic_emu.py --lib libdrastic.so --load-only            # sanity
python3 analysis/drastic_emu.py --lib libdrastic.so --call 0x<fn> --args 0x04800000 --trace
```

## The two experiments this enables (the actual §4.1 work)

**A — drive the translator on a crafted guest `LDR` from `0x04800000`.**
The dynarec block compiler is at `0x87410` (`push {r4-r11,lr}`). Set up its
context struct (emit cursor at `ctx+0x4AC`, plus the fields it reads around
`0x88180`+), place a guest `ldr rD,[rN]` opcode where it decodes instructions,
run it, then disassemble the **host code it emits into the cursor**. If the
emitted code for the `0x048xxxxx` range is a `bl <helper>`, that callee is the
runtime memory handler we hook. (Needs the ctx layout reversed first — the main
open task.)

**B — probe a candidate runtime memory helper directly.**
Once a candidate read/write helper is identified (e.g. from experiment A, or by
tracing a booted core), call it with a wireless address:
`--call 0x<helper> --args 0x04800000` and let the wireless-watch + branch trace
show what it touches and dispatches to.

## Headless-core driver — `drastic_headless.py` (the spike, WORKING to M2)

Rather than reverse the translator context, the more powerful route is to **run
the core headless** with a *synthetic* Android/JNI runtime (no device, no
virtualization) and let it execute until the wireless-watch fires.
`drastic_headless.py` extends the harness with functional libc import handlers
(memcpy/memset/malloc/open/read/lseek/fopen/fread → serving host ROM/BIOS files)
and in-guest **JavaVM + JNIEnv vtables** (240 slots) whose entries trap to a
Python dispatcher (GetEnv, FindClass, NewGlobalRef, GetMethodID,
GetStringUTFChars, …).

**Verified milestones (run: `python3 drastic_headless.py --lib libdrastic.so`):**
- **M1 — `JNI_OnLoad` runs clean, returns `0x10006`** (JNI_VERSION_1_6). 11 JNI
  calls serviced by the fake vtables. ✅
- **M2 — `insertGame` runs clean, returns `0x1`** (success). Executes its init
  chain (`0x122ec`, `0x11550`, snprintf path-store into the emulator state global
  at the pc-relative base, `0xefa4`, `0x116d4`) and releases the ROM string. ✅
  - Required enabling **VFP/NEON** in Unicorn (DraStic uses `vmov.i32 q8` etc.);
    done in `drastic_emu.py` (`CPACR` cp10/cp11 + `FPEXC.EN`). Without it the core
    faults "invalid instruction" on the first NEON op.

This **disproves** the earlier assumption that a booted core was out of reach in
cloud: the runtime-synthesis approach drives the real core to a ROM-initialized
state with no Android.

### M3 (next) — step the DS CPU until wifi is touched
Remaining to reach an actual wireless access:
1. Locate the **frame/emulation-run** function (from `renderFrame` export or the
   internal step loop) and call it in a loop.
2. Wire real inputs through the file-server already built: the APK's
   `assets/drastic_bios_arm7.bin`/`arm9.bin` (+ the `DS_lite_X2B` firmware in
   `firmware/`) and a DS ROM, so the core actually boots the DS.
3. Survive the core's **callbacks into Java** during a frame (video blit / input);
   the JNI dispatcher returns non-null for handles — `CallVoidMethod`-style
   callbacks just no-op, but any the emulation *depends on* (input state) may need
   real returns.
4. With the wireless-watch armed, run frames; DS boot/firmware or a multiplayer
   ROM touching `0x048xxxxx` will surface the host handler + backtrace.

Honest caveat: M3 needs a DS ROM and may need scripted input to reach wireless
code; the DS firmware menu alone doesn't init wifi. But the hard part (a running
core in cloud) is now proven.
