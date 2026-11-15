#!/usr/bin/env bash
# Android 14 standalone install/launch smoke: one recovered IXIO package at a time.
set -uo pipefail
OUT=".ixio-rebuild-output"
LOG="ixio-standalone-smoke"
mkdir -p "$LOG"
: > "$LOG/overview.tsv"
SDK="${ANDROID_HOME:-/usr/local/lib/android/sdk}"
BUILD_TOOLS="$(find "$SDK/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
echo "EMULATOR_ANDROID_VERSION=$(adb shell getprop ro.build.version.release)" | tee "$LOG/environment.txt"
echo "NATIVE_BRIDGE=$(adb shell getprop ro.dalvik.vm.native.bridge)" | tee -a "$LOG/environment.txt"
adb shell getprop ro.product.cpu.abilist | tee -a "$LOG/environment.txt"
adb uninstall com.lguplus.aicallagent >/dev/null 2>&1 || true
adb uninstall com.lguplus.callrecorder >/dev/null 2>&1 || true
FAILED=0

test_package() {
  local group="$1"
  local pkg="$2"
  local manifest="$LOG/$group-status.txt"
  echo "GROUP=$group" > "$manifest"
  echo "PACKAGE=$pkg" >> "$manifest"
  adb logcat -c >/dev/null 2>&1 || true
  if [ "$group" = main ]; then
    if [ ! -f "$OUT/main/base.apk" ]; then
      echo "INSTALL=FAIL_MISSING_BASE" | tee -a "$manifest";return 1
    fi
    mapfile -d '' -t apks < <(find "$OUT/main" -maxdepth 1 -type f \
      \( -name 'base.apk' -o -name 'signed-split_*.apk' \) -print0 | sort -z)
    echo "APK_COUNT=${#apks[@]}" | tee -a "$manifest"
    if [ "${#apks[@]}" -ne 4 ]; then
      echo "INSTALL=FAIL_SPLIT_COUNT" | tee -a "$manifest";return 1
    fi
    for file in "${apks[@]}"; do
      "$BUILD_TOOLS/apksigner" verify --verbose "$file" \
        > "$LOG/$group-$(basename "$file").signature.log" 2>&1 || return 1
    done
    adb install-multiple -r "${apks[@]}" > "$LOG/$group-install.log" 2>&1
    install_rc=$?
  else
    local apk="$OUT/recorder/recorder-reassembled-signed.apk"
    if [ ! -f "$apk" ]; then
      echo "INSTALL=FAIL_MISSING_APK" | tee -a "$manifest";return 1
    fi
    "$BUILD_TOOLS/apksigner" verify --verbose "$apk" > "$LOG/$group-signature.log" 2>&1 || return 1
    adb install -r "$apk" > "$LOG/$group-install.log" 2>&1
    install_rc=$?
  fi
  if [ "$install_rc" -ne 0 ]; then
    echo "INSTALL=FAIL_STATUS_$install_rc" | tee -a "$manifest"
    tail -35 "$LOG/$group-install.log" | tee -a "$manifest"
    return 1
  fi
  echo "INSTALL=PASS" | tee -a "$manifest"
  adb shell pm path "$pkg" > "$LOG/$group-pm-path.txt" 2>&1 || true
  if ! grep -q '^package:' "$LOG/$group-pm-path.txt"; then
    echo "PM_PACKAGE_PATH=FAIL" | tee -a "$manifest";return 1
  fi
  echo "PM_PACKAGE_PATH=PASS" | tee -a "$manifest"
  adb shell cmd package resolve-activity --brief "$pkg" > "$LOG/$group-resolve-activity.txt" 2>&1 || true
  adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 \
    > "$LOG/$group-monkey-launch.txt" 2>&1 || true
  if [ "$group" = recorder ]; then
    adb shell am start-foreground-service -n "$pkg/.CallRecordingService" \
      > "$LOG/$group-start-service.txt" 2>&1 || true
  fi
  sleep 8
  adb shell pidof "$pkg" > "$LOG/$group-pid-after-8s.txt" 2>&1 || true
  adb logcat -d -v threadtime -t 7000 > "$LOG/$group-logcat.txt" 2>&1 || true
  adb shell dumpsys package "$pkg" > "$LOG/$group-dumpsys-package.txt" 2>&1 || true
  adb exec-out screencap -p > "$LOG/$group-screen.png" 2>/dev/null || true
  if [ -s "$LOG/$group-pid-after-8s.txt" ]; then
    echo "PROCESS_8S=ALIVE" | tee -a "$manifest"
  else
    echo "PROCESS_8S=NOT_RUNNING" | tee -a "$manifest"
  fi
  if grep -F 'FATAL EXCEPTION' "$LOG/$group-logcat.txt" >/dev/null; then
    echo "FATAL_EXCEPTION_IN_LOGCAT=YES" | tee -a "$manifest"
  else
    echo "FATAL_EXCEPTION_IN_LOGCAT=NONE_OBSERVED" | tee -a "$manifest"
  fi
  echo -e "$group\tPASS\t$(cat "$LOG/$group-pid-after-8s.txt")" >> "$LOG/overview.tsv"
  adb uninstall "$pkg" > "$LOG/$group-uninstall.txt" 2>&1 || true
}
test_package main com.lguplus.aicallagent || FAILED=$((FAILED+1))
test_package recorder com.lguplus.callrecorder || FAILED=$((FAILED+1))
echo "INSTALL_FAILURE_COUNT=$FAILED" | tee "$LOG/final-summary.txt"
cat "$LOG/main-status.txt" "$LOG/recorder-status.txt" | tee -a "$LOG/final-summary.txt"
exit "$FAILED"
