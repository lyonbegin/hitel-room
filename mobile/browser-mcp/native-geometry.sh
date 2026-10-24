#!/usr/bin/env bash
# Inspect actual scrcpy/X11 framebuffer geometry from the ORIGINAL containers.
# Does not alter Android images, scrcpy or the 53 upstream files.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
OUT="$ROOT/mobile-test-results/android-browser-mcp"
mkdir -p "$OUT"
{
  echo "=== ANDROID WM PHYSICAL RESOLUTION ==="
  docker exec android-emulator-1 adb shell wm size 2>&1 || true
  docker exec android-emulator-1 adb shell wm density 2>&1 || true
  echo "=== ORIGINAL Xvfb / DISPLAY ==="
  docker exec -e DISPLAY=:0 emulator-scrcpy-1 sh -c 'xdotool getdisplaygeometry; xrandr -q; xwininfo -root -tree' 2>&1 || true
  echo "=== SCRCPY WINDOW GEOMETRIES ==="
  docker exec -e DISPLAY=:0 emulator-scrcpy-1 sh -c 'for id in $(xdotool search --name "scrcpy|android-emulator" 2>/dev/null);do xdotool getwindowname "$id"; xdotool getwindowgeometry --shell "$id"; done' 2>&1 || true
  echo "=== SCRCPY PROCESS ==="
  docker exec emulator-scrcpy-1 sh -c 'ps aux | grep -E "scrcpy|x11vnc|Xvfb" | grep -v grep' 2>&1 || true
  echo "=== SCRCPY RENDER OUTPUT ==="
  docker exec emulator-scrcpy-1 sh -c 'tail -n 65 /var/log/scrcpy.log; tail -n 18 /var/log/x11vnc.log' 2>&1 || true
} | tee "$OUT/native-geometry.txt"
echo "NATIVE_GEOMETRY_DIAGNOSTICS_SAVED"
