#!/usr/bin/env bash
# REAL Android installation + boot + local auth + texture smoke gate.
# This executes the ACTUAL Flutter APK on an Android emulator with ARM64 NativeBridge;
# it does not treat compilation, signing, or synthetic log text as runtime success.
set -euo pipefail
OUT="$GITHUB_WORKSPACE/reports/hitel-avatar-chat-local-auto/emulator"
APK="$GITHUB_WORKSPACE/reports/hitel-avatar-chat-local-auto/apk/HITEL_Original_avatar_chat_Expression2_Local_AUTO_Debug.apk"
PKG=ai.hitel.avatar_chat.localauto
ACTIVITY=ai.bithuman.example.avatar_chat.MainActivity
mkdir -p "$OUT"
test -s "$APK"
echo "REAL_ANDROID_FLUTTER_APK_INSTALL_BEGIN"
adb wait-for-device
adb shell getprop ro.product.cpu.abilist > "$OUT/abis.txt"
adb shell getprop ro.dalvik.vm.native.bridge > "$OUT/native-bridge.txt"
adb shell getprop ro.build.version.sdk > "$OUT/sdk-level.txt"
cat "$OUT/abis.txt"
cat "$OUT/native-bridge.txt"
grep -Fq 'arm64-v8a' "$OUT/abis.txt" || {
  echo "ABORT: Emulator has no ARM64 NativeBridge; cannot test actual APK"; exit 4;
}
adb install -r "$APK" 2>&1 | tee "$OUT/install.txt"
grep -Fq 'Success' "$OUT/install.txt"
adb shell pm path "$PKG" > "$OUT/installed-package.txt"
grep -Fq 'package:' "$OUT/installed-package.txt"
adb shell am force-stop "$PKG" || true
adb logcat -c
adb shell am start -W -n "$PKG/$ACTIVITY" 2>&1 | tee "$OUT/launch.txt"
grep -Fq 'Status: ok' "$OUT/launch.txt"
echo "REAL_ANDROID_FLUTTER_PACKAGE_INSTALLED_AND_ACTIVITY_LAUNCHED"

# CI's x86_64 native bridge can take multiple minutes for first real ARM64 frame.
# A startup error always fails immediately. A real engine create and one real
# Texture post are both mandatory for success.
created=0
first_texture=0
for n in $(seq 1 195); do
  adb logcat -d -v time > "$OUT/full.logcat" || true
  grep -E 'BH_EXPR2_LOCAL_TEST|EXPR2_LOCAL_FIXTURE|BithumanAvatar|AndroidRuntime|NetworkSecurityConfig|[Cc]leartext|FATAL EXCEPTION|Flutter'     "$OUT/full.logcat" > "$OUT/filtered.logcat" || true
  if grep -Eq 'ORIGINAL_AUTO_HARDWARE_MODEL_CREATED_BY_FLUTTER|LOCAL_TEST_ORIGINAL_CREATE_PASS' "$OUT/filtered.logcat"; then
    created=1
  fi
  if grep -Fq 'first frame on the texture' "$OUT/filtered.logcat"; then
    first_texture=1
  fi
  if grep -Eq 'load failed:|[Cc]leartext HTTP traffic .*not permitted|EXPR2_LOCAL_FIXTURE.*TEST_AUTH_REJECTED|FATAL EXCEPTION' "$OUT/filtered.logcat"; then
    echo "REAL_ANDROID_APP_BOOT_FAILED" | tee "$OUT/VERDICT.txt"
    break
  fi
  if [ "$created" -eq 1 ] && [ "$first_texture" -eq 1 ]; then
    echo "REAL_ANDROID_CREATE_AND_FIRST_TEXTURE_FRAME_PASS" | tee "$OUT/VERDICT.txt"
    break
  fi
  if [ $((n % 12)) -eq 0 ];then
    echo "EMULATOR_RUNTIME_POLL=$n created=$created texture=$first_texture"
  fi
  sleep 5
done

adb logcat -d -v time > "$OUT/full.logcat" || true
grep -E 'BH_EXPR2_LOCAL_TEST|EXPR2_LOCAL_FIXTURE|BithumanAvatar|AndroidRuntime|NetworkSecurityConfig|[Cc]leartext|FATAL EXCEPTION|Flutter'   "$OUT/full.logcat" > "$OUT/filtered.logcat" || true
adb exec-out screencap -p > "$OUT/screenshot.png" || true
adb shell dumpsys meminfo "$PKG" > "$OUT/meminfo.txt" || true
adb shell run-as "$PKG" sh -c 'find . -name boot_status.txt -print' > "$OUT/boot-status-path.txt" 2>/dev/null || true
adb shell run-as "$PKG" cat app_flutter/boot_status.txt > "$OUT/boot-status.txt" 2>/dev/null || true
adb shell pidof "$PKG" > "$OUT/pid.txt" || true
python3 - "$OUT" <<'PY'
from pathlib import Path
import json,sys
p=Path(sys.argv[1])
log=(p/'filtered.logcat').read_text(errors='replace')
checks={
  'real_apk_adb_installed':'Success' in (p/'install.txt').read_text(),
  'activity_launched':'Status: ok' in (p/'launch.txt').read_text(),
  'local_test_original_model_ready':'LOCAL_TEST_ORIGINAL_MODEL_READY' in log,
  'local_test_auth_server_started':'TEST_LOCAL_AUTH_READY' in log,
  'original_auto_sdk_engine_created':('ORIGINAL_AUTO_HARDWARE_MODEL_CREATED_BY_FLUTTER' in log),
  'first_frame_posted_to_original_flutter_texture':'first frame on the texture' in log,
  'no_cleartext_http_rejection':'Cleartext HTTP traffic' not in log,
  'no_plugin_load_failure':'load failed:' not in log,
  'no_fatal_exception':'FATAL EXCEPTION' not in log,
}
checks['local_test_http_auth_validated']='TEST_AUTH_VALIDATE_ACCEPTED' in log
report={'test':'REAL Flutter APK installed and launched on Android emulator via ARM64 NativeBridge',
        'checks':checks,'all_pass':all(checks.values()),
        'emulator_arm64_abi':(p/'abis.txt').read_text().strip(),
        'local_auth':'synthetic localhost DEBUG ONLY; not production licensing',
        'hardware':'SDK original AUTO; emulator GPU/NPU acceleration NOT claimed'}
(p/'RUNTIME_RESULT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
if not report['all_pass']:raise SystemExit(9)
print('REAL_ANDROID_FLUTTER_APP_INSTALL_AUTH_SDK_CREATE_TEXTURE_PASS')
PY
