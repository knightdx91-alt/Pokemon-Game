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

### M3 (in progress) — step the DS CPU until the I/O helper fires

**Key simplification found:** we do NOT need to reach the Union Room. Every DS
game reads DS I/O registers (DISPSTAT/VCOUNT/keypad/timers/IPC) on its very first
frame, so DraStic's **I/O read/write helper — the function whose internal
address-dispatch contains the wireless (`0x048xxxxx`) sub-branch — is called from
frame 1.** `drastic_headless.py`'s `run_frame` detects it by trapping any basic
block entered with an argument register in the guest I/O range `0x04xxxxxx`
(0x048xxxxx flagged as wireless). So **one booted DS frame is enough** to surface
the handler; a multiplayer ROM/save is only needed later to exercise the wifi
*case*, not to find it.

**Real emulation API mapped** (from the export table): the flow is
`onInit → insertGame(directBoot=1) → startGame → updateFrame` (the true
emulation-step; `renderFrame` only blits). DS emulation runs on a **pthread**;
`drastic_headless.py` captures its `start_routine` from `pthread_create` so it can
be run single-threaded.

**Current blocker (one concrete loader gap):** `onInit` faults — it reaches a
**PLT stub** (`ldr pc,[ip,#off]!` at ~`0x9a80`) whose GOT slot the synthetic
loader didn't resolve, so the indirect jump lands in garbage. `drastic_emu.py`
relocates the 239 `R_ARM_JUMP_SLOT` entries to import stubs, but this slot is a
**lazy/unrelocated GOT.plt entry** (normally filled by the dynamic linker on
first call). Fix options:
  1. Pre-resolve every `.got.plt` slot that still points into the PLT (lazy
     value) to a generic "return 0" import stub; or
  2. Emulate the PLT[0] resolver: on entry to any PLT stub, decode the reloc
     index and dispatch to the right stub.
Until then, `onInit` doesn't complete, so no emu thread is created and
`updateFrame` no-ops (0 I/O calls observed — the symptom).

Once `onInit` completes: run `updateFrame` (or the captured emu-thread routine)
for one frame with the I/O-block detector → the hot `0x04xxxxxx`-arg block is the
memory/IO helper → read its `0x048xxxxx` sub-branch statically = the wireless
hook. That is the finish line for §4.1.

Honest status: M1+M2 proven; M3 has the path + tooling but is blocked on the PLT
lazy-binding fix in the loader. Performance note: Unicorn emulating DraStic's JIT
compiling+running a DS frame is slow but the first I/O access comes early in the
frame, so a bounded instruction cap should reach it.
