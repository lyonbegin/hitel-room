#!/usr/bin/env bash
set -euo pipefail
OUT="$GITHUB_WORKSPACE/reports/expr2-stream"
APK="$GITHUB_WORKSPACE/build/expr2-stream/expression2-preinference-stream-smoke.apk"
mkdir -p "$OUT"
test -s "$APK"
unzip -Z1 "$APK" > "$OUT/apk-members.txt"
if grep -Ei 'libexpr2jni|libLiteRt|expression2-android|essence2-android' "$OUT/apk-members.txt";then
  echo 'VENDOR_BINARY_PRESENT' | tee "$OUT/VERDICT.txt"
  exit 1
fi
grep -q 'lib/arm64-v8a/libexpression2_verified_core.so' "$OUT/apk-members.txt"
adb wait-for-device
adb install -r "$APK" | tee "$OUT/install.log"
adb logcat -c
adb shell am start -n com.example.x2hello/.MainActivity | tee "$OUT/launch.log"
for i in $(seq 1 80);do
  adb logcat -d -v time -s EXPR2_STREAM_SMOKE:I '*:S' > "$OUT/smoke.logcat" || true
  if grep -q 'EXPR2_STREAM_PREINFERENCE_SMOKE_' "$OUT/smoke.logcat";then break;fi
  if grep -q 'NATIVE_SMOKE_FAILURE' "$OUT/smoke.logcat";then break;fi
  sleep 2
done
adb logcat -b crash -d -v time > "$OUT/crash.logcat" || true
adb exec-out screencap -p > "$OUT/screenshot.png" || true
if ! grep -F 'EXPR2_STREAM_PREINFERENCE_SMOKE_PASS passed=26 failed=0' "$OUT/smoke.logcat";then
  echo 'ANDROID14_PREINFERENCE_SMOKE_NOT_PROVEN' | tee "$OUT/VERDICT.txt"
  exit 1
fi
echo 'ANDROID14_PREINFERENCE_SMOKE_PASS_26_OF_26' | tee "$OUT/VERDICT.txt"
