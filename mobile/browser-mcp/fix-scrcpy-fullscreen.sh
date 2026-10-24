#!/usr/bin/env bash
# Source-only X11 geometry repair: never scale the iframe and desync touches.
set -Eeuo pipefail
out="$(git rev-parse --show-toplevel)/mobile-test-results/android-browser-mcp"
mkdir -p "$out"
run(){ docker exec -e DISPLAY=:0 emulator-scrcpy-1 sh -lc "$1"; }
read -r fbw fbh < <(run 'xdotool getdisplaygeometry' | tr '\r' ' ')
echo "HITEL_XVFB_FRAMEBUFFER=$fbw x $fbh"
wids="$(run "xdotool search --class scrcpy 2>/dev/null || xdotool search --name 'android-emulator' 2>/dev/null" || true)"
if [[ -z "$wids" ]];then echo HITEL_SCRCPY_NO_X11_WINDOW; exit 1;fi
wid="$(printf '%s\n' "$wids" | head -1 | tr -d '\r')"
before="$(run "xdotool getwindowgeometry --shell '$wid'")"
echo "$before" | tee "$out/window-before.txt"
width="$(printf '%s\n' "$before" | sed -n 's/^WIDTH=//p' | head -1)"
height="$(printf '%s\n' "$before" | sed -n 's/^HEIGHT=//p' | head -1)"
[[ "$width" =~ ^[0-9]+$ && "$height" =~ ^[0-9]+$ ]] || { echo HITEL_INVALID_WINDOW_GEOMETRY;exit 1; }
echo "HITEL_SCRCPY_BEFORE=$width x $height"
if (( width*100 >= fbw*85 && height*100 >= fbh*85 ));then
  echo HITEL_X11_WINDOW_ALREADY_FILLS_FRAME
  # The visual video occupies 47%-50% despite a full X11 window. Opt in
  # to force SDL fullscreen and rebuild its GL viewport for an A/B test.
  if [[ "$(printenv HITEL_FORCE_FULLSCREEN || echo 0)" != "1" ]];then exit 0;fi
  echo HITEL_FORCED_RENDERER_FULLSCREEN_DIAGNOSTIC
fi
# Linux scrcpy Alt+f toggles native SDL fullscreen. noVNC pointer coordinates
# remain correct; unlike a transform/zoom on the webpage.
echo HITEL_TOGGLE_SCRCPY_FULLSCREEN
run "xdotool windowfocus '$wid' || true; xdotool key --window '$wid' alt+f" || true
sleep 2
after="$(run "xdotool getwindowgeometry --shell '$wid'")"
echo "$after" | tee "$out/window-after.txt"
aw="$(printf '%s\n' "$after" | sed -n 's/^WIDTH=//p' | head -1)"
ah="$(printf '%s\n' "$after" | sed -n 's/^HEIGHT=//p' | head -1)"
echo "HITEL_SCRCPY_AFTER=$aw x $ah"
if [[ "$aw" =~ ^[0-9]+$ && "$ah" =~ ^[0-9]+$ ]] &&
   (( aw*100 >= fbw*85 && ah*100 >= fbh*85 )); then
  echo HITEL_SCRCPY_FULLSCREEN_X11_FIXED
else
  echo HITEL_SCRCPY_FULLSCREEN_X11_NOT_FIXED
  exit 2
fi
