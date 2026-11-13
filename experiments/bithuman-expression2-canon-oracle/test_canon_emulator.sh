#!/usr/bin/env bash
set -euo pipefail
OUT="$GITHUB_WORKSPACE/reports/expression2-original-canon"
APK="$GITHUB_WORKSPACE/build/canon-oracle/expression2-original-canon-oracle.apk"
mkdir -p "$OUT"
test -s "$APK"
adb wait-for-device
for key in ro.product.cpu.abi ro.product.cpu.abilist ro.dalvik.vm.native.bridge; do
  echo "$key=$(adb shell getprop "$key" | tr -d '\r')" >> "$OUT/device.txt"
done
adb install -r "$APK" | tee "$OUT/install.log"
adb logcat -c
adb shell am start -n com.example.x2hello/.MainActivity | tee "$OUT/launch.log"
for i in $(seq 1 70); do
  adb logcat -d -v time -s EXPR2_CANON_ORACLE:I '*:S' > "$OUT/original-canon.logcat" || true
  if grep -q 'ORIGINAL_CANON_AB_COMPLETE' "$OUT/original-canon.logcat"; then break; fi
  if grep -q 'CANON_ORACLE_FAILURE' "$OUT/original-canon.logcat"; then break; fi
  sleep 2
done
adb logcat -b crash -d -v time > "$OUT/crash.logcat" || true
adb exec-out screencap -p > "$OUT/screenshot.png" || true
grep -E 'ORIGINAL_CANON_ADDRESS_PASS|ORIGINAL_CANON_FUNCTION_INVOKED|CANON_CASE|ORIGINAL_CANON_AB_COMPLETE|CANON_ORACLE_FAILURE' "$OUT/original-canon.logcat" || true
if ! grep -q 'ORIGINAL_CANON_AB_COMPLETE count=4 bitExact=true' "$OUT/original-canon.logcat"; then
  echo 'ORIGINAL_CANON_SDK_ORACLE_FAILED_OR_NOT_EQUIVALENT' | tee "$OUT/VERDICT.txt"
  exit 1
fi
if [ "$(grep -c 'ORIGINAL_CANON_FUNCTION_INVOKED' "$OUT/original-canon.logcat")" -lt 4 ]; then
  echo 'ORIGINAL_CANON_FUNCTION_NOT_CALLED_4_TIMES' | tee "$OUT/VERDICT.txt"
  exit 1
fi
adb exec-out run-as com.example.x2hello cat files/canon_original_differential_report.json \
  > "$OUT/canon_original_differential_report.json"
for part in input original_history candidate_history; do
  adb exec-out run-as com.example.x2hello cat "files/wise_pup_canon_$part.bin" \
    > "$OUT/wise_pup_canon_$part.bin"
done
python3 - <<'PY'
import hashlib,json
from pathlib import Path
root=Path("reports/expression2-original-canon")
report=json.loads((root/"canon_original_differential_report.json").read_text())
assert report["all_cases_bit_exact"] is True
assert len(report["cases"])==4
assert all(x["exact_bytes"]==4792320 and x["bit_exact"] for x in report["cases"])
assert len((root/"wise_pup_canon_input.bin").read_bytes())==299520
original=(root/"wise_pup_canon_original_history.bin").read_bytes()
candidate=(root/"wise_pup_canon_candidate_history.bin").read_bytes()
assert len(original)==len(candidate)==4792320
assert original==candidate
assert hashlib.sha256((root/"wise_pup_canon_input.bin").read_bytes()).hexdigest()=="cac1c9aeb8c80de4b46661784ffd3fa5f601bf0113fa543db00f1fa8ec2d94d5"
for x in report["cases"]:
    print("CANON_ORIGINAL_REAL",x["case"],x["exact_bytes"],
          "bitExact",x["bit_exact"],"SHA256",x["original_output_sha256"])
print("ORIGINAL_WISE_PUP_CANON_HISTORY_BIT_EXACT_PASS")
PY
echo ORIGINAL_WISE_PUP_CANON_HISTORY_BIT_EXACT_PASS | tee "$OUT/VERDICT.txt"
