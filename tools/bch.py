#!/usr/bin/env python3
"""
bch.py — from-spec parser for Nintendo 3DS **BCH** (PICA200) 3D models.

This is the Gen-6/7 counterpart to `nitro_g3d.py` (which handles the DS Nitro
G3D / BMD0 models). Omega Ruby / USUM field maps are BCH models wrapped in GARC
containers, so the DS pipeline does not apply — this decoder is what unblocks
Hoenn (and later Kalos/Alola) 3D map extraction.

Design goal: expose the SAME duck-typed interface that
`render_platinum_maps._draw_model_triangles` already consumes from an
`nitro_g3d.Model`, so the existing rasterizer renders BCH triangles unchanged:

    model.up_scale                      -> float
    model.triangles()                   -> yields (mat_idx, [ (V,V,V), ... ])
    model.mat_texture   {mat_idx: str}  -> material -> texture name
    model.mat_palette   {mat_idx: str}  -> (BCH textures are self-paletted; "")
    model.mat_alpha     {mat_idx: 0..31}

    Vertex(x, y, z, s, t)               -> raw position + texel-normalized UV

and a Tex0-like object:

    tex.textures        (set/dict of names)
    tex.palettes        ({} — unused for BCH)
    tex.decode(name, _) -> (flat RGBA bytes, w, h)
    tex.default_palette_for(name) -> ""

Format references: SPICA (gdkchan) BCH.cs / PICA command decode, Ohana3DS.
Only the subset needed for static map geometry is implemented (no skeletal
animation, no per-bone skinning transforms — map base models are single-space).

NOTE: byte-level field offsets below are confirmed against the real Omega Ruby
extraction (a/0/3/9 GR containers → embedded BCH). See `render_oras_maps.py`.
"""
import struct
import sys


def u8(d, o):  return d[o]
def u16(d, o): return struct.unpack_from("<H", d, o)[0]
def u32(d, o): return struct.unpack_from("<I", d, o)[0]
def s32(d, o): return struct.unpack_from("<i", d, o)[0]
def f32(d, o): return struct.unpack_from("<f", d, o)[0]


def cstr(d, o):
    e = d.find(b"\0", o)
    return d[o:e].decode("ascii", "replace") if e >= 0 else d[o:].decode("ascii", "replace")


# --------------------------------------------------------------------------
# BCH header + relocation
# --------------------------------------------------------------------------
class BCH:
    """A parsed BCH container: header sections + relocation applied in-place so
    every stored pointer is an absolute file offset."""

    def __init__(self, data, base=0):
        if data[base:base + 4] != b"BCH\x00":
            raise ValueError("not a BCH container at 0x%x" % base)
        self.data = bytearray(data[base:])  # local copy; relocation edits it
        d = self.data
        self.backward = d[4]
        self.forward = d[5]
        self.version = u16(d, 6)
        # Section offsets (relative to BCH start) + lengths.
        self.main_off = u32(d, 0x08)
        self.str_off = u32(d, 0x0C)
        self.gpu_off = u32(d, 0x10)
        self.data_off = u32(d, 0x14)
        # dataExtended only exists in newer revisions (>= 0x21); guarded by
        # header length inferred from mainHeaderOffset.
        p = 0x18
        self.dataext_off = 0
        if self.main_off >= 0x2C:
            self.dataext_off = u32(d, p); p += 4
        self.reloc_off = u32(d, p); p += 4
        self.main_len = u32(d, p); p += 4
        self.str_len = u32(d, p); p += 4
        self.gpu_len = u32(d, p); p += 4
        self.data_len = u32(d, p); p += 4
        if self.main_off >= 0x2C:
            self.dataext_len = u32(d, p); p += 4
        else:
            self.dataext_len = 0
        self.reloc_len = u32(d, p); p += 4
        self._apply_relocations()

    def _section_base(self, flag):
        # Relocation entry flag (high nibble of the entry's top byte) selects
        # which section base to add. Mapping per SPICA BCH relocation decode.
        return {
            0x00: self.main_off,   # pointers inside main header -> main
            0x01: self.str_off,
            0x02: self.gpu_off,
            0x03: self.data_off,
            0x04: self.data_off,
            0x05: self.dataext_off,
            0x06: self.dataext_off,
        }.get(flag, self.main_off)

    def _apply_relocations(self):
        """Walk the relocation table; each 4-byte entry has a 25-bit word index
        (into the pointed section) and a flag selecting base + target section.
        We add the appropriate section base to the referenced pointer word so
        that afterwards every pointer we read is an absolute offset."""
        d = self.data
        o = self.reloc_off
        end = self.reloc_off + self.reloc_len
        while o < end:
            entry = u32(d, o); o += 4
            # low 25 bits = pointer position (in words) within a section;
            # bits 25..31 = flags (which section the pointer lives in + which
            # base to add). This split matches SPICA's PatchOffset decode.
            pos = (entry & 0x1FFFFFF) * 4
            flag = (entry >> 25) & 0x7F
            # Section the *pointer word itself* lives in (even flags → main-ish
            # tables, odd → data). SPICA distinguishes by flag value; here we
            # take the common convention: flags 0..1 → main header, others →
            # relative to the section chosen by _section_base.
            ptr_section = self.main_off if flag <= 1 else self.data_off
            addr = ptr_section + pos
            if addr + 4 > len(d):
                continue
            val = u32(d, addr)
            struct.pack_into("<I", d, addr, (val + self._section_base(flag)) & 0xFFFFFFFF)

    # ---- string table -------------------------------------------------
    def strings(self):
        """All ASCII names in the string table. VALIDATED against real ORAS
        a/0/3/9 member 0 → ['c102r0101_00_00','lambert1','test00_00_00', ...]
        (model name, material, texture)."""
        raw = self.data[self.str_off:self.str_off + self.str_len]
        return [s.decode("ascii", "replace") for s in raw.split(b"\0")
                if len(s) >= 2 and all(32 <= c < 127 for c in s)]

    # ---- content model table ------------------------------------------
    def content_dict(self):
        """The main header begins with the GfxObjects content header — a series
        of (patricia-dict pointer, entry count) pairs: [0]=Models, [1]=Materials,
        [2]=Shaders, [3]=Textures, [4]=LUTs, ... (SPICA GfxContentHeader).

        WIP: the models dict pointer resolves (pair0 → 1 model), but the
        relocation pass (`_apply_relocations`) is NOT yet byte-exact — some
        pointer words are mis-based, so downstream dict/mesh walking is unsafe
        until the SPICA relocation-flag decode is reproduced precisely. Do not
        rely on this for geometry yet; see assets_3d/hoenn/RECON.md."""
        raise NotImplementedError("relocation not yet byte-exact — see RECON.md")


if __name__ == "__main__":
    data = open(sys.argv[1], "rb").read()
    b = BCH(data)
    print("BCH v%04x main=0x%x str=0x%x gpu=0x%x data=0x%x reloc=0x%x/%d" % (
        b.version, b.main_off, b.str_off, b.gpu_off, b.data_off,
        b.reloc_off, b.reloc_len))
