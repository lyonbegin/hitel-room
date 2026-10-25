#!/usr/bin/env bash
# HITEL GitHub-KVM input transport override.
# The upstream vendor scrcpy-display files stay byte-for-byte unchanged.
set -uo pipefail

EMU="${EMU:-android-emulator-1:5555}"
XW="${XVFB_W:-720}"
XH="${XVFB_H:-1520}"
MAXSIZE="${MAX_SIZE:-1080}"
export DISPLAY=:0

echo "[hitel-scrcpy-input] EMU=$EMU Xvfb=${XW}x${XH} max-size=$MAXSIZE"
echo "[hitel-scrcpy-input] x11vnc=nothreads,pointer_mode=1,nowireframe,always_inject"

Xvfb :0 -screen 0 "${XW}x${XH}x24" -nolisten tcp &
sleep 2

matchbox-window-manager -use_titlebar no >/var/log/mwm.log 2>&1 &
sleep 1

# Correctness-first pointer path for Android touch gestures. The upstream
# container uses -threads plus desktop window/scroll heuristics. Those are
# unnecessary for one borderless scrcpy window and can coalesce held-button
# pointer motion. Keep the same VNC/noVNC stack but inject every coordinate.
x11vnc -display :0 -forever -shared -nopw -rfbport 5900 \
       -noxdamage -defer 1 -wait 5 \
       -nothreads -pointer_mode 1 -nowireframe -nowirecopyrect \
       -noscrollcopyrect -always_inject -debug_pointer \
       -bg -o /var/log/x11vnc.log

websockify --web /opt/novnc 6080 localhost:5900 >/var/log/websockify.log 2>&1 &

while true; do
  adb connect "$EMU" >/dev/null 2>&1
  adb -s "$EMU" wait-for-device >/dev/null 2>&1
  echo "[hitel-scrcpy-input] starting scrcpy for $EMU"
  scrcpy --serial "$EMU" \
         --window-x 0 --window-y 0 --window-width "$XW" --window-height "$XH" \
         --window-borderless --stay-awake \
         --max-size "$MAXSIZE" --max-fps 60 --render-driver=opengl \
         --window-title "$EMU" >/var/log/scrcpy.log 2>&1 &
  SPID=$!
  for i in 1 2 3 4 5 6 7 8; do
    WID=$(xdotool search --class scrcpy 2>/dev/null | head -1)
    if [ -n "$WID" ]; then
      xdotool windowsize "$WID" "$XW" "$XH" >/dev/null 2>&1 || true
      xdotool windowmove "$WID" 0 0 >/dev/null 2>&1 || true
      xdotool windowfocus "$WID" >/dev/null 2>&1 || true
      break
    fi
    sleep 1
  done
  wait "$SPID"
  echo "[hitel-scrcpy-input] scrcpy exited; reconnecting in 3s"
  sleep 3
done
