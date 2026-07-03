#!/usr/bin/env python3
"""
usum_effect_remap.py — recover the move-effect-id -> sequence-id remap by
EMULATION (the map is a PIC code lookup; static analysis bottomed out — see
decomp/battle_effects/EFFECT_DISPATCH.md).

Approach: load Battle.cro in Unicorn with internal relocations applied (so the
153-entry sequence-handler table at rodata+0x45a0 is populated), then:
  * make the CPU fault-tolerant: lazily map any unmapped data page (zero-filled)
    on read/write so a function runs against a mostly-zero fixture without
    crashing, and stub unmapped code fetches (imports) as `return 0`;
  * watch reads of the table region [rodata+0x45a0 .. +153*8): each read's
    (addr - base)/8 is the sequence id being dispatched;
  * sweep functions, calling each with r0 = a candidate effect id and scratch
    pointers in r1..r3. A function whose watched table index *changes with the
    effect id* is the remap (or contains it).

This is a discovery sweep, not a finished decode: it prints the functions whose
0x45a0 index depends on the input effect id, which pins the remap site for a
focused follow-up (and often yields the mapping directly).

OUTCOME (this session): blind emulation CANNOT recover the remap, and the reason
is now proven, not guessed:
  * Fixtures tried: effect id in r0, in filled arg buffers (id at every offset),
    and seeded into the real event-queue global (bss+0x394, {tag 0x1f, payload}).
  * CRITICAL SOUNDNESS BUG that produced false hits: reusing ONE emulator across
    thousands of probes leaves memory dirty (lazy-mapped pages + prior writes
    persist), so a later function can read leftover data and appear
    "input-dependent". With a FRESH emulator per probe, every candidate
    (incl. sub_8c80) reads the 0x45a0 table zero times — the sweep hits were
    pure stale-state noise. ALWAYS instantiate a fresh emu per probe.
  * Conclusion: the dispatcher's index depends on real battle state that the
    game builds at runtime (effect-object graph reached from the live battle
    system), which a synthetic fixture can't stand up without effectively
    emulating the whole title. This needs a real memory image — a live-battle
    RAM dump / Citra savestate — not more static/blind work.

This tool remains the correct harness for THAT input: hand `probe_queue()` /
`probe()` a real captured battle memory image and the sequence id falls straight
off the 0x45a0 watch. Instantiate a fresh emu per call (see fresh_probe()).

Usage: python3 tools/usum_effect_remap.py --probe 0xADDR   (fresh emu per id)
"""
import sys, os, struct
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cro_emu import CroEmu, SEG_BASE
from unicorn import (Uc, UcError, UC_HOOK_MEM_READ_UNMAPPED,
                     UC_HOOK_MEM_WRITE_UNMAPPED, UC_HOOK_MEM_FETCH_UNMAPPED,
                     UC_HOOK_MEM_READ, UC_MEM_FETCH_UNMAPPED)
from unicorn.arm_const import (UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2,
                               UC_ARM_REG_R3, UC_ARM_REG_SP, UC_ARM_REG_LR,
                               UC_ARM_REG_PC)

TABLE = SEG_BASE[1] + 0x45a0
TABLE_END = TABLE + 153 * 8
PAGE = 0x100000


class FaultTolerantEmu(CroEmu):
    def __init__(self, module):
        super().__init__(module)
        self.hits = []          # list of sequence ids read from the table
        self._mapped_lazy = set()
        self._scratch1 = self.alloc(0x400)   # fixed reusable arg buffers
        self._scratch2 = self.alloc(0x400)
        # add lazy-map + table-watch hooks (in addition to the base fetch stub)
        self.uc.hook_add(UC_HOOK_MEM_READ_UNMAPPED | UC_HOOK_MEM_WRITE_UNMAPPED,
                         self._lazy_map)
        self.uc.hook_add(UC_HOOK_MEM_READ, self._watch, begin=TABLE, end=TABLE_END)

    def _lazy_map(self, uc, access, address, size, value, user):
        base = address & ~(PAGE - 1)
        if base in self._mapped_lazy:
            return False
        try:
            uc.mem_map(base, PAGE)
            uc.mem_write(base, b"\0" * PAGE)
            self._mapped_lazy.add(base)
            return True                     # retry the access
        except UcError:
            return False

    def _watch(self, uc, access, address, size, value, user):
        if TABLE <= address < TABLE_END:
            self.hits.append((address - TABLE) // 8)

    # event-queue global (bss seg3 + 0x394), resolved from sub_8790c's literal.
    QUEUE = SEG_BASE[3] + 0x394

    def seed_queue(self, eff):
        """Reproduce one sub_8790c push of {tag 0x1f, payload=eff} at slot 0."""
        q = self.QUEUE
        # zero a generous window first
        self.uc.mem_write(q, b"\0" * 0x600)
        self.uc.mem_write(q + 0x00, struct.pack("<I", 1))        # count/index = 1
        self.uc.mem_write(q + 0x04, struct.pack("<H", 0x1f))     # tag[0]
        self.uc.mem_write(q + 0xc4, struct.pack("<I", eff))      # payload[0]
        self.uc.mem_write(q + 0x244, struct.pack("<I", eff))     # mirror payloads
        self.uc.mem_write(q + 0x3c4, struct.pack("<I", eff))
        self.uc.mem_write(q + 0x544, b"\x01")                    # valid flag[0]

    def probe_queue(self, off, eff, insns=20000):
        self.hits = []
        self.seed_queue(eff)
        from cro_emu import STACK_BASE, STACK_SIZE, RET_MAGIC
        for r, v in ((UC_ARM_REG_R0, self._scratch1), (UC_ARM_REG_R1, self._scratch2),
                     (UC_ARM_REG_R2, self._scratch2), (UC_ARM_REG_R3, 0)):
            self.uc.reg_write(r, v & 0xFFFFFFFF)
        self.uc.mem_write(self._scratch1, b"\0" * 0x400)
        self.uc.reg_write(UC_ARM_REG_SP, STACK_BASE + STACK_SIZE - 0x400)
        self.uc.reg_write(UC_ARM_REG_LR, RET_MAGIC)
        try:
            self.uc.emu_start(SEG_BASE[0] + off, RET_MAGIC, count=insns)
        except UcError:
            pass
        return list(self.hits)

    def probe(self, off, eff, insns=20000, ptr_mode=True):
        self.hits = []
        # Fill both scratch buffers with the effect id (u32 repeated), so a
        # field read `ldr rX,[argptr,#off]` at *any* offset returns the effect
        # id — this catches dispatchers that read effectId from a struct field
        # rather than from r0. In ptr_mode r0 is a pointer to such a buffer;
        # otherwise r0 is the scalar effect id.
        blob = struct.pack("<I", eff & 0xFFFFFFFF) * 0x100
        self.uc.mem_write(self._scratch1, blob)
        self.uc.mem_write(self._scratch2, blob)
        r0 = self._scratch1 if ptr_mode else eff
        for r, v in ((UC_ARM_REG_R0, r0), (UC_ARM_REG_R1, self._scratch2),
                     (UC_ARM_REG_R2, self._scratch2), (UC_ARM_REG_R3, eff)):
            self.uc.reg_write(r, v & 0xFFFFFFFF)
        from cro_emu import STACK_BASE, STACK_SIZE, RET_MAGIC
        self.uc.reg_write(UC_ARM_REG_SP, STACK_BASE + STACK_SIZE - 0x400)
        self.uc.reg_write(UC_ARM_REG_LR, RET_MAGIC)
        try:
            self.uc.emu_start(SEG_BASE[0] + off, RET_MAGIC, count=insns)
        except UcError:
            pass
        return list(self.hits)


def fresh_probe(kind, off, eff):
    """SOUND probe: a brand-new emulator per call (no dirty-state leakage)."""
    emu = FaultTolerantEmu("Battle")
    if kind == "queue":
        return emu.probe_queue(off, eff)
    return emu.probe(off, eff, ptr_mode=(kind == "ptr"))


def main():
    import json, bisect
    emu = FaultTolerantEmu("Battle")
    funcs = sorted(json.load(open(os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "decomp/functions/Battle.json"))), key=lambda f: f["addr"])

    if "--probe" in sys.argv:
        off = int(sys.argv[sys.argv.index("--probe") + 1], 0)
        for e in (0, 4, 32, 48, 67, 103, 200, 400):
            print(f"  effId {e:3d}: queue={fresh_probe('queue', off, e)} "
                  f"scalar={fresh_probe('scalar', off, e)}")   # fresh emu per id (sound)
        return

    # No default blind sweep: it is UNSOUND (see the module docstring — reused
    # emulator state produces false input-dependent hits; a fresh emu per probe
    # reads the 0x45a0 table zero times). The harness is meant to be driven with
    # a REAL captured battle memory image loaded before `fresh_probe(...)`.
    print(__doc__)
    print("Ready. `--probe 0xADDR` runs a sound (fresh-emu) probe; feed a real "
          "battle memory image for a meaningful 0x45a0 index. Loaded "
          f"{len(funcs)} functions; {emu.relocs_applied} relocs applied.")


if __name__ == "__main__":
    main()
