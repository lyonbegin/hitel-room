#!/usr/bin/env bash
# Exercise the official Flutter v2.6.37 Essence2 AvatarPlayer (not renderOnce).
# This is a debug mock with a fixed 14.437 s PCM fixture, not a real TTS or AI.
set -euo pipefail
APK="${1:?APK}"
BOOT="${2:?boot evidence}"
OUT="${3:?stream evidence}"
mkdir -p "$BOOT" "$OUT"
test "${QEMU_AUDIO_DRV:-}" = wav
test -n "${QEMU_WAV_PATH:-}"
adb shell svc wifi disable
adb shell svc data disable
adb shell cmd media_session volume --stream 3 --set 15 --get > "$OUT/media-volume.txt" 2>&1 || true
bash tools/bithuman_deep/essence2_android_emulator_smoke.sh "$APK" "$BOOT"
PACKAGE=ai.bithuman.example.avatar_chat.essence2
set +e
bash tools/bithuman_deep/essence2_android_speech_turn_probe.sh "$OUT"
probe_rc=$?
set -e
printf 'speech_probe_exit_code=%s\n' "$probe_rc" > "$OUT/app-probe-result.txt"
adb shell run-as "$PACKAGE" cat ./app_flutter/hitel_e2_trace.previous.log > "$OUT/native-trace-previous.txt" 2>/dev/null || true
adb shell run-as "$PACKAGE" cat ./app_flutter/hitel_e2_trace.log > "$OUT/native-trace-current.txt" 2>/dev/null || true
cat "$OUT/native-trace-previous.txt" "$OUT/native-trace-current.txt" > "$OUT/native-function-trace-after-voice.txt"
adb shell run-as "$PACKAGE" cat ./app_flutter/hitel_ai_e2e.log > "$OUT/ai-protocol-app-log.txt" 2>/dev/null || true
adb logcat -d -v time > "$OUT/full-after-speech-logcat.txt" || true
python3 tools/bithuman_deep/check_essence2_original_stream.py \
  --native "$OUT/native-function-trace-after-voice.txt" \
  --protocol "$OUT/ai-protocol-app-log.txt" \
  --report "$OUT/original-stream-proof.json"
report_rc=$?
python3 tools/bithuman_deep/analyze_essence2_e2trace.py \
  --input "$OUT/native-function-trace-after-voice.txt" \
  --output "$OUT/stream-frame-coverage.json" || true
adb shell dumpsys audio > "$OUT/android-audio-state.txt" 2>&1 || true
echo "ESSENCE2_ORIGINAL_STREAM_PROBE: speech_rc=$probe_rc report_rc=$report_rc"
if ((probe_rc != 0)); then exit "$probe_rc"; fi
exit "$report_rc"
