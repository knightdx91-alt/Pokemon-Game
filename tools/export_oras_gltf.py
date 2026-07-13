#!/usr/bin/env python3
"""
export_oras_gltf.py — Export a decoded Pokémon Omega Ruby (3DS) map to a real
3D file: **glTF binary (.glb)** with geometry + UVs + embedded textures.

This is the actual "3D map" deliverable (not a flat top-down bake): the .glb
loads directly in three.js (GLTFLoader) — the same renderer `unleashed.html`
uses — and is viewable/orbitable from any angle, so terrain relief, building
height (once props are added) and tree volume are all real 3D.

Chain (all in bch.py): find_map_model → mesh_draws (draw→Texture0Name) → global
texture index (render_oras_maps.load_index) → decode_etc1 (ETC1/ETC1A4) → per
material a glTF primitive (POSITION + TEXCOORD_0 + indices) with a baseColor
texture (alphaMode MASK for ETC1A4). Y-up matches glTF.

Usage:
  python3 tools/export_oras_gltf.py 0006   # Littleroot -> assets_3d/hoenn/gltf/map_0006.glb
"""
import io
import json
import os
import struct
import sys

import numpy as np
from PIL import Image

import bch
import render_oras_maps as R

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                       "assets_3d", "hoenn", "gltf")


def _pad(b, align=4, fill=b"\x00"):
    r = len(b) % align
    return b + fill * (align - r) if r else b


def export(model_mem, index):
    d = open(os.path.join(R.MODEL_DIR, f"{model_mem}.bin"), "rb").read()
    off = struct.unpack_from("<I", d, 8)[0] & 0x7FFFFFFF
    model = bch.BCH(d, off)
    R._draw_triangles.res = R.TexResolver(index)
    meshes = list(R._draw_triangles(model))     # [(img_or_None, [ (x,y,z,u,v)*3 ])]

    bin_parts = []          # list of bytes, concatenated into the BIN chunk
    offset = [0]
    bufferViews, accessors, images, textures, materials, gltf_meshes, nodes = \
        [], [], [], [], [], [], []

    def add_view(data, target=None):
        data = _pad(data)
        bv = {"buffer": 0, "byteOffset": offset[0], "byteLength": len(data)}
        if target:
            bv["target"] = target
        bin_parts.append(data)
        offset[0] += len(data)
        bufferViews.append(bv)
        return len(bufferViews) - 1

    tex_cache = {}                     # id(img array) -> texture index

    def add_texture(im):
        img, w, h = im
        key = id(img)
        if key in tex_cache:
            return tex_cache[key]
        buf = io.BytesIO()
        Image.fromarray(img, "RGBA").save(buf, "PNG")
        png = buf.getvalue()
        vi = add_view(png)
        images.append({"bufferView": vi, "mimeType": "image/png"})
        textures.append({"source": len(images) - 1, "sampler": 0})
        tex_cache[key] = len(textures) - 1
        return tex_cache[key]

    for im, tris in meshes:
        if not tris:
            continue
        # de-duplicate vertices per mesh
        vmap = {}
        verts = []
        idx = []
        for t in tris:
            for v in t:
                k = v
                j = vmap.get(k)
                if j is None:
                    j = len(verts)
                    vmap[k] = j
                    verts.append(v)
                idx.append(j)
        pos = np.array([[v[0], v[1], v[2]] for v in verts], np.float32)
        uv = np.array([[v[3], v[4]] for v in verts], np.float32)
        ind = np.array(idx, np.uint32)

        pv = add_view(pos.tobytes(), 34962)
        accessors.append({"bufferView": pv, "componentType": 5126, "count": len(verts),
                          "type": "VEC3",
                          "min": pos.min(0).tolist(), "max": pos.max(0).tolist()})
        a_pos = len(accessors) - 1
        uvv = add_view(uv.tobytes(), 34962)
        accessors.append({"bufferView": uvv, "componentType": 5126,
                          "count": len(verts), "type": "VEC2"})
        a_uv = len(accessors) - 1
        iv = add_view(ind.tobytes(), 34963)
        accessors.append({"bufferView": iv, "componentType": 5125,
                          "count": len(ind), "type": "SCALAR"})
        a_idx = len(accessors) - 1

        mat = {"pbrMetallicRoughness": {"metallicFactor": 0, "roughnessFactor": 1},
               "doubleSided": True}
        if im is not None:
            ti = add_texture(im)
            mat["pbrMetallicRoughness"]["baseColorTexture"] = {"index": ti}
            mat["alphaMode"] = "MASK"
            mat["alphaCutoff"] = 0.4
        else:
            mat["pbrMetallicRoughness"]["baseColorFactor"] = [0.35, 0.7, 0.3, 1]
        materials.append(mat)
        gltf_meshes.append({"primitives": [{
            "attributes": {"POSITION": a_pos, "TEXCOORD_0": a_uv},
            "indices": a_idx, "material": len(materials) - 1}]})
        nodes.append({"mesh": len(gltf_meshes) - 1})

    if not gltf_meshes:
        return None

    bin_blob = _pad(b"".join(bin_parts))
    gltf = {
        "asset": {"version": "2.0", "generator": "export_oras_gltf"},
        "scene": 0,
        "scenes": [{"nodes": list(range(len(nodes)))}],
        "nodes": nodes,
        "meshes": gltf_meshes,
        "materials": materials,
        "textures": textures,
        "images": images,
        "samplers": [{"wrapS": 10497, "wrapT": 10497,
                      "magFilter": 9729, "minFilter": 9987}],
        "accessors": accessors,
        "bufferViews": bufferViews,
        "buffers": [{"byteLength": len(bin_blob)}],
    }
    json_blob = _pad(json.dumps(gltf, separators=(",", ":")).encode(), 4, b" ")

    out = io.BytesIO()
    total = 12 + 8 + len(json_blob) + 8 + len(bin_blob)
    out.write(b"glTF")
    out.write(struct.pack("<II", 2, total))
    out.write(struct.pack("<I", len(json_blob)))
    out.write(b"JSON")
    out.write(json_blob)
    out.write(struct.pack("<I", len(bin_blob)))
    out.write(b"BIN\x00")
    out.write(bin_blob)
    return out.getvalue()


def main(argv):
    index = R.load_index()
    os.makedirs(OUT_DIR, exist_ok=True)
    for mem in [a for a in argv if not a.startswith("--")] or ["0006"]:
        glb = export(mem, index)
        if glb is None:
            print(f"  {mem}: no geometry")
            continue
        out = os.path.join(OUT_DIR, f"map_{mem}.glb")
        open(out, "wb").write(glb)
        print(f"  {mem}: {len(glb)//1024} KB → {out}")


if __name__ == "__main__":
    main(sys.argv[1:])
