#!/usr/bin/env bash
set -euo pipefail
pkg=com.hitel.mlkit.tester
adb install -r dist/HITEL_MLKit_SDK_Tester.apk
adb logcat -c
adb shell am start -W -n "$pkg/.MainActivity"
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
# A diagnostic app can be valid even if the external SDK reports UNAVAILABLE.
echo 'TESTER_UI_AND_REAL_STATUS_PROBE_PASS; STT_NOT_CERTIFIED' | tee evidence/result.txt
