#!/usr/bin/env bash
# Only PASS when the *unmodified* original SDK native function executed
# and numerical discrepancies for identical PCM vectors were measured.
set -euo pipefail
OUT="$GITHUB_WORKSPACE/reports/expression2-original-oracle"
APK="$GITHUB_WORKSPACE/build/oracle/expression2-original-preprocessor-oracle.apk"
mkdir -p "$OUT"
test -s "$APK"
adb wait-for-device
for property in ro.build.version.sdk ro.product.cpu.abi ro.product.cpu.abilist ro.dalvik.vm.native.bridge; do
  echo "$property=$(adb shell getprop "$property" | tr -d '\r')" >> "$OUT/device.txt"
done
sha256sum "$APK" > "$OUT/apk-sha256.txt"
adb install -r "$APK" | tee "$OUT/install.log"
adb logcat -c
# Keep all early native bridge messages and crash evidence before the filtered poll.
adb logcat -v time > "$OUT/complete-live.logcat" 2>&1 &
LOGCAT_PID=$!
adb shell am start -n com.example.x2hello/.MainActivity | tee "$OUT/launch.log"
for i in $(seq 1 65); do
  adb logcat -d -v time -s EXPR2_ORACLE:I EXPR2_ORIGINAL_ORACLE:I '*:S' > "$OUT/differential.logcat" || true
  if grep -q ORIGINAL_ORACLE_AB_COMPLETE "$OUT/differential.logcat"; then break; fi
  if grep -q ORIGINAL_ORACLE_FAILURE "$OUT/differential.logcat"; then break; fi
  sleep 2
done
adb logcat -d -v time > "$OUT/all.logcat" || true
adb logcat -b crash -d -v time > "$OUT/crash-buffer.logcat" || true
kill "$LOGCAT_PID" 2>/dev/null || true
sleep 1
adb shell dumpsys meminfo com.example.x2hello > "$OUT/meminfo.txt" || true
adb exec-out screencap -p > "$OUT/screenshot.png" || true
cat "$OUT/device.txt"
grep -E 'ORIGINAL_LIBRARIES_LOADED|ORIGINAL_ADDRESS_PASS|ORIGINAL_FUNCTION_INVOKED|ORACLE_CASE|ORIGINAL_ORACLE_AB_COMPLETE|ORIGINAL_ORACLE_FAILURE' "$OUT/differential.logcat" || true
if ! grep -q ORIGINAL_ORACLE_AB_COMPLETE "$OUT/differential.logcat"; then
  grep -E 'ORACLE_ENTER|ORACLE_ADDRESS|ORACLE_JNI|ORACLE_DLOPEN|ORACLE_ORIGINAL_FEED|fatal signal|SIGSEGV|FATAL EXCEPTION' "$OUT/complete-live.logcat" | tail -55 || true
  echo ORIGINAL_SDK_ORACLE_NOT_VERIFIED > "$OUT/VERDICT.txt"
  exit 1
fi
if [ "$(grep -c ORIGINAL_FUNCTION_INVOKED "$OUT/differential.logcat")" -lt 5 ]; then
  echo ORIGINAL_SDK_ORACLE_WRONG_CALL_COUNT > "$OUT/VERDICT.txt"
  exit 1
fi
adb exec-out run-as com.example.x2hello cat files/original_differential_report.json > "$OUT/original_differential_report.json"
python3 - <<'PY'
import json
from pathlib import Path
d=json.loads(Path("reports/expression2-original-oracle/original_differential_report.json").read_text())
assert d["result"]=="REFERENCE_EXECUTED_AND_COMPARED"
assert len(d["cases"])==5
for x in d["cases"]:
    assert x["count"]==35200 and x["nonfinite_count"]==0
    print("ORIGINAL_REFERENCE_REAL",x["case"],"exact",x["float_exact_count"],
          "mae",x["mae"],"max",x["max_abs"],"ref_sha",x["original_sha256"])
PY
for case in silence impulse sine fixed_noise spoken_tts; do
  adb exec-out run-as com.example.x2hello cat "files/$case"_original.f32 > "$OUT/$case"_original.f32
  adb exec-out run-as com.example.x2hello cat "files/$case"_candidate.f32 > "$OUT/$case"_candidate.f32
  test "$(stat -c %s "$OUT/$case"_original.f32)" -eq 140800
  test "$(stat -c %s "$OUT/$case"_candidate.f32)" -eq 140800
done
echo ORIGINAL_REFERENCE_EXECUTED_BUT_PARITY_NEEDS_NUMERIC_EVIDENCE | tee "$OUT/VERDICT.txt"
