#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
# No accounts, external ports, or exported device state are used in this probe.
: "${RAILWAY_VOLUME_MOUNT_PATH:?Persistent Railway volume must be attached}"
[[ "$RAILWAY_VOLUME_MOUNT_PATH" == /data ]] || exit 2
export ANDROID_AVD_HOME=/data/avd ANDROID_USER_HOME=/data/android-user
mkdir -p "$ANDROID_AVD_HOME" "$ANDROID_USER_HOME"
name=hitel-play-dev
serial=emulator-5554
if [[ ! -f "$ANDROID_AVD_HOME/$name.ini" ]]; then
  printf 'no\n' | avdmanager create avd -n "$name" -k 'system-images;android-35;google_apis_playstore;x86_64' -d pixel_6
  echo 'HITEL_PERSISTENT_AVD_CREATED'
else
  echo 'HITEL_PERSISTENT_AVD_REUSED'
fi
cleanup() {
  adb -s "$serial" emu kill >/dev/null 2>&1 || true
  if [[ -n "${pid:-}" ]]; then wait "$pid" 2>/dev/null || true; fi
}
trap cleanup EXIT
trap 'exit 143' TERM INT
accel=off
if emulator -accel-check >/tmp/hitel-accel-check.txt 2>&1; then accel=auto; fi
echo "HITEL_ANDROID_ACCEL=$accel"
emulator -avd "$name" -port 5554 -no-window -noaudio -gpu swiftshader_indirect -accel "$accel" -no-snapshot -no-boot-anim -memory 2048 -cores 2 > /tmp/hitel-emulator.log 2>&1 &
pid=$!
ready=0
for i in $(seq 1 360); do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo 'HITEL_ANDROID_BOOT_FAILED'
    tail -n 35 /tmp/hitel-emulator.log
    exit 1
  fi
  if [[ "$(adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)" == 1 ]]; then ready=1; break; fi
  sleep 3
done
if [[ "$ready" != 1 ]]; then echo 'HITEL_ANDROID_BOOT_TIMEOUT'; exit 1; fi
adb -s "$serial" shell pm path com.android.vending | grep -q '^package:'
echo 'HITEL_ANDROID_BOOT_AND_PLAY_STORE_VERIFIED'
if [[ "$(adb -s "$serial" shell cat /data/local/tmp/hitel-railway-probe 2>/dev/null | tr -d '\r' || true)" == hitel-persistence-v1 ]]; then
  echo 'HITEL_ANDROID_USERDATA_PERSISTENCE_VERIFIED'
else
  adb -s "$serial" shell 'echo hitel-persistence-v1 > /data/local/tmp/hitel-railway-probe'
  echo 'HITEL_ANDROID_USERDATA_MARKER_WRITTEN'
fi
# End this one-shot probe so that emulator CPU usage does not run continuously.
echo 'HITEL_PERSISTENT_HOST_BOOT_PROBE_COMPLETED'
