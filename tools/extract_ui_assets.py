"""
Extract FireRed UI assets (window frame, fonts) into web-ready RGBA PNGs + JSON.
Usage: python3 tools/extract_ui_assets.py
Output: data/ui/window/*.png, data/ui/font/*.png, data/ui/font/*.json

Everything is derived from the real pokefirered graphics + text.c width tables,
so on-screen menus match the game pixel-for-pixel.
"""
import json
import os
import re

from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FR = os.path.join(REPO, "source", "pokefirered")
OUT = os.path.join(REPO, "data", "ui")

# Menu text colors (FireRed standard: dark-gray text, light-gray shadow on white)
INK = (96, 96, 96, 255)
SHADOW = (208, 208, 200, 255)


def _load_indexed(path):
    img = Image.open(path)
    assert img.mode == "P", f"{path} not indexed"
    px = list(img.getdata())
    return img.width, img.height, px


# ------------------------------------------------------------------ window frame
def extract_window_frame():
    """std.png is a 24x24 (3x3 tile) nine-slice. Apply stdpal_0, index 0 -> transparent."""
    path = os.path.join(FR, "graphics", "text_window", "std.png")
    src = Image.open(path).convert("P")
    pal_path = os.path.join(FR, "graphics", "text_window", "stdpal_0.pal")
    colors = _read_jasc_pal(pal_path)

    w, h = src.size
    px = list(src.getdata())
    out = Image.new("RGBA", (w, h))
    op = []
    for idx in px:
        if idx == 0:
            op.append((0, 0, 0, 0))          # window interior / transparent
        else:
            r, g, b = colors[idx]
            op.append((r, g, b, 255))
    out.putdata(op)

    dst_dir = os.path.join(OUT, "window")
    os.makedirs(dst_dir, exist_ok=True)
    out.save(os.path.join(dst_dir, "std.png"))
    print(f"[window] std.png -> data/ui/window/std.png ({w}x{h})")


def _read_jasc_pal(path):
    with open(path) as f:
        lines = [l.strip() for l in f if l.strip()]
    # header: JASC-PAL / 0100 / <count>
    colors = []
    for line in lines[3:]:
        parts = line.split()
        if len(parts) >= 3:
            colors.append((int(parts[0]), int(parts[1]), int(parts[2])))
    return colors


# ------------------------------------------------------------------ font widths
def _parse_width_table(symbol):
    text = open(os.path.join(FR, "src", "text.c")).read()
    m = re.search(symbol + r"\[\]\s*=\s*\{([^}]*)\}", text, re.S)
    if not m:
        raise RuntimeError(f"width table {symbol} not found")
    nums = re.findall(r"\d+", m.group(1))
    return [int(n) for n in nums]


def _parse_charmap():
    """Map python str char -> glyph byte (cell index in the font sheet)."""
    cmap = {}
    for line in open(os.path.join(FR, "charmap.txt")):
        m = re.match(r"\s*'(.)'\s*=\s*([0-9A-Fa-f]{2})\b", line)
        if m:
            cmap[m.group(1)] = int(m.group(2), 16)
    return cmap


def extract_font(name, sheet_rel, width_symbol):
    """Recolor the glyph sheet to menu ink/shadow and emit a per-char metrics JSON."""
    sheet_path = os.path.join(FR, "graphics", "fonts", sheet_rel)
    src = Image.open(sheet_path).convert("P")
    w, h = src.size
    px = list(src.getdata())

    out = Image.new("RGBA", (w, h))
    op = []
    for idx in px:
        if idx == 1:      # main ink
            op.append(INK)
        elif idx == 2:    # shadow
            op.append(SHADOW)
        else:             # 0 backdrop / 3 unused -> transparent
            op.append((0, 0, 0, 0))
    out.putdata(op)

    dst_dir = os.path.join(OUT, "font")
    os.makedirs(dst_dir, exist_ok=True)
    out.save(os.path.join(dst_dir, f"{name}.png"))

    widths = _parse_width_table(width_symbol)
    cmap = _parse_charmap()
    cell = 16
    cols = w // cell
    glyphs = {}
    for ch, byte in cmap.items():
        gx = (byte % cols) * cell
        gy = (byte // cols) * cell
        adv = widths[byte] if byte < len(widths) else 6
        glyphs[ch] = {"x": gx, "y": gy, "w": adv}
    glyphs[" "] = {"x": 0, "y": 0, "w": 3}  # explicit space advance

    meta = {"sheet": f"{name}.png", "cell": cell, "lineHeight": 16, "glyphs": glyphs}
    with open(os.path.join(dst_dir, f"{name}.json"), "w") as f:
        json.dump(meta, f)
    print(f"[font] {name}: {len(glyphs)} glyphs -> data/ui/font/{name}.png|.json ({w}x{h})")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    extract_window_frame()
    extract_font("normal", "latin_normal.png", "sFontNormalLatinGlyphWidths")
    extract_font("small", "latin_small.png", "sFontSmallLatinGlyphWidths")
    print("Done.")
