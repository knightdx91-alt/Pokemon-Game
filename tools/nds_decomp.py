#!/usr/bin/env python3
"""
nds_decomp.py — Decompile an NDS ROM into a pret-style source tree.

Takes any .nds ROM and explodes it into a directory layout modelled on the
pret decomp repos (source/pokeplatinum, source/pokeheartgold):

  <out>/
    rom_header.bin          — raw 0x200-byte cartridge header
    rom_info.json           — parsed header (title, gamecode, offsets, sizes)
    banner.bin              — icon/title banner
    arm9.bin / arm7.bin     — CPU binaries
    overlays/
      overlay_0000.bin …    — overlay binaries (decompressed if LZ-flagged)
      arm9_overlay_table.json / arm7_overlay_table.json
    files/                  — the full NitroFS tree, REAL names from the FNT
      a/0/1/6  …            — (Gen 5 layout) raw NARC containers
    unpacked/               — every NARC expanded into member files
      a/0/1/6/0001.bin …    — members auto-decompressed (LZ77/LZ11) and
                              auto-named by magic (.nclr/.ncgr/.nscr/…)
    DECOMP_MANIFEST.md      — index of everything + known Pokémon NARC names

Nothing here produces C code — that part of a pret repo is years of human
reverse engineering. This produces the complete data/asset side, which is
what the game-building sessions actually consume.

Usage:
  python3 tools/nds_decomp.py <rom.nds> [-o source/nds/<name>] [--no-unpack]
  python3 tools/nds_decomp.py rom.nds --list          # just print the file tree

No dependencies beyond the standard library.
"""
import argparse
import json
import struct
import sys
from pathlib import Path

# ---------------------------------------------------------------- header ---

def parse_header(rom):
    h = {}
    h['title']       = rom[0x00:0x0C].split(b'\0')[0].decode('ascii', 'replace')
    h['gamecode']    = rom[0x0C:0x10].decode('ascii', 'replace')
    h['makercode']   = rom[0x10:0x12].decode('ascii', 'replace')
    h['unitcode']    = rom[0x12]
    (h['arm9_offset'], h['arm9_entry'], h['arm9_ram'], h['arm9_size'],
     h['arm7_offset'], h['arm7_entry'], h['arm7_ram'], h['arm7_size'],
     h['fnt_offset'], h['fnt_size'], h['fat_offset'], h['fat_size'],
     h['arm9_ovt_offset'], h['arm9_ovt_size'],
     h['arm7_ovt_offset'], h['arm7_ovt_size']) = struct.unpack_from('<16I', rom, 0x20)
    h['banner_offset'] = struct.unpack_from('<I', rom, 0x68)[0]
    h['rom_size_used'] = struct.unpack_from('<I', rom, 0x80)[0]
    return h

# ------------------------------------------------------------------- FNT ---

def parse_fnt(rom, fnt_off, fat_count):
    """Return {file_id: 'path/name', ...} and set of dir paths."""
    names = {}
    total_dirs = struct.unpack_from('<H', rom, fnt_off + 6)[0]

    def walk(dir_id, prefix):
        entry = fnt_off + (dir_id & 0xFFF) * 8
        sub_off, first_id = struct.unpack_from('<IH', rom, entry)
        p = fnt_off + sub_off
        fid = first_id
        while True:
            length = rom[p]; p += 1
            if length == 0:
                break
            is_dir = bool(length & 0x80)
            n = length & 0x7F
            name = rom[p:p + n].decode('ascii', 'replace'); p += n
            if is_dir:
                sub_id = struct.unpack_from('<H', rom, p)[0]; p += 2
                walk(sub_id, prefix + name + '/')
            else:
                names[fid] = prefix + name
                fid += 1

    walk(0xF000, '')
    return names

def parse_fat(rom, fat_off, fat_size):
    out = []
    for i in range(fat_size // 8):
        start, end = struct.unpack_from('<II', rom, fat_off + i * 8)
        out.append((start, end))
    return out

# ---------------------------------------------------------- decompression ---

def lz_decompress(data):
    """Decompress GBA/NDS LZ77 (type 0x10) or LZ11 (type 0x11) data.
    Returns None if data isn't LZ-compressed or is malformed."""
    if len(data) < 4 or data[0] not in (0x10, 0x11):
        return None
    lz11 = data[0] == 0x11
    dst_len = data[1] | (data[2] << 8) | (data[3] << 16)
    if dst_len == 0 or dst_len > 0x1000000:
        return None
    src, out = 4, bytearray()
    try:
        while len(out) < dst_len:
            flags = data[src]; src += 1
            for bit in range(8):
                if len(out) >= dst_len:
                    break
                if flags & (0x80 >> bit):
                    b1 = data[src]
                    if not lz11:
                        cnt = (b1 >> 4) + 3
                        disp = ((b1 & 0xF) << 8 | data[src + 1]) + 1
                        src += 2
                    else:
                        ind = b1 >> 4
                        if ind == 0:
                            cnt = (b1 << 4 | data[src + 1] >> 4) + 0x11
                            disp = ((data[src + 1] & 0xF) << 8 | data[src + 2]) + 1
                            src += 3
                        elif ind == 1:
                            cnt = ((b1 & 0xF) << 12 | data[src + 1] << 4 |
                                   data[src + 2] >> 4) + 0x111
                            disp = ((data[src + 2] & 0xF) << 8 | data[src + 3]) + 1
                            src += 4
                        else:
                            cnt = ind + 1
                            disp = ((b1 & 0xF) << 8 | data[src + 1]) + 1
                            src += 2
                    if disp > len(out):
                        return None
                    for _ in range(cnt):
                        out.append(out[-disp])
                else:
                    out.append(data[src]); src += 1
    except IndexError:
        return None
    return bytes(out) if len(out) == dst_len else None

# ------------------------------------------------------------------ NARC ---

NARC_MAGIC = b'NARC'

def parse_narc(data):
    """Return list of (index, member_bytes) or None if not a NARC."""
    if len(data) < 0x1C or data[:4] != NARC_MAGIC:
        return None
    # chunks start at 0x10: BTAF (fat), BTNF (fnt), GMIF (data)
    pos = 0x10
    fat, gmif_data_off = None, None
    while pos + 8 <= len(data):
        tag = data[pos:pos + 4]
        size = struct.unpack_from('<I', data, pos + 4)[0]
        if size < 8 or pos + size > len(data):
            return None
        if tag == b'BTAF':
            n = struct.unpack_from('<I', data, pos + 8)[0]
            fat = [struct.unpack_from('<II', data, pos + 12 + i * 8) for i in range(n)]
        elif tag == b'GMIF':
            gmif_data_off = pos + 8
            break
        pos += size
    if fat is None or gmif_data_off is None:
        return None
    return [(i, data[gmif_data_off + s: gmif_data_off + e]) for i, (s, e) in enumerate(fat)]

# Nintendo resource magics → friendly extension
MAGIC_EXT = {
    b'RLCN': '.nclr', b'RGCN': '.ncgr', b'RCSN': '.nscr', b'RECN': '.ncer',
    b'RNAN': '.nanr', b'RTFN': '.nftr', b'RCMN': '.ncmr', b'RBMN': '.nmbr',
    b'BMD0': '.nsbmd', b'BTX0': '.nsbtx', b'BCA0': '.nsbca', b'BTP0': '.nsbtp',
    b'BMA0': '.nsbma', b'BVA0': '.nsbva', b'NARC': '.narc', b'PMCP': '.pmcp',
}

def guess_ext(data):
    if len(data) >= 4:
        e = MAGIC_EXT.get(data[:4])
        if e:
            return e
        if data[0] in (0x10, 0x11):
            return '.lz'
    return '.bin'

# ------------------------------------------------ known Pokémon NARC names ---
# Best-effort annotations for well-known NARC paths (from community research:
# pret, PKHeX, Kazo's BW tools). Keyed by gamecode prefix → path → label.
KNOWN_NARCS = {
    # Black/White 2 (IRE/IRD) and Black/White (IRB/IRA) share most paths
    'IR': {
        'a/0/0/2': 'text — common (item/move/ability/species names, UI)',
        'a/0/0/3': 'text — story dialogue',
        'a/0/1/6': 'pokemon personal data (base stats, types, abilities)',
        'a/0/1/8': 'pokemon level-up learnsets',
        'a/0/1/9': 'pokemon evolution data',
        'a/0/2/1': 'move data',
        'a/0/9/1': 'trainer data',
        'a/0/9/2': 'trainer pokemon parties',
        'a/1/2/7': 'wild encounter data (BW2)',
        'a/1/2/6': 'wild encounter data (BW)',
        'a/0/0/8': 'map matrix',
        'a/0/0/9': 'map data',
        'a/0/0/4': 'pokemon battle sprites',
        'a/0/1/7': 'pokemon icon sprites',
    },
    # Diamond/Pearl/Platinum (ADA/APA/CPU) — pret pokeplatinum has full names
    'CP': {
        'poketool/personal/pl_personal.narc': 'pokemon personal data',
        'poketool/waza/pl_waza_tbl.narc': 'move data',
        'poketool/trainer/trdata.narc': 'trainer data',
        'poketool/trainer/trpoke.narc': 'trainer pokemon parties',
        'fielddata/encountdata/pl_enc_data.narc': 'wild encounter data',
        'msgdata/pl_msg.narc': 'all game text',
    },
    # HeartGold/SoulSilver (IPK/IPG) — pret pokeheartgold has full names
    'IP': {
        'a/0/0/2': 'pokemon personal data',
        'a/0/1/1': 'move data',
        'a/0/5/5': 'trainer data',
        'a/0/5/6': 'trainer pokemon parties',
        'a/0/3/7': 'wild encounter data (Johto/Kanto)',
        'a/0/2/7': 'all game text',
    },
}

# ------------------------------------------------------------------ main ---

def extract(rom_path, out_dir, unpack=True, list_only=False):
    rom = Path(rom_path).read_bytes()
    h = parse_header(rom)
    print(f"ROM: {h['title']} [{h['gamecode']}]  {len(rom) / 1048576:.1f} MB")

    fat = parse_fat(rom, h['fat_offset'], h['fat_size'])
    names = parse_fnt(rom, h['fnt_offset'], len(fat))
    print(f"FAT entries: {len(fat)}   named files: {len(names)}")

    if list_only:
        for fid in sorted(names):
            s, e = fat[fid]
            print(f"  {fid:5d}  {e - s:9d}  {names[fid]}")
        return

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    # header / banner / arm binaries
    (out / 'rom_header.bin').write_bytes(rom[:0x200])
    (out / 'rom_info.json').write_text(json.dumps(h, indent=2))
    if h['banner_offset']:
        (out / 'banner.bin').write_bytes(rom[h['banner_offset']:h['banner_offset'] + 0x23C0])
    (out / 'arm9.bin').write_bytes(rom[h['arm9_offset']:h['arm9_offset'] + h['arm9_size']])
    (out / 'arm7.bin').write_bytes(rom[h['arm7_offset']:h['arm7_offset'] + h['arm7_size']])

    # overlays
    ov_dir = out / 'overlays'
    for cpu, ovt_off, ovt_size in (('arm9', h['arm9_ovt_offset'], h['arm9_ovt_size']),
                                   ('arm7', h['arm7_ovt_offset'], h['arm7_ovt_size'])):
        if not ovt_size:
            continue
        ov_dir.mkdir(parents=True, exist_ok=True)
        table = []
        for i in range(ovt_size // 32):
            (ov_id, ram, size, bss, si_s, si_e, fid, flags) = struct.unpack_from(
                '<8I', rom, ovt_off + i * 32)
            table.append({'id': ov_id, 'ram_addr': hex(ram), 'ram_size': size,
                          'bss_size': bss, 'file_id': fid,
                          'compressed': bool(flags & 0x01000000)})
            s, e = fat[fid]
            data = rom[s:e]
            dec = lz_decompress(data) if (flags & 0x01000000) else None
            (ov_dir / f'{cpu}_overlay_{ov_id:04d}.bin').write_bytes(dec or data)
        (ov_dir / f'{cpu}_overlay_table.json').write_text(json.dumps(table, indent=2))
        print(f"{cpu} overlays: {len(table)}")

    # NitroFS files
    files_dir = out / 'files'
    narc_paths = []
    for fid, name in sorted(names.items()):
        s, e = fat[fid]
        data = rom[s:e]
        dest = files_dir / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        if data[:4] == NARC_MAGIC:
            narc_paths.append((name, data))
    print(f"NitroFS: extracted {len(names)} files, {len(narc_paths)} NARC archives")

    # NARC unpacking
    unpacked_counts = {}
    if unpack:
        unp_dir = out / 'unpacked'
        for name, data in narc_paths:
            members = parse_narc(data)
            if members is None:
                continue
            mdir = unp_dir / name
            mdir.mkdir(parents=True, exist_ok=True)
            for idx, m in members:
                dec = lz_decompress(m)
                payload = dec if dec is not None else m
                mdir.joinpath(f'{idx:04d}{guess_ext(payload)}').write_bytes(payload)
            unpacked_counts[name] = len(members)
        print(f"Unpacked {len(unpacked_counts)} NARCs "
              f"({sum(unpacked_counts.values())} member files)")

    # manifest
    known = {}
    for prefix, table in KNOWN_NARCS.items():
        if h['gamecode'].startswith(prefix):
            known = table
            break
    lines = [f"# {h['title']} [{h['gamecode']}] — decomp manifest", '',
             f"Extracted from `{Path(rom_path).name}` by `tools/nds_decomp.py`.", '',
             '## Layout',
             '- `arm9.bin` / `arm7.bin` / `overlays/` — code binaries',
             '- `files/` — full NitroFS tree (raw, real names from the FNT)',
             '- `unpacked/<narc path>/` — NARC members, LZ-decompressed, ext by magic', '',
             '## Known data archives (community-documented)', '']
    for path, label in sorted(known.items()):
        mark = '✓' if path in unpacked_counts or (files_dir / path).exists() else '✗ (not present)'
        cnt = f" — {unpacked_counts[path]} members" if path in unpacked_counts else ''
        lines.append(f"- `{path}` — {label} {mark}{cnt}")
    if not known:
        lines.append('_(no annotation table for this gamecode)_')
    lines += ['', '## File tree', '']
    for fid in sorted(names):
        s, e = fat[fid]
        lines.append(f"- `{names[fid]}` ({e - s} bytes)")
    (out / 'DECOMP_MANIFEST.md').write_text('\n'.join(lines) + '\n')
    print(f"Wrote {out / 'DECOMP_MANIFEST.md'}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[1])
    ap.add_argument('rom', help='path to .nds ROM')
    ap.add_argument('-o', '--out', help='output dir (default source/nds/<gamecode>)')
    ap.add_argument('--no-unpack', action='store_true', help='skip NARC unpacking')
    ap.add_argument('--list', action='store_true', help='list files only, no extraction')
    args = ap.parse_args()
    rom_path = Path(args.rom)
    if not rom_path.exists():
        sys.exit(f'ROM not found: {rom_path}')
    out = args.out
    if not out and not args.list:
        gamecode = rom_path.read_bytes()[0x0C:0x10].decode('ascii', 'replace')
        out = Path(__file__).parent.parent / 'source' / 'nds' / gamecode
    extract(rom_path, out, unpack=not args.no_unpack, list_only=args.list)


if __name__ == '__main__':
    main()
