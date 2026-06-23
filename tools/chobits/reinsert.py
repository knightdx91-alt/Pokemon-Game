#!/usr/bin/env python3
"""Reinsert polished Chobits text and write a new ROM.

Edit the EDITS dict below: pointer-table index -> new ASCII text.
Constraints: each '\n'-delimited line <= 33 chars; <= 2 lines; ASCII 0x20-0x7e.
New strings are appended to the ROM's free tail and the pointer is rewritten,
so edited text may be longer or shorter than the original.

    python3 reinsert.py gopicolo_eng.gba out.gba
"""
import struct, sys

TBL_S, TBL_E = 0x84e74, 0x8dcc0
N = (TBL_E - TBL_S) // 4

# index -> replacement text. Populate from the play-and-flag loop.
EDITS = {
    # 127: "The tambourine's all rhythm...\nbreathe and keep the pace!",
}

def load(fn):
    return bytearray(open(fn, 'rb').read())

def get_entry(d, i):
    v = struct.unpack('<I', d[TBL_S + i*4: TBL_S + i*4 + 4])[0]
    off = v - 0x08000000
    return off, d[off:d.find(b'\x00', off)]

def find_index_by_text(d, needle):
    for i in range(N):
        if get_entry(d, i)[1] == needle:
            return i
    return -1

def reinsert(d, edits):
    """edits: {index: bytes}. Append to free tail (4-aligned), repoint."""
    i = len(d) - 1
    while d[i] in (0x00, 0xff):
        i -= 1
    cur = (i + 1 + 3) & ~3
    for idx, newtext in edits.items():
        blob = newtext + b'\x00'
        if cur + len(blob) > len(d):
            raise SystemExit("out of free space")
        d[cur:cur + len(blob)] = blob
        struct.pack_into('<I', d, TBL_S + idx*4, 0x08000000 + cur)
        cur = (cur + len(blob) + 3) & ~3
    return d

def validate(edits_txt):
    for i, t in edits_txt.items():
        lines = t.split("\n")
        assert len(lines) <= 2, "#%d has >2 lines" % i
        for ln in lines:
            assert len(ln) <= 33, "#%d line too long (%d): %r" % (i, len(ln), ln)
            assert all(0x20 <= ord(c) < 0x7f for c in ln), "#%d non-ASCII: %r" % (i, ln)

if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else "gopicolo_eng.gba"
    out = sys.argv[2] if len(sys.argv) > 2 else "out.gba"
    validate(EDITS)
    d = load(src)
    d = reinsert(d, {i: t.encode('ascii') for i, t in EDITS.items()})
    open(out, 'wb').write(d)
    for i in EDITS:
        print("#%d -> %r" % (i, get_entry(d, i)[1].decode('ascii')))
    print("wrote", out)
