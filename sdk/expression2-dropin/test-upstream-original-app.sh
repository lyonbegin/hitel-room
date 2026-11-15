#!/usr/bin/env bash
set -euo pipefail
report=reports/expression2-dropin
mkdir -p "$report"
adb shell getprop ro.product.cpu.abilist | tee "$report/device-abis.txt"
adb install -r build/expression2-dropin/upstream-expression2-hello-sdk-replaced.apk \
  2>&1 | tee "$report/install.txt"
# Seed the exact checksum-verified PUBLIC Wise Pup IMX from the host directly
# into the test app's private cache. This avoids emulator DNS dependence and
# keeps SDK authorization/session semantics separate from public model fetch.
if [[ -n "${EXPR2_PUBLIC_IMX_PATH:-}" ]]; then
  test -s "$EXPR2_PUBLIC_IMX_PATH"
  echo 'd2c70beaa48b73d40681366879599d4940f744b736105c030fe13c6852d626d9  '"$EXPR2_PUBLIC_IMX_PATH" | sha256sum -c
  adb exec-in run-as com.example.x2hello sh -c \
    'mkdir -p files/expression2-models && cat > files/expression2-models/wise-pup-expression2.imx' \
    < "$EXPR2_PUBLIC_IMX_PATH"
  adb exec-out run-as com.example.x2hello \
    sha256sum files/expression2-models/wise-pup-expression2.imx \
    > "$report/device-public-imx-sha256.txt"
  grep -q '^d2c70beaa48b73d40681366879599d4940f744b736105c030fe13c6852d626d9 ' \
    "$report/device-public-imx-sha256.txt"
  echo 'EXPR2_PUBLIC_IMX_PRESEEDED_ORIGINAL_BYTES_PASS' | tee "$report/model-preseed.txt"
fi
adb logcat -c
adb shell am start -W -n com.example.x2hello/.MainActivity \
  2>&1 | tee "$report/launch.txt"
echo ORIGINAL_APP_LAUNCHED_SDK_SWAPPED
result=TIMEOUT
for n in $(seq 1 48); do
  if (( n % 6 == 0 )); then
    adb logcat -d -v brief -s HITEL_EXPRESSION2:I X2HELLO:I '*:S' \
      | tail -35 | tee "$report/progress-$n.txt" || true
    adb shell dumpsys meminfo com.example.x2hello \
      > "$report/meminfo-$n.txt" || true
    adb shell top -b -n 1 -o PID,CPU,RES,NAME \
      > "$report/top-$n.txt" 2>&1 || true
  fi
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
grep -E 'HITEL_EXPRESSION2|X2HELLO' "$report/full-logcat.txt" \
  > "$report/sdk-trace.txt" || true
tail -120 "$report/sdk-trace.txt" || true
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
