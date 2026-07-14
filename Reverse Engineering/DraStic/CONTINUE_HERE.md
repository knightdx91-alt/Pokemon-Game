# ▶ DraStic Multiplayer — RESUME HERE (start every new session with this)

**Goal (settled):** add **DS local-wireless multiplayer** to the real Android
**DraStic** (r2.6.0.4a) by transplanting melonDS's open-source `Wifi` state
machine and patching it into DraStic's closed native core. We chose this over the
melonDS-web alternative because DraStic's game compatibility is the requirement.

**What this is NOT:** we are NOT trying to make DraStic a usable web app. The core
is a closed native-ARM JIT; running it off-ARM (WASM/emulation) is far too slow to
play. The headless emulation below is a **research tool** to find the wireless
hook so we can patch the *real Android app*. (See `FEASIBILITY.md` for why.)

---

## 0. Session bootstrap (ephemeral things — redo every session)

```bash
pip install unicorn capstone
# DraStic core (v7 = the RE target; extract from the committed APK):
cd "Reverse Engineering/DraStic"
mkdir -p /tmp/dr && (cd /tmp/dr && unzip -o "$OLDPWD/apk/DraStic_r2.6.0.4a_armeabi-v7a.apk" \
    "lib/armeabi-v7a/*" "assets/drastic_bios_*")
# Platinum ROM (test game) from the owner's Drive (id below), 128MB:
curl -sSL "https://drive.usercontent.google.com/download?id=17pbLDu1VxBpO9Jf3AbWO9ZEH9O1ecVcc&export=download&confirm=t" -o /tmp/platinum.nds
```

**Committed inputs (persist in this repo):**
- `apk/DraStic_r2.6.0.4a_armeabi-v7a.apk` — the RE target (v7, `libdrastic.so`,
  ARM/A32, easiest to reverse). Also `..._arm64-v8a.apk`.
- `firmware/DS_lite_X2B-W-20051130_1616.bin` — CRC-valid retail DS Lite firmware,
  MAC `00:09:BF:05:A3:D4`, RF2958. **The wifi RF/BB calibration source.** (`FIRMWARE.md`)
- `analysis/analyze_drastic.py` — ELF/const/symbol recon.
- `analysis/drastic_emu.py` — Unicorn ARM loader (relocs, import stubs, tracing).
- `analysis/drastic_headless.py` — synthetic Android/JNI runtime + init driver.
- `analysis/frida_trace.js` — on-device tracer (the low-risk alternative, below).

**Ephemeral (gitignored / not committed):** the extracted `.so`/BIOS, the ROM.
Drive IDs: Platinum `17pbLDu1VxBpO9Jf3AbWO9ZEH9O1ecVcc` (CPUE); DraStic APKs are
already in `apk/`.

---

## 1. Solved / settled (don't re-derive)

| Piece | State |
|---|---|
| DS wifi RF/BB calibration + MAC | ✅ `firmware/DS_lite_X2B…bin` (CRC valid) |
| Wireless state machine | ✅ transplant melonDS `Wifi` (GPLv3) — not built yet |
| Netplay transport | ✅ easy: Java layer (Android sockets) + 1 new JNI method; DraStic has ZERO native networking |
| DraStic core = dynarec (ARM/A32) that **assembles host ARM code** | ✅ confirmed |
| Headless core **loads + fully initializes** in-cloud | ✅ `onInit`/`insertGame`/`resetDS`/`startGame` all run CLEAN |

### Retracted false positives (DO NOT chase these again)
- **`0x8825c` is NOT the wireless hook.** It's the JIT *assembling* an LDR/STR
  opcode; `0x04800000` there = `LDR/STR class | U-bit`, an opcode template, not the
  DS wireless region. Static constant-search is confounded because the dynarec
  emits ARM opcodes whose bit patterns collide with DS region bases. (`FINDINGS_JIT.md`)
- **"1M JIT blocks ran / emulation runs" was WRONG** — those were 1M busy-spins on
  a `pthread_cond_wait` stub (mis-counted as `.bss`). No guest code executed.

### Harness facts that MUST be preserved (hard-won)
- Capstone linear decode **halts on the first bad word** → use a
  **continue-on-error** sweep, else `.text` looks empty.
- **Enable VFP/NEON** (`CPACR` cp10/cp11 + `FPEXC.EN`) — core uses `vmov.i32 q8`.
- **ARM/Thumb interworking:** put a real `bx lr` (`0xe12fff1e`) at every import/JNI
  stub slot and have hooks set ONLY the return value. Writing PC/CPSR.T from inside
  a Unicorn hook does NOT interwork reliably → Thumb callers crash as ARM. (This
  single fix unblocked the whole init sequence.)
- `memalign` size arg is **r1** (alignment is r0); alloc arena must be large
  (128 MB) — the core allocates JIT/RAM buffers.
- Synthetic `JavaVM`/`JNIEnv` vtables (240 slots) trap to Python. Indices used:
  JavaVM GetEnv `+0x18`; JNIEnv FindClass idx6/`+0x18`, NewGlobalRef idx21/`+0x54`,
  GetMethodID idx94/`+0x178`, GetStaticMethodID idx113, GetStringUTFChars
  idx169/`+0x2a4`, GetPrimitiveArrayCritical idx222/`+0x378`, GetArrayLength idx171.

### Key addresses (`libdrastic.so`, ARM/A32; vaddr == file offset)
```
.text 0xa0d0 (size 0xff630)   .rodata 0x112e20   JIT code cache (bss) >= 0x135000
JNI_OnLoad          0x0e7e0     onInit         0x0b540
insertGame          0x0e124  (env,thiz,jstring rom, jint directBoot=1, ...)
resetDS             0x0e300     startGame      0x0de4c
updateFrame         0x0e318  (only a ~47-insn SYNC STUB, not the emulator)
renderFrame         0x0c7c8  (body 0x0c7fc; blits via GetPrimitiveArrayCritical)
setFirmwareUserdata 0x0dd44  (wifi/MAC/firmware data injection point — RELEVANT)
JIT block translator (assembles host ARM)      0x87410  (push{r4-r11,lr}, ~0x6684 bytes)
emu WORKER thread routine (blocks on cond_wait) 0x37ae4  (start_routine @ call site 0x38368)
pthread_create PLT ~0x9a84 (callers: 0x38368,0x5c788,0x5c80c,0x5c890,0x7a5d0,0xce7a0)
```

---

## 2. THE CURRENT BLOCKER (this is where to work)

**DraStic's emulation is producer/consumer multi-threaded, and a single-threaded
raw harness can't drive it.**
- `updateFrame` (0xe318) is a ~47-insn sync stub — not the emulator.
- `0x37ae4` is a **worker thread that immediately blocks on `pthread_cond_wait`**
  (confirmed: busy-spins the cond_wait stub). It's a *consumer* waiting for a
  signal; nothing signals it single-threaded.
- `pthread_create` is **not** called during `onInit/insertGame/startGame` in our
  runs (threads=[]). So either the emu thread is **created by Java** (Java spawns a
  thread that calls a native run-fn per frame) or creation is gated on state our
  stubs don't set. **Resolve this first** (see task A).

## 3. NEXT TASKS (in order)

**A. Determine how emulation is actually driven.** Two hypotheses:
   1. *Java-driven*: a Java thread calls a native "run one frame" JNI repeatedly.
      Candidate entry points to trace: `updateFrame`, `renderFrame`, `startGame`,
      `resetDS` (returned `0x135000` = JIT cache base — interesting). Trace each
      with a block hook: which one causes execution to enter the JIT cache
      (`>=0x135000`) and stay (many *distinct* blocks, not a spin)?
   2. *Native-thread-driven*: find where `pthread_create` is actually called
      (it exists — 6 call sites). Hook the pthread_create stub across the FULL
      lifecycle incl. renderFrame; capture every `(start_routine, arg)`.

**B. If native-threaded → implement cooperative thread scheduling in the harness.**
   - Capture all pthread_create routines/args.
   - Model sync: `pthread_cond_wait` = yield to scheduler; `pthread_cond_signal`/
     `broadcast` = mark a waiter runnable; `pthread_mutex_lock/unlock` = no-op
     (single core). `pthread_create` = register a runnable thread (don't run yet).
   - Switch threads with `uc.context_save()` / `uc.context_restore()` (+ per-thread
     stacks). Round-robin; when the running thread blocks/yields, pick another.
   - Drive: run the producer (updateFrame or the Java-emu run-fn) which signals the
     worker; cooperatively run the worker (0x37ae4) to produce one frame.

**C. Once a frame actually emulates → find the memory/IO helper.**
   - The DS boot reads I/O (DISPSTAT/VCOUNT/keypad/IPC) on frame 1. Detect the
     helper: NOT by "guest addr in r0-r3" (I/O uses the page-table fast path — that
     detector fired 0 times). Better signals to try:
       * a `.text` function frequently CALLED FROM the JIT cache (LR >= 0x135000);
       * or find the I/O register **shadow buffer** (host) via the memory-map setup
         and watch it with `UC_HOOK_MEM`, backtracing to the accessor;
       * or single-step the JIT-compiled block that services a known DISPSTAT read.
   - The helper's internal dispatch tests the DS I/O sub-region; the **`0x048xxxxx`
     (bit-23) branch = the wireless stub = the §4.1 hook** we've been after.

**D. Design the patch (the actual deliverable).**
   - At the wireless case, emit/redirect to a transplanted `wifi_read/write`
     (melonDS `Wifi`, fed the `X2B` firmware + MAC).
   - Then §4.2–4.4: DraStic's scheduler (timed events), ARM7 IRQ delivery
     (`setFirmwareUserdata` @0xdd44 is a related injection point), guest-RAM access.
   - Netplay transport: new JNI method(s) + Android sockets in `classes.dex`
     (the Java layer); relay wireless frames between two instances over TCP/UDP.
   - **Both** `libdrastic.so` **and** `classes.dex` must be patched, then repack +
     re-sign the APK.
   - **Licensing:** transplanting melonDS makes a distributed patched APK
     **GPLv3-derived** while DraStic is proprietary — fine for personal use, a real
     constraint for distribution.

## 4. Low-risk alternative (recommended if the headless grind stalls)

The headless path proved the core *initializes* but is stuck on the threading
model — which a **real device/emulator solves for free** (the OS runs the threads).
Run **`analysis/frida_trace.js`** against DraStic on a device or a nested-virt
Android emulator, boot Platinum, and let coverage/`probe()` surface the live I/O
helper address in minutes. Then jump straight to task D. This sidesteps tasks A–C
entirely. Every DS game hits I/O on frame 1, so you do NOT need to reach the Union
Room to find the helper — only to exercise the wifi *case* later.

---

## 5. Doc map
- `README.md` — overview + scorecard.
- `FEASIBILITY.md` — the go/no-go, architecture, why not web.
- `FINDINGS_JIT.md` — the dynarec analysis + the `0x8825c` retraction.
- `HARNESS.md` — the Unicorn harness + headless driver, M1/M2/init results, the
  multi-threaded blocker (with the "1M blocks" correction).
- `FIRMWARE.md` — firmware survey + why `X2B`.
- `CONTINUE_HERE.md` — **this file: the single resume point.**
```
