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
# Voice-frame success alone is NOT enough. Verify the typed question completes
# the full request/reply protocol, including UI leaving Thinking.
for checkpoint in $(seq 1 12); do
  adb logcat -d -v time > "$OUT/full-after-speech-logcat.txt"
  if grep -q 'HITEL_AI_E2E.*ui.status=responseDone' "$OUT/full-after-speech-logcat.txt"; then
    echo "PASS_ESSENCE2_TYPED_RESPONSE_DONE_AFTER_EXTRA_$((checkpoint * 5))s"
    break
  fi
  echo "PENDING_ESSENCE2_TYPED_AI_REPLY_STATUS_CHECKPOINT_$checkpoint"
  sleep 5
done
adb exec-out screencap -p > "$OUT/keyboard-ai-after-response.png"
adb shell run-as "$APP" cat ./app_flutter/hitel_ai_e2e.log > "$OUT/ai-protocol-app-log.txt"
grep -Fq 'client.rx type=response.done' "$OUT/ai-protocol-app-log.txt"
grep -Fq 'ui.status=responseDone' "$OUT/ai-protocol-app-log.txt"
echo PASS_AI_PROTOCOL_EVENTS_PERSISTED_ON_DEVICE_AND_COPYABLE
adb shell run-as "$APP" cat ./app_flutter/hitel_e2_trace.log > "$OUT/native-function-trace-after-voice.txt"
adb logcat -d -v threadtime | grep 'HITEL_E2TRACE' > "$OUT/native-trace-from-logcat.txt" || true
python3 tools/bithuman_deep/verify_essence2_keyboard_ai_e2e.py \
  --logcat "$OUT/full-after-speech-logcat.txt" \
  --native-trace "$OUT/native-function-trace-after-voice.txt" \
  --report "$OUT/keyboard-ai-end-to-end-result.json"
python3 tools/bithuman_deep/analyze_essence2_e2trace.py \
  --input "$OUT/native-function-trace-after-voice.txt" \
  --output "$OUT/speech-function-summary.json" --require-boot --require-speech
echo PASS_E2TRACE_REAL_DEVICE_AUDIO_GPU_RENDER_PRESENT_FUNCTION_LOGS_CAPTURED
if ((speech_rc != 0)); then
  echo "FAIL_REAL_VOICE_PROBE_RC_$speech_rc"
  exit "$speech_rc"
fi
echo PASS_SOFIA_OFFLINE_MODEL_AND_ACTUAL_SPEECH_FUNC_PROBE
