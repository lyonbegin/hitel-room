#!/usr/bin/env bash
set -euo pipefail
APK="${1:?Android APK}"
test -s "$APK"
adb logcat -G 32M
adb shell svc wifi disable
adb shell svc data disable
echo PASS_LIVE_EMULATOR_ENTRY_BASH
bash tools/bithuman_deep/essence2_android_emulator_smoke.sh "$APK" essence2-live-boot
bash tools/bithuman_deep/essence2_live_pcm16_emulator_probe.sh essence2-live-speech
echo PASS_LIVE_ESSENCE2_ANDROID15_EMULATOR
