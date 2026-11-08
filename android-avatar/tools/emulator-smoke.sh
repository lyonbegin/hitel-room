#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p test-results
collect() {
  adb exec-out screencap -p > test-results/real-android-screen.png 2>/dev/null || true
  adb logcat -d -v time > test-results/logcat.txt 2>&1 || true
  echo '=== WebView / app logcat ==='
  grep -E 'HITEL-AVATAR|HITEL|chromium|WASM|Uncaught|Web Console|net::ERR_|not found' test-results/logcat.txt | tail -n 80 || true
  adb shell dumpsys activity activities > test-results/activities.txt 2>&1 || true
  adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
  adb exec-out cat /sdcard/window.xml > test-results/ui.xml 2>/dev/null || true
}
trap collect EXIT
adb devices -l | tee test-results/devices.txt
adb shell getprop ro.build.version.release | tee test-results/android-version.txt
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
adb shell am force-stop kr.hitel.s2avatar || true
adb shell am start -W -n kr.hitel.s2avatar/.MainActivity | tee test-results/launch.txt
pid=""
for i in $(seq 1 50); do
  pid="$(adb shell pidof kr.hitel.s2avatar | tr -d '\r' || true)"
  if [[ -n "$pid" ]] && adb shell cat /proc/net/unix | grep -q "webview_devtools_remote_$pid"; then
    break
  fi
  sleep 1
done
test -n "$pid" || { echo "FAIL: Android app exited"; exit 1; }
echo "APP_PID=$pid"
adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid"
node tools/webview-cdp-smoke.mjs | tee test-results/actual-webview-test.txt
