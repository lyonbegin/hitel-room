#!/usr/bin/env bash
set -euo pipefail
pkg=com.google.aiedge.gallery
# Observe the actual preinstalled service, never claim success if missing.
adb shell pm list packages -u | grep -E 'com.google.android.tts|com.google.android.googlequicksearchbox|com.google.android.gms' | tee evidence/mlkit-packages.txt || true
adb shell dumpsys package com.google.android.tts > evidence/mlkit-speech-service.txt || true
adb shell dumpsys connectivity > evidence/mlkit-network.txt || true
# Collect service resolution and device compatibility without changing the SDK or model.
{
  adb shell getprop ro.boot.verifiedbootstate
  adb shell getprop ro.boot.flash.locked
  adb shell getprop ro.product.cpu.abilist
  adb shell settings get secure voice_recognition_service
  adb shell cmd package query-services --brief -a android.speech.RecognitionService
  adb shell cmd package query-services --brief -a android.speech.RecognitionService -p com.google.android.tts
  adb shell dumpsys speech_recognition
  adb shell dumpsys activity services com.google.android.tts
} > evidence/mlkit-service-resolution.txt 2>&1 || true
cat evidence/mlkit-service-resolution.txt
# Compare host and guest connectivity; retain diagnostics even when probes fail.
{
  date -u
  curl -IL --connect-timeout 10 --max-time 20 https://gstatic.com/matchmaker/tclib_models/langid/v1/superpacks_manifest.zip || true
  adb shell date
  adb shell settings get global http_proxy
  adb shell settings get global private_dns_mode
  adb shell dumpsys netpolicy
  adb shell dumpsys jobscheduler com.google.android.tts
  adb shell 'toybox nc --help' || true
  adb shell 'ping -c 1 -W 3 gstatic.com' || true
  adb shell 'ping -c 1 -W 3 dl.google.com' || true
} > evidence/mlkit-network-probes.txt 2>&1
cat evidence/mlkit-network-probes.txt
# Use the existing regression's Korean synthesis as a known-transcript fixture.
ffmpeg -nostdin -y -i evidence/ko-KR.wav -ar 16000 -ac 1 -f s16le evidence/mlkit-ko-test.pcm
adb push evidence/mlkit-ko-test.pcm /data/local/tmp/mlkit-ko-test.pcm
adb shell "run-as $pkg cp /data/local/tmp/mlkit-ko-test.pcm files/mlkit-ko-test.pcm"
adb logcat -c
set +e
timeout 900 adb shell am instrument -w -r -e class com.google.ai.edge.gallery.services.asr.ManagedMlKitDeviceTest "$pkg.test/androidx.test.runner.AndroidJUnitRunner" | tee evidence/mlkit-instrumentation.txt
rc=${PIPESTATUS[0]}
set -e
adb logcat -d -v threadtime > evidence/mlkit-logcat.txt
adb shell dumpsys jobscheduler com.google.android.tts > evidence/mlkit-jobs-after.txt 2>&1 || true
adb shell dumpsys connectivity > evidence/mlkit-network-after.txt 2>&1 || true
grep -E 'HITEL_MLKIT_TEST|MddLanguagePackDownload|LPRequestState|ModelManagerImpl|NGSA.GoogleAsrService' evidence/mlkit-logcat.txt | tail -150 | tee evidence/mlkit-events.txt || true
test "$rc" = 0
grep -F 'OK (1 test)' evidence/mlkit-instrumentation.txt
grep -F 'MLKIT_BASIC_KOREAN_PCM_PASS' evidence/mlkit-events.txt
