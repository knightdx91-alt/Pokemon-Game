#!/usr/bin/env python3
"""Generate the pixel-exact battle-UI asset pack from the pokeemerald-platinum
binaries.

Source: https://github.com/sinnoh-remakes/pokeemerald-platinum
        graphics/battle_interface/*.png  (4bpp indexed, palette baked in the PNG)

The decomp PNGs already carry the correct GBA palette, so we only need to crop
the meaningful regions, split the sprite atlases, and re-emit clean RGBA PNGs
(plus a meta.json describing slice sizes + bar fill colours) into
  src/assets/battle/ui/

Run:  python3 tools/gen_battle_ui_assets.py
Needs: pip install pillow ; network access to raw.githubusercontent.com
"""
import io, json, os, struct, sys, urllib.request

from PIL import Image

REPO = "sinnoh-remakes/pokeemerald-platinum"
RAW = f"https://raw.githubusercontent.com/{REPO}/master/graphics/battle_interface"
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "battle", "ui")

NEEDED = [
    "healthbox_singles_player.png",
    "healthbox_singles_opponent.png",
    "hpbar.png",
    "expbar.png",
    "status.png",
    "textbox.png",
]


def fetch(name):
    """Fetch a battle_interface PNG, return it as an RGBA Image."""
    url = f"{RAW}/{name}"
    req = urllib.request.Request(url, headers={"User-Agent": "pokemon-game-tools"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return Image.open(io.BytesIO(data)).convert("RGBA")


def bbox_nonblack(im):
    """Bounding box of pixels that are not the black background (0,0,0)."""
    px = im.load()
    minx = miny = 10**9
    maxx = maxy = -1
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and (r or g or b):
                minx, miny = min(minx, x), min(miny, y)
                maxx, maxy = max(maxx, x), max(maxy, y)
    if maxx < 0:
        return (0, 0, im.width, im.height)
    return (minx, miny, maxx + 1, maxy + 1)


def transparent_black(im):
    """Make the (0,0,0) background transparent."""
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if r == 0 and g == 0 and b == 0:
                px[x, y] = (0, 0, 0, 0)
    return im


def bar_fill_strip(hpbar):
    """Extract one column of the green HP-bar fill (its vertical shading) and
    derive the yellow/red variants by hue-swap — exactly what the GBA palette
    swap does at runtime. Returns dict of name -> list[ (r,g,b,a) ] columns."""
    px = hpbar.load()
    # A fully-filled column of the green bar (x=32: outline/shadow/white/green/
    # light-green/white/shadow/outline).
    col = []
    sx = 32
    for y in range(hpbar.height):
        col.append(px[sx, y])
    # Trim transparent/black top+bottom to the fill band.
    band = [(y, c) for y, c in enumerate(col) if c[3] and (c[0] or c[1] or c[2])]
    if band:
        ys = [y for y, _ in band]
        col = col[min(ys): max(ys) + 1]

    # Only the two green tones are swapped by the GBA palette; the white
    # highlight and dark outline rows are shared across all three ramps.
    GREEN_MAIN = (90, 213, 131)
    GREEN_LITE = (115, 255, 172)
    SWAP = {
        "yellow": {GREEN_MAIN: (222, 214, 0), GREEN_LITE: (255, 255, 90)},
        "red":    {GREEN_MAIN: (214, 74, 0),  GREEN_LITE: (255, 120, 66)},
    }

    def recolor(pixels, mode):
        out = []
        for (r, g, b, a) in pixels:
            if a == 0:
                out.append((0, 0, 0, 0)); continue
            if mode == "green":
                out.append((r, g, b, a))
            else:
                out.append((*SWAP[mode].get((r, g, b), (r, g, b)), a))
        return out

    return {
        "green": recolor(col, "green"),
        "yellow": recolor(col, "yellow"),
        "red": recolor(col, "red"),
    }


def save_strip(pixels, path):
    im = Image.new("RGBA", (1, len(pixels)))
    im.putdata(pixels)
    im.save(path)


def fetch_bin(name):
    url = f"{RAW}/{name}"
    req = urllib.request.Request(url, headers={"User-Agent": "pokemon-game-tools"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def battle_windows(textbox, mapbin):
    """Assemble the battle textbox tilemap and extract the three bottom-bar
    window frames: message (full teal), action-select (teal prompt + white
    command box), move-select (white move list + white type/PP box).
    Returns dict name -> RGBA Image (240x48), plus a meta dict of splits."""
    ents = struct.unpack(f"<{len(mapbin)//2}H", mapbin)
    MW, MH = 32, len(ents) // 32
    canvas = Image.new("RGBA", (MW * 8, MH * 8), (0, 0, 0, 0))
    for i, e in enumerate(ents):
        tile = e & 0x3FF
        tx, ty = (tile % 16) * 8, (tile // 16) * 8
        if ty + 8 > textbox.height:
            continue
        t = textbox.crop((tx, ty, tx + 8, ty + 8))
        if (e >> 10) & 1: t = t.transpose(Image.FLIP_LEFT_RIGHT)
        if (e >> 11) & 1: t = t.transpose(Image.FLIP_TOP_BOTTOM)
        canvas.paste(t, ((i % MW) * 8, (i // MW) * 8))
    canvas = transparent_black(canvas)
    # Detect the filled 48px row bands (the three window layouts).
    px = canvas.load()
    def filled(y):
        return any(px[x, y][3] for x in range(canvas.width))
    bands, y = [], 0
    while y < canvas.height:
        if filled(y):
            s = y
            while y < canvas.height and filled(y): y += 1
            bands.append((s, y))
        else:
            y += 1
    names = ["msg_frame", "action_frame", "move_frame"]
    out = {}
    for name, (s, e) in zip(names, bands):
        out[name] = canvas.crop((0, s, 240, e))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    src = {n: fetch(n) for n in NEEDED}
    meta = {}

    # --- Healthbox frames: crop to the visible frame, keep black transparent ---
    for key, fname in (("player", "healthbox_singles_player.png"),
                       ("opponent", "healthbox_singles_opponent.png")):
        im = src[fname]
        box = bbox_nonblack(im)
        crop = transparent_black(im.crop(box))
        crop.save(os.path.join(OUT, f"hb_{key}.png"))
        meta[f"hb_{key}"] = {"w": crop.width, "h": crop.height,
                             "ox": box[0], "oy": box[1]}

    # --- "HP" label glyph (salmon) from the bar sheet ---
    hp_label = transparent_black(src["hpbar.png"].crop((8, 0, 22, 8)))
    hp_label.save(os.path.join(OUT, "hp_label.png"))
    meta["hp_label"] = {"w": hp_label.width, "h": hp_label.height}

    # --- HP bar fill strips (green/yellow/red), 1px wide, tiled horizontally ---
    strips = bar_fill_strip(src["hpbar.png"])
    for name, cols in strips.items():
        save_strip(cols, os.path.join(OUT, f"hpfill_{name}.png"))
    meta["hpfill"] = {"h": len(strips["green"])}

    # --- EXP bar fill (blue): the 3-row bar band from expbar.png (shadow /
    # bright-blue / bright-blue), sampled from a filled column past the label. ---
    exp = src["expbar.png"]
    epx = exp.load()
    ecol = None
    for x in range(exp.width):
        col = [epx[x, y] for y in range(exp.height)]
        blue = [c for c in col if c[2] > c[0] + 30 and c[2] > 150]
        if blue and col[0] != (222, 213, 180, 255):  # skip the "EXP" label columns
            band = [c for c in col if c[3] and not (c[0] == 0 and c[1] == 0 and c[2] == 0)]
            ecol = band
            break
    if not ecol:
        ecol = [(82, 106, 98, 255), (65, 205, 255, 255), (65, 205, 255, 255)]
    save_strip(ecol, os.path.join(OUT, "expfill.png"))
    meta["expfill"] = {"h": len(ecol)}

    # --- Status pills: 6 stacked 24x8 icons -> a strip we can slice by row ---
    st = transparent_black(src["status.png"].copy())
    # The status sheet also has a cream (#FFFFDE) surround behind the pills.
    spx = st.load()
    for yy in range(st.height):
        for xx in range(st.width):
            if spx[xx, yy] == (255, 255, 222, 255):
                spx[xx, yy] = (0, 0, 0, 0)
    st.save(os.path.join(OUT, "status.png"))
    meta["status"] = {"w": 24, "h": 8,
                      "order": ["psn", "par", "slp", "frz", "brn", "frb"]}

    # --- Battle bottom-bar window frames (message / action / move) ---
    wins = battle_windows(src["textbox.png"], fetch_bin("textbox_map.bin"))
    for name, im in wins.items():
        im.save(os.path.join(OUT, name + ".png"))
    meta["windows"] = {
        # internal splits (px) measured from the assembled frames
        "action_prompt_w": 120,   # teal prompt box width; command box to its right
        "move_list_w": 155,       # move-list box width; type/PP box to its right
        "frame_h": 48,
    }

    with open(os.path.join(OUT, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)

    print("wrote battle UI pack to", os.path.relpath(OUT))
    for k, v in meta.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
