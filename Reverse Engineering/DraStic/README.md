# DraStic DS Emulator — Reverse Engineering

Reverse-engineering the **DraStic** Android DS emulator (`com.dsemu.drastic`,
**r2.6.0.4a**) with the goal of **adding DS local-wireless multiplayer** — a
feature DraStic has never had.

RE is authorized for this repo (see the ⚖️ block in the root `CLAUDE.md`).

## Goal

Make two DraStic instances link over the DS's local wireless (Download Play /
multi-cart battles/trades, e.g. Pokémon, Mario Kart DS local). melonDS already
implements DS wireless in open source (GPLv3) — so the strategy is **transplant
melonDS's `Wifi` state machine and wire it into DraStic**, rather than inventing
the wireless emulation from scratch.

## What's here

```
apk/        the two r2.6.0.4a APK builds (arm64-v8a and armeabi-v7a)   [see note]
firmware/   DS_lite_X2B-W-20051130_1616.bin — the DS Lite firmware we need
analysis/   analyze_drastic.py — reproducible ELF/const/symbol recon
FEASIBILITY.md   the full go/no-go engineering assessment
FIRMWARE.md      why this firmware, and the survey of the whole dump set
```

> **APK note:** the two APKs are the RE subject. If they aren't committed yet
> (size/LFS), pull them from the owner's Drive — see `apk/README.md`.

## TL;DR status

| Sub-problem | State |
|---|---|
| DS wireless RF/BB calibration + MAC (firmware) | ✅ **Solved** — CRC-valid retail DS Lite firmware secured (`firmware/`) |
| Wireless MAC/baseband state machine | ✅ **Solved in principle** — transplant melonDS `Wifi` (GPLv3) |
| Netplay transport | ✅ **Easy** — add in the Java layer (Android sockets) + one new JNI method; DraStic has **zero** native networking to fight |
| Hook locus in DraStic's core (§4.1) | ✅ **Found** — dynarec emitter; wifi selected by bit-23 test at `0x8825c` (`libdrastic.so`) / `0x7f788` (compat). See `FINDINGS_JIT.md` |
| Emitter ABI + scheduler / IRQ / guest-RAM (§4.2–4.4) | ⏳ **Remaining decisive work** — patch the emitter to call a wifi handler, then wire in melonDS `Wifi` |

**Recommendation:** the firmware + melonDS parts are settled, and the JIT hook
point is now located. The core is a **dynarec** — memory accesses are compiled
inline, so there is no C slow-path to detour; the fix is **patching the emitter**
to emit a call-out for the `0x048xxxxx` range, not adding a switch case. The
project now hinges on reversing the emitter's local ABI and the scheduler / IRQ /
guest-RAM internals. See `FEASIBILITY.md` §4 and `FINDINGS_JIT.md`.
