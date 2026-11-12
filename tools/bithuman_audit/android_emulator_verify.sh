#!/usr/bin/env bash
# Execute inside an Android emulator. Real device/ABI/launch evidence only.
set -uo pipefail
RESULTS="$GITHUB_WORKSPACE/reports/bithuman-emulator"
APK="$GITHUB_WORKSPACE/vendor/app/build/outputs/apk/debug/app-debug.apk"
mkdir -p "$RESULTS"
adb wait-for-device
for property in ro.build.version.release ro.build.version.sdk ro.product.cpu.abi ro.product.cpu.abilist ro.dalvik.vm.native.bridge ro.hardware; do
  printf '%s=' "$property" >> "$RESULTS/emulator-props.txt"
  adb shell getprop "$property" >> "$RESULTS/emulator-props.txt"
done
adb devices -l > "$RESULTS/adb-devices.txt"
unzip -Z1 "$APK" | grep -E '^lib/[^/]+/.*\.so$' > "$RESULTS/apk-native-libraries.txt" || true
sha256sum "$APK" > "$RESULTS/apk-sha256.txt"
grep -q '^lib/arm64-v8a/' "$RESULTS/apk-native-libraries.txt" || {
  echo "ERROR_ORIGINAL_APK_HAS_NO_ARM64_LIBRARY" | tee -a "$RESULTS/verdict.txt"; exit 1;
}
echo "ORIGINAL_APK_ARM64_LIBRARIES_CONFIRMED" | tee -a "$RESULTS/verdict.txt"
if grep -q '^lib/x86_64/' "$RESULTS/apk-native-libraries.txt"; then
  echo "APK_HAS_X86_64_NATIVE_LIBS" | tee -a "$RESULTS/verdict.txt"
else
  echo "APK_HAS_NO_X86_64_NATIVE_LIBS" | tee -a "$RESULTS/verdict.txt"
fi
set +e
adb install -r "$APK" > "$RESULTS/install-stdout.txt" 2>&1
status=$?
set -e
cat "$RESULTS/install-stdout.txt"
echo "ADB_INSTALL_EXIT_CODE=$status" | tee -a "$RESULTS/verdict.txt"
if [[ "$status" != "0" ]]; then
  if grep -Eq 'INSTALL_FAILED_NO_MATCHING_ABIS|ABI .*not supported' "$RESULTS/install-stdout.txt"; then
    echo "VERIFIED_EXPECTED_ABI_INCOMPATIBILITY" | tee -a "$RESULTS/verdict.txt"
    exit 0
  fi
  echo "UNEXPECTED_INSTALL_FAILURE" | tee -a "$RESULTS/verdict.txt"
  exit 1
fi
echo "ORIGINAL_SDK_SAMPLE_APK_INSTALLED" | tee -a "$RESULTS/verdict.txt"
adb shell am force-stop com.example.x2hello >/dev/null 2>&1 || true
adb logcat -c || true
adb shell am start -n com.example.x2hello/.MainActivity > "$RESULTS/launch.txt" 2>&1 || true
sleep 5
adb shell dumpsys activity activities > "$RESULTS/activities.txt" 2>&1 || true
adb shell uiautomator dump /sdcard/window.xml > "$RESULTS/ui-dump-command.txt" 2>&1 || true
adb pull /sdcard/window.xml "$RESULTS/window.xml" >/dev/null 2>&1 || true
adb exec-out screencap -p > "$RESULTS/screenshot.png" || true
adb logcat -d -v time -t 1500 > "$RESULTS/logcat.txt" || true
adb shell dumpsys package com.example.x2hello > "$RESULTS/package.txt" || true
if grep -Eq 'No API secret|API secret|No API' "$RESULTS/window.xml" 2>/dev/null; then
  echo "LAUNCHED_UI_WITH_NO_API_CREDENTIAL_EXPECTED" | tee -a "$RESULTS/verdict.txt"
  exit 0
fi
if grep -Eq 'Unable to start activity|FATAL EXCEPTION|UnsatisfiedLinkError|No implementation found' "$RESULTS/logcat.txt"; then
  echo "NATIVE_OR_JAVA_LAUNCH_FAILURE" | tee -a "$RESULTS/verdict.txt"
  exit 1
fi
if grep -q 'com.example.x2hello' "$RESULTS/activities.txt"; then
  echo "APP_LAUNCHED_BUT_RENDER_UNVERIFIED_NO_CREDENTIAL" | tee -a "$RESULTS/verdict.txt"
  exit 0
fi
echo "APP_INSTALLS_BUT_LAUNCH_NOT_CONFIRMED" | tee -a "$RESULTS/verdict.txt"
exit 1
