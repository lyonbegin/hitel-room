#!/usr/bin/env bash
set -euo pipefail
out="mobile-test-results/android11"
mkdir -p "$out"
adb reverse tcp:18888 tcp:18888
adb shell settings put global http_proxy 127.0.0.1:18888
adb install -r mobile/android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
adb shell am start -n app.hitel.nativebridge/.MainActivity --es hitel_url "$HITEL_LAB"
sleep 45
adb logcat -d -s HITEL_E2E:I '*:S' | tee "$out/native.log"
adb exec-out screencap -p > "$out/real-android11.png"
adb shell getprop ro.build.version.release | tee "$out/version.txt"
adb shell dumpsys activity activities | grep -m1 'app.hitel.nativebridge' | tee "$out/foreground.txt" || true
grep -q APP_STARTED "$out/native.log"
grep -q WEB_LOADED "$out/native.log"
grep -q BRIDGE_PING_OK "$out/native.log"
echo "ANDROID_11_NATIVE_WEBVIEW_BRIDGE_PASS"
