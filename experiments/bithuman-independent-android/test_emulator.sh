#!/usr/bin/env bash
# Android emulator E2E: real Google LiteRT CPU inference of public bitHuman Expression2 model.
set -euo pipefail
OUT="$GITHUB_WORKSPACE/reports/independent-android"
APK="$GITHUB_WORKSPACE/build/native-apk/hitel-independent-expression2-encoder.apk"
mkdir -p "$OUT"
test -s "$APK"
adb wait-for-device
for prop in ro.build.version.sdk ro.product.cpu.abi ro.product.cpu.abilist ro.dalvik.vm.native.bridge; do
  echo "$prop=$(adb shell getprop "$prop" | tr -d '\r')" >> "$OUT/emulator-abi.txt"
done
sha256sum "$APK" | tee "$OUT/apk-sha256.txt"
adb install -r "$APK" 2>&1 | tee "$OUT/install.txt"
adb logcat -c
adb shell am start -n com.example.x2hello/.MainActivity 2>&1 | tee "$OUT/launch.txt"
for i in $(seq 1 40); do
  adb logcat -d -v brief -s HITEL_IMX_CPU:I '*:S' > "$OUT/encoder-logcat.txt" 2>&1 || true
  if grep -q 'INDEPENDENT_ANDROID_CPU_PASS' "$OUT/encoder-logcat.txt"; then
    break
  fi
  if grep -q 'HITEL_IMX_CPU.*FAIL' "$OUT/encoder-logcat.txt"; then
    break
  fi
  sleep 3
done
adb shell dumpsys meminfo com.example.x2hello > "$OUT/meminfo.txt" || true
adb exec-out screencap -p > "$OUT/screenshot.png" || true
adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
adb pull /sdcard/ui.xml "$OUT/ui.xml" >/dev/null 2>&1 || true
adb logcat -d -v time -t 3500 > "$OUT/full-logcat.txt" || true
cat "$OUT/emulator-abi.txt"
cat "$OUT/encoder-logcat.txt"
if grep -q 'ENC_PASS' "$OUT/encoder-logcat.txt" &&
   grep -q 'TOK14_PASS' "$OUT/encoder-logcat.txt" &&
   grep -q 'INDEPENDENT_ANDROID_CPU_PASS' "$OUT/encoder-logcat.txt"; then
   echo "ANDROID14_REAL_MODEL_INFERENCE_PASS" | tee "$OUT/verdict.txt"
   exit 0
fi
echo "ANDROID14_REAL_MODEL_INFERENCE_NOT_VERIFIED" | tee "$OUT/verdict.txt"
exit 1
