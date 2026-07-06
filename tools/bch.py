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

    def _value_base(self, flag):
        """Section base ADDED to the pointer word's stored value.

        VERIFIED (flag 0): the word at main_off+pos*4 stores a main-relative
        offset; adding main_off yields the absolute target. Proven on real ORAS
        member 0 — word@0x44 = 0xcc, +main(0x44) = 0x110 = the Models dict.

        HYPOTHESES (flags 1-3, rarer): 1 → string table (name pointers),
        2 → data section (vertex/texture buffers), 3 → gpu command section.
        These still need per-flag byte-exact confirmation (see RECON.md); the
        rare high-flag entries (0x26/0x28/0x2e) are not yet mapped."""
        return {
            0: self.main_off,
            1: self.str_off,
            2: self.data_off,
            3: self.gpu_off,
        }.get(flag, self.main_off)

    def _apply_relocations(self):
        """Walk the relocation table. Each 4-byte entry: low 25 bits = pointer
        word index (relative to main header), high 7 bits = flag selecting the
        base to add to the stored value. Afterwards, flag-0 pointers are exact
        absolute offsets; flags 1-3 are best-effort (see _value_base)."""
        d = self.data
        o = self.reloc_off
        end = self.reloc_off + self.reloc_len
        while o < end:
            entry = u32(d, o); o += 4
            pos = (entry & 0x1FFFFFF) * 4
            flag = (entry >> 25) & 0x7F
            addr = self.main_off + pos          # pointer word lives in main region
            if addr + 4 > len(d):
                continue
            val = u32(d, addr)
            struct.pack_into("<I", d, addr, (val + self._value_base(flag)) & 0xFFFFFFFF)

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

        WIP: pair0 (Models, count 1) is readable, but the flag!=0 relocation is
        NOT byte-exact — the material/shader/texture pointers (pairs 1+) are
        mis-based, so a blind patricia walk from those is unsafe. For the Models
        path use `find_map_model()`, which recovers the descriptor directly and
        VERIFIES it via the model name. See assets_3d/hoenn/RECON.md."""
        raise NotImplementedError("flag!=0 relocation not byte-exact — see RECON.md")

    # ---- map model descriptor (VERIFIED path, flag-0 only) -------------
    def _map_code_offset(self):
        """String-table-relative offset of the map-code model name (e.g.
        'c09r1002_00_00'), or None. Map codes look like c<digits>r<digits>_NN_NN.
        Names in BCH are stored as string-table-*relative* offsets."""
        import re
        reg = bytes(self.data[self.str_off:self.str_off + self.str_len])
        m = re.search(rb'c\d+r\d+_\d+_\d+', reg)
        return m.start() if m else None

    def find_map_model(self):
        """Locate the terrain model descriptor WITHOUT relying on the (not yet
        byte-exact) flag!=0 relocation.

        Method (validated on real ORAS a/0/3/9 member 0818 = map 'c09r1002_00_00'):
        the Models patricia dict stores, for each model, a node whose first two
        words are `(u32 nameOffset, u32 dataOffset)` — nameOffset is the
        string-table-relative offset of the model name, dataOffset is the
        absolute offset of the model descriptor. We find the map-code string,
        scan the main header for a word equal to its str-relative offset (the
        node's nameOffset), read the next word as the descriptor offset, and
        confirm it via the mesh table: descriptor +0x34 = mesh-table pointer
        (in-file), +0x38 = mesh count (small). The name-string match makes this
        unambiguous — a bare offset can collide, but a *node* has the descriptor
        immediately after and passes the mesh-table check (0818: node@0x10c →
        desc 0x2cc → mesh table 0x8c8, 17 meshes; uniquely).

        Returns dict {name, descriptor, matrix (3x4 floats), mesh_table,
        mesh_count} or None. Only covers c##r####-coded field maps for now;
        D-/other-named members need the generic Models-dict walk (see RECON.md).
        """
        name_rel = self._map_code_offset()
        if name_rel is None:
            return None
        name = cstr(self.data, self.str_off + name_rel)
        d = self.data
        mo, ml = self.main_off, self.main_len
        for o in range(mo, mo + ml - 8, 4):
            if u32(d, o) != name_rel:
                continue
            desc = u32(d, o + 4)                     # node: name, dataOffset, ...
            if not (mo <= desc < len(d) - 0xc0):
                continue
            mesh_table = u32(d, desc + 0x34)
            mesh_count = u32(d, desc + 0x38)
            if not (mo <= mesh_table < len(d)) or not (0 < mesh_count < 1024):
                continue
            matrix = [[f32(d, desc + (r * 4 + c) * 4) for c in range(4)]
                      for r in range(3)]
            return {"name": name, "descriptor": desc, "matrix": matrix,
                    "mesh_table": mesh_table, "mesh_count": mesh_count}
        return None


if __name__ == "__main__":
    data = open(sys.argv[1], "rb").read()
    b = BCH(data)
    print("BCH v%04x main=0x%x str=0x%x gpu=0x%x data=0x%x reloc=0x%x/%d" % (
        b.version, b.main_off, b.str_off, b.gpu_off, b.data_off,
        b.reloc_off, b.reloc_len))
