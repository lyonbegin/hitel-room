#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export DISPLAY=:99
out="mobile-test-results/android-live"
mkdir -p "$out"
[[ "$(adb shell getprop ro.build.version.release | tr -d '\r')" == 11 ]] || { echo WRONG_ANDROID_VERSION; exit 21; }
[[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == 1 ]] || { echo ANDROID_NOT_BOOTED; exit 22; }
sudo apt-get update -qq
sudo apt-get install -y -qq --no-install-recommends xvfb x11vnc websockify scrcpy matchbox-window-manager xdotool > /dev/null
Xvfb :99 -screen 0 600x1130x24 -nolisten tcp >"$out/xvfb.log" 2>&1 &
sleep 2
matchbox-window-manager -use_titlebar no >"$out/window-manager.log" 2>&1 &
sleep 2
x11vnc -display :99 -rfbport 5900 -localhost -forever -shared -nopw -noxdamage -defer 3 >"$out/x11vnc.log" 2>&1 &
websockify 127.0.0.1:6080 127.0.0.1:5900 >"$out/websockify.log" 2>&1 &
sleep 2
scrcpy --serial emulator-5554 --max-size 1080 --window-borderless --stay-awake \
  --window-x 0 --window-y 0 --window-width 600 --window-height 1130 \
  >"$out/scrcpy.log" 2>&1 &
SCRCPY_PID=$!
for n in {1..20}; do
  WID=$(xdotool search --class scrcpy 2>/dev/null | head -n1 || true)
  if [[ -n "$WID" ]];then xdotool windowfocus "$WID" || true;break;fi
  sleep 1
done
kill -0 "$SCRCPY_PID" || { echo SCRCPY_FAILED;cat "$out/scrcpy.log";exit 25; }
adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk >"$out/apk-install.log"
adb shell am start -n app.hitel.nativebridge/.MainActivity \
  --es hitel_url 'https://hitel-communication-web-production.up.railway.app/sdk-lab/device?side=android' >"$out/native-launch.log"
adb exec-out screencap -p >"$out/first-real-screen.png"
echo ACTUAL_ANDROID11_SCRCPY_RUNNING
# Real VNC RFB handshake and Android pixel buffer, no simulated frames.
if [[ "${HITEL_KVM_SMOKE_ONLY:-0}" == 1 ]]; then
  python3 - <<'PY'
import socket
with socket.create_connection(('127.0.0.1',5900),timeout=10) as client:
    banner=client.recv(12)
    assert banner.startswith(b'RFB 003.'),repr(banner)
    print('NATIVE_VNC_RFB_HANDSHAKE_PASS',banner.decode().strip())
PY
  test -s "$out/first-real-screen.png"
  echo 'ANDROID11_SCRCPY_NOVNC_SMOKE_PASS'
  exit 0
fi
if [[ "${HITEL_KVM_STANDALONE:-0}" == 1 ]]; then
  echo "ANDROID_11_LIVE_VM_CREATED"
  date -u +"VM_START_UTC=%Y-%m-%dT%H:%M:%SZ"
  adb shell getprop ro.build.version.release
  adb shell getprop sys.boot_completed
  # One-off KVM VM: remain available for a maximum of 10 minutes after
  # session request, independently from this ChatGPT/browser connection.
  deadline="${HITEL_VM_DEADLINE_EPOCH:-0}"
  if [[ "$deadline" -le 0 ]]; then deadline=$(($(date +%s)+600)); fi
  while [[ $(date +%s) -lt "$deadline" ]]; do
    if ! kill -0 "$SCRCPY_PID" 2>/dev/null; then echo "SCRCPY_EXITED";break;fi
    sleep 3
  done
  adb exec-out screencap -p > "$out/final-real-screen.png" || true
  echo "ANDROID_11_LIVE_VM_SHUTDOWN"
  exit 0
fi
node lab-kvm/runner-bridge.mjs
