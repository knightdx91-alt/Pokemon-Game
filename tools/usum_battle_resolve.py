#!/usr/bin/env python3
"""
usum_battle_resolve.py — resolve Battle.cro's runtime layout from a LIVE
in-battle VA dump (/tmp/va.bin from the Citra autopilot's /tmp/dump_va trigger).

This is the payoff of the live-capture route for the effect->sequence remap. It
finds Battle.cro's relocated load base in the VA-contiguous image, reads its
runtime segment table, and locates the battle event-queue global by
prologue-matching `sub_8790c` (the event-queue push) and reading its
relocation-filled queue-base literal.

Ground truth captured this way (USUM USA, this build — base is DETERMINISTIC
across battles; Battle.cro is UNLOADED on the overworld so this only works from
an in-battle dump):

    text   VA 0x6dd180  size 0xfc7f4
    rodata VA 0x7da000  size 0xe694   -> sequence-handler table (rodata+0x45a0) @ 0x7de5a0
    data   VA 0x8145c90 size 0xe68
    bss    VA 0x8146af8 size 0xbaa0
    sub_8790c @ runtime 0x764a8c; queue-base literal (disk file off 0x879d4,
      reloc-filled) -> 0x8146e8c == bss+0x394  (confirms EFFECT_DISPATCH.md)

IMPORTANT (empirical, this session): the tag-0x1f effect event is a SUB-FRAME
transient — pushed by sub_86e48 and drained by the sequence runner within one
frame. It is NOT present in the queue in any external /tmp/dump_va snapshot (a
file-triggered dump freezes the game ~1 frame, so it always lands between the
push and the next push). Reading (effectId->seqId) therefore does NOT go through
the queue. Instead:
  * effectId is KNOWN from the chosen move (data/pokemon/usum_moves.json effectId).
  * seqId persists across the multi-frame move at work+0xa94 (the step-state
    machine). The remaining task is to resolve the battle-"work" object base
    (a global pointer in Battle.cro data/bss) and read u32 @ work+0xa94 during a
    move, OR add a PC-breakpoint dump at the dispatch site to the Citra patch.

Also: the DEFAULT /tmp/dump_va window (base 0x00100000 size 0x00F00000, 16 MB)
reaches text+rodata but NOT data/bss (~0x814xxxx). Dump those with an explicit
base, e.g.  echo "08140000 00020000" > /tmp/dump_va.

Usage:
    # (in battle) capture text+rodata, then resolve:
    echo "00100000 00F00000" > /tmp/dump_va
    python3 tools/usum_battle_resolve.py            # reads /tmp/va.bin
    python3 tools/usum_battle_resolve.py /path/to/va.bin
"""
import struct
import sys

DUMP_BASE = 0x100000  # /tmp/dump_va default base; file off = VA - DUMP_BASE
CRO_PATH = "source/3ds/ultramoon/romfs/Battle.cro"

# sub_8790c signatures (this build):
#   prologue  push {r4,r5,r6,r7,r8,lr} = e92d41f0  -> bytes f0 41 2d e9
#   at +0x14  ldr r5,[pc,#0xac]        = e59f50ac  -> bytes ac 50 9f e5
PROLOGUE = bytes.fromhex("f0412de9")
LDR_R5 = bytes.fromhex("ac509fe5")
LDR_OFF = 0x14          # offset of the ldr within sub_8790c
LDR_LIT_DELTA = 8 + 0xac  # ARM pc-rel: literal = ldr_va + 8 + imm


def u32(mem, va):
    o = va - DUMP_BASE
    if o < 0 or o + 4 > len(mem):
        return None
    return struct.unpack("<I", mem[o:o + 4])[0]


def resolve(mem):
    cro = open(CRO_PATH, "rb").read()
    # deep, content-rich text signature (avoids the all-veneer prologue region)
    sig = cro[384 + 0x20000:384 + 0x20000 + 24]
    k = mem.find(sig)
    if k < 0:
        raise SystemExit("Battle.cro not resident in this dump "
                         "(are you in a battle? it's unloaded on the overworld)")
    text_va = DUMP_BASE + k - 0x20000

    # runtime segment table: CRO header at text_va-0x180; SegTableOffset@+0xC8 is
    # relocated to an ABSOLUTE VA at load, SegNum@+0xCC.
    hdr = text_va - 0x180
    seg_tbl_va = u32(mem, hdr + 0xC8)
    seg_num = u32(mem, hdr + 0xCC)
    segs = {}
    for i in range(seg_num):
        b = seg_tbl_va + i * 12
        off, size, sid = struct.unpack("<III", mem[b - DUMP_BASE:b - DUMP_BASE + 12])
        segs[sid] = (off, size)

    out = {
        "text": text_va,
        "rodata": segs[1][0],
        "data": segs[2][0],
        "bss": segs[3][0],
        "seqtbl": segs[1][0] + 0x45a0,
    }

    # queue base: locate sub_8790c by prologue+ldr, read the reloc-filled literal.
    start, end = text_va - DUMP_BASE, segs[1][0] - DUMP_BASE
    i = start
    while True:
        j = mem.find(PROLOGUE, i)
        if j < 0 or j >= end:
            break
        if mem[j + LDR_OFF:j + LDR_OFF + 4] == LDR_R5:
            fva = DUMP_BASE + j
            lit_va = fva + LDR_OFF + LDR_LIT_DELTA
            out["sub_8790c"] = fva
            out["qbase"] = u32(mem, lit_va)
            break
        i = j + 4
    return out


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/va.bin"
    mem = open(path, "rb").read()
    r = resolve(mem)
    print(f"Battle.cro (from {path}, VA base {hex(DUMP_BASE)}):")
    print(f"  text   {hex(r['text'])}")
    print(f"  rodata {hex(r['rodata'])}   seq-handler table @ {hex(r['seqtbl'])}")
    print(f"  data   {hex(r['data'])}")
    print(f"  bss    {hex(r['bss'])}")
    if "qbase" in r:
        qb = r["qbase"]
        rel = qb - r["bss"]
        print(f"  sub_8790c @ {hex(r['sub_8790c'])}  event-queue base @ {hex(qb)} "
              f"(bss+{hex(rel)}{'  OK' if rel == 0x394 else ''})")


if __name__ == "__main__":
    main()
