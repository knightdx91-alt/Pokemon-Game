#!/bin/bash
# Launch the PREBUILT Citra (skips the ~10-min from-source build).
#
# The binary at decomp/citra/prebuilt/citra is StonedEdge/citra-1 +
# citra1_build_fixes.patch + the live-control additions (ApLiveInput/ApLiveShot),
# stripped. It is a normal open-source emulator binary (NOT ROM bytes). All it
# needs at runtime is SDL2 + a software-GL X server, which this script apt-installs.
#
# Usage:
#   decomp/citra/prebuilt/run_citra.sh /path/to/ultramoon.3ds
# with the save already installed (see decomp/citra/saves/README.md) and env
# CITRA_AUTOPILOT=1 to enable the /tmp/autopilot.txt + live-control channels.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
BIN="$HERE/citra"

# One-time runtime deps (idempotent; fast if already installed).
if ! ldconfig -p | grep -q libSDL2-2.0; then
  apt-get update -qq
  apt-get install -y -qq libsdl2-2.0-0 xvfb libgl1-mesa-dri libglu1-mesa >/dev/null
fi

ROM="${1:?usage: run_citra.sh <rom.3ds>}"
exec env LIBGL_ALWAYS_SOFTWARE=1 xvfb-run -a "$BIN" "$ROM"
