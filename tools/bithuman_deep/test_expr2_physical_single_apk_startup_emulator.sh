#!/usr/bin/env bash
# Smoke test for the exact big, model-bundled APK sent to real Android phones.
# Only verify installation, localhost fixture, local model and ORIGINAL SDK create.
# Do NOT wait for the slow ARM64-translation rendering loop.
set -euo pipefail
OUT="$GITHUB_WORKSPACE/reports/expression2-real-device-apk-smoke"
APK="$GITHUB_WORKSPACE/build/physical-single-apk/Expression2_Original_ARM64_Real_Device_Test.apk"
PKG="com.example.x2hello"
mkdir -p "$OUT"
test -s "$APK"
adb wait-for-device
adb install -r "$APK" | tee "$OUT/install.txt"
adb shell am force-stop "$PKG" || true
adb logcat -c
adb shell am start -n "$PKG/.MainActivity" | tee "$OUT/launch.txt"
for _ in $(seq 1 24); do
  adb logcat -d -v time -s EXPR2_DEVICE:I EXPR2_LOCAL_FIXTURE:E '*:S' > "$OUT/startup.logcat" || true
  if grep -q "TEST_LOCAL_AUTH_READY" "$OUT/startup.logcat";then break;fi
  sleep 2
done
grep "TEST_LOCAL_AUTH_READY" "$OUT/startup.logcat"
echo "PHYSICAL_APK_ANDROID_LOOPBACK_AUTH_SERVER_STARTED_PASS"
adb shell uiautomator dump /sdcard/window.xml > "$OUT/ui-dump.txt" 2>&1 || true
adb exec-out cat /sdcard/window.xml > "$OUT/window.xml" || true
python3 - "$OUT/window.xml" "$OUT/click-position.txt" <<'PY'
from pathlib import Path
import re,sys,html
data=Path(sys.argv[1]).read_text(errors="replace")
# UIAutomator returns XML with character refs for the original Korean button.
node=next((x for x in re.findall(r'<node\b[^>]+>',data) if "원본 엔진 시험 시작" in html.unescape(x)),None)
assert node,"Original SDK test button not present"
bounds=re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',node)
assert bounds,node
x1,y1,x2,y2=map(int,bounds.groups())
Path(sys.argv[2]).write_text(str((x1+x2)//2)+" "+str((y1+y2)//2)+"\n")
print("EXPR2_DEVICE_START_BUTTON_FOUND bounds=",bounds.group(0))
PY
read -r X Y < "$OUT/click-position.txt"
adb shell input tap "$X" "$Y"
echo "EXPR2_DEVICE_TEST_BUTTON_TAPPED"
for n in $(seq 1 42); do
  adb logcat -d -v time -s EXPR2_DEVICE:I EXPR2_LOCAL_FIXTURE:E '*:S' > "$OUT/device.logcat" || true
  if grep -q "SDK_ORIGINAL_CREATE_PASS" "$OUT/device.logcat";then break;fi
  if grep -q "TEST_FAIL" "$OUT/device.logcat";then break;fi
  sleep 3
done
adb logcat -d -v time -s EXPR2_DEVICE:I EXPR2_LOCAL_FIXTURE:E '*:S' > "$OUT/device.logcat" || true
adb logcat -b crash -d -v time > "$OUT/crash.logcat" || true
adb exec-out screencap -p > "$OUT/screen.png" || true
python3 - "$OUT" <<'PY'
from pathlib import Path
import sys,json
root=Path(sys.argv[1])
text=(root/"device.logcat").read_text(errors="replace")
checks={
 "apk_installed":"Success" in (root/"install.txt").read_text(errors="replace"),
 "local_fixture_started":"TEST_LOCAL_AUTH_READY" in text,
 "start_button_clicked":"ORIGINAL_TEST_BEGIN" in text,
 "bundled_model_local_cache_ready":"LOCAL_MODEL_READY" in text,
 "original_arm64_library_loaded":"SDK_ORIGINAL_ARM64_LIBRARY_LOADED" in text,
 "original_model_construct_pass":"SDK_ORIGINAL_MODEL_CONSTRUCT_PASS" in text,
 "test_only_credential_set":"LOCAL_TEST_CREDENTIAL_REGISTERED" in text,
 "localhost_validate_accepted":"TEST_AUTH_VALIDATE_ACCEPTED" in text,
 "original_avatar_create_pass":"SDK_ORIGINAL_CREATE_PASS" in text,
}
out={"checks":checks,"first_unmet":next((k for k,v in checks.items() if not v),None),
     "result":"PASS" if all(checks.values()) else "FAILED"}
(root/"RESULT.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
if not all(checks.values()):raise SystemExit(1)
PY
