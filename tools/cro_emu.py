#!/usr/bin/env python3
"""
cro_emu.py — a Unicorn CPU-emulation harness for USUM CRO modules.

The btl engine reaches most code through PIC segment-relative dispatch that
static analysis can't follow (the table base is computed at runtime, not a
reloc'd literal). This harness loads a .cro into an ARM CPU so those dispatches
can be *executed* and observed.

Loader model (CRO0, validated on Battle.cro):
  - Segment table @header+0xC8 (offset,size,id)×N: id 0=text 1=rodata 2=data
    3=bss. We map each at a chosen page-aligned base.
  - Internal relocation table @header+0x128, 12-byte entries
    (target_tag, (source_seg<<8)|type, value_offset):
        target_tag = (offset<<4)|target_seg
        write32(base[target_seg]+offset, base[source_seg]+value_offset)
    This fills the relocation-only pointer tables (switch tables, handler
    arrays) that are zero on disk — so PIC dispatch works once applied.
  - Imports (cross-module calls into static.crs / other CROs) are NOT patched;
    their veneers load 0 and branch to 0. We trap the resulting null fetch and
    force an immediate return (r0=0), which is fine for the leaf-ish dispatch
    logic we trace (it does not depend on cross-module callees).

API:
  emu = CroEmu("Battle")
  r0  = emu.call(0x924a8, [this_ptr, enum])      # returns r0
  emu.write(addr, bytes) / emu.read(addr, n) / emu.alloc(n)

CLI self-test: `python3 tools/cro_emu.py --selftest` validates the whole
pipeline against the known in-battle field getter sub_924a8.
"""
import struct, sys, os
from unicorn import *
from unicorn.arm_const import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROMFS = os.path.join(ROOT, "source/3ds/ultramoon/romfs")

# Chosen load bases (page-aligned, non-overlapping, away from null).
SEG_BASE = {0: 0x10000000, 1: 0x20000000, 2: 0x30000000, 3: 0x40000000}
SEG_MAP = 0x02000000          # 32 MiB window mapped per segment (generous)
STACK_BASE, STACK_SIZE = 0x70000000, 0x100000
SCRATCH_BASE, SCRATCH_SIZE = 0x50000000, 0x400000   # for alloc()
RET_MAGIC = 0x7FFFF000        # sentinel LR: execution stops when pc hits it


class CroEmu:
    def __init__(self, module):
        path = os.path.join(ROMFS, f"{module}.cro")
        if not os.path.exists(path):
            sys.exit(f"ERROR: {path} missing — run the session bootstrap.")
        self.d = open(path, "rb").read()
        assert self.d[0x80:0x84] == b"CRO0", "not a CRO0"
        self.uc = Uc(UC_ARCH_ARM, UC_MODE_ARM)
        self._map_segments()
        self._apply_internal_relocs()
        self._setup_runtime()
        self._alloc_ptr = SCRATCH_BASE

    # ---- loading ----------------------------------------------------------
    def _u32(self, o):
        return struct.unpack_from("<I", self.d, o)[0]

    def _map_segments(self):
        segoff, segn = self._u32(0xC8), self._u32(0xCC)
        self.segs = []
        for i in range(segn):
            o, s, sid = struct.unpack_from("<III", self.d, segoff + i * 12)
            self.segs.append((o, s, sid))
        # map one region per distinct segment id present
        for sid, base in SEG_BASE.items():
            self.uc.mem_map(base, SEG_MAP)
        for o, s, sid in self.segs:
            if s and sid in SEG_BASE and o:      # bss has o==0/no file bytes
                self.uc.mem_write(SEG_BASE[sid], self.d[o:o + s])

    def _apply_internal_relocs(self):
        roff, rn = self._u32(0x128), self._u32(0x12C)
        applied = 0
        for i in range(rn):
            f0, f1, f2 = struct.unpack_from("<III", self.d, roff + i * 12)
            tseg, toff = f0 & 0xF, f0 >> 4
            src, typ = (f1 >> 8) & 0xFF, f1 & 0xFF
            if typ != 2 or tseg not in SEG_BASE or src not in SEG_BASE:
                continue
            val = SEG_BASE[src] + f2
            try:
                self.uc.mem_write(SEG_BASE[tseg] + toff, struct.pack("<I", val))
                applied += 1
            except UcError:
                pass
        self.relocs_applied = applied

    def _setup_runtime(self):
        self.uc.mem_map(STACK_BASE, STACK_SIZE)
        self.uc.mem_map(SCRATCH_BASE, SCRATCH_SIZE)
        self.uc.mem_map(RET_MAGIC & ~0xFFF, 0x1000)
        # trap null/import fetches -> force return
        self.uc.hook_add(UC_HOOK_MEM_FETCH_UNMAPPED | UC_HOOK_MEM_READ_UNMAPPED
                         | UC_HOOK_MEM_WRITE_UNMAPPED, self._on_unmapped)

    def _on_unmapped(self, uc, access, address, size, value, user):
        # An unpatched import veneer branched to ~0. Return to caller with r0=0.
        lr = uc.reg_read(UC_ARM_REG_LR)
        if access == UC_MEM_FETCH_UNMAPPED:
            uc.reg_write(UC_ARM_REG_R0, 0)
            uc.reg_write(UC_ARM_REG_PC, lr if lr else RET_MAGIC)
            return True
        return False        # genuine bad data access -> let it fault (visible)

    # ---- memory helpers ---------------------------------------------------
    def alloc(self, n):
        p = self._alloc_ptr
        self._alloc_ptr = (self._alloc_ptr + n + 0xF) & ~0xF
        self.uc.mem_write(p, b"\0" * n)
        return p

    def write(self, addr, data):
        self.uc.mem_write(addr, bytes(data))

    def read(self, addr, n):
        return self.uc.mem_read(addr, n)

    def seg_addr(self, seg, off):
        return SEG_BASE[seg] + off

    # ---- execution --------------------------------------------------------
    def call(self, text_off, args=(), timeout_insns=200000):
        for i, a in enumerate(args[:4]):
            self.uc.reg_write([UC_ARM_REG_R0, UC_ARM_REG_R1,
                               UC_ARM_REG_R2, UC_ARM_REG_R3][i], a & 0xFFFFFFFF)
        self.uc.reg_write(UC_ARM_REG_SP, STACK_BASE + STACK_SIZE - 0x100)
        self.uc.reg_write(UC_ARM_REG_LR, RET_MAGIC)
        start = SEG_BASE[0] + text_off
        try:
            self.uc.emu_start(start, RET_MAGIC, count=timeout_insns)
        except UcError as e:
            pc = self.uc.reg_read(UC_ARM_REG_PC)
            raise RuntimeError(f"emu fault at pc=0x{pc:x}: {e}")
        return self.uc.reg_read(UC_ARM_REG_R0)


def selftest():
    emu = CroEmu("Battle")
    print(f"loaded Battle.cro: {emu.relocs_applied} internal relocs applied")
    # sub_924a8(this, enum): the in-battle field getter. With this[0x2f8]==0 it
    # skips the 9/0xb remap and hits the switch. enum 21 -> ldrb [this+0x1a].
    def s32(v):
        return v - 0x100000000 if v >= 0x80000000 else v
    this = emu.alloc(0x300)
    emu.write(this + 0x1a, b"\x37")           # field 0x1a
    emu.write(this + 0x1b, b"\x5a")           # field 0x1b
    emu.write(this + 0x1ea, b"\xfb")          # rankAtk = -5 (signed)
    # emulator-validated enum map (see usum_battlemon_fields.py):
    got20 = emu.call(0x924a8, [this, 20])     # enum 20 -> field 0x1a
    got21 = emu.call(0x924a8, [this, 21])     # enum 21 -> field 0x1b
    got1 = s32(emu.call(0x924a8, [this, 1]))  # enum 1 -> signed field 0x1ea
    ok = (got20 == 0x37 and got21 == 0x5a and got1 == -5)
    print(f"  sub_924a8(this,20)=0x{got20:x} (want 0x37, field 0x1a)")
    print(f"  sub_924a8(this,21)=0x{got21:x} (want 0x5a, field 0x1b)")
    print(f"  sub_924a8(this, 1)={got1} (want -5, rankAtk signed 0x1ea)")
    print("selftest:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    print(__doc__)
