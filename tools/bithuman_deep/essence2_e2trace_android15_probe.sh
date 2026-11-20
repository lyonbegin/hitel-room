#!/usr/bin/env bash
# A single Bash process: preserve exit statuses, keep script environment,
# and fail on missing ACTUAL device-function traces.
set -euo pipefail
APP='ai.bithuman.example.avatar_chat.essence2'
APK="$1"
BOOT="$2"
OUT="$3"
mkdir -p "$BOOT" "$OUT"
adb shell svc wifi disable
adb shell svc data disable
bash tools/bithuman_deep/essence2_android_emulator_smoke.sh "$APK" "$BOOT"
if grep -q 'api.bithuman.ai' "$BOOT/boot-status.txt"; then
  echo FAIL_MODEL_USED_VENDOR_DNS
  exit 19
fi
echo "apiLevel=$(adb shell getprop ro.build.version.sdk | tr -d '\r')" > "$OUT/device-runtime.txt"
echo "abi=$(adb shell getprop ro.product.cpu.abi | tr -d '\r')" >> "$OUT/device-runtime.txt"
echo "glesVersion=$(adb shell getprop ro.opengles.version | tr -d '\r')" >> "$OUT/device-runtime.txt"
adb shell run-as "$APP" cat ./app_flutter/hitel_e2_trace.log > "$OUT/native-function-trace-before-voice.txt"
python3 tools/bithuman_deep/analyze_essence2_e2trace.py \
  --input "$OUT/native-function-trace-before-voice.txt" \
  --output "$OUT/boot-function-summary.json" --require-boot
echo PASS_E2TRACE_REAL_DEVICE_BOOT_FUNCTION_LOGS_CAPTURED
set +e
bash tools/bithuman_deep/essence2_android_speech_turn_probe.sh "$OUT"
speech_rc=$?
set -e
printf 'voice_probe_exit_code=%s\n' "$speech_rc" > "$OUT/voice-probe-result.txt"
sleep 2
adb shell run-as "$APP" cat ./app_flutter/hitel_e2_trace.log > "$OUT/native-function-trace-after-voice.txt"
adb logcat -d -v threadtime | grep 'HITEL_E2TRACE' > "$OUT/native-trace-from-logcat.txt" || true
python3 tools/bithuman_deep/analyze_essence2_e2trace.py \
  --input "$OUT/native-function-trace-after-voice.txt" \
  --output "$OUT/speech-function-summary.json" --require-boot --require-speech
echo PASS_E2TRACE_REAL_DEVICE_AUDIO_GPU_RENDER_PRESENT_FUNCTION_LOGS_CAPTURED
if ((speech_rc != 0)); then
  echo "FAIL_REAL_VOICE_PROBE_RC_$speech_rc"
  exit "$speech_rc"
fi
echo PASS_SOFIA_OFFLINE_MODEL_AND_ACTUAL_SPEECH_FUNC_PROBE
