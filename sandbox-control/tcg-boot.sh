#!/bin/bash
set -u
export ANDROID_HOME=/opt/android-sdk
export ANDROID_SDK_ROOT=/opt/android-sdk
export ANDROID_I_WANT_MY_TCG=yes
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
echo ANDROID_TCG_TEST_START
"$ANDROID_HOME/emulator/emulator" -avd HITEL_ANDROID_11 -accel off -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -memory 1536 -cores 2 >/tmp/hitel-tcg-emulator.log 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
for n in $(seq 1 160); do
 if ! kill -0 "$pid" 2>/dev/null;then
  echo EMULATOR_PROCESS_EXITED
  tail -n 22 /tmp/hitel-tcg-emulator.log
  exit 22
 fi
 booted=$("$ANDROID_HOME/platform-tools/adb" -s emulator-5554 shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
 if [ "$booted" = 1 ];then
  echo ANDROID_11_TCG_REAL_BOOT_OK
  "$ANDROID_HOME/platform-tools/adb" -s emulator-5554 shell getprop ro.build.version.release || true
  exit 0
 fi
 if [ $((n%20)) -eq 0 ];then echo "ANDROID_TCG_STILL_BOOTING_$n";fi
 sleep 1
done
echo ANDROID_11_TCG_NOT_BOOTED_IN_160_SECONDS
tail -n 25 /tmp/hitel-tcg-emulator.log
exit 24
