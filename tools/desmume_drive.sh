#!/usr/bin/env bash
# Drive Pokémon (DS) in desmume-cli headless (Xvfb) and screenshot real menus,
# to visually compare against the Unleashed UI reimplementation.
#
# Usage: tools/desmume_drive.sh <rom.nds> <out_prefix> "<key script>"
#   key script = space-separated tokens sent via xdotool with 0.35s spacing:
#     u d l r  = D-pad (Up/Down/Left/Right = arrow keys)
#     a b x y  = face buttons (desmume default: a=x-key b=z-key ...)
#     s = Start(Enter)  e = Select(Backspace)  .N = sleep N seconds  shot = screenshot
# A battery save (.dsv) placed next to the ROM (same basename) is auto-loaded.
set -u
ROM="$1"; OUT="$2"; SCRIPT="${3:-}"
export DISPLAY=:99 PATH="$PATH:/usr/games"
pgrep Xvfb >/dev/null || (Xvfb :99 -screen 0 1024x768x24 >/tmp/xvfb.log 2>&1 &)
sleep 1
# desmume default keyboard map (SDL): arrows=Dpad, x=A, z=B, s=X, a=Y, Enter=Start, Backspace=Select
declare -A K=( [u]=Up [d]=Down [l]=Left [r]=Right [a]=x [b]=z [x]=s [y]=a [s]=Return [e]=BackSpace )
( desmume-cli "$ROM" >/tmp/desmume.log 2>&1 & echo $! >/tmp/desmume.pid )
sleep 8
win=$(xdotool search --name desmume | head -1 || true)
i=0
for tok in $SCRIPT; do
  case "$tok" in
    .*) sleep "${tok#.}";;
    shot) import -window root "${OUT}_${i}.png" 2>/dev/null; i=$((i+1));;
    *) key="${K[$tok]:-}"; [ -n "$key" ] && { [ -n "$win" ] && xdotool key --window "$win" "$key" || xdotool key "$key"; }; sleep 0.35;;
  esac
done
import -window root "${OUT}_final.png" 2>/dev/null
kill "$(cat /tmp/desmume.pid)" 2>/dev/null
echo "shots: ${OUT}_*.png"
