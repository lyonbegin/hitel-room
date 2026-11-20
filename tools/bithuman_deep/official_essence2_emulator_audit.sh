#!/usr/bin/env bash
set -euo pipefail
OUT="$GITHUB_WORKSPACE/official-proof"
mkdir -p "$OUT"
adb shell getprop ro.build.version.sdk > "$OUT/emulator-api.txt"
adb shell getprop ro.product.cpu.abilist > "$OUT/emulator-abis.txt"
adb shell getprop ro.dalvik.vm.native.bridge > "$OUT/emulator-native-bridge.txt" || true
APK="$GITHUB_WORKSPACE/official-sources/android/essence2-hello/app/build/outputs/apk/debug/app-debug.apk"
set +e
adb install -r "$APK" > "$OUT/adb-install.txt" 2>&1
INST_RC=$?
set -e
cat "$OUT/adb-install.txt"
if (( INST_RC != 0 )); then
  echo BLOCKED_OFFICIAL_APK_INSTALL_NO_SUPPORTED_NATIVE_ABI_OR_PLATFORM > "$OUT/emulator-outcome.txt"
  echo "install_exit_code=$INST_RC" >> "$OUT/emulator-outcome.txt"
else
  echo PASS_OFFICIAL_UNMODIFIED_KOTLIN_APK_INSTALLED > "$OUT/emulator-outcome.txt"
  adb shell am start -S -n com.example.e2hello/.MainActivity > "$OUT/adb-launch.txt" 2>&1
  sleep 8
  adb logcat -d -v time -s E2HELLO:I AndroidRuntime:E > "$OUT/official-app-logcat.txt" || true
  adb exec-out screencap -p > "$OUT/official-app-screen.png" || true
  if grep -q "No API secret" "$OUT/official-app-logcat.txt"; then
    echo BLOCKED_OFFICIAL_ENGINE_MISSING_API_SECRET_EXPECTED >> "$OUT/emulator-outcome.txt"
  else
    echo OFFICIAL_ENGINE_BOOT_REASON_UNVERIFIED_SEE_LOGCAT >> "$OUT/emulator-outcome.txt"
  fi
fi
echo "emulator_audio_backend=-no-audio (physical audibility cannot be verified)" >> "$OUT/emulator-outcome.txt"
cat "$OUT/emulator-outcome.txt"
cat "$OUT/emulator-abis.txt"
