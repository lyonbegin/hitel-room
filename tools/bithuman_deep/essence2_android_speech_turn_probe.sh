#!/usr/bin/env bash
# Continue an ALREADY BOOTED Essence2 Android 15 emulator session after
# essence2_android_emulator_smoke.sh has proved boot:load:ok + actual frames.
# Type a user prompt using Android UI automation and require nonzero
# speechWritten/speechPresented evidence from unmodified original SDK.
set -euo pipefail
PACKAGE=ai.bithuman.example.avatar_chat.essence2
OUT="${1:?output directory}"
mkdir -p "$OUT"
adb shell pidof "$PACKAGE" | tr -d '\r' | grep -Eq '^[0-9]+$'
adb shell run-as "$PACKAGE" cat ./app_flutter/boot_status.txt \
  > "$OUT/boot-before-speech.txt"
grep -q 'boot:load:ok' "$OUT/boot-before-speech.txt"
grep -q 'boot:session:open' "$OUT/boot-before-speech.txt"
echo PASS_ESSENCE2_ORIGINAL_NATIVE_AND_MOCK_SESSION_READY_BEFORE_VOICE
adb shell logcat -c || true
# Touch the avatar to reveal the originally auto-hiding Flutter chrome.
adb shell input tap 360 550
sleep 2
adb exec-out screencap -p > "$OUT/speech-ui-chooser.png"
adb shell uiautomator dump /sdcard/essence2-speech.xml \
    > "$OUT/ui-dump-commands.txt" 2>&1 || true
adb shell cat /sdcard/essence2-speech.xml > "$OUT/speech-ui.xml" 2>/dev/null || true
set +e
python3 - "$OUT/speech-ui.xml" "$OUT/text-box-coordinates.txt" <<'PY'
import re,sys,xml.etree.ElementTree as ET
p,out=sys.argv[1:]
try:
    root=ET.parse(p).getroot()
    for n in root.iter('node'):
        desc=(n.attrib.get('text','')+' '+n.attrib.get('content-desc','')).lower()
        if (n.attrib.get('class')=='android.widget.EditText' or
                'say something' in desc or 'type' in desc):
            points=[int(x) for x in re.findall(r'\d+',n.attrib.get('bounds',''))]
            if len(points)==4 and (points[2]-points[0])>30:
                with open(out,'w') as f:f.write(f'{(points[0]+points[2])//2} {(points[1]+points[3])//2}\n')
                print('FOUND_ORIGINAL_FLUTTER_CHAT_TEXTFIELD',desc,points)
                sys.exit(0)
except Exception as e:
    print('SPEECH_UI_PARSE',str(e))
sys.exit(2)
PY
rc=$?
set -e
if [ "$rc" -ne 0 ]; then
  # Flutter's AutoHidingChrome shows the editable PromptCapsule but in
  # Android 15 ndk_translated mode it exposes only a root android.view.View
  # to uiautomator. Verified by actual 720x1280 screenshot and full UI XML
  # in GitHub Actions #44520971451. The original input occupies the
  # lower 84px, centered at y=1190. Use geometry only AFTER proving the
  # original session is open and the face is rendered.
  echo FLUTTER_SEMANTICS_NOT_EXPOSING_TEXTFIELD_USE_VERIFIED_VISUAL_GEOMETRY
  SIZE="$(adb shell wm size | tr -d '\r' | tail -1 | grep -oE '[0-9]+x[0-9]+' | tail -1)"
  test -n "$SIZE"
  W="${SIZE%x*}"
  H="${SIZE#*x}"
  X=$((W * 35 / 100))
  Y=$((H * 93 / 100))
  # The original text capsule is always at the bottom with keyboard closed.
  echo "$X $Y" > "$OUT/text-box-coordinates.txt"
fi
read -r X Y < "$OUT/text-box-coordinates.txt"
echo "TAP_ORIGINAL_CHAT_INPUT=$X,$Y"
# Source root cause: AutoHidingChrome hides the entire PromptCapsule after
# Motion.chromeIdle. UIAutomator dump and screenshot take longer than that
# timeout, so tapping the stale screenshot sent the tap to the FACE instead
# of the hidden input. Reveal and focus consecutively without intervening I/O.
adb shell input tap 360 550
sleep 0.25
adb shell input tap "$X" "$Y"
sleep 1
adb shell dumpsys input_method > "$OUT/input-method-focus.txt" 2>&1 || true
if ! grep -Eq 'mInputShown=true|mShowRequested=true|mImeWindowVis=.*visible' "$OUT/input-method-focus.txt"; then
  echo IME_NOT_VISIBLE_AFTER_FIRST_TAP_REPEAT_IMMEDIATELY
  adb shell input tap 360 550
  sleep 0.2
  adb shell input tap "$X" "$Y"
  sleep 1
  adb shell dumpsys input_method > "$OUT/input-method-focus.txt" 2>&1 || true
fi
adb exec-out screencap -p > "$OUT/speech-input-focused.png" || true
echo "IME_STATE:"
grep -E 'mInputShown|mShowRequested|mCurFocusedWindow' "$OUT/input-method-focus.txt" | tail -5 || true
# The original PromptCapsule is single-line with onSubmitted -> _send.
adb shell input text 'HITEL%sessence%stwo%sspeech%stest'
sleep 2
adb exec-out screencap -p > "$OUT/speech-input-filled.png" || true
adb shell input keyevent KEYCODE_ENTER
echo INPUT_REAL_ORIGINAL_CHAT_EVENT_DISPATCHED_BY_ADB_ENTER
sleep 8
adb exec-out screencap -p > "$OUT/speech-after-send.png"
adb shell run-as "$PACKAGE" cat ./app_flutter/boot_status.txt > "$OUT/boot-after-send.txt" 2>/dev/null || true
# Original SDK response + audio frames can take longer under ARM translation.
for i in $(seq 1 72); do
  sleep 10
  adb logcat -d -v time > "$OUT/full-after-speech-logcat.txt" || true
  if grep -q "stage=speech.playback.exception" "$OUT/full-after-speech-logcat.txt"; then
    echo FAIL_NATIVE_SPEECH_WORKER_TERMINATED
    break
  fi
  adb shell run-as "$PACKAGE" cat ./app_flutter/boot_status.txt > "$OUT/boot-after-send.txt" || true
  if grep -E 'speechWritten=[1-9][0-9]*.*speechPresented=[1-9][0-9]*' \
    "$OUT/full-after-speech-logcat.txt" >/dev/null; then
    echo "PASS_ESSENCE2_ORIGINAL_NATIVE_SPEECH_FRAMES_WRITTEN_AND_PRESENTED_AFTER_$((i*10))s"
    break
  fi
  if ! adb shell pidof "$PACKAGE" | grep -q '[0-9]'; then
    echo FAIL_ESSENCE2_APP_CRASHED_DURING_TEXT_TO_VOICE
    break
  fi
  if (( i % 6 == 0 )); then
    echo SPEECH_CHECKPOINT_$((i*10))s
    grep -E 'BithumanAvatar: texture frames|session:|speechWritten|speechPresented|speech text' \
      "$OUT/full-after-speech-logcat.txt" | tail -10 || true
  fi
done
adb exec-out screencap -p > "$OUT/speech-final.png"
adb shell run-as "$PACKAGE" cat ./app_flutter/boot_status.txt > "$OUT/boot-final.txt" 2>/dev/null || true
adb logcat -d -v time > "$OUT/full-after-speech-logcat.txt" || true
python3 - "$OUT" <<'PY'
from pathlib import Path
import re,sys
root=Path(sys.argv[1])
for p in root.glob('*.txt'):
    if 'coordinate' in p.name:continue
    text=p.read_text(errors='replace')
    text=re.sub(r'(?i)Bearer\s+\S+','Bearer [REDACTED]',text)
    text=re.sub(r'(?i)api-secret[=:]\S+','api-secret=[REDACTED]',text)
    text=re.sub(r'https://[^\s]+?\?[^\s]+','[SIGNED_LINK_REDACTED]',text)
    p.write_text(text)
PY
echo REAL_ESSENCE2_NATIVE_SPEECH_FRAME_STATISTICS
grep -E 'BithumanAvatar: texture frames|speechWritten|speechPresented|botTranscript|response\.|BithumanRealtime' \
  "$OUT/full-after-speech-logcat.txt" | tail -35 || true
echo REAL_ESSENCE2_AUDIO_OUTPUT_LOGS
grep -E 'AudioTrack|AudioFlinger|bhav|bh-feed' "$OUT/full-after-speech-logcat.txt" | tail -25 || true
echo REAL_ESSENCE2_BOOT_AND_SESSION_DIAGNOSTICS
cat "$OUT/boot-final.txt"
if grep -Eq 'speechWritten=[1-9][0-9]*.*speechPresented=[1-9][0-9]*' \
   "$OUT/full-after-speech-logcat.txt"; then
  echo PASS_ESSENCE2_ORIGINAL_SDK_SPEECH_FRAME_PRESENTATION_VERIFIED
else
  echo FAIL_ESSENCE2_SPEECH_PRESENTATION_UNVERIFIED
  exit 16
fi
