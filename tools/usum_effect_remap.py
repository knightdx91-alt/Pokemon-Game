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

OUTCOME (this session): the blind sweep finds NO function that exposes an
effect-id-dependent 0x45a0 index — under both a scalar-r0 and a filled-buffer
fixture (arg pages set to the effect id at every offset). The one zero-fixture
hit, sub_8c80, is a step-state handler (7-way jump on [r1]), not the remap.
Interpretation: the dispatcher reads the effect id through a *structured pointer
walk* (a relocated global, or a multi-level deref into the live effect-object),
so a blind fixture doesn't route the id to where the index is computed. Cracking
it needs the effect-object layout reconstructed first — which realistically
wants a live-battle RAM dump (same blocker as the battle-pokemon scalar names).
This tool is the reusable harness for that follow-up: give `probe()` a correctly
shaped effect-object and it will read the sequence id straight off the watch.

Usage: python3 tools/usum_effect_remap.py [--probe 0xADDR]
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


def main():
    import json, bisect
    emu = FaultTolerantEmu("Battle")
    funcs = sorted(json.load(open(os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "decomp/functions/Battle.json"))), key=lambda f: f["addr"])

    if "--probe" in sys.argv:
        off = int(sys.argv[sys.argv.index("--probe") + 1], 0)
        for e in (0, 4, 32, 48, 67, 103, 200, 400):
            p = emu.probe(off, e, ptr_mode=True)
            s = emu.probe(off, e, ptr_mode=False)
            print(f"  effId {e:3d}: ptr={p} scalar={s}")
        return

    # discovery sweep: functions whose 0x45a0 index depends on the effect id.
    # Streams hits to stdout immediately (flush) so partial runs are useful.
    probes = [4, 32, 67, 200]
    outf = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                             "decomp/battle_effects/remap_sweep.txt"), "w")
    def emit(s):
        print(s, flush=True)
        outf.write(s + "\n"); outf.flush()
    emit(f"sweeping {len(funcs)} functions, budget 6000 insns...")
    n = 0
    for f in funcs:
        if f["size"] > 4000:
            continue
        n += 1
        if n % 400 == 0:
            emit(f"... {n} scanned")
        for mode in (True, False):
            seqs = {}
            for e in probes:
                h = emu.probe(f["addr"], e, insns=6000, ptr_mode=mode)
                if h:
                    seqs[e] = tuple(h)
            if len(set(seqs.values())) > 1:
                emit(f"HIT {f['name']} @0x{f['addr']:x} ({'ptr' if mode else 'scalar'}): "
                     + "; ".join(f"e{e}->{list(s)}" for e, s in seqs.items()))
                break
    emit("sweep done")
    outf.close()


if __name__ == "__main__":
    main()
