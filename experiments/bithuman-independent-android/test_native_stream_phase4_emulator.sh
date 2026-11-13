#!/usr/bin/env bash
# Proof must include an actual Android device model inference and 53 RGB frame conversions.
set -euo pipefail
OUT="$GITHUB_WORKSPACE/reports/bithuman-android-native-stream-phase4"
APK="$GITHUB_WORKSPACE/build/native-stream-phase4/independent-expression2-native-stream-phase4.apk"
mkdir -p "$OUT"
test -s "$APK"
adb wait-for-device
for prop in ro.build.version.sdk ro.product.cpu.abi ro.product.cpu.abilist; do
  echo "$prop=$(adb shell getprop "$prop" | tr -d '\r')" >> "$OUT/device-abi.txt"
done
sha256sum "$APK" > "$OUT/apk-sha256.txt"
adb install -r "$APK" 2>&1 | tee "$OUT/install.txt"
adb logcat -c || true
adb shell am start -n com.example.x2hello/.MainActivity | tee "$OUT/launch.txt"
for i in $(seq 1 105); do
  adb logcat -d -v brief -s HITEL_PHASE4:I '*:S' > "$OUT/phase4.logcat" 2>&1 || true
  if grep -q 'INDEPENDENT_ANDROID_PHASE4_PASS frames=53' "$OUT/phase4.logcat"; then
    break
  fi
  if grep -q 'PHASE4_FAILURE' "$OUT/phase4.logcat"; then
    break
  fi
  sleep 3
done
adb shell dumpsys meminfo com.example.x2hello > "$OUT/meminfo.txt" 2>&1 || true
adb exec-out screencap -p > "$OUT/emulator-screen.png" || true
adb shell uiautomator dump /sdcard/p4.xml > "$OUT/uiautomator.txt" 2>&1 || true
adb pull /sdcard/p4.xml "$OUT/window.xml" >/dev/null 2>&1 || true
adb logcat -d -v time -t 4500 > "$OUT/all-logcat.txt" 2>&1 || true
cat "$OUT/device-abi.txt"
cat "$OUT/phase4.logcat"
if grep -q 'NATIVE_STREAM_INPUT_PASS pcm=44000 modelInput=35200' "$OUT/phase4.logcat" &&
   grep -q 'INDEPENDENT_ANDROID_PHASE4_PASS frames=53' "$OUT/phase4.logcat" &&
   grep -q 'STEP14_PASS' "$OUT/phase4.logcat" &&
   grep -q 'ENC_TOK14_PASS' "$OUT/phase4.logcat" &&
   test "$(grep -c DECODE_BATCH_PASS "$OUT/phase4.logcat")" -eq 4; then
  adb exec-out run-as com.example.x2hello cat files/phase4_first.png > "$OUT/first_frame.png" || true
  adb exec-out run-as com.example.x2hello cat files/phase4_last.png > "$OUT/last_frame.png" || true
  test -s "$OUT/first_frame.png"
  test -s "$OUT/last_frame.png"
  echo "REAL_ANDROID53_NATIVE_CPP_LITERT_PASS" | tee "$OUT/verdict.txt"
  exit 0
fi
echo "REAL_ANDROID53_NATIVE_CPP_LITERT_FAIL" | tee "$OUT/verdict.txt"
exit 1
