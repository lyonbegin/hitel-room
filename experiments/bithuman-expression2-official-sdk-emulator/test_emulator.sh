#!/usr/bin/env bash
set -euo pipefail
OUT="$GITHUB_WORKSPACE/reports/expression2-official-sdk-emulator"
APK="$GITHUB_WORKSPACE/build/expression2-official-sdk-emulator/app-debug.apk"
MODEL="$GITHUB_WORKSPACE/build/expression2-official-model/members/combined_litert.tflite"
CANON="$GITHUB_WORKSPACE/build/expression2-official-model/members/canon.bin"
PKG=com.example.x2hello
mkdir -p "$OUT"
test -s "$APK" && test -s "$MODEL" && test -s "$CANON"

adb wait-for-device
for key in ro.build.version.sdk ro.product.cpu.abi ro.product.cpu.abilist ro.dalvik.vm.native.bridge; do
  echo "$key=$(adb shell getprop "$key" | tr -d '\r')" >> "$OUT/device.txt"
done
adb install -r "$APK" | tee "$OUT/install.txt"
adb shell pm path "$PKG" | tee "$OUT/installed-package.txt"

# Create the scoped external data directory, then copy the verified *original*
# model files outside of the APK, exactly as local Expression2Model.combined needs.
adb shell am start -n "$PKG/.MainActivity" > "$OUT/first-start.txt"
sleep 3
TARGET="/sdcard/Android/data/$PKG/files/models"
adb shell "mkdir -p '$TARGET'"
adb push "$MODEL" "$TARGET/combined_litert.tflite" | tee "$OUT/push-model.txt"
adb push "$CANON" "$TARGET/canon.bin" | tee "$OUT/push-canon.txt"
adb shell ls -l "$TARGET" > "$OUT/device-model-files.txt"

# Start only AFTER model provisioning. Previous launch is intentionally ignored.
adb logcat -c
adb shell am force-stop "$PKG"
adb shell am start -n "$PKG/.MainActivity" | tee "$OUT/launch.txt"
for i in $(seq 1 150); do
  adb logcat -d -v time -s EXPR2_OFFICIAL:I '*:S' > "$OUT/official.logcat" || true
  if grep -q 'SDK_PROBE_END' "$OUT/official.logcat"; then break; fi
  sleep 2
done
adb logcat -d -v time > "$OUT/all.logcat" || true
adb logcat -b crash -d -v time > "$OUT/crash.logcat" || true
adb shell dumpsys meminfo "$PKG" > "$OUT/meminfo.txt" || true
adb exec-out screencap -p > "$OUT/screenshot.png" || true
adb exec-out run-as "$PKG" cat files/official-first-frame.png > "$OUT/official-first-frame.png" 2>/dev/null || true
cat "$OUT/device.txt"
grep -E 'SDK_PROBE_|SDK_ORIGINAL_|MODEL_ORIGINAL_|SDK_OFFICIAL_|SDK_CREDENTIAL|SDK_MODEL_' "$OUT/official.logcat" || true

python3 - <<'PY'
from pathlib import Path
root=Path('reports/expression2-official-sdk-emulator')
installed=(root/'install.txt').read_text()
logs=(root/'official.logcat').read_text()
assert 'Success' in installed, 'Original SDK application failed to install in emulator'
assert 'SDK_PROBE_END' in logs, 'App failed/hung/crashed before completion'
assert 'MODEL_ORIGINAL_FILES_VERIFIED' in logs, 'Official model was not loaded from Android device'
assert 'SDK_ORIGINAL_MODEL_CONSTRUCT_PASS' in logs, 'Original SDK model constructor not reached'
assert 'SDK_OFFICIAL_CREATE_BEGIN' in logs, 'Original SDK runtime create() not invoked'
if 'SDK_OFFICIAL_RENDER_PASS' in logs:
    print('EXPRESSION2_OFFICIAL_SDK_RENDER_PASS')
    (root/'VERDICT.txt').write_text('OFFICIAL_SDK_RENDER_PASS\n')
elif 'SDK_OFFICIAL_CREATE_PASS' in logs:
    print('EXPRESSION2_OFFICIAL_SDK_ENGINE_CREATED_BUT_RENDER_NOT_PROVEN')
    (root/'VERDICT.txt').write_text('OFFICIAL_ENGINE_CREATED_RENDER_UNVERIFIED\n')
elif 'SDK_OFFICIAL_CREATE_REJECTED' in logs:
    print('EXPRESSION2_OFFICIAL_SDK_BLOCKED_AT_VENDOR_AUTHORIZATION_NOT_RENDERED')
    (root/'VERDICT.txt').write_text('BLOCKED_AUTHORIZATION_OR_CREATE_ERROR_NOT_RENDERED\n')
    raise SystemExit(2)
else:
    raise AssertionError('Unknown official SDK execution state')
PY
