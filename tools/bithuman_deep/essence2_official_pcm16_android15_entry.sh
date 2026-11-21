#!/usr/bin/env bash
# Invoked from android-emulator-runner's /bin/sh -c as "bash <this file>".
# The bash interpreter must be explicit: dash rejects 'set -o pipefail'.
set -euo pipefail
APK="${1:?built APK filename}"
test -s "$APK"
adb logcat -G 32M
adb shell svc wifi disable
adb shell svc data disable
echo PASS_EMULATOR_ENTRY_BASH_STARTED
bash tools/bithuman_deep/essence2_android_emulator_smoke.sh \
  "$APK" essence2-official-emulator-boot
bash tools/bithuman_deep/essence2_official_pcm16_emulator_probe.sh \
  essence2-official-emulator-speech
echo PASS_OFFICIAL_ESSENCE2_ANDROID15_EMULATOR_END_TO_END
