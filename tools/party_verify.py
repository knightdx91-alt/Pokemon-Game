#!/usr/bin/env python3
"""
party_verify.py — the EXACT-UI verification loop (per CLAUDE.md: reconstruct →
pixel-diff against a real captured frame → fix → repeat until diff == 0).

Ground truth: a phone screenshot of the real Platinum screen pushed to the
`traces` branch by emulator-debug.js (🔬 → Frame → Shot→Repo). It stacks the two
DS screens (each 256x192) at the phone width; this tool splits them back to
native 256x192 so a reconstruction can be diffed pixel-for-pixel.

Usage:
  party_verify.py split <frame.png> <out_top.png> <out_bot.png>
  party_verify.py diff  <reconstruction.png> <reference_256x192.png>
"""
import sys
from PIL import Image
import numpy as np


def split(frame_path, out_top, out_bot):
    im = Image.open(frame_path).convert('RGB')
    W, H = im.size
    sh = round(W * 192 / 256)                 # a DS screen at this width
    im.crop((0, 0, W, sh)).resize((256, 192), Image.LANCZOS).save(out_top)
    im.crop((0, sh, W, 2 * sh)).resize((256, 192), Image.LANCZOS).save(out_bot)
    print(f"{frame_path} {W}x{H} -> {out_top} / {out_bot} (screen h={sh})")


def diff(recon_path, ref_path):
    a = np.asarray(Image.open(recon_path).convert('RGB').resize((256, 192)), int)
    b = np.asarray(Image.open(ref_path).convert('RGB').resize((256, 192)), int)
    d = np.abs(a - b)
    mean = d.mean()
    pct = (d.max(2) > 30).mean() * 100
    print(f"mean abs diff {mean:.2f}/255 | {pct:.1f}% of pixels differ >30")
    return mean, pct


if __name__ == "__main__":
    if sys.argv[1] == "split":
        split(sys.argv[2], sys.argv[3], sys.argv[4])
    elif sys.argv[1] == "diff":
        diff(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
