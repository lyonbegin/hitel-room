#!/usr/bin/env bash
set -euo pipefail

APK=$(find AndroidProject/app/build/outputs/apk/debug -name '*.apk' -print -quit)
test -s "$APK"

adb wait-for-device
adb shell getprop sys.boot_completed
adb shell settings put system screen_off_timeout 600000
adb shell input keyevent 82
adb install -r "$APK"
adb shell pm grant app.hitel.callflowlab.v14 android.permission.RECORD_AUDIO
adb shell am start -W -n app.hitel.callflowlab.v14/app.hitel.samsungprobe.W03ConsoleActivity
sleep 6
PID=$(adb shell pidof app.hitel.callflowlab.v14 | tr -d '\r')
test -n "$PID"
echo "EMULATOR_UI_PROCESS_OK pid=$PID"

adb shell uiautomator dump /sdcard/hitel14-original.xml
adb shell cat /sdcard/hitel14-original.xml > /tmp/hitel14-original.xml
python3 - <<'PY'
import xml.etree.ElementTree as ET
root=ET.parse('/tmp/hitel14-original.xml').getroot()
visible=[(n.get('text','')+' '+n.get('content-desc','')).strip()
         for n in root.iter('node')]
for token in ['HITEL14 원본','한국어 말하기','출력음 STT','전체 실행 로그']:
    assert any(token in t for t in visible),(token,visible[:30])
for removed in ['문자통화 전환 다시 시도','삼성 문자 입력창 보기','삼성 문자통화 TTS 보내기']:
    assert not any(removed in t for t in visible),removed
print('EMULATOR_VISIBLE_ORIGINAL_MIC_AND_SPEAKER_UI_OK')
print('EMULATOR_TEXTCALL_CONTROLS_HIDDEN_OK')
PY

# Test original microphone UI click causes native model initialization or model
# download status. No Korean speech accuracy claim without model/real device PCM.
python3 - <<'PY'
import xml.etree.ElementTree as ET,re,subprocess
root=ET.parse('/tmp/hitel14-original.xml').getroot()
matches=[node for node in root.iter('node')
         if '한국어 말하기' in (node.get('text') or '') and node.get('clickable')=='true']
if not matches:
    raise AssertionError('Original v14 microphone click target absent')
b=matches[0].get('bounds')
coords=list(map(int,re.findall(r'\d+',b)))
assert len(coords)==4,b
x=(coords[0]+coords[2])//2;y=(coords[1]+coords[3])//2
print('MIC_CLICK_ORIGINAL_BUTTON',x,y)
subprocess.run(['adb','shell','input','tap',str(x),str(y)],check=True)
PY
sleep 3
adb shell uiautomator dump /sdcard/hitel14-mic-click.xml
adb shell cat /sdcard/hitel14-mic-click.xml > /tmp/hitel14-mic-click.xml
python3 - <<'PY'
import xml.etree.ElementTree as ET
root=ET.parse('/tmp/hitel14-mic-click.xml').getroot()
visible='\n'.join((n.get('text')or'') for n in root.iter('node'))
assert ('초기화' in visible or '다운로드' in visible or
        '마이크' in visible or '한국어' in visible),visible[:400]
print('EMULATOR_ORIGINAL_MIC_ACTION_HANDLED')
PY

# Native microphone/model inference and real media output are not proven by
# emulator UI smoke. Collect crashes and only fail on our package's fatal crash.
adb logcat -d -v time > /tmp/hitel14-emu-logcat.txt
python3 - <<'PY'
s=open('/tmp/hitel14-emu-logcat.txt',errors='replace').read()
import re
matches=[x for x in re.findall(r'FATAL EXCEPTION.{0,1600}',s,re.S)
         if 'app.hitel.callflowlab.v14' in x]
assert not matches, matches[:2]
print('EMULATOR_NO_HITEL_FATAL_EXCEPTION_OK')
PY
