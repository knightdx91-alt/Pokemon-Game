#!/usr/bin/env python3
"""Parse /tmp/hook_out from the Citra JIT read-watch into (seqId, regs) records.
Each line: <vaddr> <r0..r15> (all hex). seqId = (vaddr - seqtbl)/8.
Usage: hookcap.py [seqtbl_hex]   (default 0x7de5a0)
"""
import sys

SEQTBL = int(sys.argv[1], 16) if len(sys.argv) > 1 else 0x7de5a0

def main():
    try:
        lines = open('/tmp/hook_out').read().splitlines()
    except FileNotFoundError:
        print("no /tmp/hook_out"); return
    seen = []
    for ln in lines:
        p = ln.split()
        if not p:
            continue
        vaddr = int(p[0], 16)
        regs = [int(x, 16) for x in p[1:17]] if len(p) >= 17 else []
        off = vaddr - SEQTBL
        seqid = off // 8
        slot = "handler" if off % 8 == 0 else "aux"
        seen.append((vaddr, seqid, slot, regs))
    print(f"{len(seen)} seqtbl reads (seqtbl={hex(SEQTBL)}):")
    # de-dup consecutive identical seqid
    last = None
    for vaddr, seqid, slot, regs in seen:
        key = (seqid, slot)
        marker = "" if key != last else "  (repeat)"
        last = key
        rs = " ".join(f"r{i}={hex(regs[i])}" for i in (4, 5, 0, 1)) if regs else ""
        print(f"  vaddr={hex(vaddr)} seqId={seqid} [{slot}]{marker}  {rs}")
    # summary of distinct handler-slot seqIds
    hs = sorted({s for _, s, sl, _ in seen if sl == 'handler'})
    print("distinct handler seqIds:", hs)

if __name__ == '__main__':
    main()
