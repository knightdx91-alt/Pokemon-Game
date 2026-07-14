# §4.1 — CORRECTED: the "0x8825c wifi hook" was a false positive

> **Retraction.** An earlier version of this file (commit `df9c312`) claimed the
> wireless hook point was found at `0x8825c` (`libdrastic.so`) / `0x7f788`
> (`libdrastic_compat.so`), gated by a "bit-23 address test." **That was wrong.**
> On verification, the register in question holds a guest **ARM LDR/STR opcode**,
> not a guest address, and `0x04800000` there is an **ARM instruction-encoding
> template**, not the DS wireless region base. The real memory/wireless dispatch
> has **not** been located yet. Details below so the mistake isn't repeated.

## What actually happens at `0x87410` (the "emitter")

`0x87410`–`~0x8da94` (26 KB, `push {r4-r11,lr}`) is DraStic's **dynarec block
compiler** — it translates guest ARM instructions into host ARM instructions.
The sub-region around `0x881f0`–`0x88300` is where it compiles a guest
**LDR/STR**. There, `sl` (r10) = **the guest instruction opcode**, and the code
extracts standard LDR/STR encoding fields:

| instruction | bit(s) | ARM LDR/STR field |
|---|---|---|
| `tst sl,#0x800000` | 23 | U (add/subtract offset) |
| `tst sl,#0x400000` | 22 | B (byte vs word) |
| `ubfx sl,#0x14,#1` | 20 | L (load vs store) |
| `ubfx sl,#0xc,#4` | 12–15 | Rd |
| `and sl,#0xf` | 0–3 | Rm |
| `ubfx sl,#0x10,#4` | 16–19 | Rn |

It then **assembles a host instruction word**: `mov r6,#0x4000000` (LDR/STR
class, bit 26), `movmi r6,#0x4800000` (**same class + U bit**, mirroring the
guest's U bit), `orr` in cond/Rn, and `str`s the finished word to the JIT emit
cursor at `[ctx,#0x4AC]`. Confirming it's opcode assembly: nearby it emits
`movt …,#0xe340` (0xe3400000 = `movt`/`movw` template) and
`orr …,#0xe3000000` (mov-immediate template).

**Therefore `0x04800000` @ `0x8825c` = "LDR/STR opcode with U=1", not the
wireless region.** Same for the other "region constants" found in `.text`
(`0x02000000`=I-bit, `0x04000000`=LDR/STR class, `0x06000000`, `0x08000000`=cond
bit) — they are ARM encoding bitfields the JIT ORs together, which is why a
constant search lit up all over the instruction translator.

## Why the constant-search approach is confounded here

DraStic is a **dynarec that assembles ARM host code**, so the exact bit patterns
that also happen to be DS memory-region bases (`0x02/0x04/0x06/0x08 << 24`)
appear as *opcode templates* throughout `.text`. **Static constant search cannot
distinguish "DS region base as an address" from "ARM opcode field" — and in a
JIT the latter dominates.** This is the core methodological trap; do not treat a
region-base constant in `.text` as a memory-dispatch site without confirming the
holding register is a runtime address, not a guest opcode.

## What IS still established (unaffected by the error)

- DraStic is a **dynarec/JIT** (this analysis reinforces it — huge `.bss` code
  cache, an ARM-assembling emitter).
- Core is **ARM/A32** (mostly ARM, some Thumb). Capstone linear decode halts on
  the first bad word → a **continue-on-error sweep** is mandatory.
- Guest region bases also appear as 4-aligned words in a **`.data` cluster**
  (`~0x12e8xx`) — a *data* table (candidate memory-map descriptor), distinct from
  the opcode-template hits in `.text`. This is the better lead (see below).

## Where the real memory/wireless dispatch actually lives (not yet found)

Guest memory accesses are **runtime-addressed** (page-table style); the guest
address is a runtime value, so the wireless region will **not** appear as a code
constant. The real dispatch is in the **runtime memory-access helpers** that
JIT-compiled code (and DMA, and the interpreter) call — where an actual runtime
address is range-checked and I/O side effects happen. Those helpers are the true
hook target and have **not** been located.

## Corrected next steps (harder than the retracted claim implied)

1. **Parse the `.data` memory-map table** at `~0x12e8xx`: if it's an array of
   `{guest_base, size, host_ptr, read_fn, write_fn}`, the per-region **handler
   function pointers** (values in `.text` range `0xa0d0–0x112e20`) give the I/O
   read/write routines directly — the clean hook — without any opcode-template
   confusion.
2. If that table has no function pointers (pure fastmem page array), fall to
   **dynamic analysis**: run a core under a Unicorn/QEMU harness (or on-device
   with a native hook), execute a ROM that touches `0x048xxxxx`, and trace which
   function services it. Static search alone is insufficient given the JIT.
3. Only after the *runtime* handler is found does the "emit a call-out / wrap the
   handler" integration work begin. `0x8825c` is **not** part of it.

## Reproduce the correction

```
# sl-holds-opcode proof: every bit tested near 0x88204 maps to an LDR/STR field,
# and 0x04800000 = LDR/STR class | U-bit (an opcode template), not a DS address.
python3 - <<'PY'
for v in (0x04000000,0x04800000): print(hex(v), 'bit26(LDR/STR)|'+('U(bit23)' if v&0x800000 else ''))
PY
```
