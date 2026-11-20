#!/usr/bin/env bash
# Exercise the installed APK and retain output evidence even when lip-sync fails.
set -euo pipefail
APK="${1:?APK}"
BOOT="${2:?boot evidence}"
OUT="${3:?speech evidence}"
mkdir -p "$BOOT" "$OUT"
# The emulator's WAV backend captures the virtual speaker, beyond AudioTrack.
test "${QEMU_AUDIO_DRV:-}" = wav
test -n "${QEMU_WAV_PATH:-}"
adb shell cmd media_session volume --stream 3 --set 15 --get > "$OUT/media-volume.txt" 2>&1
cat "$OUT/media-volume.txt"
set +e
bash tools/bithuman_deep/essence2_e2trace_android15_probe.sh "$APK" "$BOOT" "$OUT"
probe_rc=$?
set -e
printf 'actual_app_probe_exit_code=%s\n' "$probe_rc" > "$OUT/app-probe-result.txt"
adb shell dumpsys audio > "$OUT/android-audio-state.txt" 2>&1 || true
adb shell dumpsys media.audio_flinger > "$OUT/audio-flinger-state.txt" 2>&1 || true
adb shell run-as ai.bithuman.example.avatar_chat.essence2 cat ./app_flutter/hitel_e2_trace.log > "$OUT/final-native-trace.txt" 2>/dev/null || true
adb shell run-as ai.bithuman.example.avatar_chat.essence2 cat ./app_flutter/hitel_ai_e2e.log > "$OUT/final-ai-protocol.txt" 2>/dev/null || true
echo ACTUAL_NATIVE_SPEECH_PREPARATION_AND_COMPLETION
grep -E 'stage=speech\.|stage=sdk.utterance.drained|stage=audio.track.write' "$OUT/final-native-trace.txt" | tail -16 || true
adb logcat -d -v time | grep -E 'BithumanAvatar.*exception|bh-essence-speech|FATAL EXCEPTION|Fatal signal' | tail -15 || true
# android-emulator-runner then stops the emulator and finalizes the WAV header.
exit "$probe_rc"

