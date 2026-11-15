#!/usr/bin/env bash
set -euo pipefail
OUT=reports/essence2-direct-jvm-runtime
APK=build/essence2-direct-runtime/app-debug.apk
mkdir -p "$OUT"
test -s "$APK"
adb wait-for-device
for property in ro.product.cpu.abilist ro.dalvik.vm.native.bridge ro.build.version.sdk;do
  echo "$property=$(adb shell getprop "$property" | tr -d '\r')" >> "$OUT/device.txt"
done
adb install -r "$APK" | tee "$OUT/install.txt"
adb logcat -c
adb shell am start -W -n com.example.e2hello/.MainActivity | tee "$OUT/launch.txt"
for i in $(seq 1 50);do
  adb logcat -d -v time -s ESSENCE2_ORIGINAL_PROBE:I '*:S' > "$OUT/probe.logcat" || true
  if grep -q 'ESSENCE2_PROBE_END' "$OUT/probe.logcat";then break;fi
  sleep 2
done
adb logcat -b crash -d -v time > "$OUT/crash.logcat" || true
adb logcat -d -v time > "$OUT/all.logcat" || true
adb exec-out screencap -p > "$OUT/screenshot.png" || true
grep -E 'ESSENCE2_' "$OUT/probe.logcat" | tee "$OUT/milestones.txt" || true
python3 - <<'PY'
from pathlib import Path
import json
base=Path("reports/essence2-direct-jvm-runtime")
log=(base/"probe.logcat").read_text(errors="replace")
flags={
 "installed":"Success" in (base/"install.txt").read_text(errors="replace"),
 "original_sdk_meterring_code_unchanged":"ESSENCE2_METERING_CODE=metering_no_credential" in log,
 "original_refuses_bit_true":"ESSENCE2_METERING_REFUSES=true" in log,
 "real_vendor_jvm_constant_modified":"ESSENCE2_JVM_PATCHED_CONSTANT_REAL_ART_RUNTIME_PASS" in log,
 "modified_message_in_log":"HITEL_ESSENCE2_JVM_TEXT_PATCH_OK_20261115: a valid API secret is required." in log,
 "original_message_not_present":"no API secret was found, so this render cannot be attributed to an account" not in log,
 "probe_completed":"ESSENCE2_PROBE_END" in log,
}
for name in ("le_jni","e2u_jni"):
  flags["native_load_"+name+"_pass"]="ESSENCE2_ORIGINAL_NATIVE_LOAD_PASS="+name in log
  flags["native_load_"+name+"_fail"]="ESSENCE2_ORIGINAL_NATIVE_LOAD_FAIL="+name in log
essential=[flags[k] for k in ("installed","original_sdk_meterring_code_unchanged",
          "original_refuses_bit_true","real_vendor_jvm_constant_modified",
          "modified_message_in_log","original_message_not_present","probe_completed")]
summary={
 "test":"Real Android ART execution of original Essence2 0.10.3 JVM one-constant patch",
 "checks":flags,"all_required_jvm_checks_pass":all(essential),
 "native_loads_are_independent_observations_not_prerequisite":True,
 "no_vendor_metering_bypass_or_credential_test":True,
 "real_model_frame_rendering_tested":False
}
(base/"RESULT.json").write_text(json.dumps(summary,indent=2)+"\n")
(base/"VERDICT.txt").write_text("ESSENCE2_REAL_ANDROID_JVM_TEXT_PATCH_PASS\n" if all(essential) else "ESSENCE2_RUNTIME_PATCH_PROOF_FAIL\n")
print(json.dumps(summary,indent=2))
if not all(essential):raise SystemExit(1)
PY
