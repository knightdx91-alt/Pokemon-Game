# Adding Multiplayer to DraStic — Feasibility Assessment

**Target:** DraStic r2.6.0.4a (`com.dsemu.drastic`), Android.
**Goal:** DS local-wireless multiplayer (Download Play, multi-cart link).
**Strategy:** transplant melonDS's open-source (GPLv3) `Wifi` state machine and
wire it into DraStic's emulation core via a native shim + a Java-side netplay
transport.

This is an honest engineering assessment based on static RE of the shipped
binaries. It is **not** a promise the project converges — the deciding risk
(reversing DraStic's JIT internals) is real and unresolved.

---

## 1. Package facts

Two r2.6.0.4a builds were analyzed:

| Build | ABI | Cores |
|---|---|---|
| `DraStic DS Emulator r2.6.0.4a.apk` (10.9 MB) | `arm64-v8a` | `libdrastic_arm64.so` (1.35 MB), `libdrastic_cpu.so` (10 KB) |
| `com.dsemu.drastic_r2.6.0.4a-APK_Award.apk` (12.6 MB) | `armeabi-v7a` | `libdrastic.so` (1.26 MB), `libdrastic_compat.so` (1.17 MB), `libdrastic_cpu.so` (18 KB) |

Same emulator version, different CPU architectures. Neither is fat; a device
uses one or the other. The **v7 core is the better RE target** — Thumb-2 is
easier to follow, and armeabi-v7a is the more broadly compatible build.

Assets of interest (shared): `game_database.xml` (per-game save/compat DB),
`usrcheat.dat` (R4 cheat DB), HLE `drastic_bios_arm7/9.bin`, custom shader
format, keymaps, virtual controllers.

## 2. Confirmed by RE (`analysis/analyze_drastic.py`)

- **Wireless is fully stubbed — nothing to extend.** No `wifi/wireless/802.11/
  baseband` strings. The DS wireless region base `0x04800000` appears only 1–3×
  (and those are coincidental data, since the core builds addresses inline via
  `movw/movt`, not literal pools); the finer wireless constants (region end
  `0x04808000`, **Wifi-RAM** `0x04804000`/mirror) appear **0×**. By contrast the
  main I/O base `0x04000000` appears 148× (v7) / 208× (arm64). Conclusion:
  accesses to `0x048xxxxx` are swallowed by a coarse range check; there is no
  partial wireless model to build on.
- **Zero native networking.** No `socket/connect/bind/send/recv/inet` imports in
  either core. → The netplay transport must be added wholesale, and the clean
  place is the **Java/Kotlin layer** (full Android sockets) bridged in via one
  new JNI method — not the native lib.
- **Threaded, pthread-based** (17 pthread imports): emu + audio/render threads.
- **Clean, stable JNI surface** — 72 methods, all `Java_com_dsemu_drastic_
  DraSticJNI_*` (`insertGame`, `loadState`/`saveState`, `pauseSystem`,
  `renderFrame`, `applyConfig`, `updateCheats`, …). **No wireless JNI.** Adding
  multiplayer means adding new JNI methods → **both** the native `.so` **and**
  `classes.dex` must be modified.
- **Large static `.bss`** (~48 MB v7 / ~64 MB arm64) = the emulated DS RAM +
  JIT code cache reserved at load. Confirms a **dynarec (JIT)** design.

## 3. Firmware blocker — SOLVED

DS wireless init needs the firmware's RF/BB calibration + MAC. Secured a
CRC-valid retail DS Lite firmware (`firmware/DS_lite_X2B-W-20051130_1616.bin`,
MAC `00:09:BF:05:A3:D4`, RF2958, cfg CRC `0x1488` ✅). Because our shim owns
wireless init (like melonDS), we feed this file to the transplanted code
directly — DraStic's HLE limitation is irrelevant. See `FIRMWARE.md`.

## 4. The deciding risk — hooking into DraStic's core

melonDS's `Wifi` is a *guest* of melonDS's CPU/scheduler/IRQ/memory. To run it
under DraStic we must reverse DraStic's equivalents and write glue. Remaining RE
tasks, in dependency order:

1. **ARM7 I/O read/write dispatch + the `0x048xxxxx` stub** — the hook point.
   ✅ **RESOLVED — see `FINDINGS_JIT.md`.** DraStic compiles memory accesses in a
   **dynarec (JIT) emitter**; there is **no C slow-path** to detour. The wireless
   region is handled inside the emitter, selected by a **bit-23 test**
   (`tst addr,#0x800000`) — located at `0x8825c` in `libdrastic.so` and `0x7f788`
   in `libdrastic_compat.so` (both cores, same design). So the hook is
   "**patch the emitter to emit a call-out to our `wifi_read/write` handler for
   the `0x048xxxxx` range**," not "add a switch case." Harder than a C hook, but
   the exact locus is now known. Remaining sub-task: reverse the emitter's local
   register/ABI contract at that point to splice a `bl`.
2. **Scheduler / timing** — how to read a cycle/µs timestamp and register a
   timed callback, so the (extremely timing-sensitive) beacon/CMD/REPLY state
   machine ticks correctly.
3. **ARM7 interrupt controller** — how DraStic sets ARM7 `IF`/delivers IRQ 24
   so the game's wifi driver wakes on TX/RX completion.
4. **Guest-RAM access** — DraStic's main-RAM base pointer/accessor, so the shim
   can DMA packets between Wifi-RAM and main RAM.
5. *(optional)* **Savestate hooks** — (de)serialize the new wireless state so
   `saveState`/`loadState` don't corrupt.

Difficulty: items 1–4 are deep disassembly of a **stripped** Thumb-2 / AArch64
binary with no symbols. Item 1 (JIT) is the make-or-break; if wireless accesses
are inlined with no clean slow-path, in-place patching becomes impractical.

## 5. Proposed architecture (if it proceeds)

```
  ┌─────────────────────────── Android app (classes.dex, editable) ───────────┐
  │  Netplay transport: TCP/UDP sockets, lobby, frame relay (Java/Kotlin)      │
  │        │  new JNI:  wifiPushRxFrame(byte[])   wifiPollTxFrame() : byte[]   │
  └────────┼──────────────────────────────────────────────────────────────────┘
           ▼
  ┌──────── native shim (new code linked/patched into libdrastic*.so) ─────────┐
  │  melonDS Wifi state machine (GPLv3, lifted)  +  firmware(X2B) cal/MAC       │
  │        ▲ reads/writes guest RAM   ▲ ticks on scheduler   ▲ raises ARM7 IRQ  │
  └────────┼───────────────┼───────────────────┼──────────────────────────────┘
           │ hook          │ hook              │ hook
     ARM7 I/O dispatch  DraStic scheduler   DraStic IRQ ctrl   ← reversed in §4
     (0x048xxxxx stub)
```

Transport in Java = trivial and avoids adding native networking. The hard part
is the three `hook` arrows into reversed internals.

**Licensing:** lifting melonDS code makes the derived work **GPLv3**; DraStic
itself is proprietary. A distributable patched APK would have GPL-compliance
implications. Fine for private/personal use; flag before any distribution.

## 6. Verdict

- ✅ Firmware/calibration — solved.
- ✅ Wireless state machine — solved in principle (melonDS transplant).
- ✅ Netplay transport — easy (Java sockets + 1 JNI method).
- ⏳ **Core integration (§4) — partially resolved, still decisive.** §4.1 is
  **done**: the hook locus is found (dynarec emitter; wifi at `0x8825c` /
  `0x7f788`, gated by the bit-23 test). The confirmed "worst case" from before is
  what we have — **JIT-inlined memory access, no clean C seam** — so the emitter
  must be patched to call out for the wireless range. That is bounded and located
  but non-trivial, and §4.2–4.4 (scheduler, IRQ, guest-RAM) remain.

### Recommended next step

Now that §4.1 is pinned, the next concrete task is to **reverse the emitter's
local ABI at `0x88204`–`0x8825c`**: which registers carry the guest address,
value, and access size at that point, and what an emitted `bl <handler>` must
preserve. Then prototype: patch the emitter so the `0x048xxxxx` case emits a call
to a stub `wifi_read/write` (first just logging), and confirm — on-device or via
a Unicorn harness — that wireless accesses reach it. That proves the emitter-hook
mechanism end-to-end before wiring in melonDS's `Wifi` + scheduler/IRQ (§4.2–4.4).

> Honest note: if the aim is simply *DS multiplayer on Android*, packaging
> **melonDS** (open source, wireless already working) is dramatically less risky
> than grafting it onto DraStic. Grafting onto DraStic is worth it only if
> DraStic specifically (its speed/UX/compat) is the requirement.
