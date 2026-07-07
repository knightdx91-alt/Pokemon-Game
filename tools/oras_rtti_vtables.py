#!/usr/bin/env python3
"""
oras_rtti_vtables.py — Bridge ORAS RTTI class names → their vtables → methods.

ORAS (Gen-6) stripped its function symbols, but RTTI class-name strings survive.
This walks the C++ ABI linkage to recover each class's virtual methods:

  RTTI name string (rodata)
    ← type_info: a rodata word `type_info+4` points to the name
      ← vtable: a rodata word `vtable[-1]` points to the type_info; the vtable's
        function slots (vtable[0..]) point into text.

The links are internal RELOCATIONS (pointer words are 0 on disk, filled at load).
INTERNAL-RELOC ENTRY FORMAT (cracked; header @0x128 → off,count; 12-byte entries,
4-byte phase-tolerant): `[patchType | srcSeg<<8] [value=offset-in-srcSeg]
[dest=(destOff<<4)|destSeg]`. patchType 2 = absolute pointer; segs: 0 text,
1 rodata, 2/3 gpu, 4+ data. VERIFIED on DllField: a func slot =
`[0x2][text_off][(rodOff<<4)|1]`; a type_info name-ptr =
`[0x102][name_rodOff][(tiOff<<4)|1]`.

Usage:
  python3 tools/oras_rtti_vtables.py [Class1 Class2 ...]   # default: map classes
  (needs the function scan: CRO_ROM=source/3ds/omegaruby CRO_FUNC_DIR=/tmp/...
   python3 tools/cro_disasm.py --scan)
"""
import json
import os
import struct
import sys

ROM = os.environ.get("CRO_ROM", "source/3ds/omegaruby")
FUNC = os.environ.get("CRO_FUNC_DIR", "/tmp/oras_functions")
MODULE = os.environ.get("ORAS_MODULE", "DllField")
# DllField segment file-offsets (from cro_map): text@384, rodata@987136.
TEXT_O, ROD_O, ROD_SZ = 384, 987136, 121248


def load():
    d = open(f"{ROM}/romfs/{MODULE}.cro", "rb").read()
    off = struct.unpack_from("<I", d, 0x128)[0]
    cnt = struct.unpack_from("<I", d, 0x12C)[0]
    dst_val = {}                         # dest rodata offset -> (srcSeg, value)
    for o in range(off, min(off + cnt * 12 + 16, len(d) - 12), 4):
        f0, f1, f2 = struct.unpack_from("<III", d, o)
        if (f0 & 0xFF) == 2 and (f0 >> 16) == 0 and (f2 & 0xF) == 1:
            dst_val[f2 >> 4] = ((f0 >> 8) & 0xFF, f1)
    rod = d[ROD_O:ROD_O + ROD_SZ]
    rodval_dests = {}                    # rodata value -> [dest offsets] (src=rodata)
    for doff, (seg, val) in dst_val.items():
        if seg == 1:
            rodval_dests.setdefault(val, []).append(doff)
    return d, rod, dst_val, rodval_dests


def name_off(rod, cls):
    # RTTI mangled nested-name: N5field<len><cls>E. Locate the 'field<len><cls>'
    # body; the 'N5' start is 2 bytes earlier.
    i = rod.find(("field" + str(len(cls)) + cls).encode())
    return i - 2 if i >= 0 else None


def methods_of(rod, dst_val, rodval_dests, cls):
    noff = name_off(rod, cls)
    if noff is None:
        return []
    out = []
    for name_field in rodval_dests.get(noff, []):     # type_info+4 == name ptr
        ti = name_field - 4
        for vm1 in rodval_dests.get(ti, []):          # vtable[-1] == type_info
            vt = vm1 + 4
            meths, k = [], vt
            while k in dst_val and dst_val[k][0] == 0:  # text (function) slots
                meths.append(dst_val[k][1])
                k += 4
            if meths:
                out.append((vt, meths))
    return out


def main(argv):
    d, rod, dst_val, rodval_dests = load()
    classes = argv or ["FieldCameraSetting", "FieldStereoCamera", "MapFileSimple",
                        "MapBlock", "FieldmapProc", "FieldAreaEnv", "GridVector"]
    result = {}
    for cls in classes:
        vts = methods_of(rod, dst_val, rodval_dests, cls)
        result[cls] = [{"vtable": f"rodata+{vt:#x}",
                        "methods": [f"{m:#x}" for m in meths]} for vt, meths in vts]
        no = name_off(rod, cls)
        print(f"{cls}: name@rodata+{no:#x}" if no is not None else f"{cls}: NOT FOUND")
        for vt, meths in vts:
            print(f"   vtable@rodata+{vt:#x}: {len(meths)} methods "
                  f"[{', '.join(hex(m) for m in meths[:8])}...]")
    out = os.environ.get("ORAS_VT_OUT", "/tmp/oras_class_vtables.json")
    json.dump(result, open(out, "w"), indent=1)
    print("wrote", out)


if __name__ == "__main__":
    main(sys.argv[1:])
