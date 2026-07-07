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
# ETC1 texture decode (PICA format 0xC) — 3DS variant
# --------------------------------------------------------------------------
_ETC1_MOD = [[2, 8, -2, -8], [5, 17, -5, -17], [9, 29, -9, -29],
             [13, 42, -13, -42], [18, 60, -18, -60], [24, 80, -24, -80],
             [33, 106, -33, -106], [47, 183, -47, -183]]


def _clamp8(v):
    return 0 if v < 0 else 255 if v > 255 else v


def _etc1_block(bs):
    """Decode one 8-byte ETC1 block (bytes already in big-endian/spec order) to
    16 (r,g,b) tuples, column-major (pixel p -> x=p//4, y=p%4)."""
    b0, b1, b2, b3, b4, b5, b6, b7 = bs
    diff = (b3 >> 1) & 1
    flip = b3 & 1

    def sd(base5, d3):
        return base5 + (d3 - 8 if d3 >= 4 else d3)

    if diff:
        r1 = (b0 >> 3) & 0x1F; g1 = (b1 >> 3) & 0x1F; bl1 = (b2 >> 3) & 0x1F
        r2 = sd(r1, b0 & 7); g2 = sd(g1, b1 & 7); bl2 = sd(bl1, b2 & 7)
        c1 = ((r1 << 3) | (r1 >> 2), (g1 << 3) | (g1 >> 2), (bl1 << 3) | (bl1 >> 2))
        c2 = ((r2 << 3) | (r2 >> 2), (g2 << 3) | (g2 >> 2), (bl2 << 3) | (bl2 >> 2))
    else:
        c1 = (((b0 >> 4) & 0xF) * 17, ((b1 >> 4) & 0xF) * 17, ((b2 >> 4) & 0xF) * 17)
        c2 = ((b0 & 0xF) * 17, (b1 & 0xF) * 17, (b2 & 0xF) * 17)
    t1 = (b3 >> 5) & 7; t2 = (b3 >> 2) & 7
    idx = (b4 << 24) | (b5 << 16) | (b6 << 8) | b7
    out = [None] * 16
    for p in range(16):
        x, y = p // 4, p % 4
        sub = 0 if ((not flip and x < 2) or (flip and y < 2)) else 1
        base = c1 if sub == 0 else c2
        tbl = t1 if sub == 0 else t2
        m = _ETC1_MOD[tbl][(((idx >> (p + 16)) & 1) << 1) | ((idx >> p) & 1)]
        out[p] = (_clamp8(base[0] + m), _clamp8(base[1] + m), _clamp8(base[2] + m))
    return out


def decode_etc1(data, off, w, h):
    """Decode a 3DS ETC1 texture (PICA format 0xC) at `data[off:]` of size w x h
    into a flat RGB bytes buffer (w*h*3). 3DS stores the texture 8x8-tiled with
    4x4 ETC1 blocks in Morton order per tile, and each 8-byte block byte-REVERSED
    vs the ETC1 spec. VERIFIED on ORAS a/1/5/2/0890.bch (map r131 'gake_sea':
    the sea-cliff texture decodes to recognizable rock-over-sea pixels)."""
    buf = bytearray(w * h * 3)
    bi = 0
    order = ((0, 0), (1, 0), (0, 1), (1, 1))   # 4x4-block Morton order in a tile
    for ty in range(0, h, 8):
        for tx in range(0, w, 8):
            for bx, by in order:
                blk = data[off + bi * 8: off + bi * 8 + 8][::-1]
                bi += 1
                if len(blk) < 8:
                    continue
                cols = _etc1_block(blk)
                for p in range(16):
                    X = tx + bx * 4 + (p // 4)
                    Y = ty + by * 4 + (p % 4)
                    if X < w and Y < h:
                        j = (Y * w + X) * 3
                        buf[j], buf[j + 1], buf[j + 2] = cols[p]
    return bytes(buf)


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

    def _section_base(self, section):
        """Base offset of an H3D section id (SPICA H3DRelocator.GetAddress).

        0 Contents(main) · 1 Strings · 2/3 Commands(gpu) · 4/5/6/8 RawData(data) ·
        7 RawDataIndex16 (data, high bit is just an index-type marker) ·
        9-13 RawExt(dataext). Returns the byte base to add / read from."""
        if section == 0:
            return self.main_off
        if section == 1:
            return self.str_off
        if section in (2, 3):
            return self.gpu_off
        if section in (4, 5, 6, 7, 8):
            return self.data_off
        return self.dataext_off

    def _apply_relocations(self):
        """Walk the relocation table (SPICA H3DRelocator). Each 4-byte entry:
          bits 0-24  = PtrAddress  (word index of the pointer, within Source)
          bits 25-28 = Target      (section whose base is ADDED to the value)
          bits 29-31 = Source      (section the pointer WORD lives in)
        The pointer word is at section_base(Source) + PtrAddress*4; its stored
        value gets section_base(Target) added. This makes ALL flags exact (not
        just flag-0) — the earlier main-only assumption mis-based every pointer
        whose Source != main (materials/textures/vertex/index)."""
        d = self.data
        o = self.reloc_off
        end = self.reloc_off + self.reloc_len
        while o < end:
            entry = u32(d, o); o += 4
            ptr_word = entry & 0x1FFFFFF
            target = (entry >> 25) & 0xF
            source = (entry >> 29) & 0x7
            addr = self._section_base(source) + ptr_word * 4
            if addr + 4 > len(d):
                continue
            val = u32(d, addr)
            struct.pack_into("<I", d, addr,
                             (val + self._section_base(target)) & 0xFFFFFFFF)

    # ---- H3DDict node reader ------------------------------------------
    def read_dict(self, ptr):
        """Read an H3DDict at absolute offset `ptr` → ordered list of
        (name, refbit, node_index). Node = 0xc bytes: u16 LeftNodeIndex,
        u16 RightNodeIndex, u32 NameOffset (string-table-RELATIVE), u32
        ReferenceBit. Node 0 is the root (refbit 0xffffffff, name skipped in
        SPICA). We read sequentially from the root; the parallel Values array
        (H3DTexture/H3DMaterial) is indexed by this same node order.

        VERIFIED on ORAS a/1/5/2/0890.bch texture dict (root @0x308): yields
        the map's texture names mapr131_chip_soil2 / _gake_basic1 /
        _gake_basic_side / mapr13P_gake_sea_b1 in Values order."""
        out = []
        d = self.data
        i = 0
        o = ptr
        while o + 0xC <= len(d):
            rel = u32(d, o + 4)
            rb = u32(d, o + 8)
            name = None
            if 0 < rel < self.str_len:
                e = d.find(b"\0", self.str_off + rel)
                s = d[self.str_off + rel:e]
                if s and all(32 <= c < 127 for c in s):
                    name = s.decode("ascii", "replace")
            # stop when we leave the node run: a non-root node with no name and
            # an implausible refbit (past the string table) ends the dict.
            if i > 0 and name is None and rb >= self.str_off:
                break
            out.append((name, rb, i))
            i += 1
            o += 0xC
            if i > 4096:
                break
        return out

    def object_names(self, prefix=None):
        """Convenience: scan the main header for H3DDict node runs and return
        the distinct valid object names (optionally filtered by `prefix`).
        Used to list a BCH's texture/material/model names without resolving the
        exact per-dict header offsets."""
        d = self.data
        names = []
        seen = set()
        o = self.main_off
        end = self.main_off + self.main_len
        while o + 0xC <= end:
            rel = u32(d, o + 4)
            if 0 < rel < self.str_len:
                e = d.find(b"\0", self.str_off + rel)
                s = d[self.str_off + rel:e]
                if 2 <= len(s) <= 40 and all(32 <= c < 127 for c in s):
                    nm = s.decode("ascii")
                    if nm not in seen and (prefix is None or nm.startswith(prefix)):
                        seen.add(nm)
                        names.append(nm)
            o += 4
        return names

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
        """String-table-relative offset of the map-code model name, or None.
        Map codes: c##r####/c1##/r###/d###/t### + `_NN_NN`, and the overworld
        `world##_NN_NN` cells (e.g. 'c09r1002_00_00', 'r119_03_03',
        'world13_07_02'). Names in BCH are string-table-*relative* offsets."""
        import re
        reg = bytes(self.data[self.str_off:self.str_off + self.str_len])
        m = re.search(rb'[a-z]+\d+[a-z]?\d*_\d+_\d+', reg)
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

    # ---- PICA200 draw calls (verified on ORAS member 0818) -------------
    def pica_draw_calls(self):
        """Scan the GPU command section for per-mesh draw calls, returning a
        list of dicts {index_addr, count, vbuf_off, stride}.

        Method (validated on real ORAS a/0/3/9 member 0818 = 17 meshes): the
        per-mesh PICA command buffers write, in order, the vertex-array config
        (reg 0x200 burst) then the draw (reg 0x227 = index-buffer offset,
        reg 0x228 = index count, reg 0x22f = draw-elements). A linear command
        walk from gpu_off desyncs on interleaved non-command data, so we scan
        raw words for the reg-0x228 command header (0x000f0228), read the count
        (the word before it) and the index offset (reg 0x227, two words before),
        then search back <=0x400 bytes for the reg-0x200 burst to get the
        vertex-buffer offset (reg 0x203) and stride ((reg 0x205 >> 16) & 0xff).

        `index_addr` and `vbuf_off` are ABSOLUTE BCH offsets — the relocation
        (SPICA-exact, all flags) has already added the data-section base to the
        reg 0x227/0x203 words in the command stream, so map_triangles() reads
        them directly (no data_off add). u16 indices. VERIFIED: mesh0 →
        index@0xdd9f8 count 1200 stride 36, vertex0.x == 123.68. Meshes whose
        0x227 is not immediately before 0x228 (array draws) come back with
        index_addr=None and are skipped by triangles()."""
        d = self.data
        g0, g1 = self.gpu_off, self.gpu_off + self.gpu_len
        draws = []
        o = g0
        while o + 8 <= g1:
            if u32(d, o + 4) == 0x000F0228:            # reg 0x228, mask 0xf
                count = u32(d, o)
                index_addr = (u32(d, o - 8) & 0x7FFFFFFF) if o >= g0 + 8 and \
                    u32(d, o - 4) == 0x000F0227 else None
                vbuf_off = stride = 0
                for q in range(o, max(g0, o - 0x400), -4):
                    hv = u32(d, q + 4)
                    if (hv & 0xFFFF) == 0x200 and (hv >> 31) & 1:
                        extra = (hv >> 20) & 0x7FF
                        regs = {}
                        r, p = 0x200, q + 8
                        regs[0x200] = u32(d, q)
                        for _ in range(extra):
                            r += 1
                            regs[r] = u32(d, p)
                            p += 4
                        vbuf_off = regs.get(0x203, 0)
                        stride = (regs.get(0x205, 0) >> 16) & 0xFF
                        break
                draws.append({"index_addr": index_addr, "count": count,
                              "vbuf_off": vbuf_off, "stride": stride})
            o += 4
        return draws

    def materials(self):
        """Ordered material records from the model's material table
        (`find_map_model().mesh_table` — despite the name this is the MATERIALS
        table, stride 0x2c for ORAS BCH version>=0x21). Layout from Ohana3DS:
          +0x00 MaterialParamsOffset · +0x10 TextureCommandsOffset ·
          +0x14 TextureCommandsWordCount · +0x18 MaterialMapperOffset ·
          +0x1c Texture0Name · +0x20 Texture1Name · +0x24 Texture2Name ·
          +0x28 material Name  (all string-table-relative).
        Returns list of dicts {tex0, tex1, tex2, name, texture} where `texture`
        is the resolved primary texture name (tex0, or tex1 when tex0 is
        'projection_dummy'). VERIFIED on ORAS c105 (member 0154): mat8.tex0=
        'chip_kusa' (ground grass), mat14='pokecen_01', mat0='c105_hashi01'."""
        m = self.find_map_model()
        if not m:
            return []
        mt, mc = m["mesh_table"], m["mesh_count"]
        d = self.data

        def s(o):
            rel = u32(d, o)
            if not (0 < rel < self.str_len):
                return None
            e = d.find(b"\0", self.str_off + rel)
            v = d[self.str_off + rel:e]
            return v.decode("ascii", "replace") if v and all(32 <= c < 127 for c in v) else None

        out = []
        for e in range(mc):
            base = mt + e * 0x2C
            tex0, tex1, tex2 = s(base + 0x1C), s(base + 0x20), s(base + 0x24)
            name = s(base + 0x28)
            primary = tex0
            if primary in (None, "projection_dummy"):
                primary = tex1 or tex2 or tex0
            out.append({"tex0": tex0, "tex1": tex1, "tex2": tex2,
                        "name": name, "texture": primary})
        return out

    def mesh_names(self):
        """Ordered per-mesh object/material names from the mesh table
        (`find_map_model().mesh_table`, entry stride 0x2c, name at +0x1c,
        string-table-relative). VERIFIED on ORAS c105 (member 0154): 21 names
        incl. `pokecen00`/`pc_mado` (Pokémon Center), `c105_house1_a`,
        `c105_hashi01` (bridge), `chip_kusa` (grass) — so a town's contents are
        readable from its mesh names (used to identify maps + bind textures)."""
        m = self.find_map_model()
        if not m:
            return []
        mt, mc = m["mesh_table"], m["mesh_count"]
        out = []
        for e in range(mc):
            rel = u32(self.data, mt + e * 0x2C + 0x1C)
            name = None
            if 0 < rel < self.str_len:
                s = self.data[self.str_off + rel:self.data.find(b"\0", self.str_off + rel)]
                if s and all(32 <= c < 127 for c in s):
                    name = s.decode("ascii", "replace")
            out.append(name)
        return out

    def mesh_draws(self):
        """Pair each mesh with its draw call BY ORDER → list of
        {name, index_addr, count, vbuf_off, stride}. The mesh table and the GPU
        draw calls are emitted in the same order and in equal number (VERIFIED
        on ORAS c105: 21 meshes == 21 draws), so mesh[i] ↔ draw[i]. This gives
        each drawn triangle group its mesh NAME — the authoritative pairing the
        heuristic lacked, and the hook for name/material → texture binding."""
        names = self.mesh_names()
        mats = self.materials()
        draws = self.pica_draw_calls()
        out = []
        for i, dc in enumerate(draws):
            d = dict(dc)
            d["name"] = names[i] if i < len(names) else None
            d["texture"] = mats[i]["texture"] if i < len(mats) else None
            out.append(d)
        return out

    def map_triangles(self):
        """Yield (x, y, z, u, v) vertices grouped 3-per-triangle for the map
        terrain. Positions are raw model units; u,v are the two floats after the
        position+normal (offset +0x18 for the 36-byte format). Meshes without a
        resolvable index buffer or with stride < 0x18 are skipped. Reuses the
        `find_map_model`-confirmed data section. VERIFIED to yield coherent
        terrain (see pica_draw_calls)."""
        import math
        d = self.data
        for dc in self.pica_draw_calls():
            if dc["index_addr"] is None or dc["stride"] < 0x18:
                continue
            stride = dc["stride"]
            vbo = dc["vbuf_off"]                     # already absolute (relocated)
            ib = dc["index_addr"]                    # already absolute (relocated)
            uvo = 0x18 if stride >= 0x20 else 0x0c   # after pos(+normal)
            if max(vbo, ib) >= len(d) or stride == 0:
                continue
            # Per-TRIANGLE validation. Some 0x228 draws get a mismatched 0x227
            # (my heuristic VAO pairing — the SOBJ decode would make this exact),
            # so a mesh's vertex buffer can contain interspersed garbage floats.
            # Map geometry lives within a few hundred model units, so drop any
            # triangle whose vertices are non-finite or out of range (BOUND),
            # rather than gating whole meshes on their first few vertices.
            BOUND = 8192.0
            tri = []
            for i in range(dc["count"]):
                vi = u16(d, ib + i * 2)
                o = vbo + vi * stride
                if o + uvo + 8 > len(d):
                    tri = []
                    break
                v = (f32(d, o), f32(d, o + 4), f32(d, o + 8),
                     f32(d, o + uvo), f32(d, o + uvo + 4))
                tri.append(v)
                if len(tri) == 3:
                    if all(math.isfinite(c) and abs(c) < BOUND
                           for t in tri for c in t[:3]):
                        yield tri
                    tri = []

    # ---- named texture table (a/1/5/2 map-texture BCHs) ---------------
    def texture_table(self):
        """Resolve each H3DTexture to its NAME + image params → dict
        {name: {addr, width, height, fmt}} (addr absolute, post-reloc).

        Per Ohana3DS the texture record is: `+0x00` texUnit0CommandsOffset
        (→ the PICA block that writes reg 0x082 size / 0x085 addr / 0x08e fmt),
        `+0x1c` textureName (string). We find records by a valid name at +0x1c
        whose +0x00 points into the GPU section, then read the params from the
        referenced command block. VERIFIED on ORAS a/1/5/2/0890.bch → chip_gake01
        →0x7b80, chip_gake_sea→0x9b80, … Names are the SAME base names the model
        materials reference (no map-prefix), so model.materials()[i]['texture']
        keys straight into this table."""
        d = self.data
        go, ge = self.gpu_off, self.gpu_off + self.gpu_len
        table = {}
        o = self.main_off
        end = self.main_off + self.main_len
        while o + 0x20 <= end:
            c0 = u32(d, o)
            rel = u32(d, o + 0x1C)
            name = None
            if 0 < rel < self.str_len:
                e = d.find(b"\0", self.str_off + rel)
                s = d[self.str_off + rel:e]
                if s and all(32 <= c < 127 for c in s):
                    name = s.decode("ascii", "replace")
            if go <= c0 < ge and name and not name.startswith("$"):
                addr = size = fmt = None
                p = c0
                for _ in range(48):
                    if p + 8 > ge:
                        break
                    reg = u32(d, p + 4) & 0xFFFF
                    v = u32(d, p)
                    if reg == 0x085:
                        addr = v & 0x7FFFFFFF
                    elif reg == 0x082:
                        size = v
                    elif reg == 0x08E:
                        fmt = v & 0xF
                    elif reg == 0x022F or reg == 0x0080:
                        break
                    p += 8
                if addr and size and name not in table:
                    table[name] = {"addr": addr, "width": size & 0xFFFF,
                                   "height": (size >> 16) & 0xFFFF, "fmt": fmt}
            o += 4
        return table

    # ---- PICA200 texture units (for a/1/5/2 map-texture BCHs) ----------
    def pica_textures(self):
        """Scan the GPU section for texture-unit setups and return a list of
        {addr, width, height, fmt}. `addr` is an ABSOLUTE BCH offset (the
        relocation already added the data-section base to the reg 0x085 word).
        PICA regs: 0x082 = tex0 size ((h<<16)|w), 0x085 = tex0 address,
        0x08e = tex0 format (0xC = ETC1). VERIFIED on ORAS a/1/5/2/0890.bch:
        128x128 ETC1 units at absolute 0x3b80, 0x5b80, … (data_off + 0, 0x2000,
        …; each 128x128 ETC1 = 0x2000 bytes)."""
        d = self.data
        g0, g1 = self.gpu_off, self.gpu_off + self.gpu_len
        size = addr = fmt = None
        out = []
        o = g0
        while o + 8 <= g1:
            reg = u32(d, o + 4) & 0xFFFF
            v = u32(d, o)
            if reg == 0x082:
                size = v
            elif reg == 0x085:
                addr = v
            elif reg == 0x08E:
                fmt = v & 0xF
                if size and addr:
                    out.append({"addr": addr, "width": size & 0xFFFF,
                                "height": (size >> 16) & 0xFFFF, "fmt": fmt})
                    size = addr = None
            o += 4
        return out


if __name__ == "__main__":
    data = open(sys.argv[1], "rb").read()
    b = BCH(data)
    print("BCH v%04x main=0x%x str=0x%x gpu=0x%x data=0x%x reloc=0x%x/%d" % (
        b.version, b.main_off, b.str_off, b.gpu_off, b.data_off,
        b.reloc_off, b.reloc_len))
