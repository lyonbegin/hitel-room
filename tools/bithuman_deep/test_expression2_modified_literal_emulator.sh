#!/usr/bin/env bash
# Controlled official SDK runtime regression: genuine model + original JNI,
# patched JVM string constants only; credential is intentionally unset.
# Expected result is original authentication denial with the NEW string.
# DOES NOT bypass authorization or assert frame rendering.
set -euo pipefail

OUT="$GITHUB_WORKSPACE/reports/expression2-jvm-runtime-literal-check"
APK="$GITHUB_WORKSPACE/build/expression2-jvm-runtime-literal-check/app-debug.apk"
MODEL="$GITHUB_WORKSPACE/build/expression2-official-model/members/combined_litert.tflite"
CANON="$GITHUB_WORKSPACE/build/expression2-official-model/members/canon.bin"
PKG=com.example.x2hello
MARKER="HITEL_EXPRESSION2_JVM_TEXT_PATCH_OK_20261114"
mkdir -p "$OUT"
test -s "$APK" && test -s "$MODEL" && test -s "$CANON"
test "$(stat -c %s "$MODEL")" -eq 158524428
test "$(stat -c %s "$CANON")" -eq 299520

adb wait-for-device
for key in ro.build.version.sdk ro.product.cpu.abi ro.product.cpu.abilist ro.dalvik.vm.native.bridge; do
  echo "$key=$(adb shell getprop "$key" | tr -d '\r')" >> "$OUT/device.txt"
done
adb install -r "$APK" | tee "$OUT/install.txt"
adb shell pm path "$PKG" > "$OUT/package-path.txt"

# The SDK probe activity first creates its scoped external storage, then the
# test copies the ORIGINAL public model and restarts the same probe unchanged.
adb shell am start -n "$PKG/.MainActivity" > "$OUT/first-start.txt"
sleep 3
TARGET="/sdcard/Android/data/$PKG/files/models"
adb shell "mkdir -p '$TARGET'"
adb push "$MODEL" "$TARGET/combined_litert.tflite" | tee "$OUT/push-model.txt"
adb push "$CANON" "$TARGET/canon.bin" | tee "$OUT/push-canon.txt"
adb shell ls -l "$TARGET" > "$OUT/model-files.txt"

adb logcat -c
adb shell am force-stop "$PKG"
adb shell am start -n "$PKG/.MainActivity" | tee "$OUT/launch.txt"
for n in $(seq 1 80); do
  adb logcat -d -v time -s EXPR2_OFFICIAL:I '*:S' > "$OUT/official.logcat" || true
  if grep -q 'SDK_PROBE_END' "$OUT/official.logcat";then break;fi
  sleep 2
done
adb logcat -b crash -d -v time > "$OUT/crash.logcat" || true
adb logcat -d -v time > "$OUT/all.logcat" || true
adb exec-out screencap -p > "$OUT/screenshot.png" || true
adb shell dumpsys meminfo "$PKG" > "$OUT/meminfo.txt" || true
grep -E 'SDK_PROBE_|SDK_ORIGINAL_|MODEL_ORIGINAL_|SDK_OFFICIAL_|SDK_CREDENTIAL|SDK_MODEL_' "$OUT/official.logcat" \
  | tee "$OUT/sdk-milestones.txt" || true

python3 - "$OUT" "$MARKER" <<'PY'
from pathlib import Path
import sys,json
out=Path(sys.argv[1]);marker=sys.argv[2]
logs=(out/"official.logcat").read_text(errors="replace")
checks={
 "apk_installed":"Success" in (out/"install.txt").read_text(errors="replace"),
 "native_loaded":"SDK_ORIGINAL_NATIVE_LOAD_PASS" in logs,
 "original_model_verified":"MODEL_ORIGINAL_FILES_VERIFIED" in logs,
 "original_model_constructed":"SDK_ORIGINAL_MODEL_CONSTRUCT_PASS" in logs,
 "credential_unset":"SDK_CREDENTIAL_UNSET_NO_TEST_SECRET" in logs,
 "sdk_create_invoked":"SDK_OFFICIAL_CREATE_BEGIN" in logs,
 "sdk_refusal_observed":"SDK_OFFICIAL_CREATE_REJECTED" in logs,
 "patched_literal_observed":marker in logs,
 "original_literal_absent":"no API secret was found" not in logs,
 "no_render_claim":"SDK_OFFICIAL_RENDER_PASS" not in logs,
 "app_probe_completed":"SDK_PROBE_END" in logs,
}
result={
 "test":"expression2_official_model_patched_JVM_error_literal_actual_runtime",
 "checks":checks,
 "all_expected_conditions":all(checks.values()),
 "original_ARM64_machine_code_patched":False,
 "authorized_rendering_test":False,
 "note":"The test deliberately leaves vendor API credentials unset and expects the native SDK to deny creation with the modified JVM message. It does NOT prove successful engine creation or frame output."
}
(out/"RESULT.json").write_text(json.dumps(result,indent=2)+"\n")
(out/"VERDICT.txt").write_text(
 "PATCHED_JVM_LITERAL_REACHED_IN_REAL_ANDROID_RUNTIME_PASS\n" if all(checks.values()) else
 "PATCHED_JVM_LITERAL_RUNTIME_NOT_VERIFIED\n")
print(json.dumps(result,indent=2))
if not all(checks.values()):raise SystemExit(1)
PY
