#!/usr/bin/env bash
# Exercise the installed APK and retain output evidence even when lip-sync fails.
set -euo pipefail
APK="${1:?APK}"
BOOT="${2:?boot evidence}"
OUT="${3:?speech evidence}"
mkdir -p "$BOOT" "$OUT"
# One continuous monitor survives Android output-device closes and reopens.
test -n "${QEMU_WAV_PATH:-}"
recorder_pid=''
stop_recorder() {
  if [ -n "$recorder_pid" ]; then
    kill -TERM "$recorder_pid" 2>/dev/null || true
    wait "$recorder_pid" || true
    recorder_pid=''
  fi
}
trap stop_recorder EXIT
case "${QEMU_AUDIO_DRV:-}" in
  pa)
    parecord --device=essence2_test.monitor --rate=48000 --channels=2 --format=s16le --file-format=wav "$QEMU_WAV_PATH" > "$OUT/speaker-recorder.txt" 2>&1 &
    recorder_pid=$!
    sleep 1
    kill -0 "$recorder_pid"
    ;;
  wav) ;;
  *) echo FAIL_NO_SUPPORTED_SPEAKER_CAPTURE; exit 22 ;;
esac
# Set volume after boot settles; keep the actual observed value as evidence.
adb shell cmd media_session volume --stream 3 --set 15 > "$OUT/media-volume.txt" 2>&1
sleep 2
adb shell cmd media_session volume --stream 3 --get >> "$OUT/media-volume.txt" 2>&1
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
# Finalize the continuous speaker recording before emulator teardown.
stop_recorder
trap - EXIT
exit "$probe_rc"

