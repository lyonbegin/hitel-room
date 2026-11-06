#!/usr/bin/env bash
set -Eeuo pipefail
PKG="app.hitel.callnative"
APK="callassistant-native/app/build/outputs/apk/debug/app-debug.apk"
mkdir -p emulator-evidence
export ANDROID_SERIAL="emulator-5554"
log() { printf '[HITEL-CI] %s\n' "$*"; }
finish() {
  local original=$?
  set +e
  adb logcat -d -v threadtime > emulator-evidence/full-logcat.txt 2>&1
  grep -E "HITEL_MONITOR|HITEL_PHONE|AndroidRuntime|FATAL EXCEPTION|ActivityTaskManager|RoleManager|Telecom" emulator-evidence/full-logcat.txt > emulator-evidence/telephony-logcat.txt || :
  adb shell dumpsys telecom > emulator-evidence/dumpsys-telecom.txt 2>&1
  adb shell dumpsys role > emulator-evidence/dumpsys-role.txt 2>&1
  adb shell dumpsys activity activities > emulator-evidence/dumpsys-activity.txt 2>&1
  adb shell uiautomator dump /sdcard/hitel-final-ui.xml >/dev/null 2>&1
  adb pull /sdcard/hitel-final-ui.xml emulator-evidence/final-ui.xml >/dev/null 2>&1
  adb exec-out screencap -p > emulator-evidence/final-screenshot.png 2>/dev/null
  printf 'exit_code=%s\nandroid_sdk=%s\n' "$original" "$(adb shell getprop ro.build.version.sdk 2>/dev/null)" > emulator-evidence/summary.txt
  adb emu gsm cancel 5551234 >/dev/null 2>&1 || :
  adb emu gsm cancel 5559876 >/dev/null 2>&1 || :
  log "Evidence collected (exit_code=$original)"
}
trap finish EXIT
log "Step 1: emulator OS and APK"
adb wait-for-device
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1"
test -s "$APK"
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb install -r -g "$APK" | tee emulator-evidence/install.txt
adb shell pm path "$PKG" | tee emulator-evidence/package-path.txt | grep -F "$PKG"
log "PASS apk installed"
if adb shell pm dump "$PKG" | grep -qi "moe.shizuku.manager.permission.API_V23"; then
  log "FAIL unwanted Shizuku dependency"; exit 10
fi
log "PASS no Shizuku permission"

log "Step 2: launcher UI and activities"
adb shell am start -W -n "$PKG/.MainActivity" | tee emulator-evidence/launch.txt
sleep 4
python3 callassistant-native/ci/ui-assert.py wait "기본 전화 앱으로 지정"
adb exec-out screencap -p > emulator-evidence/launcher-screenshot.png
adb shell uiautomator dump /sdcard/hitel-launch-ui.xml
adb pull /sdcard/hitel-launch-ui.xml emulator-evidence/launch-ui.xml >/dev/null
grep -q "기본 전화 앱으로 지정" emulator-evidence/launch-ui.xml
grep -q "전화 걸기" emulator-evidence/launch-ui.xml
if grep -q "Shizuku" emulator-evidence/launch-ui.xml; then
  log "FAIL Shizuku UI still visible"; exit 11
fi
log "PASS launcher and native dialer controls"

log "Step 3: ACTION_DIAL intent"
adb shell am start -W -a android.intent.action.DIAL -d tel:5550099 -p "$PKG" | tee emulator-evidence/dial-intent.txt
sleep 2
adb shell uiautomator dump /sdcard/hitel-dial-ui.xml
adb pull /sdcard/hitel-dial-ui.xml emulator-evidence/dial-ui.xml >/dev/null
grep -q "5550099" emulator-evidence/dial-ui.xml
log "PASS tel URI applied to native keypad"

log "Step 4: offline speech screen (not call audio)"
adb shell am start -W -f 0x04000000 -n "$PKG/.MainActivity" >/dev/null
python3 callassistant-native/ci/ui-assert.py tap "마이크 자막 / 기기 TTS 독립 시험"
python3 callassistant-native/ci/ui-assert.py wait "Android 공통 음성 기능 시험"
sleep 2
adb shell uiautomator dump /sdcard/hitel-voice-ui.xml
adb pull /sdcard/hitel-voice-ui.xml emulator-evidence/voice-ui.xml >/dev/null
grep -q "Android 공통 음성 기능 시험" emulator-evidence/voice-ui.xml
grep -q "TTS" emulator-evidence/voice-ui.xml
log "PASS offline voice lab screen"

log "Step 4b: non-default existing phone app integration"
adb shell am start -W -f 0x04000000 -n "$PKG/.MainActivity" >/dev/null
adb shell pm grant "$PKG" android.permission.READ_PHONE_STATE
adb logcat -c
adb emu gsm call 5559876 | tee emulator-evidence/gsm-existing-dialer.txt
FOUND_PASSIVE=0
for attempt in $(seq 1 25); do
  if adb logcat -d -s HITEL_MONITOR:I '*:S' | grep -q 'CALL_STATE='; then FOUND_PASSIVE=1; break; fi
  sleep 2
done
adb logcat -d -s HITEL_MONITOR:I '*:S' > emulator-evidence/existing-dialer-state-log.txt
adb emu gsm cancel 5559876 >/dev/null || :
sleep 5  # Wait until Telecom releases the previous call before changing default dialer.
if [ "$FOUND_PASSIVE" -ne 1 ]; then
  log "FAIL PHONE_STATE broadcast not observed without replacing dialer"; exit 15
fi
log "PASS existing default dialer retained; HITEL received Android PHONE_STATE event"

log "Step 5: default dialer role"
adb shell cmd role add-role-holder --user 0 android.app.role.DIALER "$PKG" | tee emulator-evidence/role-grant.txt
sleep 2
adb shell dumpsys role | tee emulator-evidence/role-holders.txt
grep -Fq "holders=$PKG" emulator-evidence/role-holders.txt
log "PASS system dialer role assigned"
sleep 12  # Telecom and InCallController must observe the new dialer before we generate a call.

log "Step 6: virtual GSM incoming call, InCallService lifecycle"
adb logcat -c
adb shell am start -W -f 0x04000000 -n "$PKG/.MainActivity" >/dev/null
FOUND=0
for callTry in 1 2; do
  adb emu gsm call 5551234 | tee emulator-evidence/gsm-incoming.txt
  for attempt in $(seq 1 13); do
    if adb logcat -d -s HITEL_PHONE:I '*:S' | grep -q 'CALL_ADDED='; then FOUND=1; break; fi
    sleep 2
  done
  if [ "$FOUND" -eq 1 ]; then break; fi
  adb shell dumpsys telecom > "emulator-evidence/telecom-before-retry-${callTry}.txt" || :
  adb emu gsm cancel 5551234 >/dev/null || :
  log "InCallService not bound on call attempt $callTry; rechecking role and waiting for Telecom rebinding"
  adb shell dumpsys role | tee "emulator-evidence/role-before-retry-${callTry}.txt"
  grep -Fq "holders=$PKG" "emulator-evidence/role-before-retry-${callTry}.txt"
  sleep 15
done
adb logcat -d -s HITEL_PHONE:I '*:S' > emulator-evidence/call-added-log.txt
if [ "$FOUND" -ne 1 ]; then
  log "FAIL GSM call did not reach InCallService after two real call attempts"; exit 12
fi
log "PASS virtual GSM incoming call reached InCallService"

log "Step 7: incoming call UI and disconnect lifecycle"
adb shell am start -W -f 0x04000000 -n "$PKG/.MainActivity" >/dev/null
python3 callassistant-native/ci/ui-assert.py wait "통화 화면 열기"
python3 callassistant-native/ci/ui-assert.py tap "통화 화면 열기"
adb exec-out screencap -p > emulator-evidence/incoming-screenshot.png
# Both Android 11 and 15 render the Android call heads-up notification
# *over* the Activity. UIAutomator only exposes the underlying "전화 받기"
# node on API 35, so trying that node clicks the foreground "거절" instead.
# The real emulator screenshot confirmed Answer at x=26%, y=17%.
SIZE="$(adb shell wm size | sed -n 's/^Physical size: //p' | head -1)"
WIDTH="${SIZE%x*}"
HEIGHT="${SIZE#*x}"
test -n "$WIDTH" && test -n "$HEIGHT"
adb exec-out screencap -p > emulator-evidence/before-answer-screenshot.png
adb shell input tap "$((WIDTH * 26 / 100))" "$((HEIGHT * 17 / 100))"
log "TAPPED actual topmost incoming call Answer (x=26%,y=17%); Telecom ACTIVE assertion follows"
log "PASS real tap sent to incoming call Answer control (call state confirmation pending)"
ANSWERED=0
for attempt in $(seq 1 15); do
  if adb logcat -d -s HITEL_PHONE:I '*:S' | grep -q 'CALL_STATE=4'; then ANSWERED=1; break; fi
  sleep 2
done
if [ "$ANSWERED" -ne 1 ]; then
  log "FAIL user-facing answer button did not transition InCallService to ACTIVE"; exit 16
fi
log "PASS actual answer button changes telecom call to ACTIVE"
log "Step 8: attempt actual VOICE_DOWNLINK / VOICE_CALL AudioRecord sources during ACTIVE call"
adb shell am start -W -f 0x04000000 -n "$PKG/.MainActivity" >/dev/null
python3 callassistant-native/ci/ui-assert.py tap "상대방 음성 추출 검증"
python3 callassistant-native/ci/ui-assert.py wait "실제 상대방 통화 음성 추출 검사"
python3 callassistant-native/ci/ui-assert.py tap "VOICE_DOWNLINK 추출 시도"
python3 callassistant-native/ci/ui-assert.py tap "VOICE_CALL 양방향 추출 시도"
python3 callassistant-native/ci/ui-assert.py tap "AOSP 다운링크 추출 실제 호출"
RESULTS=0
for attempt in $(seq 1 25); do
  adb logcat -d -s HITEL_RX_PROBE:I '*:S' > emulator-evidence/remote-audio-probe.txt
  if grep -q 'RESULT=.*source=VOICE_DOWNLINK' emulator-evidence/remote-audio-probe.txt && grep -q 'RESULT=.*source=VOICE_CALL' emulator-evidence/remote-audio-probe.txt && grep -q 'RESULT=.*source=AOSP_DOWNLINK' emulator-evidence/remote-audio-probe.txt; then RESULTS=1; break; fi
  sleep 2
done
if [ "$RESULTS" -ne 1 ]; then
  log "FAIL missing probe result for one or more actual AudioRecord telephony sources"
  exit 21
fi
grep -q 'PERMISSION capture_audio_output=DENIED' emulator-evidence/remote-audio-probe.txt || { log "FAIL unexpected privileged permission state; review needed"; exit 22; }
grep -q 'ATTEMPT source=VOICE_DOWNLINK' emulator-evidence/remote-audio-probe.txt || exit 23
grep -q 'ATTEMPT source=VOICE_CALL' emulator-evidence/remote-audio-probe.txt || exit 24
grep -q 'ATTEMPT source=AOSP_DOWNLINK' emulator-evidence/remote-audio-probe.txt || exit 25
grep -E 'PERMISSION|ATTEMPT|RESULT=|RELEASED' emulator-evidence/remote-audio-probe.txt
adb exec-out screencap -p > emulator-evidence/remote-audio-probe-screenshot.png
log "PASS actual telephony AudioRecord attempts were executed, results logged. NOT proof of far-end audio."
log "Emulator GSM has no call audio and remote voice extraction remains unverified."
adb shell uiautomator dump /sdcard/hitel-active-ui.xml >/dev/null || :
adb pull /sdcard/hitel-active-ui.xml emulator-evidence/active-ui.xml >/dev/null 2>&1 || :
adb emu gsm cancel 5551234 | tee emulator-evidence/gsm-cancel.txt
REMOVED=0
for attempt in $(seq 1 15); do
  if adb logcat -d -s HITEL_PHONE:I '*:S' | grep -q 'CALL_REMOVED'; then REMOVED=1; break; fi
  sleep 2
done
if [ "$REMOVED" -ne 1 ]; then
  log "FAIL InCallService did not receive call removal"; exit 13
fi
log "PASS simulated GSM call disconnected in app"
if adb logcat -d -v brief | grep -E "FATAL EXCEPTION" | grep -q "$PKG"; then
  log "FAIL AndroidRuntime fatal app crash"; exit 14
fi

log "Step 8: WAV recorder screen and local file recording"
adb shell am start -W -n "$PKG/.CallAudioMonitorActivity" >/dev/null
python3 callassistant-native/ci/ui-assert.py wait "HITEL 통화 음성 검증"
python3 callassistant-native/ci/ui-assert.py tap "기기 마이크 참고 녹음 시작"
sleep 4
adb exec-out screencap -p > emulator-evidence/wav-recording-screen.png
python3 callassistant-native/ci/ui-assert.py tap "녹음 종료·WAV 저장 완료"
WAV=0
for i in $(seq 1 20); do
  if adb logcat -d -s HITEL_RX_RECORD:I '*:S' | grep -q 'FINALIZED bytes='; then WAV=1; break; fi
  sleep 1
done
adb logcat -d -s HITEL_RX_RECORD:V '*:S' > emulator-evidence/wav-recorder-log.txt
test "$WAV" = 1 || { log "FAIL WAV did not finalize"; exit 46; }
adb shell content query --uri content://media/external/audio/media > emulator-evidence/wav-media-store.txt
grep -q 'HITEL_Call_Test' emulator-evidence/wav-media-store.txt || { log "FAIL WAV not found"; exit 47; }
python3 callassistant-native/ci/ui-assert.py tap "완료된 녹음 재생"
sleep 2
adb logcat -d -s HITEL_RX_RECORD:I '*:S' > emulator-evidence/wav-playback-log.txt
grep -q 'PLAYBACK_START' emulator-evidence/wav-playback-log.txt || { log "FAIL WAV playback did not start"; exit 48; }
log "PASS local WAV recorded, finalized, present in Music and played"

log "PASS emulator smoke test: install, launch, dial role, UI, GSM call lifecycle"
