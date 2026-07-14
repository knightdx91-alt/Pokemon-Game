#!/usr/bin/env python3
"""
DraStic headless-core driver (spike) — run the emulator core under Unicorn with
a SYNTHETIC Android/JNI runtime, no real Android.

Goal of the spike: reach a point where the DS emulation actually executes so the
wireless-region watch (from drastic_emu.py) can fire — without a device.

Milestones (each is a real checkpoint; honest about how far it gets):
  M1. JNI_OnLoad completes  (needs JavaVM+JNIEnv vtables)
  M2. insertGame completes  (needs GetStringUTFChars + functional libc + ROM/BIOS
      file serving)
  M3. run N frames          (needs the frame-run fn + surviving Java callbacks)

This extends DraSticEmu with: functional libc import handlers, and in-guest
JavaVM/JNIEnv vtables whose entries are trap stubs dispatched to Python.

Usage:
  python3 drastic_headless.py --lib libdrastic.so [--rom game.nds] [--bios7 ..] [--bios9 ..]
"""
import struct, sys, argparse, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drastic_emu import DraSticEmu, Elf32
from unicorn import *
from unicorn.arm_const import *

JNIENV_VT   = 0x71000000   # synthetic JNIEnv vtable (240 entries)
JNIENV_OBJ  = 0x71010000   # JNIEnv object: [0]=vtable
JAVAVM_VT   = 0x71020000
JAVAVM_OBJ  = 0x71030000
JNI_TRAP    = 0x72000000   # per-slot trap stubs: JNI_TRAP + idx*4
SCRATCH     = 0x73000000   # scratch strings/handles
FAKE_HANDLE = 0x74000000   # opaque non-null handles handed back to the core

# JNIEnv function-table indices we care about (offset/4):
#   6=FindClass(0x18) 21=NewGlobalRef(0x54) 94=GetMethodID(0x178)
#   169=GetStringUTFChars(0x2a4) 170=ReleaseStringUTFChars(0x2a8)
# JavaVM: 6=GetEnv(0x18)

class Headless(DraSticEmu):
    def __init__(self, libpath, rom=None, bios7=None, bios9=None, verbose=False):
        super().__init__(libpath, verbose=verbose)
        self.files = {}          # path-substr -> bytes  (served to libc open/read)
        self.fds = {}            # fd -> [bytes, pos]
        self.next_fd = 100
        self.scratch = SCRATCH
        self.fake = FAKE_HANDLE
        self.rom = rom
        self.log = []
        if rom and os.path.exists(rom):   self.files['rom'] = open(rom,'rb').read()
        if bios7 and os.path.exists(bios7): self.files['bios7'] = open(bios7,'rb').read()
        if bios9 and os.path.exists(bios9): self.files['bios9'] = open(bios9,'rb').read()
        self._build_runtime()

    # --- memory helpers ---
    def _emit_str(self, s):
        b = s.encode() + b'\0'
        p = self.scratch; self.uc.mem_write(p, b); self.scratch += (len(b)+7)&~7
        return p
    def _alloc(self, n):
        p = self.fake; self.fake += (n+7)&~7; return p

    def _build_runtime(self):
        for base in (JNIENV_VT, JNIENV_OBJ, JAVAVM_VT, JAVAVM_OBJ, JNI_TRAP, SCRATCH, FAKE_HANDLE):
            self._ensure_mapped(base, 0x10000)
        # vtable slots -> trap stubs
        for idx in range(240):
            self.uc.mem_write(JNIENV_VT + idx*4, struct.pack('<I', JNI_TRAP + idx*4))
        self.uc.mem_write(JNIENV_OBJ, struct.pack('<I', JNIENV_VT))
        for idx in range(16):
            self.uc.mem_write(JAVAVM_VT + idx*4, struct.pack('<I', JNI_TRAP + 0x1000 + idx*4))
        self.uc.mem_write(JAVAVM_OBJ, struct.pack('<I', JAVAVM_VT))
        # hook the trap regions + import stubs with our functional dispatcher
        self.uc.hook_add(UC_HOOK_CODE, self._rt_dispatch, begin=JNI_TRAP, end=JNI_TRAP+0x10000)

    # --- functional libc (replaces the return-0 stub for known names) ---
    def _libc(self, name):
        uc = self.uc
        a0=uc.reg_read(UC_ARM_REG_R0); a1=uc.reg_read(UC_ARM_REG_R1)
        a2=uc.reg_read(UC_ARM_REG_R2); a3=uc.reg_read(UC_ARM_REG_R3)
        r = 0
        if name in ('memcpy','__aeabi_memcpy','__aeabi_memcpy4','__aeabi_memcpy8','memmove','__aeabi_memmove','__aeabi_memmove4','__aeabi_memmove8'):
            uc.mem_write(a0, bytes(uc.mem_read(a1, a2))); r=a0
        elif name in ('memset','__aeabi_memset','__aeabi_memset4','__aeabi_memset8'):
            uc.mem_write(a0, bytes([a1&0xff])*a2); r=a0
        elif name in ('__aeabi_memclr','__aeabi_memclr4','__aeabi_memclr8'):
            uc.mem_write(a0, b'\0'*a1); r=a0
        elif name=='strlen':
            s=a0; n=0
            while uc.mem_read(s+n,1)[0]!=0: n+=1
            r=n
        elif name in ('strcmp','strncmp'):
            r=0
        elif name in ('malloc','calloc','realloc','memalign','valloc'):
            n=a0 if name!='calloc' else a0*a1
            if name=='realloc': n=a1
            r=self._alloc(max(n,16))
            if name=='calloc': uc.mem_write(r, b'\0'*n)
        elif name=='free': r=0
        elif name in ('open','open64','__open_2'):
            path=self._cstr(a0); data=self._match_file(path)
            if data is not None:
                fd=self.next_fd; self.next_fd+=1; self.fds[fd]=[data,0]; r=fd
            else: r=0xffffffff
        elif name in ('read',):
            fd=a0
            if fd in self.fds:
                data,pos=self.fds[fd]; chunk=data[pos:pos+a2]
                uc.mem_write(a1, chunk); self.fds[fd][1]+=len(chunk); r=len(chunk)
            else: r=0
        elif name in ('lseek','lseek64'):
            fd=a0
            if fd in self.fds: self.fds[fd][1]=a1; r=a1
        elif name in ('close',): r=0
        elif name in ('fopen','fopen64'):
            path=self._cstr(a0); data=self._match_file(path)
            if data is not None:
                fd=self.next_fd; self.next_fd+=1; self.fds[fd]=[data,0]; r=fd  # FILE* == fd handle
            else: r=0
        elif name=='fread':
            fd=a3; sz=a1*a2
            if fd in self.fds:
                data,pos=self.fds[fd]; chunk=data[pos:pos+sz]
                uc.mem_write(a0,chunk); self.fds[fd][1]+=len(chunk); r=len(chunk)//max(a1,1)
        elif name in ('fclose',): r=0
        else:
            r=0  # default: benign 0
        self.log.append(('libc',name,hex(a0),hex(r)))
        uc.reg_write(UC_ARM_REG_R0, r)
        lr=uc.reg_read(UC_ARM_REG_LR); uc.reg_write(UC_ARM_REG_PC, lr & ~1)

    def _cstr(self, p):
        out=b''
        while True:
            c=self.uc.mem_read(p,1)
            if c==b'\0': break
            out+=c; p+=1
            if len(out)>512: break
        return out.decode('latin1','replace')
    def _match_file(self, path):
        pl=path.lower()
        if pl.endswith('.nds') or 'rom' in pl: return self.files.get('rom')
        if 'bios7' in pl or 'arm7' in pl: return self.files.get('bios7')
        if 'bios9' in pl or 'arm9' in pl: return self.files.get('bios9')
        return None

    # --- override the import hook to route known libc names to _libc ---
    def _hook_import(self, uc, addr, size, _):
        if addr in self.imports:
            name=self.imports[addr]
            self._libc(name)   # _libc handles return + PC=LR (covers default 0 too)

    # --- JNI/JavaVM dispatcher ---
    def _rt_dispatch(self, uc, addr, size, _):
        if addr < JNI_TRAP or addr >= JNI_TRAP+0x10000: return
        is_vm = addr >= JNI_TRAP+0x1000 and addr < JNI_TRAP+0x2000
        idx = ((addr-(JNI_TRAP+0x1000))//4) if is_vm else (addr-JNI_TRAP)//4
        a0=uc.reg_read(UC_ARM_REG_R0); a1=uc.reg_read(UC_ARM_REG_R1); a2=uc.reg_read(UC_ARM_REG_R2)
        r=0
        if is_vm:
            if idx==6:  # GetEnv(vm, void** env, version)
                uc.mem_write(a1, struct.pack('<I', JNIENV_OBJ)); r=0
            else: r=0
            tag=f"JavaVM[{idx}]"
        else:
            if idx==169:      # GetStringUTFChars(env, jstr, isCopy) -> our path
                r=self._emit_str(self.rom or '/sdcard/game.nds')
            elif idx==170:    # ReleaseStringUTFChars
                r=0
            elif idx in (6,21,94,113):  # FindClass/NewGlobalRef/GetMethodID/GetStaticMethodID -> handle
                r=self._alloc(64)
            else:
                r=self._alloc(16)  # any other -> non-null opaque handle
            tag=f"JNIEnv[{idx}]"
        self.log.append(('jni',tag,hex(r)))
        uc.reg_write(UC_ARM_REG_R0, r)
        lr=uc.reg_read(UC_ARM_REG_LR); uc.reg_write(UC_ARM_REG_PC, lr & ~1)

    # --- milestones ---
    def run_onload(self, addr):
        self.log.clear()
        r0,err=self.call(addr, [JAVAVM_OBJ, 0], timeout_s=10)
        return r0, err
    def run_insertgame(self, addr, r3=0):
        self.log.clear()
        # insertGame(env, thiz, jstring rom, jint, ... stack args)
        r0,err=self.call(addr, [JNIENV_OBJ, self._alloc(16), self._alloc(16), r3], timeout_s=15)
        return r0, err


def _exports(lib):
    d=open(lib,'rb').read(); e=Elf32(lib)
    def v2o(va):
        for po,pv,pf,pm,fl in e.loads:
            if pv<=va<pv+pf: return po+(va-pv)
    o=v2o(e.symtab); so=v2o(e.strtab); out={}
    for i in range(4000):
        b=o+i*16
        if b+16>len(d): break
        stn,stv=struct.unpack("<II",d[b:b+8])
        if so+stn>=len(d): continue
        try: end=d.index(b'\0',so+stn)
        except ValueError: continue
        nm=d[so+stn:end].decode('latin1','replace')
        if nm.startswith('JNI_OnLoad') or 'insertGame' in nm: out[nm]=stv
    return out

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--lib',required=True); ap.add_argument('--rom');
    ap.add_argument('--bios7'); ap.add_argument('--bios9')
    ap.add_argument('--verbose',action='store_true')
    args=ap.parse_args()
    exp=_exports(args.lib)
    print("exports:",{k:hex(v) for k,v in exp.items()})
    h=Headless(args.lib, rom=args.rom, bios7=args.bios7, bios9=args.bios9, verbose=args.verbose)
    onload=exp.get('JNI_OnLoad')
    print(f"\n[M1] JNI_OnLoad @ {onload:#x} ...")
    r0,err=h.run_onload(onload)
    print(f"     returned {r0:#x}  {'FAULT '+str(err) if err else 'CLEAN'}")
    print(f"     runtime calls: {len(h.log)}  ({[t for _,t,*_ in h.log][:16]})")
    ig=[v for k,v in exp.items() if 'insertGame' in k]
    if ig:
        print(f"\n[M2] insertGame @ {ig[0]:#x} ...")
        r0,err=h.run_insertgame(ig[0])
        print(f"     returned {r0:#x}  {'FAULT '+str(err) if err else 'CLEAN'}")
        libc=[n for k,n,*_ in h.log if k=='libc']
        print(f"     libc calls: {libc[:24]}")
    h.report()

if __name__=='__main__':
    main()
