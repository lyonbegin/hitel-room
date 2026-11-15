#!/usr/bin/env bash
# Original Expression2 0.6.2 JNI; only original JVM metering apiBase method changed.
# A newly generated CI token is identical in the test app and ephemeral server.
set -euo pipefail
OUT="$GITHUB_WORKSPACE/reports/expression2-original-ci-auth-android"
APK="$GITHUB_WORKSPACE/build/expression2-original-ci-auth-android/app-debug.apk"
MODEL="$GITHUB_WORKSPACE/build/expression2-official-model/members/combined_litert.tflite"
CANON="$GITHUB_WORKSPACE/build/expression2-official-model/members/canon.bin"
PKG=com.example.x2hello
mkdir -p "$OUT"
test -s "$APK" && test -s "$MODEL" && test -s "$CANON"
test -n "$EXPR2_CI_TOKEN"
test "$(stat -c%s "$MODEL")" -eq 158524428
test "$(stat -c%s "$CANON")" -eq 299520
python3 -u tools/bithuman_deep/expression2_ephemeral_auth_fixture.py \
  --host 127.0.0.1 --port 18762 \
  --log "$OUT/original-http-field-types.jsonl" > "$OUT/ci-auth-server.log" 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
python3 - <<'PY'
import socket,time
for _ in range(70):
    try:
        with socket.create_connection(("127.0.0.1",18762),timeout=.4):
            print("CI_AUTH_SERVER_LOCALHOST_18762_READY")
            break
    except OSError:time.sleep(.15)
else:raise RuntimeError("CI auth backend cannot start")
PY
adb wait-for-device
adb reverse tcp:18762 tcp:18762 | tee "$OUT/adb-reverse.txt"
adb reverse --list | tee "$OUT/adb-reverse-list.txt"
grep -q '18762' "$OUT/adb-reverse-list.txt"
for key in ro.build.version.sdk ro.product.cpu.abi ro.product.cpu.abilist ro.dalvik.vm.native.bridge; do
  echo "$key=$(adb shell getprop "$key" | tr -d '\r')" >> "$OUT/device.txt"
done
adb install -r "$APK" | tee "$OUT/install.txt"
adb shell am start -n "$PKG/.MainActivity" > "$OUT/initial-start.txt"
sleep 3
TARGET="/sdcard/Android/data/$PKG/files/models"
adb shell "mkdir -p '$TARGET'"
adb push "$MODEL" "$TARGET/combined_litert.tflite" > "$OUT/push-model.txt"
adb push "$CANON" "$TARGET/canon.bin" > "$OUT/push-canon.txt"
adb shell ls -l "$TARGET" > "$OUT/model-files.txt"
adb logcat -c
adb shell am force-stop "$PKG"
adb shell am start -n "$PKG/.MainActivity" | tee "$OUT/start.txt"
echo "CI_ORIGINAL_ANDROID_APP_STARTED"
for n in $(seq 1 144); do
  adb logcat -d -v time -s EXPR2_OFFICIAL:I '*:S' > "$OUT/official.logcat" || true
  if grep -q 'SDK_PROBE_END' "$OUT/official.logcat";then break;fi
  if grep -q 'SDK_OFFICIAL_RENDER_PASS' "$OUT/official.logcat";then break;fi
  sleep 5
done
adb logcat -d -v time -s EXPR2_OFFICIAL:I '*:S' > "$OUT/official.logcat" || true
adb logcat -b crash -d -v time > "$OUT/crash.logcat" || true
adb logcat -d -v time > "$OUT/all.logcat" || true
adb exec-out screencap -p > "$OUT/screenshot.png" || true
adb shell dumpsys meminfo "$PKG" > "$OUT/meminfo.txt" || true
adb exec-out run-as "$PKG" cat files/official-first-frame.png > "$OUT/official-first-frame.png" 2>/dev/null || true
if ! file "$OUT/official-first-frame.png" | grep -q 'PNG image data'; then rm -f "$OUT/official-first-frame.png";fi
grep -E 'SDK_PROBE_|SDK_ORIGINAL_|MODEL_ORIGINAL_|SDK_OFFICIAL_|SDK_CREDENTIAL|SDK_MODEL_' "$OUT/official.logcat" \
  | tee "$OUT/sdk-milestones.txt" || true
python3 - "$OUT" <<'PY'
from pathlib import Path
import json,sys
p=Path(sys.argv[1])
logs=(p/"official.logcat").read_text(errors="replace")
fp=p/"original-http-field-types.jsonl"
entries=[json.loads(s) for s in fp.read_text().splitlines()] if fp.is_file() else []
checks={
 "adb_reverse_established":"18762" in (p/"adb-reverse-list.txt").read_text(),
 "original_arm64_native_load_pass":"SDK_ORIGINAL_NATIVE_LOAD_PASS" in logs,
 "original_model_construct_pass":"SDK_ORIGINAL_MODEL_CONSTRUCT_PASS" in logs,
 "ci_credential_supplied_to_original_sdk":"SDK_CREDENTIAL_CONFIGURED" in logs,
 "original_avatar_create_invoked":"SDK_OFFICIAL_CREATE_BEGIN" in logs,
 "server_received_original_validate":any(e["path"]=="/v1/auth/validate" and e["authenticated_synthetic_fixture"] for e in entries),
 "original_avatar_create_success":"SDK_OFFICIAL_CREATE_PASS" in logs,
 "first_frame_produced_by_original_arm64":"SDK_OFFICIAL_FIRST_FRAME_PASS" in logs and (p/"official-first-frame.png").is_file(),
 "original_render_pass":"SDK_OFFICIAL_RENDER_PASS" in logs,
 "no_unexpected_app_exception":"SDK_PROBE_UNEXPECTED_FAIL" not in logs
}
first=next((k for k,v in checks.items() if not v),None)
result={
 "kind":"real-original-SDK-Android-emulator-with-matched-CI-test-credential",
 "checks":checks,
 "first_unmet_boundary":first,
 "http_method_paths":[e["path"] for e in entries],
 "original_sdk_modified_jvm_functions":["SelfHostMeter$Companion.apiBase$expression2_release()Ljava/lang/String;"],
 "original_arm64_modified":False,
 "server_scope":"GitHub Actions ephemeral localhost via adb reverse 18762",
 "no_vendor_credentials_used":True,
 "result":"PASS" if all(checks.values()) else "NOT_YET_PASSED"
}
(p/"RESULT.json").write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
(p/"VERDICT.txt").write_text(result["result"]+" first_unmet="+str(first)+"\n")
print(json.dumps(result,indent=2,ensure_ascii=False))
if not all(checks.values()):raise SystemExit(1)
PY
