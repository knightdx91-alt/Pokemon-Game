# DS Firmware for DraStic Multiplayer

DS local wireless needs the console firmware's **RF/baseband calibration** and
**MAC address** — the values a real DS's ARM7 wifi driver uploads to the RF2958
chip during init. DraStic HLE-boots and never needed this, so it doesn't ship
it. Our transplanted melonDS `Wifi` code reads this data exactly like melonDS
does, so we supply a real firmware to it directly (DraStic keeps HLE-booting the
game as usual — the firmware is used only by the injected wireless subsystem).

## The firmware we use

**`firmware/DS_lite_X2B-W-20051130_1616.bin`** — retail **World DS Lite**, 256 KB.

| Field | Value |
|---|---|
| Header id (@0x08) | `MACh` (genuine) |
| Build | 2005-11-30 16:16, v5 (Magenta menu) |
| MAC (@0x36) | `00:09:BF:05:A3:D4` (Nintendo OUI) |
| Enabled channels (@0x3C) | `0x3FFE` (ch 1–13) |
| RF type (@0x40) | `0x02` (RF2958) |
| Wifi cfg length (@0x2C) | `0x138` (312 bytes — correct) |
| Wifi cfg CRC16 (@0x2A) | `0x1488` — **matches computed** ✅ |

The CRC-16 (poly `0xA001`) over the config block validates — this is the same
integrity check the DS hardware performs, so the calibration is genuine and
intact.

## Why this one (survey of the whole set)

The source page lists 14 official DS/DS Lite dumps. **11 of the 14 are
privacy-scrubbed** — MAC and the entire wifi-calibration block wiped to `0xFF`
(these are useless for wireless). Only three carry intact, CRC-valid config:

| File | Model | MAC | Verdict |
|---|---|---|---|
| **DS_lite_X2B-W-20051130_1616.bin** | **Retail World DS Lite** | `00:09:BF:05:A3:D4` | ✅ **chosen** |
| ISNE_lite-W-20060220_2059.bin | IS-NITRO dev-unit Lite | `00:17:AB:63:3A:E3` | intact, but dev firmware |
| ISNE_phat-W-20060220_2059.bin | IS-NITRO dev-unit Phat | `00:09:BF:08:20:EF` | intact, but dev firmware |

The two ISNE images are **IS-NITRO-EMULATOR developer/capture-unit** firmwares —
they validate but aren't what retail games expect. The `X2B` retail DS Lite dump
is the correct, most representative choice.

The first firmware supplied during investigation
(`DS_lite-W-20060308_1119.bin`) is one of the scrubbed 11 — **do not use it.**

## Notes / caveats

- Both linking instances must agree on wireless config; using the same real
  firmware on both ends is the clean way to guarantee that (distinct MACs would
  need to be assigned per instance — the config is otherwise identical across
  units of a model, since RF/BB calibration is not per-unit personal data).
- A matching real **BIOS** (`bios7`/`bios9`) is *not* required for this path —
  DraStic keeps HLE-booting; only the wireless subsystem consumes the firmware.
- Verify anytime with `analysis/analyze_drastic.py` is not for firmware; the
  firmware checks are inline in the RE session notes / can be re-derived from the
  offsets in the table above.
