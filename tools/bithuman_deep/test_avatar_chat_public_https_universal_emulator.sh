#!/usr/bin/env bash
# Real installed native ARM64 Android emulator test for the PUBLIC HTTPS app.
# This test NEVER treats APK compilation or signature as runtime success.
set -euo pipefail
OUT="$GITHUB_WORKSPACE/reports/hitel-avatar-chat-public-https-auto-universal/emulator"
APK="$GITHUB_WORKSPACE/reports/hitel-avatar-chat-public-https-auto-universal/apk/HITEL_Original_avatar_chat_Expression2_Public_HTTPS_AUTO_Universal_Emulator_Debug.apk"
PACKAGE="ai.hitel.avatar_chat.localauto"
ACTIVITY="ai.bithuman.example.avatar_chat.MainActivity"
mkdir -p "$OUT"
test -s "$APK"
uname -m > "$OUT/host-arch.txt"
adb wait-for-device
adb shell getprop ro.product.cpu.abilist > "$OUT/guest-abis.txt"
adb shell getprop ro.dalvik.vm.native.bridge > "$OUT/guest-translation.txt"
adb shell getprop ro.build.version.sdk > "$OUT/guest-api.txt"
adb shell getprop sys.boot_completed > "$OUT/guest-boot-complete.txt"
cat "$OUT/host-arch.txt" "$OUT/guest-abis.txt" "$OUT/guest-api.txt" "$OUT/guest-boot-complete.txt"
grep -Eq '^x86_64,arm64-v8a|^x86_64,.*arm64-v8a' "$OUT/guest-abis.txt" || { echo "ANDROID_ARM_NATIVEBRIDGE_ABSENT";exit 61; }
grep -Eq 'libndk_translation|libhoudini' "$OUT/guest-translation.txt" || { echo "ANDROID_NATIVEBRIDGE_TRANSLATOR_NOT_RUNNING";exit 61; }
grep -Eq '^1$' "$OUT/guest-boot-complete.txt" || { echo "ANDROID_EMULATOR_NOT_BOOTED";exit 62; }
echo 'EMULATOR_X86_64_PLUS_ARM64_TRANSLATOR_BOOT_COMPLETED'
adb install -r "$APK" 2>&1 | tee "$OUT/adb-install.txt"
grep -Fq 'Success' "$OUT/adb-install.txt"
adb shell pm path "$PACKAGE" | tee "$OUT/pm-path.txt"
grep -Fq 'package:' "$OUT/pm-path.txt"
adb shell am force-stop "$PACKAGE" || true
adb logcat -c || true
adb shell am start -W -n "$PACKAGE/$ACTIVITY" 2>&1 | tee "$OUT/launch.txt"
grep -Fq 'Status: ok' "$OUT/launch.txt"
echo 'REAL_APK_INSTALLED_ON_EMULATOR_WITH_ORIGINAL_NATIVE_ARM64_SDK'
: > "$OUT/checks.log"
for n in $(seq 1 240); do
  adb logcat -d -v time > "$OUT/full.logcat" 2>/dev/null || true
  grep -E 'BH_EXPR2_LOCAL_TEST|BithumanPlugin|flutter|Flutter|expr2|Expression2|FATAL EXCEPTION|AndroidRuntime|Crypto|Network|DartVM|cleartext|SSLHandshake|hitel:' "$OUT/full.logcat" > "$OUT/filtered.logcat" || true
  adb shell pidof "$PACKAGE" > "$OUT/app.pid" 2>/dev/null || true
  if grep -Eq 'FATAL EXCEPTION|Flutter initialization failed|load failed:|startup_failed' "$OUT/filtered.logcat"; then
    echo "RUNTIME_FATAL_OR_LOAD_ERROR n=$n" | tee "$OUT/checks.log";break
  fi
  if grep -Fq 'ORIGINAL_AUTO_HARDWARE_MODEL_CREATED_BY_FLUTTER' "$OUT/filtered.logcat" &&
     grep -Fq 'LOCAL_TEST_ORIGINAL_MODEL_READY' "$OUT/filtered.logcat" &&
     grep -Fq 'first frame on the texture' "$OUT/filtered.logcat"; then
    echo "SDK_CREATE_AND_FIRST_REAL_FLUTTER_TEXTURE_FRAME_OBSERVED" | tee "$OUT/checks.log";break
  fi
  if [ $((n % 24)) -eq 0 ];then
    echo "REAL_ANDROID_EMULATOR_RUNTIME_CHECK $n/240 sdk_created=$(grep -c ORIGINAL_AUTO_HARDWARE_MODEL_CREATED_BY_FLUTTER "$OUT/filtered.logcat" || true) first_texture=$(grep -c 'first frame on the texture' "$OUT/filtered.logcat" || true)"
  fi
  sleep 5
done
adb exec-out screencap -p > "$OUT/screenshot.png" 2>/dev/null || true
adb shell dumpsys meminfo "$PACKAGE" > "$OUT/memory.txt" 2>/dev/null || true
adb logcat -d -v time > "$OUT/full.logcat" || true
grep -E 'BH_EXPR2_LOCAL_TEST|BithumanPlugin|flutter|Flutter|expr2|Expression2|FATAL EXCEPTION|AndroidRuntime|Crypto|Network|DartVM|cleartext|SSLHandshake|hitel:' "$OUT/full.logcat" > "$OUT/filtered.logcat" || true
adb shell run-as "$PACKAGE" find ./ -iname '*boot*status*' -o -iname '*breadcrumb*' > "$OUT/breadcrumb-paths.txt" 2>/dev/null || true
adb shell run-as "$PACKAGE" cat app_flutter/boot_status.txt > "$OUT/boot-status.txt" 2>/dev/null || true
python3 - "$OUT" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1]);logs=(p/'filtered.logcat').read_text(errors='replace')
boot=(p/'boot-status.txt').read_text(errors='replace') if (p/'boot-status.txt').exists() else ''
checks={
 'android_emulator_booted_with_ARM64_native_bridge':(p/'guest-abis.txt').read_text().startswith('x86_64,') and 'arm64-v8a' in (p/'guest-abis.txt').read_text() and (p/'guest-boot-complete.txt').read_text().strip()=='1',
 'real_apk_installed': 'Success' in (p/'adb-install.txt').read_text(),
 'installed_package_confirmed':'package:' in (p/'pm-path.txt').read_text(),
 'activity_launched':'Status: ok' in (p/'launch.txt').read_text(),
 'public_https_session_observed':'hitel:public_https_demo_session_issued' in logs or 'hitel:public_https_demo_session_issued' in boot,
 'original_public_model_SHA_verified':'LOCAL_TEST_ORIGINAL_MODEL_READY' in logs,
 'original_sdk_auto_engine_created':'ORIGINAL_AUTO_HARDWARE_MODEL_CREATED_BY_FLUTTER' in logs,
 'original_flutter_texture_first_frame':'first frame on the texture' in logs,
 'no_sdk_load_failure':'load failed:' not in logs and 'startup_failed' not in logs,
 'no_android_crash':'FATAL EXCEPTION' not in logs and 'Flutter initialization failed' not in logs,
 'no_http_cleartext':'Cleartext HTTP traffic' not in logs,
 'app_still_running':bool((p/'app.pid').read_text().strip()) if (p/'app.pid').exists() else False,
}
result={'platform':'REAL_ANDROID_X86_64_EMULATOR_WITH_ARM64_NATIVE_BRIDGE (not physical Galaxy)', 'public_https':'https://hitel-expression2-auth-production.up.railway.app','auto_inference':'Original SDK create(context,combined) default settings','checks':checks,'pass':all(checks.values())}
(p/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
if not result['pass']:sys.exit(71)
print('REAL_PUBLIC_HTTPS_FLUTTER_SDK_FIRST_FRAME_E2E_PASS')
PY
