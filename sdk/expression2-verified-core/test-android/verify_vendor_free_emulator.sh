#!/usr/bin/env bash
set -euo pipefail
OUT="$GITHUB_WORKSPACE/reports/expression2-vendor-free-verified-core"
APK="$GITHUB_WORKSPACE/build/expr2-core/expression2-vendor-free-verified-core.apk"
mkdir -p "$OUT"
test -s "$APK"
# Read the archive TO COMPLETION before grep -q. unzip | grep -q under
# pipefail can SIGPIPE (141) on an otherwise valid APK member listing.
unzip -Z1 "$APK" > "$OUT/apk-members.txt"
if grep -E '(libexpr2jni\.so|libLiteRt\.so|expression2-android|essence2-android)' "$OUT/apk-members.txt";then
  echo 'VENDOR_BINARY_PRESENT: REJECT' | tee "$OUT/VERDICT.txt"
  exit 1
fi
grep -q 'lib/arm64-v8a/libexpression2_verified_core.so' "$OUT/apk-members.txt"
adb wait-for-device
adb install -r "$APK" | tee "$OUT/install.log"
adb logcat -c
adb shell am start -n com.example.x2hello/.MainActivity | tee "$OUT/launch.log"
for i in $(seq 1 70);do
  adb logcat -d -v time -s EXPR2_VENDOR_FREE:I '*:S' > "$OUT/vendor-free.logcat" || true
  if grep -q 'EXPR2_VENDOR_FREE_ALL_REFERENCE_VECTORS ' "$OUT/vendor-free.logcat";then break;fi
  if grep -q 'VENDOR_FREE_VERIFICATION_FAILURE' "$OUT/vendor-free.logcat";then break;fi
  sleep 2
done
adb logcat -b crash -d -v time > "$OUT/crash.logcat" || true
adb exec-out screencap -p > "$OUT/screenshot.png" || true
grep -E 'VENDOR_FREE_LIBRARY_LOADED|VENDOR_FREE_DSP_CASE|VENDOR_FREE_CANON_CASE|EXPR2_VENDOR_FREE_ALL_REFERENCE_VECTORS|VENDOR_FREE_VERIFICATION_FAILURE' "$OUT/vendor-free.logcat" || true
if ! grep -q 'EXPR2_VENDOR_FREE_ALL_REFERENCE_VECTORS PASS count=6' "$OUT/vendor-free.logcat";then
  echo VENDOR_FREE_REFERENCE_PARITY_NOT_PROVEN | tee "$OUT/VERDICT.txt"
  exit 1
fi
adb exec-out run-as com.example.x2hello cat files/vendor_free_verified_core_report.json \
  > "$OUT/vendor_free_verified_core_report.json"
python3 - <<'PY'
import json
from pathlib import Path
r=json.loads(Path("reports/expression2-vendor-free-verified-core/vendor_free_verified_core_report.json").read_text())
assert r["verified_without_vendor_binary"] is True
assert r["all_cases_bit_exact"] is True
assert r["full_sdk_parity_claimed"] is False
assert len(r["cases"])==6
for case in r["cases"]:
    assert case["bit_exact"] is True
    assert case["mismatch_bytes"]==0
    assert case["original_reference_sha256"]==case["standalone_sha256"]
    print("VENDOR_FREE_ORIGINAL_REFERENCE_MATCH",case["case"],case["bytes_compared"],case["original_reference_sha256"])
print("EXPR2_VENDOR_FREE_SIX_VECTOR_BIT_EXACT_PASS")
PY
echo EXPR2_VENDOR_FREE_SIX_VECTOR_BIT_EXACT_PASS | tee "$OUT/VERDICT.txt"
