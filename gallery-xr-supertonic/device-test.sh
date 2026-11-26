#!/usr/bin/env bash
set -euo pipefail
pkg=com.google.aiedge.gallery
adb install dist/HITEL_Gallery_XR_Supertonic_Debug.apk
adb install dist/HITEL_Gallery_XR_Supertonic_Test.apk
adb logcat -c
adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1
sleep 10
adb exec-out screencap -p > evidence/launch.png
adb shell uiautomator dump /sdcard/qa.xml || true
adb exec-out cat /sdcard/qa.xml > evidence/launch.xml || true
adb shell am force-stop "$pkg"
set +e
timeout 600 adb shell am instrument -w -r -e class com.google.ai.edge.gallery.services.tts.SupertonicDeviceTest "$pkg.test/androidx.test.runner.AndroidJUnitRunner" | tee evidence/instrumentation.txt
status=$?
set -e
adb logcat -d -v threadtime > evidence/logcat.txt
adb logcat -b crash -d > evidence/crash.txt
for locale in ko-KR en-US; do
  adb exec-out run-as "$pkg" cat "files/supertonic-test-$locale.pcm" > "evidence/$locale.pcm" || true
done
python3 - <<'PY'
import pathlib, wave, array, math
for locale in ['ko-KR','en-US']:
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
grep -F 'SYNTHESIS_OK lang=ko' evidence/logcat.txt
grep -F 'SYNTHESIS_OK lang=en' evidence/logcat.txt
echo 'SUPERTONIC_ENGINE_PCM_PASS; XR_FULL_DIALOGUE_NOT_TESTED' | tee evidence/result.txt
