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
adb shell am start -W -n "$PKG/.MainActivity" >/dev/null
python3 callassistant-native/ci/ui-assert.py tap "마이크 자막 / 기기 TTS 독립 시험"
python3 callassistant-native/ci/ui-assert.py wait "Android 공통 음성 기능 시험"
sleep 2
adb shell uiautomator dump /sdcard/hitel-voice-ui.xml
adb pull /sdcard/hitel-voice-ui.xml emulator-evidence/voice-ui.xml >/dev/null
grep -q "Android 공통 음성 기능 시험" emulator-evidence/voice-ui.xml
grep -q "TTS" emulator-evidence/voice-ui.xml
log "PASS offline voice lab screen"

log "Step 4b: non-default existing phone app integration"
adb shell am start -W -n "$PKG/.MainActivity" >/dev/null
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
if [ "$FOUND_PASSIVE" -ne 1 ]; then
  log "FAIL PHONE_STATE broadcast not observed without replacing dialer"; exit 15
fi
log "PASS existing default dialer retained; HITEL received Android PHONE_STATE event"

log "Step 5: default dialer role"
adb shell cmd role add-role-holder --user 0 android.app.role.DIALER "$PKG" | tee emulator-evidence/role-grant.txt
sleep 2
adb shell cmd role get-role-holders --user 0 android.app.role.DIALER | tee emulator-evidence/role-holders.txt
grep -Fq "$PKG" emulator-evidence/role-holders.txt
log "PASS system dialer role assigned"

log "Step 6: virtual GSM incoming call, InCallService lifecycle"
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity" >/dev/null
adb emu gsm call 5551234 | tee emulator-evidence/gsm-incoming.txt
FOUND=0
for attempt in $(seq 1 30); do
  if adb logcat -d -s HITEL_PHONE:I '*:S' | grep -q 'CALL_ADDED='; then FOUND=1; break; fi
  sleep 2
done
adb logcat -d -s HITEL_PHONE:I '*:S' > emulator-evidence/call-added-log.txt
if [ "$FOUND" -ne 1 ]; then
  log "FAIL GSM call did not reach InCallService"; exit 12
fi
log "PASS virtual GSM incoming call reached InCallService"

log "Step 7: incoming call UI and disconnect lifecycle"
adb shell am start -W -n "$PKG/.MainActivity" >/dev/null
python3 callassistant-native/ci/ui-assert.py tap "통화 화면 열기"
python3 callassistant-native/ci/ui-assert.py wait "전화 받기"
sleep 2
adb shell uiautomator dump /sdcard/hitel-incoming-ui.xml
adb pull /sdcard/hitel-incoming-ui.xml emulator-evidence/incoming-ui.xml >/dev/null
grep -q "전화 받기" emulator-evidence/incoming-ui.xml
grep -q "전화 거절" emulator-evidence/incoming-ui.xml
log "PASS native incoming call controls visible"
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
log "PASS emulator smoke test: install, launch, dial role, UI, GSM call lifecycle"
