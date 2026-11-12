#!/usr/bin/env bash
set -euo pipefail
APP=app.hitel.callflowlab.v14.growing.diag
mkdir -p /tmp/hitel14-v19-emulator
adb wait-for-device
adb shell getprop sys.boot_completed | grep -Fx 1
echo "EMULATOR_BUILD="$(adb shell getprop ro.build.version.release)
echo "EMULATOR_ABI="$(adb shell getprop ro.product.cpu.abi)
APK=AndroidProject/app/build/outputs/apk/debug/app-debug.apk
adb install -r "$APK"
adb shell pm grant "$APP" android.permission.RECORD_AUDIO
adb shell input keyevent 82
adb shell am start -W -n "$APP/app.hitel.samsungprobe.W03ConsoleActivity"
sleep 6
PID=$(adb shell pidof "$APP" | tr -d '\r')
test -n "$PID"
echo "PASS_EMULATOR_ACTUAL_APK_INSTALLED_AND_ORIGINAL_W03_RUNNING pid=$PID"
adb exec-out screencap -p > /tmp/hitel14-v19-emulator/w03-screen.png
test -s /tmp/hitel14-v19-emulator/w03-screen.png
echo "PASS_EMULATOR_W03_SCREENSHOT_CAPTURED"
# The pinned button appears immediately below the header/status before the
# tab strip. Because the old XML dump had a permission error, verify through
# the ACTUAL top Activity, not unreliable /sdcard XML permissions.
for Y in 220 280 340 400 460 520; do
  adb shell input tap 510 "$Y"
  sleep 2
  adb shell dumpsys activity activities > /tmp/hitel14-v19-emulator/activity.txt
  if grep -E 'topResumedActivity|mResumedActivity|ResumedActivity' /tmp/hitel14-v19-emulator/activity.txt | grep -q RecordingFolderPlaybackActivity; then
    echo "PASS_EMULATOR_REAL_BUTTON_CLICK_OPENED_RECORDING_PLAYER y=$Y"
    adb exec-out screencap -p > /tmp/hitel14-v19-emulator/player-screen.png
    test -s /tmp/hitel14-v19-emulator/player-screen.png
    echo "PASS_EMULATOR_RECORDING_PLAYER_SCREENSHOT_CAPTURED"
    adb logcat -d -v time > /tmp/hitel14-v19-emulator/logcat.txt
    exit 0
  fi
done
echo "FAILED: pinned button could not open playback activity in emulator"
adb shell dumpsys activity activities | tail -80
adb logcat -d -v time > /tmp/hitel14-v19-emulator/logcat.txt
exit 1
