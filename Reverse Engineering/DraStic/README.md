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
| Memory/wireless dispatch locus (§4.1) | ⏳ **Open.** DraStic is a dynarec that *assembles ARM code*, so region bit-patterns litter `.text` as opcode templates — static search can't find it. (A `0x8825c` "hit" was a false positive, **retracted** — see `FINDINGS_JIT.md`.) Needs **dynamic analysis**. |
| Scheduler / IRQ / guest-RAM (§4.2–4.4) | ⏳ **Blocked on §4.1** |

**Recommendation:** firmware + melonDS-transplant + Java-transport parts are
settled. The DraStic-core integration is the hard, unproven part — and the one
sub-result that looked "found" (a memory-dispatch site) turned out to be a JIT
opcode-encoding template, not an address. Because DraStic is a dynarec that
assembles host ARM instructions, **static constant search is confounded**; the
sound path is **dynamic analysis** (execute a core, trace an access to
`0x048xxxxx`). See `FEASIBILITY.md` §4 + `FINDINGS_JIT.md`.
