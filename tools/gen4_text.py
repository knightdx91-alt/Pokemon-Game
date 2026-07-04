#!/usr/bin/env python3
"""
gen4_text.py — decode Gen-4 (DPPt/HGSS) encrypted message banks.

A pl_msg.narc member is one text bank:
  u16 count, u16 seed; then count x (u32 offset, u32 size) XOR-encrypted with a
  per-entry key derived from seed*0x2FD; each string is `size` u16 chars XORed
  with a rolling per-message key (start 0x91BD3*(i+1), step +0x493D).
Char values map through the Gen-4 Latin table (validated below against a bank
of known English strings).

CLI:
  gen4_text.py <narc> [bank_index]      # dump one bank, or list all bank sizes
  gen4_text.py <narc> --find WORD       # print (bank, line) where WORD appears
"""
import sys, struct, os


def parse_narc(data):
    """Lenient NARC member reader (tolerates an over-large GMIF size field)."""
    if data[:4] != b"NARC":
        return None
    pos, fat, gmif = 0x10, None, None
    while pos + 8 <= len(data):
        tag = data[pos:pos + 4]
        size = struct.unpack_from("<I", data, pos + 4)[0]
        if tag == b"BTAF":
            n = struct.unpack_from("<I", data, pos + 8)[0]
            fat = [struct.unpack_from("<II", data, pos + 12 + i * 8) for i in range(n)]
        elif tag == b"GMIF":
            gmif = pos + 8
            break
        if size < 8:
            break
        pos += size
    if fat is None or gmif is None:
        return None
    return [(i, data[gmif + s:gmif + e]) for i, (s, e) in enumerate(fat)]

# Gen-4 Latin character table (validated against Platinum species/dex banks).
_CH = {0x0000: "", 0xE000: "\n", 0x25BC: "\n", 0x25BD: "\f", 0xFFFF: ""}
def _r(start, s):  # map consecutive codepoints to the chars of s
    for i, c in enumerate(s):
        _CH[start + i] = c
_r(0x0121, "0123456789")                  # digits
_r(0x012B, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")  # A-Z
_r(0x0145, "abcdefghijklmnopqrstuvwxyz")  # a-z
_CH.update({0x01DE: " ", 0x01AE: ".", 0x01AD: ",", 0x01AB: "!", 0x01AC: "?",
            0x01B0: "/", 0x01A8: "'", 0x01A9: "'", 0x01E7: "♂", 0x01E8: "♀",
            0x01F0: ":", 0x01DF: "-", 0x01B3: "-", 0x0182: "(", 0x0183: ")",
            0x01F2: "-", 0x0125: "…", 0x0188: "é"})


def decrypt_bank(mem):
    count, seed = struct.unpack_from("<HH", mem, 0)
    k = (seed * 0x2FD) & 0xFFFF
    ents = []
    for i in range(count):
        kk = (k * (i + 1)) & 0xFFFF
        realkey = kk | (kk << 16)
        off = struct.unpack_from("<I", mem, 4 + i * 8)[0] ^ realkey
        size = struct.unpack_from("<I", mem, 4 + i * 8 + 4)[0] ^ realkey
        ents.append((off & 0xFFFFFFFF, size & 0xFFFFFFFF))
    out = []
    for i, (off, size) in enumerate(ents):
        key = (0x91BD3 * (i + 1)) & 0xFFFF
        chars = []
        for j in range(size):
            if off + j * 2 + 2 > len(mem):
                break
            c = struct.unpack_from("<H", mem, off + j * 2)[0] ^ key
            key = (key + 0x493D) & 0xFFFF
            if c in (0xFFFF, 0x0000) and j == size - 1:
                continue
            chars.append(_CH.get(c, "·"))
        out.append("".join(chars))
    return out


def banks(path):
    members = parse_narc(open(path, "rb").read())
    return [(i, m) for i, m in members]


def main():
    path = sys.argv[1]
    bl = banks(path)
    if len(sys.argv) >= 3 and sys.argv[2] == "--find":
        word = sys.argv[3].lower()
        for i, m in bl:
            try:
                for ln in decrypt_bank(m):
                    if word in ln.lower():
                        print(f"bank {i}: {ln!r}")
            except Exception:
                pass
        return
    if len(sys.argv) >= 3:
        i = int(sys.argv[2])
        for j, ln in enumerate(decrypt_bank(dict(bl)[i])):
            print(f"{j:4d}: {ln}")
        return
    # overview: print bank index, count, and a sample line
    for i, m in bl:
        try:
            lines = decrypt_bank(m)
            samp = next((l for l in lines if l.strip()), "")
            print(f"bank {i:3d}  n={len(lines):4d}  e.g. {samp[:50]!r}")
        except Exception as e:
            print(f"bank {i:3d}  ERR {e}")


if __name__ == "__main__":
    main()
