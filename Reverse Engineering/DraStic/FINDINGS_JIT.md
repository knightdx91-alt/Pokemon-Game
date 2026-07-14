# §4.1 Result — DraStic's memory dispatch is a JIT emitter (hook locus found)

This resolves the "deciding risk" question from `FEASIBILITY.md` §4.1: *is there
a hookable slow-path where wireless (`0x048xxxxx`) accesses can be intercepted?*

**Answer: DraStic does not route memory through a C slow-path switch. It is a
dynarec (JIT) that emits native ARM code for guest memory accesses, and the
wireless region is handled inside that emitter.** The hook is at the emitter
level, and its exact locus is now known.

Target analyzed: `armeabi-v7a/libdrastic.so` (ARM/A32 core, the tractable build).

## How it was found

1. The core is **ARM (A32) with literal pools**, mostly ARM (1813 `push{..,lr}`
   ARM prologues vs 404 Thumb) — *not* Thumb-2 as first assumed. (Capstone's
   linear decode silently halts on the first bad word; a **continue-on-error
   sweep** was required — without it the whole `.text` looked empty. Prior
   "no constants" readings were that artifact.)
2. Robust sweep for guest region bases: main RAM `0x02000000` ×60, I/O
   `0x04000000` ×54, VRAM/OAM/GBA present — and **`0x04800000` (wireless) exactly
   once, at `0x8825c`**. The bit-23 mask `0x00800000` (which separates wifi
   `0x04800000` from main I/O `0x04000000`) appears ×163.

## The locus (function ~`0x87994`, emitter body around `0x88180`+)

```
0x88204: tst    sl, #0x800000      ; bit 23 of the GUEST address in sl
0x88210: movweq r2, #4             ; branch factor by region class
   ...
0x88250: mov    r6, #0x4000000     ; region base := main I/O 0x04000000
0x88254: cmp    r2, #0
0x8825c: movmi  r6, #0x4800000     ; ...or wireless 0x04800000  <-- THE wifi ref
0x88260: orr    r2, r7, r6
   ...
0x881c0: ldr    r3, [r4, #0x4ac]   ; r3 := JIT code-emit cursor (ctx+0x4AC)
0x881d0: movw   r7, #0x3c
0x881d4: movt   r7, #0xe51b        ; building an ARM 'ldr/str' encoding (0xe51b003c)
0x881dc: str    r7, [r3]           ; emit word 0
0x881e0: str    r2, [r3, #4]       ; emit word 1
0x8831c: str    r1, [r2], #4       ; post-indexed emit (advance cursor)
```

Evidence it's a code emitter, not an interpreter:
- The values stored (`0xe3c0….`, `0xe51b003c`, `0xe3000000`) are **ARM opcodes**
  (`mov`/`movw`/`ldr`/`str`), not data values.
- The store targets come from **`[ctx, #0x4ac]`** and use post-indexed
  `str …,[cursor],#4` — the canonical "append instruction to output buffer"
  pattern. `ctx+0x4AC` is the emit cursor field of the JIT block context.
- A PC-relative **jump table** at `0x88288` (`add r2,pc,#4; ldr r0,[r2,r0,lsl#2];
  add pc,r2,r0`, entries `0x1d10/0x1dac/0x1dc8/0x1ed4`) selects the emit path by
  access class/size.

## What this means for the multiplayer plan

- **There is no C function like `arm7_io_write32()` to LD_PRELOAD/detour.** Guest
  memory accesses are compiled inline. So the wireless hook is **not** "add cases
  to a switch"; it is **"change what the dynarec emits for the `0x048xxxxx`
  range."**
- Concretely, at the bit-23 branch (`0x88204` / `0x8825c`) the emitter currently
  produces code that treats wireless like an I/O/open-bus access. To add
  multiplayer we make the emitter, for the wireless range, emit a **call-out to a
  transplanted `wifi_read/wifi_write` handler** (the melonDS `Wifi` model) instead
  of the stub. Two viable routes:
  1. **Patch the emitter** so the wireless case emits `bl <our handler>` (a small,
     surgical change at a known address — but requires fully reversing the
     emitter's register/ABI contract at that point: what holds addr/value/size,
     and what the emitted callee must preserve).
  2. ~~Force wireless pages to the interpreter/slow path via the compat core~~ —
     **checked, ruled out.** `libdrastic_compat.so` is *not* a plain-C
     interpreter: it has the **identical emitter signature** (`0x04800000`
     referenced exactly once, at `0x7f788`, gated by the same
     `tst …,#0x800000` bit-23 test → `movmi r6,#0x4800000`). Both cores are the
     same dynarec design; there is no easier C dispatch to fall back to.

     So **route 1 (patch the emitter) is the only path.** Both `libdrastic.so`
     (wifi @ `0x8825c`) and `libdrastic_compat.so` (wifi @ `0x7f788`) expose the
     same surgical patch point.

## Difficulty verdict (updated)

- The hook locus is **found and named** (`0x87994` emitter; wifi at `0x8825c`,
  gated by `tst … ,#0x800000` at `0x88204`). That removes the biggest unknown.
- But because it's a **dynarec emitter**, the integration is **harder than a C
  slow-path** would have been: we must reverse the emitter's local calling
  convention to splice a `bl` to our handler, then drive `Wifi` from there — plus
  still solve scheduler/IRQ/guest-RAM (§4.2–4.4). The **compat core** is the more
  promising near-term target and should be checked next (it may expose a plain C
  memory dispatch).

## Reproduce

```
python3 analysis/analyze_drastic.py <libdrastic.so>          # region-const summary
# full emitter disasm: continue-on-error ARM sweep around 0x87994..0x8b000
```
