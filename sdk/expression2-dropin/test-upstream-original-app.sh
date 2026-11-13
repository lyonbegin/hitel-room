#!/usr/bin/env bash
set -euo pipefail
report=reports/expression2-dropin
mkdir -p "$report"
adb shell getprop ro.product.cpu.abilist | tee "$report/device-abis.txt"
adb install -r build/expression2-dropin/upstream-expression2-hello-sdk-replaced.apk \
  2>&1 | tee "$report/install.txt"
adb logcat -c
adb shell am start -W -n com.example.x2hello/.MainActivity \
  2>&1 | tee "$report/launch.txt"
echo ORIGINAL_APP_LAUNCHED_SDK_SWAPPED
result=TIMEOUT
for n in $(seq 1 180); do
  adb logcat -d -v time > "$report/logcat-current.txt"
  if grep -q 'DONE_FRAMES [1-9]' "$report/logcat-current.txt"; then
    result=FRAMES_PRODUCED
    break
  fi
  if grep -q 'X2HELLO.*FAILED:' "$report/logcat-current.txt"; then
    result=SDK_RUNTIME_FAILURE
    break
  fi
  if grep -q 'FATAL EXCEPTION:.*' "$report/logcat-current.txt"; then
    result=ANDROID_FATAL_EXCEPTION
    break
  fi
  sleep 5
done
adb logcat -d -v time > "$report/full-logcat.txt"
adb shell dumpsys meminfo com.example.x2hello > "$report/meminfo.txt" || true
adb shell screencap -p /sdcard/expr2-original-ui.png || true
adb pull /sdcard/expr2-original-ui.png "$report/screenshot.png" || true
echo "$result" | tee "$report/result.txt"
if [ "$result" = FRAMES_PRODUCED ]; then
  grep 'DONE_FRAMES' "$report/full-logcat.txt" | tail -5
  echo ORIGINAL_APP_REAL_MODEL_FRAMES_PRODUCED_CANDIDATE_FIDELITY_UNVERIFIED
  exit 0
fi
echo "ORIGINAL_APP_E2E_NOT_PASSED: $result"
exit 1
