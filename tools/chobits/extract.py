#!/usr/bin/env python3
"""Dump the Chobits English script and look up pointer indices by text.

Usage:
    python3 extract.py gopicolo_eng.gba              # dump all to script_dump.txt
    python3 extract.py gopicolo_eng.gba "some text"  # find index/indices of a line
"""
import struct, sys

TBL_S, TBL_E = 0x84e74, 0x8dcc0
N = (TBL_E - TBL_S) // 4

def is_jp(b):
    return any((0x81 <= c <= 0x9f) or (0xe0 <= c <= 0xef) for c in b)

def entry(d, i):
    v = struct.unpack('<I', d[TBL_S + i*4: TBL_S + i*4 + 4])[0]
    off = v - 0x08000000
    return off, d[off:d.find(b'\x00', off)]

def main():
    d = open(sys.argv[1], 'rb').read()
    if len(sys.argv) > 2:
        needle = sys.argv[2].encode('ascii')
        for i in range(N):
            _, s = entry(d, i)
            if needle in s:
                print("#%d  %r" % (i, s.decode('latin1')))
        return
    rows = []
    for i in range(N):
        off, s = entry(d, i)
        if s and not is_jp(s):
            rows.append((i, off, s))
    rows.sort(key=lambda r: r[1])  # offset order ~= script order
    with open("script_dump.txt", "w") as out:
        for i, off, s in rows:
            out.write("#%d @%06x\t%s\n" % (i, off, s.decode('latin1').replace('\n', '\\n')))
    print("dumped %d english strings to script_dump.txt" % len(rows))

if __name__ == '__main__':
    main()
