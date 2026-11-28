#!/usr/bin/env bash
set -euo pipefail
pkg=com.google.aiedge.gallery
adb wait-for-device
adb devices -l | tee evidence/adb-devices.txt
adb shell getprop > evidence/device-properties.txt
trap 'adb logcat -d -v threadtime > evidence/logcat.txt; adb logcat -b crash -d > evidence/crash.txt' EXIT
adb install -r dist/HITEL_Gallery_Global_ASR.apk
adb install -r -t dist/HITEL_Gallery_Local_SODA_Test.apk
adb logcat -c
adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1
sleep 10
adb exec-out screencap -p > evidence/launch.png
adb shell uiautomator dump /sdcard/qa.xml || true
adb exec-out cat /sdcard/qa.xml > evidence/launch.xml || true
adb shell pidof "$pkg" | tee evidence/pid.txt
adb shell am force-stop "$pkg"
set +e
timeout 600 adb shell am instrument -w -r -e class com.google.ai.edge.gallery.services.tts.SupertonicDeviceTest "$pkg.test/androidx.test.runner.AndroidJUnitRunner" | tee evidence/instrumentation.txt
status=$?
set -e
adb logcat -d -v threadtime > evidence/logcat.txt
adb logcat -b crash -d > evidence/crash.txt
for locale in ko-KR en-US na incremental; do
  adb exec-out run-as "$pkg" cat "files/supertonic-test-$locale.pcm" > "evidence/$locale.pcm" || true
done
python3 - <<'PY'
import pathlib, wave, array, math
for locale in ['ko-KR','en-US','na','incremental']:
    f=pathlib.Path('evidence')/(locale+'.pcm')
    data=f.read_bytes()
    assert len(data)>24000 and len(data)%2==0, (locale,len(data))
    a=array.array('h',data)
    rms=math.sqrt(sum(x*x for x in a)/len(a))
    assert rms>10,(locale,rms)
    with wave.open(str(f.with_suffix('.wav')),'wb') as w:
        w.setparams((1,2,24000,0,'NONE','not compressed'))
        w.writeframes(data)
    print(locale,'duration',len(a)/24000,'rms',rms)
PY
test "$status" = 0
grep -F 'OK (1 test)' evidence/instrumentation.txt
grep -F 'HUD_NO_TAG_NO_LENGTH_GATE_PASS' evidence/logcat.txt
if grep -E 'SYNTHESIS_BEGIN lang=(ko|en)( |$)' evidence/logcat.txt; then exit 1; fi
grep -F 'SYNTHESIS_OK lang=na' evidence/logcat.txt
grep -F 'INCREMENTAL_CLAUSE_BUFFER_PASS' evidence/logcat.txt
grep -F 'INDEPENDENT_INPUT_AUDIO_HEAD_PASS' evidence/logcat.txt
grep -E 'SYNTHESIS_BEGIN lang=na .*steps=4' evidence/logcat.txt
grep -E 'SYNTHESIS_BEGIN lang=na .*steps=8' evidence/logcat.txt
echo 'SUPERTONIC_INDEPENDENT_INPUT_AUDIO_HEAD_PASS; SIMULATED_INPUT_NOT_FULL_LLM' | tee evidence/result.txt
