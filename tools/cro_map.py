#!/usr/bin/env python3
"""Phase 2 of the Ultra Moon decomp: CRO segment + address maps.

Parses each CRO/CRS module's segment table, named-export targets, and
named-import patch sites (3dbrew CRO0 format, offsets validated empirically
on USUM — see decomp/README.md). Turns the phase-1 symbol inventory into
concrete code addresses:

  export  "btl::BgSystem::SetUseVram(bool)"  ->  seg0 (text) + 0xdfba0
  import  "nn::svc::GetSystemTick()"         ->  patched at seg2+0x14, ...

Segment-relative addresses are load-position-independent (CROs relocate at
runtime). Thumb functions carry bit0 set in the raw tag; we record `thumb`
separately and store the even address.

Output: decomp/map/<Module>.json + decomp/map/INDEX.md.
Usage: python3 tools/cro_map.py [romfs_dir] [-o decomp/map]
"""
import argparse
import json
import struct
import subprocess
import sys
from pathlib import Path

SEG_NAMES = {0: 'text', 1: 'rodata', 2: 'data', 3: 'bss'}

# CRO0 header field offsets (validated on USUM modules)
H_SEGTAB = 0xC8       # segment table (offset,size,id)×12B
H_NAMED_EXPORT = 0xD0  # (name_off, target_tag)×8B
H_NAMED_IMPORT = 0x100  # (name_off, patch_list_off)×8B
# NB: 0xF8 is the external-patch table (raw patch entries), NOT named imports.


def u32(d, o):
    return struct.unpack_from('<I', d, o)[0]


def cstr(d, off):
    return d[off:d.find(b'\0', off)].decode('ascii', 'replace')


def tag_addr(tag):
    """Decode a segment tag: low 4 bits = segment index, rest = offset."""
    return tag & 0xF, tag >> 4


def parse_patch_list(d, off):
    """Walk import-patch entries (12B: target_tag u32, type u8, is_last u8,
    _ u16, addend u32) until the is_last flag."""
    patches = []
    while off + 12 <= len(d) and len(patches) < 4096:
        tag, ptype, last = struct.unpack_from('<IBB', d, off)
        seg, soff = tag_addr(tag)
        patches.append({'seg': seg, 'offset': soff, 'type': ptype})
        off += 12
        if last:
            break
    return patches


def demangle(names):
    if not names:
        return {}
    out = subprocess.run(['c++filt'], input='\n'.join(names),
                         capture_output=True, text=True).stdout.splitlines()
    return {m: dm for m, dm in zip(names, out) if dm and dm != m}


def parse_module(path):
    d = path.read_bytes()
    if d[0x80:0x84] != b'CRO0':
        return None
    segs = [dict(zip(('offset', 'size', 'id'),
                     struct.unpack_from('<III', d, u32(d, H_SEGTAB) + i * 12)))
            for i in range(u32(d, H_SEGTAB + 4))]
    for s in segs:
        s['name'] = SEG_NAMES.get(s['id'], f"seg{s['id']}")

    exports, imports = [], []
    eo, ec = u32(d, H_NAMED_EXPORT), u32(d, H_NAMED_EXPORT + 4)
    for i in range(ec):
        no, tag = struct.unpack_from('<II', d, eo + i * 8)
        seg, off = tag_addr(tag)
        exports.append({'mangled': cstr(d, no), 'seg': seg,
                        'offset': off & ~1, 'thumb': bool(off & 1 and seg == 0)})
    io_, ic = u32(d, H_NAMED_IMPORT), u32(d, H_NAMED_IMPORT + 4)
    for i in range(ic):
        no, plist = struct.unpack_from('<II', d, io_ + i * 8)
        imports.append({'mangled': cstr(d, no),
                        'patches': parse_patch_list(d, plist)})

    dm = demangle(sorted({e['mangled'] for e in exports} |
                         {i['mangled'] for i in imports}))
    for rec in (*exports, *imports):
        rec['demangled'] = dm.get(rec['mangled'], rec['mangled'])

    # Import veneers: each named import's patch site in the text segment is a
    # literal word holding the resolved address, loaded by an `ldr pc,[pc,#-4]`
    # thunk 4 bytes earlier. In-module callers `bl`/`b` to that thunk address,
    # so mapping thunk_addr -> imported symbol makes cross-module calls
    # resolvable in disassembly. (This indirection — not a decoder bug — is why
    # a naive patch-offset->caller lookup failed earlier.)
    veneers = {}
    for imp in imports:
        for p in imp['patches']:
            if p['seg'] == 0 and p['offset'] >= 4:
                veneers[p['offset'] - 4] = imp['demangled']

    return {'module': path.name, 'size': len(d), 'segments': segs,
            'exports': exports, 'imports': imports,
            'veneers': {str(k): v for k, v in sorted(veneers.items())}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('romfs', nargs='?', default='source/3ds/ultramoon/romfs')
    ap.add_argument('-o', '--out', default='decomp/map')
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    rows = []
    for path in sorted(list(Path(args.romfs).glob('*.cro')) +
                       list(Path(args.romfs).glob('*.crs'))):
        rec = parse_module(path)
        if rec is None:
            print(f'{path.name}: not CRO0, skipped')
            continue
        (out / (path.stem + '.json')).write_text(json.dumps(rec, indent=1))
        text = next((s for s in rec['segments'] if s['id'] == 0), {'size': 0})
        npatch = sum(len(i['patches']) for i in rec['imports'])
        rows.append((rec['module'], text['size'], len(rec['exports']),
                     len(rec['imports']), npatch))
        print(f"{rec['module']:44s} text={text['size']:8d} "
              f"exp={len(rec['exports']):5d} imp={len(rec['imports']):5d} "
              f"patches={npatch:6d}")

    with (out / 'INDEX.md').open('w') as f:
        f.write('# Ultra Moon CRO address maps\n\n')
        f.write(f'{len(rows)} modules — total text '
                f'{sum(r[1] for r in rows)} bytes, '
                f'{sum(r[2] for r in rows)} placed exports, '
                f'{sum(r[4] for r in rows)} import patch sites\n\n')
        f.write('| Module | text bytes | exports | imports | patch sites |\n')
        f.write('|---|---|---|---|---|\n')
        for r in rows:
            f.write('| ' + ' | '.join(str(x) for x in r) + ' |\n')
    print(f'\nwrote {out}/INDEX.md')


if __name__ == '__main__':
    sys.exit(main())
