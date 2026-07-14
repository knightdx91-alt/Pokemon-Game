#!/usr/bin/env python3
"""
DraStic DS Emulator — reverse-engineering recon script.

Feasibility analysis for adding DS local-wireless multiplayer to DraStic by
transplanting melonDS's (GPLv3) open-source Wifi state machine and wiring it
into DraStic's emulation core.

Inputs (not committed — supply locally):
  - lib/armeabi-v7a/libdrastic.so       (32-bit core, the tractable RE target)
  - lib/arm64-v8a/libdrastic_arm64.so   (64-bit core)

Usage:  python3 analyze_drastic.py <path-to-libdrastic.so> [...more .so]

Outputs a summary of: ELF layout, DS wireless-region constants, networking /
threading imports, and the JNI surface — the facts the feasibility report is
built on. Pure stdlib except capstone (optional, for disasm).
"""
import sys, struct, re

def parse_elf(d):
    is64 = d[4] == 2
    if is64:
        e_shoff, = struct.unpack('<Q', d[0x28:0x30])
        ent = struct.unpack('<H', d[0x3a:0x3c])[0]
        num = struct.unpack('<H', d[0x3c:0x3e])[0]
        strx = struct.unpack('<H', d[0x3e:0x40])[0]
        def sec(i):
            o = e_shoff + i*ent
            nm, ty, fl, ad, of, sz = struct.unpack('<IIQQQQ', d[o:o+40])
            lk = struct.unpack('<I', d[o+40:o+44])[0]
            return [nm, ty, fl, ad, of, sz, lk]
    else:
        e_shoff, = struct.unpack('<I', d[0x20:0x24])
        ent = struct.unpack('<H', d[0x2e:0x30])[0]
        num = struct.unpack('<H', d[0x30:0x32])[0]
        strx = struct.unpack('<H', d[0x32:0x34])[0]
        def sec(i):
            o = e_shoff + i*ent
            nm, ty, fl, ad, of, sz = struct.unpack('<IIIIII', d[o:o+24])
            lk = struct.unpack('<I', d[o+24:o+28])[0]
            return [nm, ty, fl, ad, of, sz, lk]
    secl = [sec(i) for i in range(num)]
    shstr = secl[strx][4]
    def nm(n):
        e = d.index(b'\0', shstr+n); return d[shstr+n:e].decode('latin1')
    named = [(nm(s[0]), *s) for s in secl]
    return is64, named

def dynsyms(d, is64, named):
    syms = []
    for entry in named:
        name, _nm, ty, fl, ad, of, sz, lk = entry
        if ty == 11:  # SHT_DYNSYM
            stroff = named[lk][5]
            esz = 24 if is64 else 16
            for j in range(sz // esz):
                e = of + j*esz
                if is64:
                    n, info, other, shndx, val, size = struct.unpack('<IBBHQQ', d[e:e+24])
                else:
                    n, val, size, info, other, shndx = struct.unpack('<IIIBBH', d[e:e+16])
                en = d.index(b'\0', stroff+n); s = d[stroff+n:en].decode('latin1')
                if s:
                    syms.append((s, shndx))
    return syms

WIFI_CONSTS = {
    0x04800000: 'W_ region base',
    0x04808000: 'W_ region end',
    0x04804000: 'Wifi-RAM base',
    0x04806000: 'Wifi-RAM mirror',
    0x04000000: 'main I/O base (control)',
}

def main():
    for path in sys.argv[1:]:
        d = open(path, 'rb').read()
        is64, named = parse_elf(d)
        print(f"\n{'='*70}\n{path}  ({'aarch64' if is64 else 'arm32/thumb2'})  {len(d)} bytes\n{'='*70}")
        for name, _nm, ty, fl, ad, of, sz, lk in named:
            if name in ('.text', '.rodata', '.data', '.bss', '.got', '.plt'):
                print(f"  {name:9} vaddr={ad:#010x} off={of:#010x} size={sz:#x}")
        print("  -- DS wireless-region constants (contiguous LE word matches) --")
        for c, lbl in WIFI_CONSTS.items():
            n = d.count(struct.pack('<I', c))
            print(f"     {c:#010x} {lbl:26} x{n}")
        syms = dynsyms(d, is64, named)
        imp = [s for s, sh in syms if sh == 0]
        exp = [s for s, sh in syms if sh != 0]
        net = sorted({s for s in imp if re.search(
            r'socket|connect|bind|sendto|recvfrom|\bsend\b|\brecv\b|inet|htons', s)})
        thr = sorted({s for s in imp if s.startswith('pthread')})
        print(f"  -- imports: {len(imp)}  exports: {len(exp)} --")
        print(f"     networking imports: {net if net else 'NONE'}")
        print(f"     pthread imports: {len(thr)} present")
        jni = [s for s in exp if s.startswith('Java_')]
        print(f"     JNI methods: {len(jni)} (all under DraSticJNI); "
              f"wireless-related: "
              f"{[s for s in jni if re.search('wifi|wireless|link|net|multi', s, re.I)] or 'NONE'}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    main()
