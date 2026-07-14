#!/usr/bin/env python3
"""
DraStic dynamic-trace harness (Unicorn ARM/A32).

Purpose: the DraStic core is a dynarec that *assembles* host ARM code, so static
constant search cannot locate the DS memory/wireless dispatch (see
FINDINGS_JIT.md — the 0x8825c "hit" was an opcode template, retracted). This
harness executes the actual `libdrastic.so` in Unicorn so we can *observe*
behaviour: trace branches (`bl`/`blx`) and memory accesses while running a chosen
function, and flag any access to the wireless region `0x04800000-0x0480ffff`.

It loads the real ELF (PT_LOAD segments at their vaddrs, applies R_ARM_RELATIVE /
GLOB_DAT / JUMP_SLOT relocations), stubs imported libc/pthread calls, and gives a
`call(addr, args)` API plus a CLI.

Two intended experiments (see USAGE at bottom):
  A. Drive the dynarec translator (fn @0x87410) on a synthetic guest `LDR` from
     0x04800000 and capture the host code it emits + any helper pointer baked in.
  B. Once a candidate runtime memory helper is identified, call it with a
     wireless address and watch what it touches.

Requires: pip install unicorn capstone. Point --lib at libdrastic.so
(extract from the armeabi-v7a APK: unzip -o app.apk lib/armeabi-v7a/libdrastic.so).

NOTE: fully *booting* the DS core (ROM+BIOS+state) in Unicorn is out of scope —
that needs the whole Android/JNI runtime. This harness drives individual
functions and traces them, which is what pins down the dispatch helper.
"""
import struct, sys, argparse
from unicorn import *
from unicorn.arm_const import *
try:
    from capstone import Cs, CS_ARCH_ARM, CS_MODE_ARM, CS_MODE_THUMB
except ImportError:
    Cs = None

WIFI_LO, WIFI_HI = 0x04800000, 0x04810000     # DS wireless region (+mirror)

# ---- ELF32 loader ------------------------------------------------------------
class Elf32:
    def __init__(self, path):
        self.d = open(path, "rb").read()
        d = self.d
        assert d[:4] == b"\x7fELF" and d[4] == 1, "not ELF32"
        (self.e_entry,) = struct.unpack("<I", d[0x18:0x1c])
        (self.e_phoff,) = struct.unpack("<I", d[0x1c:0x20])
        self.e_phentsize = struct.unpack("<H", d[0x2a:0x2c])[0]
        self.e_phnum = struct.unpack("<H", d[0x2c:0x2e])[0]
        self.loads, self.dynamic = [], None
        for i in range(self.e_phnum):
            o = self.e_phoff + i * self.e_phentsize
            p_type, p_off, p_va, p_pa, p_fsz, p_msz, p_fl, p_al = struct.unpack("<IIIIIIII", d[o:o+32])
            if p_type == 1:   # PT_LOAD
                self.loads.append((p_off, p_va, p_fsz, p_msz, p_fl))
            elif p_type == 2: # PT_DYNAMIC
                self.dynamic = (p_off, p_va, p_fsz)
        self._parse_dynamic()

    def _parse_dynamic(self):
        self.dyn = {}
        if not self.dynamic:
            return
        off, va, sz = self.dynamic
        for o in range(off, off + sz, 8):
            tag, val = struct.unpack("<iI", self.d[o:o+8])
            if tag == 0:
                break
            self.dyn.setdefault(tag, val)
        # DT tags: 5 STRTAB, 6 SYMTAB, 11 SYMENT, 17 REL, 18 RELSZ, 19 RELENT,
        # 23 JMPREL, 2 PLTRELSZ
        self.strtab = self.dyn.get(5)
        self.symtab = self.dyn.get(6)
        self.syment = self.dyn.get(11, 16)

    def _va2off(self, va):
        for p_off, p_va, p_fsz, p_msz, _ in self.loads:
            if p_va <= va < p_va + p_fsz:
                return p_off + (va - p_va)
        return None

    def sym(self, idx):
        o = self._va2off(self.symtab) + idx * self.syment
        st_name, st_value, st_size, st_info, st_other, st_shndx = struct.unpack("<IIIBBH", self.d[o:o+16])
        so = self._va2off(self.strtab) + st_name
        e = self.d.index(b"\0", so)
        return self.d[so:e].decode("latin1"), st_value, st_shndx

    def relocs(self):
        """Yield (r_offset, r_type, sym_idx)."""
        out = []
        for base_tag, sz_tag in ((17, 18), (23, 2)):
            base = self.dyn.get(base_tag); size = self.dyn.get(sz_tag)
            if not base or not size:
                continue
            off = self._va2off(base)
            for o in range(off, off + size, 8):
                r_offset, r_info = struct.unpack("<II", self.d[o:o+8])
                out.append((r_offset, r_info & 0xff, r_info >> 8))
        return out


# ---- Harness -----------------------------------------------------------------
STUB_BASE = 0x7f000000   # imported-function trap page
HEAP_BASE = 0x60000000
STACK_BASE = 0x50000000
STACK_SIZE = 0x100000

class DraSticEmu:
    def __init__(self, libpath, verbose=False):
        self.elf = Elf32(libpath)
        self.uc = Uc(UC_ARCH_ARM, UC_MODE_ARM)
        self.verbose = verbose
        self.imports = {}        # stub_addr -> name
        self.heap = HEAP_BASE
        self.trace = []
        self.branches = []
        self.wifi_hits = []
        self.md = Cs(CS_ARCH_ARM, CS_MODE_ARM) if Cs else None
        self._map_segments()
        self._apply_relocs()
        self._setup_stack_heap()

    def _page(self, x): return x & ~0xfff
    def _round(self, x): return (x + 0xfff) & ~0xfff

    def _ensure_mapped(self, va, size):
        """Map [va,va+size) as contiguous regions, skipping already-mapped
        ranges. One mem_map per gap (per-page mapping is O(n^2) in Unicorn)."""
        start = self._page(va); end = self._round(va + size)
        cur = start
        for ms, me in sorted(self._mapped):
            if cur >= end:
                break
            if me <= cur or ms >= end:
                continue
            if ms > cur:
                self.uc.mem_map(cur, ms - cur); self._mapped.append((cur, ms))
            cur = max(cur, me)
        if cur < end:
            self.uc.mem_map(cur, end - cur); self._mapped.append((cur, end))

    def _map_segments(self):
        self._mapped = []
        for p_off, p_va, p_fsz, p_msz, _ in self.elf.loads:
            self._ensure_mapped(p_va, p_msz)
            self.uc.mem_write(p_va, self.elf.d[p_off:p_off + p_fsz])
        # stub page for imports, heap, stack
        self._ensure_mapped(STUB_BASE, 0x100000)
        self._ensure_mapped(HEAP_BASE, 0x2000000)
        self._ensure_mapped(STACK_BASE, STACK_SIZE)
        # Fill the import-stub region with real `bx lr` (0xe12fff1e) so returns
        # interwork ARM/Thumb correctly via the CPU (setting CPSR.T inside a hook
        # is unreliable). Hooks set only the return value, then bx lr executes.
        self.uc.mem_write(STUB_BASE, struct.pack('<I', 0xe12fff1e) * (0x100000 // 4))

    def _apply_relocs(self):
        bias = 0  # segments mapped at their p_vaddr
        stub_next = STUB_BASE
        name_to_stub = {}
        for r_offset, r_type, sym_idx in self.elf.relocs():
            if r_type == 23:        # R_ARM_RELATIVE
                cur = struct.unpack("<I", self.uc.mem_read(r_offset, 4))[0]
                self.uc.mem_write(r_offset, struct.pack("<I", cur + bias))
            elif r_type in (21, 22, 2):  # GLOB_DAT / JUMP_SLOT / ABS32
                name, val, shndx = self.elf.sym(sym_idx)
                if shndx == 0:      # undefined -> import stub
                    if name not in name_to_stub:
                        name_to_stub[name] = stub_next
                        self.imports[stub_next] = name
                        stub_next += 4
                    self.uc.mem_write(r_offset, struct.pack("<I", name_to_stub[name]))
                else:
                    self.uc.mem_write(r_offset, struct.pack("<I", val + bias))

    def _setup_stack_heap(self):
        self.uc.reg_write(UC_ARM_REG_SP, STACK_BASE + STACK_SIZE - 0x100)
        # Enable VFP/NEON — DraStic uses NEON (e.g. vmov.i32 q8) and Unicorn's
        # ARM core boots with the FPU disabled (else "invalid instruction").
        try:
            cpacr = self.uc.reg_read(UC_ARM_REG_C1_C0_2)
            self.uc.reg_write(UC_ARM_REG_C1_C0_2, cpacr | (0xf << 20))  # cp10/cp11 full access
            self.uc.reg_write(UC_ARM_REG_FPEXC, 0x40000000)             # FPEXC.EN
        except UcError:
            pass

    # --- hooks ---
    def _hook_code(self, uc, addr, size, _):
        if self.verbose and self.md:
            try:
                code = uc.mem_read(addr, size)
                for ins in self.md.disasm(bytes(code), addr):
                    self.trace.append((addr, ins.mnemonic, ins.op_str))
            except UcError:
                pass
        # detect branch-with-link (bl/blx) by decoding
        if self.md:
            try:
                for ins in self.md.disasm(bytes(uc.mem_read(addr, size)), addr):
                    if ins.mnemonic in ("bl", "blx"):
                        self.branches.append((addr, ins.op_str))
            except UcError:
                pass

    def _hook_mem(self, uc, access, addr, size, value, _):
        kind = "W" if access in (UC_MEM_WRITE, UC_MEM_WRITE_UNMAPPED) else "R"
        pc = uc.reg_read(UC_ARM_REG_PC)
        if WIFI_LO <= addr < WIFI_HI:
            self.wifi_hits.append((pc, kind, addr, size, value))
        return False   # for *_UNMAPPED: leave unhandled unless we map on demand

    def _hook_mem_unmapped(self, uc, access, addr, size, value, _):
        # Map on demand so a stray guest pointer doesn't abort the whole trace;
        # record it (esp. wireless range) then continue.
        self._hook_mem(uc, access, addr, size, value, _)
        self._ensure_mapped(addr, size)
        return True

    def _hook_import(self, uc, addr, size, _):
        if addr in self.imports:
            name = self.imports[addr]
            r0 = 0
            if name in ("malloc", "calloc", "realloc", "memalign"):
                n = uc.reg_read(UC_ARM_REG_R0) or 0x1000
                if name == "calloc":
                    n = (uc.reg_read(UC_ARM_REG_R0) or 1) * (uc.reg_read(UC_ARM_REG_R1) or 1)
                r0 = self.heap; self.heap = (self.heap + self._round(n))
            # return to LR
            lr = uc.reg_read(UC_ARM_REG_LR)
            uc.reg_write(UC_ARM_REG_R0, r0)
            uc.reg_write(UC_ARM_REG_PC, lr & ~1)

    # --- API ---
    def call(self, addr, args=None, timeout_s=5, trace=False):
        args = args or []
        for i, a in enumerate(args[:4]):
            self.uc.reg_write([UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_R3][i], a & 0xffffffff)
        RET = 0x00000000
        self._ensure_mapped(RET, 4)
        # Thumb vs ARM: low bit of target selects mode (also set CPSR T).
        thumb = addr & 1
        cpsr = self.uc.reg_read(UC_ARM_REG_CPSR)
        self.uc.reg_write(UC_ARM_REG_CPSR, (cpsr | 0x20) if thumb else (cpsr & ~0x20))
        self.uc.reg_write(UC_ARM_REG_LR, RET | 1)   # trap-return marker
        self.verbose = trace
        self.trace.clear(); self.branches.clear(); self.wifi_hits.clear()
        hc = self.uc.hook_add(UC_HOOK_CODE, self._hook_code)
        hi = self.uc.hook_add(UC_HOOK_CODE, self._hook_import, begin=STUB_BASE, end=STUB_BASE + 0x100000)
        hm = self.uc.hook_add(UC_HOOK_MEM_READ | UC_HOOK_MEM_WRITE, self._hook_mem)
        hu = self.uc.hook_add(UC_HOOK_MEM_READ_UNMAPPED | UC_HOOK_MEM_WRITE_UNMAPPED | UC_HOOK_MEM_FETCH_UNMAPPED, self._hook_mem_unmapped)
        err = None
        try:
            self.uc.emu_start(addr, RET, timeout=timeout_s * 1_000_000)
        except UcError as e:
            err = e
        for h in (hc, hi, hm, hu):
            self.uc.hook_del(h)
        return self.uc.reg_read(UC_ARM_REG_R0), err

    def report(self):
        print(f"  imports stubbed: {len(self.imports)}")
        print(f"  instructions traced: {len(self.trace)}")
        print(f"  bl/blx branches: {len(self.branches)} (first {[hex(a)+':'+o for a,o in self.branches[:12]]})")
        if self.wifi_hits:
            print(f"  *** WIRELESS-REGION ACCESSES: {len(self.wifi_hits)} ***")
            for pc, k, addr, size, val in self.wifi_hits[:20]:
                print(f"      pc={pc:#x} {k}{size*8} @ {addr:#x} = {val:#x}")
        else:
            print("  wireless-region accesses: none in this run")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lib", required=True, help="path to libdrastic.so (armeabi-v7a)")
    ap.add_argument("--call", help="function address to run, e.g. 0x87410")
    ap.add_argument("--args", default="", help="comma-separated hex args")
    ap.add_argument("--trace", action="store_true", help="full instruction trace (verbose)")
    ap.add_argument("--load-only", action="store_true", help="just load and report ELF")
    args = ap.parse_args()

    emu = DraSticEmu(args.lib)
    print(f"loaded {args.lib}")
    print(f"  PT_LOAD segments: {len(emu.elf.loads)}  relocs: {len(emu.elf.relocs())}  "
          f"imports: {len(emu.imports)}")
    if args.load_only or not args.call:
        # show a few import names to confirm stubbing worked
        names = sorted(set(emu.imports.values()))
        print(f"  sample imports: {names[:15]}")
        return
    addr = int(args.call, 0)
    callargs = [int(x, 0) for x in args.args.split(",") if x.strip()]
    print(f"calling {addr:#x} args={[hex(a) for a in callargs]} ...")
    r0, err = emu.call(addr, callargs, trace=args.trace)
    print(f"  returned r0={r0:#x}  {'(fault: '+str(err)+')' if err else '(clean)'}")
    emu.report()


if __name__ == "__main__":
    main()

# ---- USAGE recipes -----------------------------------------------------------
#  Load check:
#    python3 drastic_emu.py --lib libdrastic.so --load-only
#  Experiment A (drive the translator on a crafted guest LDR — needs a context
#    struct in memory; see FINDINGS_JIT.md for the ctx fields at +0x4ac/+0x4d8):
#    ... construct ctx, put guest opcode where the fn reads it, then --call 0x87410
#  Experiment B (probe a candidate runtime memory helper with a wifi address):
#    python3 drastic_emu.py --lib libdrastic.so --call 0x<helper> --args 0x04800000
#    -> --watch fires via report() if the helper touches the wireless region.
