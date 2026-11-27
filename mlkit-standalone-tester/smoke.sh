#!/usr/bin/env bash
set -euo pipefail
pkg=com.hitel.soda.local
adb install -r dist/HITEL_SODA_Local.apk
adb logcat -c
adb shell am start -W -n "$pkg/com.hitel.mlkit.tester.MainActivity"
sleep 3
adb shell uiautomator dump /sdcard/hitel-ui.xml
adb exec-out cat /sdcard/hitel-ui.xml > evidence/ui.xml
adb exec-out screencap -p > evidence/launch.png
xy=$(python3 - <<'PY'
import xml.etree.ElementTree as ET,re
root=ET.parse("evidence/ui.xml").getroot()
for n in root.iter("node"):
    if n.get("text")=="상태 검사":
        x,y,x2,y2=map(int,re.findall(r"\d+",n.get("bounds")))
        print((x+x2)//2,(y+y2)//2)
        break
else: raise SystemExit("status button missing")
PY
)
adb shell input tap $xy
for i in $(seq 1 30); do
  adb logcat -d -s HITEL_MLKIT_PROBE:I '*:S' > evidence/status-probe.txt
  if grep -F 'TASK_END STATUS' evidence/status-probe.txt; then break; fi
  sleep 2
done
adb logcat -d -v threadtime > evidence/logcat.txt
adb exec-out screencap -p > evidence/status.png
cat evidence/status-probe.txt
grep -F 'APP_READY' evidence/status-probe.txt
grep -F 'TASK_ENTER STATUS' evidence/status-probe.txt
grep -F 'SDK_GET_CLIENT_ENTER' evidence/status-probe.txt
grep -F 'TASK_END STATUS' evidence/status-probe.txt
# Confirm the actual local-model button opens the Android system file picker.
adb shell uiautomator dump /sdcard/hitel-ui.xml
adb exec-out cat /sdcard/hitel-ui.xml > evidence/local-button.xml
xy=$(python3 - <<'PY'
import xml.etree.ElementTree as ET,re
for n in ET.parse("evidence/local-button.xml").getroot().iter("node"):
    if n.get("text")=="로컬 모델 선택":
        x,y,x2,y2=map(int,re.findall(r"\d+",n.get("bounds")))
        print((x+x2)//2,(y+y2)//2)
        break
else: raise SystemExit("local model button missing")
PY
)
adb shell input tap $xy
sleep 3
adb shell uiautomator dump /sdcard/hitel-picker.xml
adb exec-out cat /sdcard/hitel-picker.xml > evidence/local-picker.xml
adb exec-out screencap -p > evidence/local-picker.png
adb shell dumpsys activity activities > evidence/local-picker-activity.txt
grep -Ei 'package="[^"]*documentsui' evidence/local-picker.xml
adb logcat -d -s HITEL_MLKIT_PROBE:I '*:S' | grep -F 'FILE_PICKER_ENTER kind=SODA_ZIP'
echo 'LOCAL_MODEL_SYSTEM_PICKER_PASS' | tee evidence/picker-result.txt
adb shell input keyevent 4
# Open the isolated native activity without a model; this is not an STT test.
sleep 2
adb shell uiautomator dump /sdcard/hitel-main.xml
adb exec-out cat /sdcard/hitel-main.xml > evidence/local-main.xml
xy=$(python3 - <<'PY2'
import xml.etree.ElementTree as ET,re
for n in ET.parse("evidence/local-main.xml").getroot().iter("node"):
    if n.get("text")=="로컬 실행 화면":
        x,y,x2,y2=map(int,re.findall(r"\d+",n.get("bounds")))
        print((x+x2)//2,(y+y2)//2)
        break
else: raise SystemExit("native screen button missing")
PY2
)
adb shell input tap $xy
sleep 3
adb shell uiautomator dump /sdcard/hitel-native.xml
adb exec-out cat /sdcard/hitel-native.xml > evidence/native-ui.xml
adb exec-out screencap -p > evidence/native-ui.png
grep -F '로컬 모델 ZIP 선택' evidence/native-ui.xml
adb shell pidof com.hitel.soda.local:soda_local | tee evidence/native-pid.txt
test -s evidence/native-pid.txt
adb logcat -d -s HITEL_SODA_LOCAL:I '*:S' | tee evidence/native-log.txt
grep -F 'LOCAL_ACTIVITY_READY' evidence/native-log.txt
echo 'ISOLATED_NATIVE_ACTIVITY_PASS; ENGINE_NOT_INITIALIZED_NO_MODEL' | tee evidence/native-result.txt
# A diagnostic app can be valid even if the external SDK reports UNAVAILABLE.
echo 'TESTER_UI_AND_REAL_STATUS_PROBE_PASS; STT_NOT_CERTIFIED' | tee evidence/result.txt
