#!/usr/bin/env bash
# A/B using only original BitHuman 0.9.5 skipAhead=true. Measure actual
# *unique* mouth frames from its SpeechCoverage native logs, not repeated
# speechPresented counters (which overstate progress when mouth freezes).
set -euo pipefail
APK="${1:?APK}"
mkdir -p essence2-emulator-proof essence2-speech-proof
bash tools/bithuman_deep/essence2_android_emulator_smoke.sh "$APK" essence2-emulator-proof
# The first original opening reply may be done before the transcript test,
# so preserve the boot-stage LOGCAT before it gets cleared by the UI probe.
cp essence2-emulator-proof/full-system-logcat.txt \
   essence2-speech-proof/pre-ui-native-logcat.txt 2>/dev/null || true
speech_rc=0
bash tools/bithuman_deep/essence2_android_speech_turn_probe.sh essence2-speech-proof || speech_rc=$?
# A long real 14.44 s reply can take more than real time on x86 emulator
# due to ARM translation. Observe a full utterance end and after-tail state.
for i in $(seq 1 12); do
  sleep 10
  echo "COVERAGE_AFTER_TURN_$((i*10))s"
  adb logcat -d -v time > essence2-speech-proof/post-voice-native-logcat.txt 2>&1 || true
  grep -E 'bhcov.*UTT|bhcov.*FROZEN|speechWritten=|\\[bhdeliver\\]' \
    essence2-speech-proof/post-voice-native-logcat.txt | tail -8 || true
  if grep -Eq 'bhcov.*UTT [2-9] ' \
      essence2-speech-proof/post-voice-native-logcat.txt; then
    echo PASS_ACTUAL_SECOND_UTTERANCE_FINISHED_NATIVE_COVERAGE_CAPTURED
    break
  fi
done
adb exec-out screencap -p > essence2-speech-proof/after-voice-settled.png || true
adb shell run-as ai.bithuman.example.avatar_chat.essence2 cat \
  ./app_flutter/boot_status.txt > essence2-speech-proof/boot-after-full-voice.txt 2>&1 || true
cat essence2-speech-proof/pre-ui-native-logcat.txt \
    essence2-speech-proof/full-after-speech-logcat.txt \
    essence2-speech-proof/post-voice-native-logcat.txt \
    > essence2-speech-proof/combined-original-native-A-B.log
python3 tools/bithuman_deep/audit_essence2_speech_coverage.py \
  --logcat essence2-speech-proof/combined-original-native-A-B.log \
  --report essence2-speech-proof/original-skip-ahead-A-B-report.json \
  --baseline-unique 3 --baseline-due 360 --require-improvement
# The voiced test should have executed its original input event too.
test "$speech_rc" -eq 0
grep -q 'hitel:essence2:original_skipAhead=true' \
    essence2-speech-proof/boot-after-full-voice.txt
echo PASS_ESSENCE2_ORIGINAL_SDK_NATIVE_SKIP_AHEAD_HAS_QUANTIFIABLY_IMPROVED_UNIQUE_LIP_COVERAGE
