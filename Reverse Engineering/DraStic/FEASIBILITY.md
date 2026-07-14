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
   ⏳ **STILL OPEN. (A prior "resolved at `0x8825c`" claim was RETRACTED — it was
   a false positive; see `FINDINGS_JIT.md`.)** DraStic is confirmed a **dynarec
   (JIT) that assembles host ARM code**, so DS region bit-patterns
   (`0x04800000`, etc.) appear all over `.text` as **ARM opcode templates**, not
   as memory-dispatch constants — the `0x8825c` site is the JIT setting an
   LDR/STR U-bit. **Static constant search cannot locate the dispatch here.** The
   real target is the **runtime memory-access helper** (page-table style,
   runtime-addressed) that compiled code calls; it has **not** been found.
   Recovering it needs the `.data`-table route (checked — no handler pointers) or,
   more likely, **dynamic analysis** (run a core, trace an access to
   `0x048xxxxx`).
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
- ⏳ **Core integration (§4) — still open and decisive; §4.1 NOT yet solved.**
  A prior claim that the hook was found at `0x8825c` was a **false positive**
  (JIT opcode template, not a memory address — retracted, see `FINDINGS_JIT.md`).
  Confirmed: DraStic is a dynarec that **assembles host ARM code**, which makes
  static constant-search unusable for finding the memory dispatch. The runtime
  memory-access helper (the true hook) is unlocated.

### Recommended next step

**Switch to dynamic analysis** — static search is confounded by the JIT.
Stand up a harness that actually executes a core: either (a) load `libdrastic.so`
in a **Unicorn/QEMU** harness, feed it a minimal ROM/state that reads
`0x04800000`, and trace which function services the access; or (b) run DraStic
**on-device/emulator with a native hook** (e.g. `frida`/`LD_PRELOAD`-style) and
watch for the wireless access. Recovering that helper's address is the real
§4.1. Everything downstream (wrap/redirect the helper, wire in melonDS `Wifi`,
scheduler/IRQ/guest-RAM §4.2–4.4) depends on it.

> Reality check: this retraction widens the risk. The one piece that looked
> "located" wasn't, and the sound path forward is dynamic RE — more involved than
> static disassembly. The firmware + melonDS-transplant + Java-transport parts
> remain solid; the DraStic-core integration is genuinely hard and still unproven.

> Honest note: if the aim is simply *DS multiplayer on Android*, packaging
> **melonDS** (open source, wireless already working) is dramatically less risky
> than grafting it onto DraStic. Grafting onto DraStic is worth it only if
> DraStic specifically (its speed/UX/compat) is the requirement.
