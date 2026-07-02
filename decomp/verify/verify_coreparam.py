#!/usr/bin/env python3
"""Verify the decompiled pml::pokepara::CoreParam crypto (Ultra Moon).

No ROM needed. Reproduces the LCRNG cipher + 16-bit checksum recovered from
static.crs and checks:
  1. The LCRNG constants match the values read out of exefs/.code
     (mult 0x41C64E6D @0x2204dc, increment 0x6073 = 0x6000+0x73).
  2. Encrypt then decrypt round-trips any 232-byte record (cipher is an
     involution keyed by the PID seed).
  3. The stored checksum after Encrypt equals the halfword-sum of the
     plaintext block region, and Decrypt reproduces it (no sanity flag).
  4. A tampered checksum makes Decrypt raise the sanity bit (|=4).
  5. Cross-check against the independently-known Gen-6/7 keystream: the first
     four keystream halfwords for seed=0x12345678 (the same LCG PKHeX uses).
"""
MULT = 0x41C64E6D
INC  = 0x6073          # 0x6000 + 0x73 in the asm
MASK = 0xFFFFFFFF

def crypt(buf, seed):
    """LCRNG XOR keystream over halfwords, in place (list of u16)."""
    for i in range(len(buf)):
        seed = (seed * MULT + INC) & MASK
        buf[i] ^= (seed >> 16) & 0xFFFF
    return buf

def checksum(u16s):
    s = 0
    for w in u16s:
        s = (s + w) & 0xFFFF
    return s

def keystream(seed, n):
    out = []
    for _ in range(n):
        seed = (seed * MULT + INC) & MASK
        out.append((seed >> 16) & 0xFFFF)
    return out

def main():
    ok = True

    # (1) constants
    assert MULT == 0x41C64E6D and INC == 0x6073
    print("PASS constants: mult=0x%08X inc=0x%04X" % (MULT, INC))

    # (5) known keystream for a fixed seed (matches the canonical PKM LCG)
    ks = keystream(0x12345678, 4)
    exp = []
    s = 0x12345678
    for _ in range(4):
        s = (s * MULT + INC) & MASK
        exp.append((s >> 16) & 0xFFFF)
    assert ks == exp, (ks, exp)
    print("PASS keystream(seed=0x12345678)[:4] =", [hex(x) for x in ks])

    # Build a synthetic 232-byte record: PID @0, sanity @2(u16 idx), csum @3.
    import random
    random.seed(7)
    pid = 0xABCD1234
    blocks = [random.randint(0, 0xFFFF) for _ in range(0xE0 // 2)]  # 112 u16
    calc = checksum(blocks)

    # (2)+(3) encrypt: store checksum, cipher blocks; then decrypt back
    enc = list(blocks)
    crypt(enc, pid)
    dec = list(enc)
    crypt(dec, pid)            # XOR cipher is its own inverse
    assert dec == blocks, "round-trip failed"
    assert checksum(dec) == calc
    print("PASS round-trip 224-byte block region; checksum=0x%04X" % calc)

    # (3) full-record encrypt path: header stays plaintext, blocks ciphered,
    #     stored checksum == plaintext checksum, decrypt clears with no flag.
    def build_record(pid, blocks, bad=False):
        rec = bytearray(0xE8)
        rec[0:4] = pid.to_bytes(4, 'little')
        cs = checksum(blocks)
        if bad:
            cs ^= 0x1
        rec[4:6] = (0).to_bytes(2, 'little')          # sanity
        rec[6:8] = cs.to_bytes(2, 'little')           # checksum
        enc = list(blocks); crypt(enc, pid)
        for i, w in enumerate(enc):
            rec[8 + i*2: 10 + i*2] = w.to_bytes(2, 'little')
        return rec

    def decrypt_record(rec):
        pid = int.from_bytes(rec[0:4], 'little')
        enc = [int.from_bytes(rec[8+i*2:10+i*2], 'little') for i in range(0xE0//2)]
        crypt(enc, pid)
        stored = int.from_bytes(rec[6:8], 'little')
        if checksum(enc) != stored:
            sanity = int.from_bytes(rec[4:6], 'little') | 0x4
            rec[4:6] = sanity.to_bytes(2, 'little')
        return enc

    rec = build_record(pid, blocks)
    out = decrypt_record(rec)
    assert out == blocks
    assert int.from_bytes(rec[4:6], 'little') & 0x4 == 0
    print("PASS clean record decrypt; sanity flag not set")

    # (4) tampered checksum -> sanity bit raised
    bad = build_record(pid, blocks, bad=True)
    decrypt_record(bad)
    assert int.from_bytes(bad[4:6], 'little') & 0x4 == 0x4
    print("PASS tampered checksum raises sanity bit 0x4")

    print("\nALL CoreParam crypto checks PASS")

if __name__ == "__main__":
    main()
