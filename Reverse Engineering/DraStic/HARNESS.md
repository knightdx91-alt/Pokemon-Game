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

## Honest status

The harness is the *tool*; it does not yet by itself reach a wireless access,
because that requires either the translator context layout (experiment A) or a
booted DS core (out of scope for Unicorn — needs the Android/JNI runtime + ROM +
BIOS). Next concrete step: reverse the translator's context struct so experiment
A can run end-to-end and reveal the memory-handler address.
