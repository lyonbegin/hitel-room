#!/usr/bin/env bash
# Verifies ARM64 native bridge using *real vendor* shared libraries, not a stub.
set -uo pipefail
OUT="$GITHUB_WORKSPACE/reports/arm-bridge"
APK="$GITHUB_WORKSPACE/build/app-debug.apk"
mkdir -p "$OUT"
echo "SDK=expression2-android:0.6.2" > "$OUT/context.txt"
echo "APK=$APK" >> "$OUT/context.txt"
adb wait-for-device || { echo "ADB_BOOT_FAILED" | tee "$OUT/verdict.txt"; exit 1; }
for prop in ro.build.version.sdk ro.build.version.release ro.product.cpu.abi ro.product.cpu.abilist ro.dalvik.vm.native.bridge ro.hardware sys.boot_completed; do
  echo "$prop=$(adb shell getprop "$prop" | tr -d '\r')" >> "$OUT/properties.txt"
done
adb shell ls -l /system/lib64/libndk_translation.so /system/lib/libndk_translation.so > "$OUT/translator-files.txt" 2>&1 || true
adb devices -l > "$OUT/devices.txt"
unzip -Z1 "$APK" | grep -E '^lib/.+\.so$' > "$OUT/apk-shared-libs.txt" || true
sha256sum "$APK" > "$OUT/apk-sha256.txt"
if ! grep -q '^lib/arm64-v8a/libexpr2jni.so$' "$OUT/apk-shared-libs.txt"; then
  echo "ARM64_VENDOR_LIBRARY_MISSING_IN_APK" | tee "$OUT/verdict.txt"
  exit 1
fi
adb logcat -c >/dev/null 2>&1 || true
adb shell am force-stop com.example.x2hello >/dev/null 2>&1 || true
set +e
adb install -r "$APK" > "$OUT/adb-install.txt" 2>&1
code=$?
set -e
echo "ADB_INSTALL_EXIT=$code" | tee "$OUT/verdict.txt"
cat "$OUT/adb-install.txt"
if [[ "$code" != "0" ]]; then
  echo "APK_INSTALL_FAILED" | tee -a "$OUT/verdict.txt"
  exit 1
fi
adb shell am start -n com.example.x2hello/.MainActivity > "$OUT/activity-start.txt" 2>&1 || true
sleep 8
adb logcat -d -v brief -s BITHUMAN_ARM_BRIDGE:V '*:S' > "$OUT/native-probe-log.txt" 2>&1 || true
adb logcat -d -v time -t 1800 > "$OUT/full-logcat.txt" 2>&1 || true
adb shell dumpsys activity activities > "$OUT/activities.txt" 2>&1 || true
adb shell uiautomator dump /sdcard/arm-bridge.xml > "$OUT/ui-dump.txt" 2>&1 || true
adb pull /sdcard/arm-bridge.xml "$OUT/window.xml" >/dev/null 2>&1 || true
adb exec-out screencap -p > "$OUT/screenshot.png" 2>/dev/null || true
echo "=== device properties ==="
cat "$OUT/properties.txt"
echo "=== native bridge results ==="
cat "$OUT/native-probe-log.txt"
if ! grep -q 'PROBE_BEGIN' "$OUT/native-probe-log.txt"; then
  echo "PROBE_NOT_EXECUTED_OR_ACTIVITY_CRASH" | tee -a "$OUT/verdict.txt"
  exit 1
fi
for name in LiteRt expr2jni; do
  if grep -q "LOAD_OK:$name" "$OUT/native-probe-log.txt"; then
    echo "VENDOR_NATIVE_LOAD_PASS:$name" | tee -a "$OUT/verdict.txt"
  else
    echo "VENDOR_NATIVE_LOAD_FAIL:$name" | tee -a "$OUT/verdict.txt"
  fi
done
if grep -q 'LOAD_OK:LiteRt' "$OUT/native-probe-log.txt" && grep -q 'LOAD_OK:expr2jni' "$OUT/native-probe-log.txt"; then
  echo "ARM64_VENDOR_LIBRARIES_LOADED_ON_EMULATOR" | tee -a "$OUT/verdict.txt"
  echo "RENDERING_NOT_TESTED_NO_API_CREDENTIALS" | tee -a "$OUT/verdict.txt"
  exit 0
fi
echo "ARM64_VENDOR_LIBRARIES_NOT_ALL_LOADED" | tee -a "$OUT/verdict.txt"
exit 1
