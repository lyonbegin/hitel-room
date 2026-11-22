#!/usr/bin/env bash
# Never substitute a mock native library or publish a build based on compilation.
set -euo pipefail
ROOT="$GITHUB_WORKSPACE"
OUT="$ROOT/essence2-local-mock-proof/emulator"
APK="$ROOT/HITEL_UNIFIED_ANDROID_RTC_MAIN_20261122_ARM64.apk"
PKG=ai.bithuman.example.avatar_chat.essence2
mkdir -p "$OUT"
capture() {
  if [[ -n "${AUDIO_PID:-}" ]]; then kill -INT "$AUDIO_PID" 2>/dev/null || true; wait "$AUDIO_PID" || true; fi
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
adb shell wm size 720x1280
adb shell wm density 320
adb logcat -G 16M || true
adb install --abi arm64-v8a -r "$APK" | tee "$OUT/install.txt"
grep -Fxq 'Success' "$OUT/install.txt"
adb shell pm grant "$PKG" android.permission.RECORD_AUDIO
adb shell pm revoke "$PKG" android.permission.CAMERA
adb logcat -c
# Reuse the previous project's actual model chooser and loader test.
# It performs a second install of the SAME APK (runtime grants are retained).
bash "$ROOT/tools/bithuman_deep/essence2_android_emulator_smoke.sh" "$APK" "$OUT/model-load"
adb shell run-as "$PKG" cat app_flutter/boot_status.txt > "$OUT/boot.txt"
grep -q 'boot:load:ok' "$OUT/boot.txt"
echo PASS_MODEL_LOADED
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
# ICE ready is earlier than the actual offline chat session.
for ((i=0;i<120;i+=3)); do
  adb shell run-as "$PKG" cat app_flutter/boot_status.txt > "$OUT/boot.txt" || true
  if grep -q 'boot:session:open' "$OUT/boot.txt"; then break; fi
  sleep 3
done
grep -q 'boot:session:open' "$OUT/boot.txt"
adb exec-out screencap -p > "$OUT/connected.png"
# Known prior project issue: chrome auto-hides and translated Flutter may not
# expose EditText semantics. Use the previous verified 720x1280 UI geometry.
adb shell input tap 360 550
sleep 0.25
adb shell uiautomator dump /sdcard/hitel-ui.xml || true
adb pull /sdcard/hitel-ui.xml "$OUT/connected.xml" || true
read -r x y < <(python3 - "$OUT/connected.xml" <<'PY'
import re,sys,xml.etree.ElementTree as ET
try:
    for n in ET.parse(sys.argv[1]).iter('node'):
        if n.get('class')=='android.widget.EditText' and n.get('enabled')=='true':
            a,b,c,d=map(int,re.findall(r'\d+',n.get('bounds')))
            if c-a>30:
                print((a+c)//2,(b+d)//2);break
    else: print(252,1190)
except Exception: print(252,1190)
PY
)
for try in 1 2 3; do
  adb shell input tap 360 550
  sleep 0.25
  adb shell input tap "$x" "$y"
  sleep 1
  adb shell dumpsys input_method > "$OUT/input-method.txt"
  if grep -Eq 'mInputShown=true|mShowRequested=true|mImeWindowVis=.*visible' "$OUT/input-method.txt"; then break; fi
done
grep -Eq 'mInputShown=true|mShowRequested=true|mImeWindowVis=.*visible' "$OUT/input-method.txt"
adb exec-out screencap -p > "$OUT/input-focused.png"
# Capture real emulator speaker output, independently of inbound RTP energy.
ffmpeg -nostdin -hide_banner -loglevel warning -f pulse -i hitel_emulator.monitor -ac 1 -ar 16000 -y "$OUT/speaker.wav" > "$OUT/speaker-capture.log" 2>&1 &
AUDIO_PID=$!
sleep 1
kill -0 "$AUDIO_PID"
adb shell input text RTC%stest
adb shell input keyevent KEYCODE_ENTER
adb exec-out screencap -p > "$OUT/after-send.png"
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
    sleep 3
    kill -INT "$AUDIO_PID" || true
    wait "$AUDIO_PID" || true
    unset AUDIO_PID
    python3 - "$OUT/speaker.wav" <<'PY'
import sys,wave,array,math
with wave.open(sys.argv[1],'rb') as w:
    a=array.array('h',w.readframes(w.getnframes()))
    assert len(a)>=16000
    peak=max(map(abs,a))
    rms=math.sqrt(sum(v*v for v in a)/len(a))
    print(f'EMULATOR_SPEAKER peak={peak} rms={rms:.2f}')
    assert peak>100 and rms>10, 'No non-silent emulator speaker signal'
PY
    echo PASS_ANDROID_EMULATOR_ACTUAL_APK_RTC_GATE | tee "$OUT/result.txt"
    exit 0
  fi
  sleep 3
done
echo FAIL_RTC_RX_NO_PROVEN_AUDIO_VIDEO
exit 1
