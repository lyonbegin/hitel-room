#!/usr/bin/env bash
# Never substitute a mock native library or publish a build based on compilation.
set -euo pipefail
ROOT="$GITHUB_WORKSPACE"
OUT="$ROOT/essence2-local-mock-proof/emulator"
APK="$ROOT/HITEL_UNIFIED_ANDROID_RTC_MAIN_20261122_ARM64.apk"
PKG=ai.bithuman.example.avatar_chat.essence2
mkdir -p "$OUT"
capture() {
  adb logcat -d -v threadtime > "$OUT/logcat.txt" || true
  adb exec-out screencap -p > "$OUT/final.png" || true
  adb shell uiautomator dump /sdcard/hitel-final.xml >/dev/null 2>&1 || true
  adb pull /sdcard/hitel-final.xml "$OUT/final.xml" >/dev/null 2>&1 || true
  adb shell dumpsys package "$PKG" > "$OUT/package.txt" || true
}
trap capture EXIT
adb shell getprop > "$OUT/properties.txt"
# An x86 emulator must support real arm64 native translation, or the run fails.
adb shell getprop ro.product.cpu.abilist | grep -q 'arm64-v8a'
adb install -r "$APK" | tee "$OUT/install.txt"
grep -Fxq 'Success' "$OUT/install.txt"
adb shell pm grant "$PKG" android.permission.RECORD_AUDIO
adb shell pm revoke "$PKG" android.permission.CAMERA
adb logcat -c
adb shell am start -W -n "$PKG/ai.bithuman.example.avatar_chat.MainActivity" | tee "$OUT/launch.txt"
wait_log() {
  local marker="$1" limit="$2" i
  for ((i=0; i<limit; i+=3)); do
    adb logcat -d -v threadtime > "$OUT/live.txt"
    if grep -q 'RTC_HOST_FAIL' "$OUT/live.txt"; then
      echo "FAIL_RTC_HOST"; return 1
    fi
    if grep -q "$marker" "$OUT/live.txt"; then return 0; fi
    sleep 3
  done
  echo "TIMEOUT $marker"; return 1
}
wait_log RTC_HOST_READY 300
adb exec-out screencap -p > "$OUT/connected.png"
# Use the actual UI, not a debug-only fake media path.
adb shell uiautomator dump /sdcard/hitel-ui.xml
adb pull /sdcard/hitel-ui.xml "$OUT/connected.xml"
read -r x y < <(python3 - "$OUT/connected.xml" <<'PY'
import re,sys,xml.etree.ElementTree as ET
nodes=[n for n in ET.parse(sys.argv[1]).iter('node') if n.get('class')=='android.widget.EditText' and n.get('enabled')=='true']
assert len(nodes)==1, f'expected one enabled prompt input, got {len(nodes)}'
a,b,c,d=map(int,re.findall(r'\d+',nodes[0].get('bounds')))
print((a+c)//2,(b+d)//2)
PY
)
adb shell input tap "$x" "$y"
adb shell input text RTC%stest
adb shell input keyevent 66
wait_log HITEL_RTC_FIRST_FRAME 240
wait_log PAIR_SENT 240
wait_log RTC_PCM_CALLBACK 60
# Require received, decoded video plus non-silent received audio, not merely ICE.
for ((i=0; i<120; i+=3)); do
  adb logcat -d -v threadtime > "$OUT/live.txt"
  if python3 - "$OUT/live.txt" <<'PY'
import sys,re
s=open(sys.argv[1]).read()
assert 'RTC_HOST_FAIL' not in s and 'PAIR_STALL' not in s
for line in s.splitlines():
    if 'RTC_RTP_RX' not in line: continue
    rx=line.split('RTC_RTP_RX',1)[1]
    tracks=rx.split('|')
    def positive(t,k):
        m=re.search(r'\b'+k+r'=([0-9.eE+-]+)',t)
        return bool(m and float(m.group(1))>0)
    audio=any('audio' in t and positive(t,'packetsReceived') and positive(t,'totalAudioEnergy') for t in tracks)
    video=any('video' in t and positive(t,'packetsReceived') and positive(t,'framesDecoded') for t in tracks)
    if audio and video:
        print('PASS_RTC_RX_REAL_DECODED_VIDEO_AND_NONZERO_AUDIO_ENERGY')
        sys.exit(0)
sys.exit(1)
PY
  then
    adb exec-out screencap -p > "$OUT/rtc-rendered.png"
    echo PASS_ANDROID_EMULATOR_ACTUAL_APK_RTC_GATE | tee "$OUT/result.txt"
    exit 0
  fi
  sleep 3
done
echo FAIL_RTC_RX_NO_PROVEN_AUDIO_VIDEO
exit 1
