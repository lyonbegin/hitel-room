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
# A diagnostic app can be valid even if the external SDK reports UNAVAILABLE.
echo 'TESTER_UI_AND_REAL_STATUS_PROBE_PASS; STT_NOT_CERTIFIED' | tee evidence/result.txt
