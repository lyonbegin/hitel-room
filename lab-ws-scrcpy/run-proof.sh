#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(pwd)"
UPSTREAM="$ROOT/.cache/hitel-ws-scrcpy"
OUT="$ROOT/mobile-test-results/ws-scrcpy"
mkdir -p "$OUT"
[[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == "1" ]] || { echo ANDROID11_NOT_BOOTED; exit 21; }
[[ "$(adb shell getprop ro.build.version.release | tr -d '\r')" == "11" ]] || { echo ANDROID11_VERSION_MISMATCH; exit 22; }
# Ensure pixels show an actual Android page with visible content.
adb shell am start -a android.settings.SETTINGS >/dev/null 2>&1 || true
(
  cd "$UPSTREAM/dist"
  export WS_SCRCPY_CONFIG="$UPSTREAM/hitel.yaml"
  exec node index.js
) >"$OUT/server.log" 2>&1 &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
  adb shell pkill -f com.genymobile.scrcpy.Server >/dev/null 2>&1 || true
}
trap cleanup EXIT
for n in $(seq 1 65); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo WS_SCRCPY_SERVER_EXITED
    tail -n 120 "$OUT/server.log"
    exit 30
  fi
  if curl -fsS --max-time 3 -o "$OUT/server-index.html" http://127.0.0.1:8000/ &&
     curl -fsS --max-time 3 -o "$OUT/bundle.js" http://127.0.0.1:8000/bundle.js; then break; fi
  sleep 1
done
test -s "$OUT/bundle.js" || { echo WS_SCRCPY_CLIENT_UNAVAILABLE; tail -n 100 "$OUT/server.log"; exit 31; }
echo WS_SCRCPY_HTTP_AND_CLIENT_PASS
node lab-ws-scrcpy/proof.mjs
python3 lab-ws-scrcpy/browser-proof.py
echo WS_SCRCPY_REAL_ANDROID11_NO_VNC_ALL_PASS
