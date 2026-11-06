#!/usr/bin/env bash
set -Eeuo pipefail
APK="$(find callassistant-native/systemlab/build/outputs/apk/debug -maxdepth 1 -name '*.apk' -type f | head -n 1)"
PKG="app.hitel.systemlab"
OUT="system-audio-evidence"
mkdir -p "$OUT"
finish() {
  rc=$?
  set +e
  adb logcat -d -v threadtime > "$OUT/logcat.txt" 2>&1
  adb shell dumpsys package "$PKG" > "$OUT/dumpsys-package.txt" 2>&1
  adb shell dumpsys telecom > "$OUT/dumpsys-telecom.txt" 2>&1
  adb exec-out screencap -p > "$OUT/screenshot.png" 2>/dev/null
  printf "exit_code=%d\n" "$rc" > "$OUT/result.txt"
  adb emu gsm cancel 5551234 >/dev/null 2>&1
}
trap finish EXIT

adb wait-for-device
adb shell getprop ro.build.fingerprint | tee "$OUT/fingerprint.txt"
DEBUGGABLE="$(adb shell getprop ro.debuggable | tr -d '\r')"
echo "ro.debuggable=$DEBUGGABLE"
echo "APK=$APK"
ls -lh callassistant-native/systemlab/build/outputs/apk/debug || true
test -s "$APK" || { echo "APK not found at output path"; exit 20; }
if [ "$DEBUGGABLE" != "1" ]; then
  echo "AVD system does not advertise debuggable; try adb root and retain the actual error"
fi
echo "[SYS-LAB] Configure writable temporary emulator system"
adb root
adb wait-for-device
adb disable-verity > "$OUT/disable-verity.txt" 2>&1 || true
adb reboot
adb wait-for-device
sleep 5
adb root
adb wait-for-device
adb remount | tee "$OUT/remount.txt"
adb shell mkdir -p /system/priv-app/HitelAudioLab
adb push "$APK" /system/priv-app/HitelAudioLab/HitelAudioLab.apk
adb push callassistant-native/systemlab/privapp-permissions-hitel-audio-lab.xml /system/etc/permissions/privapp-permissions-hitel-audio-lab.xml
adb shell chmod 0644 /system/priv-app/HitelAudioLab/HitelAudioLab.apk
adb shell chmod 0644 /system/etc/permissions/privapp-permissions-hitel-audio-lab.xml
adb shell restorecon -R /system/priv-app/HitelAudioLab || true
adb reboot
adb wait-for-device
for i in $(seq 1 90); do
  test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" && break
  sleep 2
done
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1"
adb shell pm path "$PKG" | tee "$OUT/system-pm-path.txt"
grep -F '/system/priv-app/HitelAudioLab' "$OUT/system-pm-path.txt"
adb shell dumpsys package "$PKG" > "$OUT/privapp-permissions.txt"
for perm in CAPTURE_AUDIO_OUTPUT CALL_AUDIO_INTERCEPTION MODIFY_AUDIO_ROUTING MODIFY_PHONE_STATE; do
  grep -q "android.permission.$perm: granted=true" "$OUT/privapp-permissions.txt" || {
    echo "[SYS-LAB] Permission $perm was not granted by AVD firmware"; exit 22;
  }
done
adb shell pm grant "$PKG" android.permission.RECORD_AUDIO
adb shell pm grant "$PKG" android.permission.READ_PHONE_STATE
echo "[SYS-LAB] Privileged package and permissions verified"

echo "[SYS-LAB] Virtual GSM call (has no real SIM caller audio)"
adb emu gsm call 5551234
sleep 3
adb emu gsm accept 5551234
sleep 3
adb logcat -c
adb shell am start -W -n "$PKG/.SystemAudioLabActivity" --ez run_all true | tee "$OUT/launch.txt"
FINISHED=0
for i in $(seq 1 40); do
  adb logcat -d -s HITEL_SYS_AUDIO:I '*:S' > "$OUT/audio-results.txt"
  if grep -q LAB_COMPLETE "$OUT/audio-results.txt"; then FINISHED=1; break; fi
  sleep 2
done
test "$FINISHED" = "1" || { echo "[SYS-LAB] Probe did not finish"; exit 23; }
for method in DIRECT_DOWNLINK AOSP_DOWNLINK AOSP_UPLINK; do
  grep -q "ATTEMPT $method" "$OUT/audio-results.txt" || exit 24
  grep -q "RESULT $method=" "$OUT/audio-results.txt" || exit 25
done
for perm in CAPTURE_AUDIO_OUTPUT CALL_AUDIO_INTERCEPTION MODIFY_AUDIO_ROUTING MODIFY_PHONE_STATE; do
  grep -q "PERMISSION $perm=GRANTED" "$OUT/audio-results.txt" || exit 26
done
grep 'HITEL_SYS_AUDIO' "$OUT/audio-results.txt"
echo "[SYS-LAB] Permission and API execution verified. Remote SIM voice remains unverified."
