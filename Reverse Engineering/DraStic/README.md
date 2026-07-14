# DraStic DS Emulator — Reverse Engineering

Reverse-engineering the **DraStic** Android DS emulator (`com.dsemu.drastic`,
**r2.6.0.4a**) with the goal of **adding DS local-wireless multiplayer** — a
feature DraStic has never had.

RE is authorized for this repo (see the ⚖️ block in the root `CLAUDE.md`).

> ## ▶ RESUMING? READ **[`CONTINUE_HERE.md`](CONTINUE_HERE.md)** FIRST.
> It is the single source of truth for continuing this work (session bootstrap,
> settled facts, retracted false positives, exact addresses, the current blocker,
> and the ordered next tasks). This README is just the overview.

## Goal

Make two DraStic instances link over the DS's local wireless (Download Play /
multi-cart battles/trades, e.g. Pokémon, Mario Kart DS local). melonDS already
implements DS wireless in open source (GPLv3) — so the strategy is **transplant
melonDS's `Wifi` state machine and wire it into DraStic**, rather than inventing
the wireless emulation from scratch.

## What's here

```
CONTINUE_HERE.md the single resume point (read this first when continuing)
apk/        the two r2.6.0.4a APK builds (arm64-v8a and armeabi-v7a) — the RE subject
firmware/   DS_lite_X2B-W-20051130_1616.bin — the DS Lite firmware we need
analysis/   analyze_drastic.py  — ELF/const/symbol recon
            drastic_emu.py      — Unicorn ARM loader (relocs, import stubs, tracing)
            drastic_headless.py — synthetic Android/JNI runtime + init driver
            frida_trace.js      — on-device tracer (low-risk alternative)
FEASIBILITY.md   the full go/no-go engineering assessment
FINDINGS_JIT.md  dynarec analysis + the 0x8825c false-positive retraction
HARNESS.md       the Unicorn harness + headless driver results + blocker
FIRMWARE.md      why this firmware, and the survey of the whole dump set
```

## TL;DR status

| Sub-problem | State |
|---|---|
| DS wifi RF/BB calibration + MAC (firmware) | ✅ **Solved** — CRC-valid retail DS Lite firmware (`firmware/`) |
| Wireless state machine | ✅ **Solved in principle** — transplant melonDS `Wifi` (GPLv3) |
| Netplay transport | ✅ **Easy** — Java layer (Android sockets) + 1 JNI method; DraStic has **zero** native networking |
| Headless core **loads + fully initializes** in-cloud | ✅ `onInit`/`insertGame`/`resetDS`/`startGame` all run CLEAN (Unicorn harness) |
| Headless core **emulates a frame** | ⏳ **Blocked** — emulation is producer/consumer **multi-threaded**; the worker (`0x37ae4`) waits on a condvar nothing signals single-threaded. Needs cooperative thread scheduling (or use the on-device Frida route). |
| Memory/wireless hook + scheduler/IRQ/RAM (§4.1–4.4) | ⏳ **Blocked on the above** — needs a live frame to surface the I/O helper |

**Two false positives were caught and retracted** (recorded so they aren't
repeated): `0x8825c` is a JIT opcode template, not the wireless hook; and a
"1M JIT blocks ran" claim was actually 1M condvar busy-spins (no guest code ran).
See `FINDINGS_JIT.md` / `HARNESS.md`.

**Next:** see `CONTINUE_HERE.md` §3 — determine how emulation is driven (Java-thread
vs native pthread), implement cooperative scheduling so a frame runs, then read the
I/O helper's `0x048xxxxx` branch. Lower-risk alternative: `frida_trace.js` on a
real device/emulator.
