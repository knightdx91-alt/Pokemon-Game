#!/usr/bin/env python3
"""
nitro_g3d.py — Parser/decoder for Nintendo DS G3D files (NSBMD models, NSBTX
textures) as used by Pokémon Platinum.

This module implements enough of the format (documented at
https://github.com/scurest/nsbmd_docs and GBATEK's DS 3D video section) to:

  * read the container / subfile structure of BMD0 / BTX0 files;
  * parse a TEX0 block into textures + palettes and decode every DS texture
    format (1–7) into RGBA;
  * parse an MDL0 model into meshes (vertex/UV geometry) + materials with their
    texture/palette pairings, by interpreting the NDS GPU command display lists.

It is deliberately dependency-light (only Pillow, and only for the CLI/preview).
Coordinates use the maths convention (column vectors, M*v).

Reference field layouts are taken verbatim from nsbmd_docs; offsets that the doc
marks "unknown" are validated at parse time rather than trusted blindly.
"""

import struct
import sys

# ---------------------------------------------------------------------------
# Fixed-point helpers
# ---------------------------------------------------------------------------
def s(v, bits):
    """Interpret v (already masked to `bits` bits) as a signed two's-complement."""
    if v & (1 << (bits - 1)):
        v -= (1 << bits)
    return v


def bgr555_to_rgba(color, alpha=255):
    r = (color & 0x1F)
    g = (color >> 5) & 0x1F
    b = (color >> 10) & 0x1F
    return (
        (r << 3) | (r >> 2),
        (g << 3) | (g >> 2),
        (b << 3) | (b >> 2),
        alpha,
    )


# ---------------------------------------------------------------------------
# Container / NameList
# ---------------------------------------------------------------------------
def read_container(data):
    """Return list of (stamp, absolute_offset) for each subfile in a G3D container."""
    stamp = data[0:4]
    bom = struct.unpack_from("<H", data, 4)[0]
    if bom != 0xFEFF:
        raise ValueError(f"bad BOM {bom:#x} (stamp {stamp!r})")
    num_sub = struct.unpack_from("<H", data, 14)[0]
    offs = struct.unpack_from(f"<{num_sub}I", data, 16)
    return [(data[o:o + 4], o) for o in offs]


def read_namelist(data, base, element_size):
    """
    Parse a NameList(T) at `base`. Returns (names, elem_offsets) where elem_offsets
    are absolute offsets to each element's raw bytes, and names are decoded strings.
    See nsbmd_docs "Common Idioms".
    """
    count = data[base + 1]
    # header(4) + UnknownHeader(8) + unknown u32[count] + elem_size u16 + data_sec u16
    unknown_arr = base + 4 + 8
    sizes_off = unknown_arr + count * 4
    stored_elem_size = struct.unpack_from("<H", data, sizes_off)[0]
    if stored_elem_size:
        element_size = stored_elem_size
    data_off = sizes_off + 4
    names_off = data_off + count * element_size
    elem_offsets = [data_off + i * element_size for i in range(count)]
    names = []
    for i in range(count):
        raw = data[names_off + i * 16: names_off + i * 16 + 16]
        names.append(raw.split(b"\x00")[0].decode("ascii", "replace"))
    return names, elem_offsets


# ---------------------------------------------------------------------------
# TEX0 — textures & palettes
# ---------------------------------------------------------------------------
class Tex0:
    def __init__(self, data, base):
        self.data = data
        self.base = base
        assert data[base:base + 4] == b"TEX0", "not a TEX0 block"

        # NB: this is the Platinum (version-1) TEX0 layout. It matches the
        # scurest/nsbmd_docs layout except for one extra u32 before the palette
        # fields, so palettes_off/block4_off sit at 0x34/0x38 (verified against
        # the actual texture/palette NameLists in the ROM data).
        block1_len_shr3 = struct.unpack_from("<H", data, base + 0x0C)[0]
        textures_off    = struct.unpack_from("<H", data, base + 0x0E)[0]
        self.block1_off = base + struct.unpack_from("<I", data, base + 0x14)[0]
        block2_len_shr3 = struct.unpack_from("<H", data, base + 0x18)[0]
        self.block2_off = base + struct.unpack_from("<I", data, base + 0x20)[0]
        self.block3_off = base + struct.unpack_from("<I", data, base + 0x24)[0]
        block4_len_shr3 = struct.unpack_from("<H", data, base + 0x30)[0]
        palettes_off    = struct.unpack_from("<I", data, base + 0x34)[0]
        self.block4_off = base + struct.unpack_from("<I", data, base + 0x38)[0]

        self.block1_len = block1_len_shr3 << 3
        self.block2_len = block2_len_shr3 << 3
        self.block4_len = block4_len_shr3 << 3

        # Texture list: element = {teximage_params u32, unknown u32}
        self.tex_names, tex_elems = read_namelist(data, base + textures_off, 8)
        self.textures = {}
        for name, eo in zip(self.tex_names, tex_elems):
            params = struct.unpack_from("<I", data, eo)[0]
            self.textures[name] = params

        # Palette list: element = {offset_shr_3 u16, unknown u16}
        self.pal_names, pal_elems = read_namelist(data, base + palettes_off, 4)
        self.palettes = {}
        for name, eo in zip(self.pal_names, pal_elems):
            off_shr3 = struct.unpack_from("<H", data, eo)[0]
            self.palettes[name] = self.block4_off + (off_shr3 << 3)

    # --- teximage_params decode ---
    @staticmethod
    def _params(p):
        return {
            "offset": (p & 0xFFFF) << 3,
            "w": 8 << ((p >> 20) & 0x7),
            "h": 8 << ((p >> 23) & 0x7),
            "format": (p >> 26) & 0x7,
            "color0": (p >> 29) & 0x1,
        }

    def texture_size(self, tex_name):
        p = self._params(self.textures[tex_name])
        return p["w"], p["h"]

    def _palette_color(self, pal_off, idx, alpha=255):
        c = struct.unpack_from("<H", self.data, pal_off + idx * 2)[0]
        return bgr555_to_rgba(c, alpha)

    def decode(self, tex_name, pal_name=None):
        """Decode a texture (optionally paired with a palette) to a flat RGBA list."""
        p = self._params(self.textures[tex_name])
        w, h, fmt = p["w"], p["h"], p["format"]
        tex_off = self.block1_off + p["offset"]
        color0_transparent = p["color0"] == 1
        pal_off = self.palettes.get(pal_name) if pal_name else None
        d = self.data
        out = [(0, 0, 0, 0)] * (w * h)

        if fmt == 1:  # A3I5 — 3-bit alpha, 5-bit index
            for i in range(w * h):
                b = d[tex_off + i]
                idx = b & 0x1F
                a3 = (b >> 5) & 0x7
                alpha = (a3 * 255 + 3) // 7
                out[i] = self._palette_color(pal_off, idx, alpha) if pal_off is not None else (idx*8, idx*8, idx*8, alpha)

        elif fmt == 2:  # 4-color palette, 2 bits/texel
            for i in range(w * h):
                b = d[tex_off + (i >> 2)]
                idx = (b >> ((i & 3) * 2)) & 0x3
                a = 0 if (color0_transparent and idx == 0) else 255
                out[i] = self._palette_color(pal_off, idx, a) if pal_off is not None else (idx*85, idx*85, idx*85, a)

        elif fmt == 3:  # 16-color palette, 4 bits/texel
            for i in range(w * h):
                b = d[tex_off + (i >> 1)]
                idx = (b & 0xF) if (i & 1) == 0 else (b >> 4)
                a = 0 if (color0_transparent and idx == 0) else 255
                out[i] = self._palette_color(pal_off, idx, a) if pal_off is not None else (idx*16, idx*16, idx*16, a)

        elif fmt == 4:  # 256-color palette, 8 bits/texel
            for i in range(w * h):
                idx = d[tex_off + i]
                a = 0 if (color0_transparent and idx == 0) else 255
                out[i] = self._palette_color(pal_off, idx, a) if pal_off is not None else (idx, idx, idx, a)

        elif fmt == 5:  # 4x4 block-compressed
            out = self._decode_compressed(p, pal_off)

        elif fmt == 6:  # A5I3 — 5-bit alpha, 3-bit index
            for i in range(w * h):
                b = d[tex_off + i]
                idx = b & 0x7
                a5 = (b >> 3) & 0x1F
                alpha = (a5 * 255 + 15) // 31
                out[i] = self._palette_color(pal_off, idx, alpha) if pal_off is not None else (idx*32, idx*32, idx*32, alpha)

        elif fmt == 7:  # direct color, 16 bits/texel (ABGR1555)
            for i in range(w * h):
                c = struct.unpack_from("<H", d, tex_off + i * 2)[0]
                a = 255 if (c & 0x8000) else 0
                out[i] = bgr555_to_rgba(c & 0x7FFF, a)

        return out, w, h

    def _decode_compressed(self, p, pal_off):
        """Texture format 5: 4x4-texel block compression (Block2 + Block3)."""
        w, h = p["w"], p["h"]
        d = self.data
        base2 = self.block2_off + p["offset"]
        base3 = self.block3_off + (p["offset"] >> 1)
        out = [(0, 0, 0, 0)] * (w * h)
        blocks_w = w // 4
        blocks_h = h // 4
        for by in range(blocks_h):
            for bx in range(blocks_w):
                blk = by * blocks_w + bx
                texels = struct.unpack_from("<I", d, base2 + blk * 4)[0]
                extra = struct.unpack_from("<H", d, base3 + blk * 2)[0]
                pal_base = (pal_off if pal_off is not None else self.block4_off) + (extra & 0x3FFF) * 4
                mode = (extra >> 14) & 0x3

                def col(i, alpha=255):
                    return bgr555_to_rgba(
                        struct.unpack_from("<H", d, pal_base + i * 2)[0], alpha)

                for ty in range(4):
                    for tx in range(4):
                        ti = ty * 4 + tx
                        val = (texels >> (ti * 2)) & 0x3
                        if mode == 0:
                            c = col(val) if val != 3 else (0, 0, 0, 0)
                        elif mode == 2:
                            c = col(val)
                        elif mode == 1:
                            if val == 0: c = col(0)
                            elif val == 1: c = col(1)
                            elif val == 2:
                                c0, c1 = col(0), col(1)
                                c = ((c0[0]+c1[0])//2, (c0[1]+c1[1])//2, (c0[2]+c1[2])//2, 255)
                            else: c = (0, 0, 0, 0)
                        else:  # mode 3
                            if val == 0: c = col(0)
                            elif val == 1: c = col(1)
                            elif val == 2:
                                c0, c1 = col(0), col(1)
                                c = ((c0[0]*5+c1[0]*3)//8, (c0[1]*5+c1[1]*3)//8, (c0[2]*5+c1[2]*3)//8, 255)
                            else:
                                c0, c1 = col(0), col(1)
                                c = ((c0[0]*3+c1[0]*5)//8, (c0[1]*3+c1[1]*5)//8, (c0[2]*3+c1[2]*5)//8, 255)
                        px = bx * 4 + tx
                        py = by * 4 + ty
                        out[py * w + px] = c
        return out

    def default_palette_for(self, tex_name):
        """Best-effort palette pairing: same name, else the only palette."""
        if tex_name in self.palettes:
            return tex_name
        if len(self.palettes) == 1:
            return next(iter(self.palettes))
        # try common suffix stripping (e.g. "grass_tex" ~ "grass_pl")
        for pn in self.pal_names:
            if pn.split("_")[0] == tex_name.split("_")[0]:
                return pn
        return next(iter(self.palettes), None)


def find_tex0(data):
    """Return a Tex0 for the first TEX0 subfile in a BTX0/BMD0 container, or None."""
    for stamp, off in read_container(data):
        if stamp == b"TEX0":
            return Tex0(data, off)
    return None


# ---------------------------------------------------------------------------
# MDL0 — models (geometry + materials)
# ---------------------------------------------------------------------------
# GPU geometry command parameter counts (only the ones that appear in Meshes).
_GEOM_PARAMS = {
    0x00: 0, 0x14: 1, 0x1B: 3, 0x20: 1, 0x21: 1, 0x22: 1,
    0x23: 2, 0x24: 1, 0x25: 1, 0x26: 1, 0x27: 1, 0x28: 1,
    0x40: 1, 0x41: 0,
}


class Vertex:
    __slots__ = ("x", "y", "z", "s", "t")

    def __init__(self, x, y, z, s, t):
        self.x, self.y, self.z, self.s, self.t = x, y, z, s, t


def decode_mesh(data, cmds_off, cmds_len):
    """
    Interpret a Mesh's GPU command blob into a list of triangles. Each triangle
    is a 3-tuple of Vertex(x, y, z, s, t) where (s, t) are raw texel coords.
    Matrix commands are ignored (map base models live in a single space); the
    caller fits the resulting XZ extent to the tile grid.
    """
    end = cmds_off + cmds_len
    p = cmds_off
    tris = []

    cur = [0.0, 0.0, 0.0]     # current vertex position
    st = [0.0, 0.0]           # current texcoord
    prim = None               # 0 tris, 1 quads, 2 tristrip, 3 quadstrip
    buf = []                  # accumulated vertices for the current primitive

    def emit_vertex():
        v = Vertex(cur[0], cur[1], cur[2], st[0], st[1])
        buf.append(v)
        _assemble(prim, buf, tris)

    while p < end:
        if p + 4 > end:
            break
        ops = struct.unpack_from("<I", data, p)[0]
        p += 4
        for k in range(4):
            op = (ops >> (k * 8)) & 0xFF
            nparams = _GEOM_PARAMS.get(op)
            if nparams is None:
                # Unknown opcode: cannot know its length — stop this mesh.
                return tris
            params = struct.unpack_from(f"<{nparams}I", data, p) if nparams else ()
            p += nparams * 4

            if op == 0x40:            # BEGIN_VTXS
                prim = params[0] & 0x3
                buf = []
            elif op == 0x41:          # END_VTXS
                pass
            elif op == 0x22:          # TEXCOORD (1.11.4 → texels)
                u = params[0]
                st[0] = s(u & 0xFFFF, 16) / 16.0
                st[1] = s((u >> 16) & 0xFFFF, 16) / 16.0
            elif op == 0x23:          # VTX_16
                a, b = params
                cur[0] = s(a & 0xFFFF, 16) / 4096.0
                cur[1] = s((a >> 16) & 0xFFFF, 16) / 4096.0
                cur[2] = s(b & 0xFFFF, 16) / 4096.0
                emit_vertex()
            elif op == 0x24:          # VTX_10 (1.3.6)
                u = params[0]
                cur[0] = s(u & 0x3FF, 10) / 64.0
                cur[1] = s((u >> 10) & 0x3FF, 10) / 64.0
                cur[2] = s((u >> 20) & 0x3FF, 10) / 64.0
                emit_vertex()
            elif op == 0x25:          # VTX_XY
                u = params[0]
                cur[0] = s(u & 0xFFFF, 16) / 4096.0
                cur[1] = s((u >> 16) & 0xFFFF, 16) / 4096.0
                emit_vertex()
            elif op == 0x26:          # VTX_XZ
                u = params[0]
                cur[0] = s(u & 0xFFFF, 16) / 4096.0
                cur[2] = s((u >> 16) & 0xFFFF, 16) / 4096.0
                emit_vertex()
            elif op == 0x27:          # VTX_YZ
                u = params[0]
                cur[1] = s(u & 0xFFFF, 16) / 4096.0
                cur[2] = s((u >> 16) & 0xFFFF, 16) / 4096.0
                emit_vertex()
            elif op == 0x28:          # VTX_DIFF: 10-bit signed deltas, added as
                u = params[0]         # the low fractional bits of 1.3.12 coords
                cur[0] += s(u & 0x3FF, 10) / 4096.0
                cur[1] += s((u >> 10) & 0x3FF, 10) / 4096.0
                cur[2] += s((u >> 20) & 0x3FF, 10) / 4096.0
                emit_vertex()
            # COLOR / NORMAL / MTX_* ignored for flat textured render.
    return tris


def _assemble(prim, buf, tris):
    """Emit triangles as vertices arrive, per primitive type."""
    n = len(buf)
    if prim == 0:                     # separate triangles
        if n % 3 == 0 and n >= 3:
            tris.append((buf[n-3], buf[n-2], buf[n-1]))
    elif prim == 1:                   # separate quads
        if n % 4 == 0 and n >= 4:
            a, b, c, d = buf[n-4], buf[n-3], buf[n-2], buf[n-1]
            tris.append((a, b, c))
            tris.append((a, c, d))
    elif prim == 2:                   # triangle strip
        if n >= 3:
            a, b, c = buf[n-3], buf[n-2], buf[n-1]
            if n % 2 == 1:
                tris.append((a, b, c))
            else:
                tris.append((b, a, c))
    elif prim == 3:                   # quad strip
        if n >= 4 and n % 2 == 0:
            a, b, c, d = buf[n-4], buf[n-3], buf[n-1], buf[n-2]
            tris.append((a, b, c))
            tris.append((a, c, d))


class Model:
    def __init__(self, data, base):
        self.data = data
        self.base = base
        u = lambda off: struct.unpack_from("<I", data, base + off)[0]
        self.render_cmds_off = base + u(0x04)
        self.materials_off = base + u(0x08)
        self.meshes_off = base + u(0x0C)
        self.num_bone_matrices = data[base + 0x17]
        self.num_materials = data[base + 0x18]
        self.num_meshes = data[base + 0x19]
        self.up_scale = struct.unpack_from("<i", data, base + 0x1C)[0] / 4096.0
        self.down_scale = struct.unpack_from("<i", data, base + 0x20)[0] / 4096.0

        self._parse_meshes()
        self._parse_materials()
        self._parse_render_cmds()

    def _parse_meshes(self):
        names, elems = read_namelist(self.data, self.meshes_off, 4)
        self.mesh_names = names
        self.meshes = []
        for eo in elems:
            mesh_off = self.meshes_off + struct.unpack_from("<I", self.data, eo)[0]
            cmds_off = mesh_off + struct.unpack_from("<I", self.data, mesh_off + 8)[0]
            cmds_len = struct.unpack_from("<I", self.data, mesh_off + 12)[0]
            self.meshes.append((cmds_off, cmds_len))

    def _parse_pairings(self, list_off):
        """
        Return dict material_index -> name from a Texture/PalettePairingList.
        Each MaterialIdxList.offset is relative to the MaterialList base
        (verified against the material-index arrays in the ROM data), not to the
        element as the nsbmd_docs wording suggests.
        """
        names, elems = read_namelist(self.data, list_off, 4)
        mapping = {}
        for name, eo in zip(names, elems):
            rel = struct.unpack_from("<H", self.data, eo)[0]
            count = self.data[eo + 2]
            arr = self.materials_off + rel
            for i in range(count):
                if arr + i < len(self.data):
                    mapping[self.data[arr + i]] = name
        return mapping

    def _parse_materials(self):
        base = self.materials_off
        tex_pair_off = base + struct.unpack_from("<H", self.data, base)[0]
        pal_pair_off = base + struct.unpack_from("<H", self.data, base + 2)[0]
        self.mat_names, mat_elems = read_namelist(self.data, base + 4, 4)
        self.mat_texture = self._parse_pairings(tex_pair_off)
        self.mat_palette = self._parse_pairings(pal_pair_off)

        # Per-material polygon alpha (bits 16-20 of polygon_attr, 0-31; 31 =
        # opaque). Translucent materials — building drop-shadows (h_kage/tshadow),
        # water, glass — must be alpha-blended, not painted opaque.
        self.mat_alpha = {}
        for i, eo in enumerate(mat_elems):
            mat_off = base + struct.unpack_from("<I", self.data, eo)[0]
            poly_attr = struct.unpack_from("<I", self.data, mat_off + 0x0C)[0]
            self.mat_alpha[i] = (poly_attr >> 16) & 0x1F

    def _parse_render_cmds(self):
        """Walk the render command list to get ordered (material, mesh) draws."""
        d = self.data
        p = self.render_cmds_off
        self.draws = []       # list of (material_idx, mesh_idx)
        cur_mat = 0
        # param counts keyed by low-5-bits operation
        for _ in range(4096):
            op = d[p]; p += 1
            low = op & 0x1F
            if low == 0x01:                 # end
                break
            elif low == 0x00:               # nop
                pass
            elif low == 0x04:               # bind material
                cur_mat = d[p]; p += 1
            elif low == 0x05:               # draw mesh
                self.draws.append((cur_mat, d[p])); p += 1
            elif low == 0x06:               # mult bone matrix
                n = 3 + (1 if op & 0x40 else 0) + (1 if op & 0x20 else 0)
                p += n
            elif low == 0x09:               # skinning eq (variable)
                p += 1
                nterms = d[p]; p += 1
                p += nterms * 3
            elif low in (0x0B, 0x2B):       # scale up/down
                pass
            elif low == 0x03:               # load matrix
                p += 1
            elif low in (0x02, 0x0C, 0x0D): # 2 params
                p += 2
            elif low in (0x07, 0x08):       # 1-2 params
                p += 2 if (low == 0x07 and op & 0x40) else 1
            else:
                p += 1

    def triangles(self):
        """
        Yield (material_idx, [triangles]) for each draw in render order. Positions
        are raw (unscaled) — apply `up_scale` at projection time. (Strips/quads
        share Vertex objects between triangles, so scaling here would compound.)
        """
        for mat_idx, mesh_idx in self.draws:
            if mesh_idx >= len(self.meshes):
                continue
            cmds_off, cmds_len = self.meshes[mesh_idx]
            yield mat_idx, decode_mesh(self.data, cmds_off, cmds_len)


def find_model(data, base=0):
    """Parse the first Model in a BMD0 container (data[base:] is the BMD0)."""
    for stamp, off in read_container(data[base:]):
        if stamp == b"MDL0":
            mdl = base + off
            # models NameList (at mdl+8) holds u32 offsets relative to the MDL0.
            _, elems = read_namelist(data, mdl + 8, 4)
            first = struct.unpack_from("<I", data, elems[0])[0]
            return Model(data, mdl + first)
    return None


# ---------------------------------------------------------------------------
# CLI: dump all textures in an NSBTX to a PNG atlas + individual PNGs
# ---------------------------------------------------------------------------
def _cli_dump(path, out_dir):
    import os
    from PIL import Image
    os.makedirs(out_dir, exist_ok=True)
    data = open(path, "rb").read()
    tex = find_tex0(data)
    if not tex:
        print("no TEX0 found")
        return
    print(f"{len(tex.tex_names)} textures, {len(tex.pal_names)} palettes")
    for name in tex.tex_names:
        pal = tex.default_palette_for(name)
        params = Tex0._params(tex.textures[name])
        try:
            pixels, w, h = tex.decode(name, pal)
        except Exception as e:
            print(f"  {name}: decode error {e}")
            continue
        img = Image.new("RGBA", (w, h))
        img.putdata(pixels)
        safe = name.replace("/", "_")
        img.save(os.path.join(out_dir, f"{safe}.png"))
        print(f"  {name}: {w}x{h} fmt{params['format']} pal={pal}")


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "dumptex":
        _cli_dump(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "tex_out")
    else:
        print("usage: python3 nitro_g3d.py dumptex <file.nsbtx> [out_dir]")
