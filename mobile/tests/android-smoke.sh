#!/usr/bin/env bash
set -euo pipefail
out="mobile-test-results/android"
mkdir -p "$out"
# Route HTTPS CONNECT through the GitHub host: Android guest DNS is unreliable.
adb reverse tcp:18888 tcp:18888
adb reverse --list | tee "$out/adb-reverse.txt"
adb shell settings put global http_proxy 127.0.0.1:18888
adb shell settings get global http_proxy | tee "$out/proxy-setting.txt"
# ADB reverse maps guest loopback to the host proxy and does not depend on guest DNS.
adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
adb shell am start -n app.hitel.nativebridge/.MainActivity \
  --es hitel_url "${HITEL_LAB_URL:-https://hitel-communication-web-production.up.railway.app/sdk-lab/device?side=android}" \
  --es hitel_ticket "${HITEL_LAB_TICKET:-}" \
  --es hitel_call_token "${HITEL_CALL_TOKEN:-}" | tee "$out/launch.txt"
sleep 35
python3 mobile/tests/comm-ci.py probe android
adb shell screencap -p /sdcard/hitel-screen.png
adb pull /sdcard/hitel-screen.png "$out/screen.png"
adb shell uiautomator dump /sdcard/hitel-window.xml || true
adb pull /sdcard/hitel-window.xml "$out/window.xml" || true
adb logcat -d -s HITEL_E2E:I '*:S' > "$out/events.log"
adb logcat -d -t 500 > "$out/logcat-tail.log"
cat "$out/events.log"
grep -q "APP_STARTED" "$out/events.log"
grep -q "WEB_LOADED" "$out/events.log"
grep -q "BRIDGE_PING_OK" "$out/events.log"
grep -q "LAB_SOCKET_CONNECTED" "$out/events.log"
grep -q "CAPABILITIES_OK" "$out/events.log"
grep -q "COMM_SOCKET_PONG" "$out/events.log"
grep -q "COMM_EVENT_CALL.INVITE" "$out/events.log"
grep -q "hitel-communication-web-production.up.railway.app/sdk-lab/device" "$out/events.log"
if grep -E "WEB_ERROR|HTTP_ERROR" "$out/events.log"; then
  echo "FAIL: HITEL WebView navigation error"
  exit 1
fi
python3 mobile/tests/lab-ci.py probe android
echo "PASS: app started, remote Vite page loaded, secure native bridge replied"
