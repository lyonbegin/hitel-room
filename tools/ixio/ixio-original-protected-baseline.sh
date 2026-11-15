#!/usr/bin/env bash
set -uo pipefail
LOG="ixio-original-baseline"
mkdir -p "$LOG"
adb shell getprop ro.build.version.release > "$LOG/android-version.txt" || true
adb shell getprop ro.dalvik.vm.native.bridge > "$LOG/native-bridge.txt" || true
mapfile -d '' -t splits < <(find .ixio-inputs/main-splits -maxdepth 1 -name '*.apk' -print0 | sort -z)
if [ "${#splits[@]}" -ne 4 ]; then
  echo "ORIGINAL_MAIN_SPLIT_COUNT=${#splits[@]}_EXPECTED_4"
  exit 2
fi
for group in main recorder; do
  if [ "$group" = main ]; then
    pkg=com.lguplus.aicallagent
    adb install-multiple -r "${splits[@]}" > "$LOG/main-install.txt" 2>&1
    ret=$?
  else
    pkg=com.lguplus.callrecorder
    adb install -r .ixio-inputs/recorder.apk > "$LOG/recorder-install.txt" 2>&1
    ret=$?
  fi
  if [ "$ret" -ne 0 ]; then
    echo "ORIGINAL_${group}_INSTALL=FAIL_$ret"
    continue
  fi
  echo "ORIGINAL_${group}_INSTALL=PASS"
  adb logcat -c >/dev/null 2>&1 || true
  adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 > "$LOG/$group-launch.txt" 2>&1 || true
  sleep 8
  adb shell pidof "$pkg" > "$LOG/$group-pid-at-8s.txt" 2>&1 || true
  adb logcat -d -v threadtime -t 5000 > "$LOG/$group-logcat.txt" 2>&1 || true
  adb shell dumpsys package "$pkg" > "$LOG/$group-dumpsys.txt" 2>&1 || true
  if [ -s "$LOG/$group-pid-at-8s.txt" ]; then
    echo "ORIGINAL_${group}_PROCESS_8S=ALIVE"
  else
    echo "ORIGINAL_${group}_PROCESS_8S=NOT_RUNNING"
  fi
  echo "ORIGINAL_${group}_TARGET_FATAL_ERRORS:"
  awk '/FATAL EXCEPTION/{p=1;n=0}p {print;n++} n>=40{p=0}' "$LOG/$group-logcat.txt" | grep -A 37 "Process: $pkg" | head -90 || true
  echo "ORIGINAL_${group}_FIREBASE_PROVIDER_LOGS:"
  grep -E "FirebaseInitProvider|FirebaseApp|AppSealing|AppSealingApplication" "$LOG/$group-logcat.txt" | head -45 || true
  adb uninstall "$pkg" > "$LOG/$group-uninstall.txt" 2>&1 || true
done
