#!/usr/bin/env bash
set -euo pipefail
pkg=com.google.aiedge.gallery
# Observe the actual preinstalled service, never claim success if missing.
adb shell pm list packages -u | grep -E 'com.google.android.tts|com.google.android.googlequicksearchbox|com.google.android.gms' | tee evidence/mlkit-packages.txt || true
adb shell dumpsys package com.google.android.tts > evidence/mlkit-speech-service.txt || true
adb shell dumpsys connectivity > evidence/mlkit-network.txt || true
# Use the existing regression's Korean synthesis as a known-transcript fixture.
ffmpeg -nostdin -y -i evidence/ko-KR.wav -ar 16000 -ac 1 -f s16le evidence/mlkit-ko-test.pcm
adb push evidence/mlkit-ko-test.pcm /data/local/tmp/mlkit-ko-test.pcm
adb shell "run-as $pkg cp /data/local/tmp/mlkit-ko-test.pcm files/mlkit-ko-test.pcm"
adb logcat -c
set +e
timeout 380 adb shell am instrument -w -r -e class com.google.ai.edge.gallery.services.asr.ManagedMlKitDeviceTest "$pkg.test/androidx.test.runner.AndroidJUnitRunner" | tee evidence/mlkit-instrumentation.txt
rc=${PIPESTATUS[0]}
set -e
adb logcat -d -v threadtime > evidence/mlkit-logcat.txt
grep -E 'HITEL_MLKIT_TEST|MddLanguagePackDownload|LPRequestState|ModelManagerImpl|NGSA.GoogleAsrService' evidence/mlkit-logcat.txt | tail -150 | tee evidence/mlkit-events.txt || true
test "$rc" = 0
grep -F 'OK (1 test)' evidence/mlkit-instrumentation.txt
grep -F 'MLKIT_BASIC_KOREAN_PCM_PASS' evidence/mlkit-events.txt
