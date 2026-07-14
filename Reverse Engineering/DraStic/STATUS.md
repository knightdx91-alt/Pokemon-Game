# DraStic Multiplayer RE — Consolidated Status & Realistic Roadmap

Goal: add DS local-wireless multiplayer to DraStic (r2.6.0.4a) by transplanting
melonDS's (GPLv3) wireless code and wiring it into DraStic's core.

## Where we are (honest)

| Piece | State | Evidence |
|---|---|---|
| DS wifi RF/BB calibration + MAC | ✅ **Solved** | CRC-valid retail DS Lite firmware `firmware/DS_lite_X2B…bin` (`FIRMWARE.md`) |
| Wireless state machine | ✅ **Solved in principle** | transplant melonDS `Wifi` (GPLv3) |
| Netplay transport | ✅ **Easy** | DraStic has zero native networking → do it in the Java layer + 1 JNI method |
| DraStic is a dynarec (ARM/A32, huge bss code cache) | ✅ **Confirmed** | `analysis/` recon; emitter @0x87410 assembles host ARM |
| **Memory/wireless dispatch locus (the hook)** | ❌ **Not found** | static search confounded (see below); one false positive already retracted |
| Scheduler / IRQ / guest-RAM integration | ⛔ **Blocked on the hook** | — |

## The core obstacle, precisely

DraStic compiles guest memory accesses into host ARM code (dynarec). Two
consequences:
1. **No C slow-path** like `arm7_io_write32()` to detour.
2. The DS region bit-patterns (`0x02/0x04/0x06/0x08 << 24`) are *also* common ARM
   opcode/immediate fields, so they appear all over `.text` as **encoding
   templates**. Static constant search cannot tell "region base as address" from
   "opcode field" — and in a JIT the latter dominates. This is exactly what
   produced (and then invalidated) the retracted `0x8825c` "hook" — see
   `FINDINGS_JIT.md`. **Static RE alone cannot locate the dispatch here.**

## What's built to break the obstacle

- `analysis/analyze_drastic.py` — ELF/const/symbol recon (reproducible).
- `analysis/drastic_emu.py` — **Unicorn harness**: loads the real core, relocs,
  stubs 251 imports, runs functions with branch/mem tracing + a wireless-region
  watch. Validated loading + executing. Limit: can't *boot* the DS (no Android/
  JNI/ROM), so it drives individual functions (`HARNESS.md`, experiments A/B).
- `analysis/frida_trace.js` — **on-device tracer**: coverage-diff to isolate the
  wireless code path, a `probe()` to confirm a candidate helper by its address
  argument, and a buffer watch. This is the technique most likely to actually
  find the handler, because on a live device the I/O path executes every frame.

## Realistic roadmap (in order of leverage)

1. **On-device Frida trace (highest ROI).** Run `frida_trace.js` against the live
   app: `cov()` with wireless idle vs. while a game enters a multiplayer/Download-
   Play screen; diff the coverage to a short candidate list; `probe()` each until
   one shows a `0x048xxxxx` argument. That address is the memory/wireless helper —
   the hook. Everything else depends on this.
2. **Or the Unicorn translator experiment** (`HARNESS.md` exp. A): reverse the
   translator's context struct, drive it on a guest `LDR` from `0x04800000`, read
   the host code it emits, and recover the helper the emitted `bl` targets. Fully
   cloud-doable but intricate.
3. Once the helper is known: wrap/redirect it for the `0x048xxxxx` range → call
   the transplanted melonDS `Wifi` (fed the `X2B` firmware). Then §4.2–4.4:
   DraStic's scheduler (timed events), ARM7 IRQ delivery, guest-RAM access.
4. Netplay transport in the Java layer + new JNI methods; lobby/relay.

## Honest verdict & the alternative

This is a **large, uncertain project**. The firmware + wireless-model + transport
thirds are solved; the DraStic-core integration is genuinely hard, and even after
finding the hook, patching a dynarec to host a wireless device with correct
timing is substantial. A full, robust result is plausibly **many weeks of
on-device RE**, with real risk on timing fidelity.

**The pragmatic alternative** (flagged repeatedly, restated here): if the actual
goal is *DS multiplayer on Android*, packaging **melonDS** — which already has
working local wireless + netplay in open source — is dramatically lower-risk than
grafting it onto DraStic's closed binary. Grafting onto DraStic is only worth it
if DraStic *specifically* (its speed/compat/UX) is a hard requirement.

**Licensing reminder:** transplanting melonDS makes a distributed patched APK
GPLv3-derived while DraStic is proprietary — fine for personal use, a real
constraint for distribution.
