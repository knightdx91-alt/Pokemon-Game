#!/usr/bin/env python3
"""
3ds_decomp.py — Decompile a DECRYPTED 3DS ROM into a pret-style source tree.

Counterpart to tools/nds_decomp.py for the 3DS generation (Pokémon X/Y,
ORAS, Sun/Moon/USUM). Accepts a **decrypted** .3ds/.cci, .cia (installer
archive — the NCCH inside is located automatically), or bare .cxi; it does
no crypto. Layout produced:

  <out>/
    rom_info.json            — parsed NCSD/NCCH headers
    exheader.bin             — extended header of the game partition
    exefs/                   — code binary, banner, icon
      .code / icon / banner …
    romfs/                   — the FULL RomFS file tree, real names
      a/0/0/0 …              — (Pokémon) GARC containers
    unpacked/                — every GARC expanded into member files
      a/2/1/8/0001.bin …     — members LZ11-decompressed where compressed
    DECOMP_MANIFEST.md       — index + community-known Pokémon GARC names

Usage:
  python3 tools/3ds_decomp.py <rom.3ds> [-o source/3ds/<code>] [--list] [--no-unpack]

Stdlib only. LZ decompression is shared with nds_decomp.py.
"""
import argparse
import importlib.util
import json
import struct
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent

# Reuse the NDS tool's LZ77/LZ11 decompressor (identical algorithm on 3DS).
_spec = importlib.util.spec_from_file_location('nds_decomp', SCRIPT_DIR / 'nds_decomp.py')
_nds = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_nds)
lz_decompress = _nds.lz_decompress

MEDIA_UNIT = 0x200

# ------------------------------------------------------------------- CIA ---

def align64(n):
    return (n + 0x3F) & ~0x3F

def find_cia_content(rom):
    """If `rom` is a CIA (installer archive), return the offset of its first
    content (the game NCCH). CIA layout: header, cert chain, ticket, TMD,
    contents, meta — each section 0x40-aligned."""
    if len(rom) < 0x2020:
        return None
    hdr_size, ctype, version = struct.unpack_from('<IHH', rom, 0)
    if hdr_size != 0x2020:
        return None
    cert_size, tik_size, tmd_size, meta_size = struct.unpack_from('<4I', rom, 8)
    off = (align64(hdr_size) + align64(cert_size) + align64(tik_size)
           + align64(tmd_size))
    if off + 0x104 <= len(rom) and rom[off + 0x100:off + 0x104] == b'NCCH':
        return off
    return None

# ------------------------------------------------------------- NCSD/NCCH ---

def parse_ncsd(rom):
    if rom[0x100:0x104] != b'NCSD':
        return None
    parts = []
    for i in range(8):
        off, size = struct.unpack_from('<II', rom, 0x120 + i * 8)
        if size:
            parts.append({'index': i, 'offset': off * MEDIA_UNIT, 'size': size * MEDIA_UNIT})
    return parts

def parse_ncch(rom, base):
    if rom[base + 0x100:base + 0x104] != b'NCCH':
        return None
    h = {'base': base}
    h['content_size'] = struct.unpack_from('<I', rom, base + 0x104)[0] * MEDIA_UNIT
    h['product_code'] = rom[base + 0x150:base + 0x160].split(b'\0')[0].decode('ascii', 'replace')
    flags = rom[base + 0x188:base + 0x190]
    h['no_crypto'] = bool(flags[7] & 0x04)
    h['exheader_size'] = struct.unpack_from('<I', rom, base + 0x180)[0]
    (h['exefs_off'], h['exefs_size']) = struct.unpack_from('<II', rom, base + 0x1A0)
    (h['romfs_off'], h['romfs_size']) = struct.unpack_from('<II', rom, base + 0x1B0)
    for k in ('exefs_off', 'exefs_size', 'romfs_off', 'romfs_size'):
        h[k] *= MEDIA_UNIT
    return h

# ----------------------------------------------------------------- ExeFS ---

def parse_exefs(rom, base):
    """ExeFS header: 10 × (name[8], offset u32, size u32); data after 0x200."""
    out = []
    for i in range(10):
        e = base + i * 16
        name = rom[e:e + 8].split(b'\0')[0].decode('ascii', 'replace')
        off, size = struct.unpack_from('<II', rom, e + 8)
        if name and size:
            out.append((name, base + 0x200 + off, size))
    return out

# ----------------------------------------------------------------- RomFS ---

NONE32 = 0xFFFFFFFF

def find_level3(rom, romfs_base, romfs_size):
    """RomFS is an IVFC container; level 3 holds the real filesystem.
    Standard offset is 0x1000; fall back to scanning aligned offsets."""
    if rom[romfs_base:romfs_base + 4] != b'IVFC':
        return None
    for off in [0x1000] + list(range(0x200, min(romfs_size, 0x10000), 0x200)):
        p = romfs_base + off
        if struct.unpack_from('<I', rom, p)[0] == 0x28:  # level3 header length
            return p
    return None

def parse_romfs(rom, lvl3):
    """Walk level-3 dir/file metadata → {path: (abs_offset, size)}."""
    (hlen, dirhash_o, dirhash_s, dirmeta_o, dirmeta_s,
     filehash_o, filehash_s, filemeta_o, filemeta_s, filedata_o) = struct.unpack_from('<10I', rom, lvl3)
    files = {}

    def read_name(p, ln):
        return rom[p:p + ln].decode('utf-16-le', 'replace')

    def walk_files(fid, prefix):
        while fid != NONE32:
            p = lvl3 + filemeta_o + fid
            (parent, sib) = struct.unpack_from('<II', rom, p)
            (doff, dsize) = struct.unpack_from('<QQ', rom, p + 8)
            (nhash, nlen) = struct.unpack_from('<II', rom, p + 24)
            name = read_name(p + 32, nlen)
            files[prefix + name] = (lvl3 + filedata_o + doff, dsize)
            fid = sib

    def walk_dir(did, prefix):
        p = lvl3 + dirmeta_o + did
        (parent, sib, child, firstfile, nhash, nlen) = struct.unpack_from('<6I', rom, p)
        name = read_name(p + 24, nlen)
        path = prefix + name + '/' if name else prefix
        walk_files(firstfile, path)
        c = child
        while c != NONE32:
            walk_dir(c, path)
            cp = lvl3 + dirmeta_o + c
            c = struct.unpack_from('<I', rom, cp + 4)[0]  # sibling

    walk_dir(0, '')
    return files

# ------------------------------------------------------------------ GARC ---

def parse_garc(data):
    """Return [(index, member_bytes)] or None. Handles GARC v4 (XY) and v6."""
    if len(data) < 0x1C or data[:4] != b'CRAG':
        return None
    header_size, endian, version = struct.unpack_from('<IHH', data, 4)
    data_off, _file_size = struct.unpack_from('<II', data, 0x10)
    p = header_size
    if data[p:p + 4] != b'OTAF':
        return None
    fato_size, count = struct.unpack_from('<IH', data, p + 4)
    p += fato_size
    if data[p:p + 4] != b'BTAF':
        return None
    q = p + 12
    members = []
    for i in range(count):
        vector = struct.unpack_from('<I', data, q)[0]; q += 4
        for bit in range(32):
            if vector & (1 << bit):
                start, end, _length = struct.unpack_from('<III', data, q); q += 12
                members.append((len(members), data[data_off + start:data_off + end]))
    return members

def maybe_decompress(m):
    dec = lz_decompress(m)
    return dec if dec is not None else m

MAGIC_EXT = dict(_nds.MAGIC_EXT)
MAGIC_EXT.update({
    b'CRAG': '.garc', b'CGFX': '.bcres', b'CLIM': '.bclim', b'FLIM': '.bflim',
    b'BCH\x00': '.bch', b'SEDL': '.sedl', b'CSAR': '.bcsar',
})

def guess_ext(data):
    if len(data) >= 4:
        e = MAGIC_EXT.get(data[:4])
        if e:
            return e
    return _nds.guess_ext(data)

# ---------------------------------------------- known Pokémon GARC names ---
# Community-documented paths (pk3DS / ProjectPokemon research). Best-effort:
# verify against member counts after extraction.
KNOWN_GARCS = {
    # Pokémon X / Y (product codes CTR-P-EKJA / EK2A)
    'EK': {
        'a/2/1/8': 'pokemon personal data (base stats, types, abilities)',
        'a/2/1/4': 'pokemon level-up learnsets',
        'a/2/1/5': 'pokemon evolution data',
        'a/2/1/2': 'move data',
        'a/2/1/3': 'egg moves',
        'a/0/7/2': 'text — common (species/move/item/ability names, UI)',
        'a/0/7/1': 'text — story dialogue',
        'a/0/1/2': 'wild encounter data',
        'a/0/3/6': 'trainer classes',
        'a/0/3/7': 'trainer data',
        'a/0/3/8': 'trainer pokemon parties',
        'a/0/0/7': 'pokemon menu icon sprites',
        'a/0/0/8': 'pokemon 3D models/textures (BCH — not 2D-convertible)',
    },
    # Sun/Moon (CTR-P-BNDA/BNEA) & Ultra Sun/Ultra Moon (CTR-P-A2AA/A2BA).
    # Best-effort (pkNX research) — verify member counts after extraction.
    'BN': {
        'a/0/1/7': 'pokemon personal data',
        'a/0/1/3': 'pokemon level-up learnsets',
        'a/0/1/1': 'move data',
        'a/0/3/2': 'text — common (names)',
    },
    'A2': {
        'a/0/1/7': 'pokemon personal data',
        'a/0/1/3': 'pokemon level-up learnsets',
        'a/0/1/1': 'move data',
        'a/0/3/2': 'text — common (names)',
    },
    # Omega Ruby / Alpha Sapphire (CTR-P-ECRA / ECLA)
    'EC': {
        'a/1/9/5': 'pokemon personal data',
        'a/1/9/1': 'pokemon level-up learnsets',
        'a/1/9/2': 'pokemon evolution data',
        'a/1/8/9': 'move data',
        'a/0/7/2': 'text — common',
        'a/0/7/1': 'text — story dialogue',
        'a/0/1/3': 'wild encounter data',
        'a/0/3/8': 'trainer data',
        'a/0/3/9': 'trainer pokemon parties',
    },
}

# ------------------------------------------------------------------ main ---

def extract(rom_path, out_dir, unpack=True, list_only=False):
    rom = Path(rom_path).read_bytes()

    # Accept NCSD (.3ds/.cci), CIA (installer archive), or bare NCCH (.cxi)
    parts = parse_ncsd(rom)
    if parts:
        game = parse_ncch(rom, parts[0]['offset'])
    else:
        cia_off = find_cia_content(rom)
        if cia_off is not None:
            print(f'CIA container detected; game NCCH at 0x{cia_off:X}')
            game = parse_ncch(rom, cia_off)
        else:
            game = parse_ncch(rom, 0)
    if not game:
        sys.exit('Not a 3DS ROM (no NCSD/CIA/NCCH magic). Is it decrypted?')
    if not game['no_crypto']:
        print('WARNING: NoCrypto flag not set — ROM may be encrypted; '
              'extraction will produce garbage if so.')
    print(f"NCCH: {game['product_code']}  romfs {game['romfs_size'] / 1048576:.1f} MB")

    files = {}
    if game['romfs_size']:
        lvl3 = find_level3(rom, game['base'] + game['romfs_off'], game['romfs_size'])
        if lvl3 is None:
            sys.exit('RomFS level-3 not found (encrypted ROM?)')
        files = parse_romfs(rom, lvl3)
    print(f"RomFS files: {len(files)}")

    if list_only:
        for path in sorted(files):
            off, size = files[path]
            print(f"  {size:10d}  {path}")
        return

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    info = {k: v for k, v in game.items()}
    info['partitions'] = parts or []
    (out / 'rom_info.json').write_text(json.dumps(info, indent=2))

    if game['exheader_size']:
        (out / 'exheader.bin').write_bytes(rom[game['base'] + 0x200: game['base'] + 0x200 + 0x800])

    if game['exefs_size']:
        exdir = out / 'exefs'
        exdir.mkdir(exist_ok=True)
        for name, off, size in parse_exefs(rom, game['base'] + game['exefs_off']):
            data = rom[off:off + size]
            if name == '.code':
                data = maybe_decompress(data)
            exdir.joinpath(name.replace('/', '_')).write_bytes(data)
        print(f"ExeFS: extracted")

    romfs_dir = out / 'romfs'
    garcs = []
    for path, (off, size) in sorted(files.items()):
        data = rom[off:off + size]
        dest = romfs_dir / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        if data[:4] == b'CRAG':
            garcs.append((path, data))
    print(f"RomFS: extracted {len(files)} files, {len(garcs)} GARC archives")

    unpacked_counts = {}
    if unpack:
        unp = out / 'unpacked'
        for path, data in garcs:
            members = parse_garc(data)
            if members is None:
                continue
            mdir = unp / path
            mdir.mkdir(parents=True, exist_ok=True)
            for idx, m in members:
                payload = maybe_decompress(m)
                mdir.joinpath(f'{idx:04d}{guess_ext(payload)}').write_bytes(payload)
            unpacked_counts[path] = len(members)
        print(f"Unpacked {len(unpacked_counts)} GARCs "
              f"({sum(unpacked_counts.values())} member files)")

    known = {}
    for prefix, table in KNOWN_GARCS.items():
        if game['product_code'].replace('CTR-P-', '').startswith(prefix):
            known = table
            break
    lines = [f"# {game['product_code']} — 3DS decomp manifest", '',
             f"Extracted from `{Path(rom_path).name}` by `tools/3ds_decomp.py`.", '',
             '## Known data archives (community-documented, pk3DS research)', '']
    for path, label in sorted(known.items()):
        mark = f"✓ — {unpacked_counts[path]} members" if path in unpacked_counts else '✗ (not present)'
        lines.append(f"- `{path}` — {label} {mark}")
    if not known:
        lines.append('_(no annotation table for this product code)_')
    lines += ['', '## RomFS file tree', '']
    for path in sorted(files):
        lines.append(f"- `{path}` ({files[path][1]} bytes)")
    (out / 'DECOMP_MANIFEST.md').write_text('\n'.join(lines) + '\n')
    print(f"Wrote {out / 'DECOMP_MANIFEST.md'}")


def main():
    ap = argparse.ArgumentParser(description='Decompile a decrypted 3DS ROM')
    ap.add_argument('rom')
    ap.add_argument('-o', '--out')
    ap.add_argument('--no-unpack', action='store_true')
    ap.add_argument('--list', action='store_true')
    args = ap.parse_args()
    rom_path = Path(args.rom)
    if not rom_path.exists():
        sys.exit(f'ROM not found: {rom_path}')
    out = args.out
    if not out and not args.list:
        out = Path(__file__).parent.parent / 'source' / '3ds' / rom_path.stem.replace(' ', '_')
    extract(rom_path, out, unpack=not args.no_unpack, list_only=args.list)


if __name__ == '__main__':
    main()
