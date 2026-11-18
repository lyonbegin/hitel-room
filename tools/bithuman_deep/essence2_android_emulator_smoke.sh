#!/usr/bin/env bash
# First-run smoke test of the real ARM64 Essence2 APK on an Android 11
# Google APIs x86_64 emulator. Not a Galaxy Flip3 hardware-performance test.
set -euo pipefail
APK="${1:?APK path}"
OUT="${2:?proof folder}"
PACKAGE="ai.bithuman.example.avatar_chat"
mkdir -p "$OUT"
echo "EMULATOR_ABIS=$(adb shell getprop ro.product.cpu.abilist | tr -d '\r')"
echo "EMULATOR_SDK=$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
echo "APK_SIZE=$(stat -c '%s' "$APK")"
adb shell wm size 720x1280 || true
adb shell wm density 320 || true
set +e
adb install -r "$APK" > "$OUT/install-result.txt" 2>&1
installed=$?
set -e
cat "$OUT/install-result.txt"
if [ "$installed" -ne 0 ]; then
  echo "FAIL_EMULATOR_ARM64_INSTALL_NOT_SUPPORTED"
  exit 12
fi
adb shell logcat -c
adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 \
    > "$OUT/launch-result.txt" 2>&1 || true
sleep 12
adb exec-out screencap -p > "$OUT/essence2-chooser.png" || true
adb shell uiautomator dump /sdcard/essence2-ui.xml \
    > "$OUT/uiautomator-result.txt" 2>&1 || true
adb shell cat /sdcard/essence2-ui.xml > "$OUT/essence2-ui.xml" 2>/dev/null || true
echo "ACTIVITY:"
adb shell dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity' | head -5 || true
echo "EMULATOR_UI_EXTRACT"
grep -oE 'text="[^"]+"|content-desc="[^"]+"' "$OUT/essence2-ui.xml" \
    | head -45 || true
set +e
python3 - "$OUT/essence2-ui.xml" "$OUT/tapcoords.txt" <<'PY'
import re,sys,xml.etree.ElementTree as ET
p,out=sys.argv[1:]
try:
    root=ET.parse(p).getroot()
    for n in root.iter('node'):
        content=(n.attrib.get('text','')+' '+n.attrib.get('content-desc','')).lower()
        if 'load essence 2 avatar' in content:
            bounds=n.attrib.get('bounds','')
            pts=[int(x) for x in re.findall(r'\d+',bounds)]
            if len(pts)==4:
                open(out,'w').write(f'{(pts[0]+pts[2])//2} {(pts[1]+pts[3])//2}\n')
                print('FOUND_FLUTTER_LOAD_BUTTON',bounds)
                sys.exit(0)
except Exception as e:
    print('UIAUTOMATOR_XML_NOT_READY',type(e).__name__)
sys.exit(2)
PY
ui_found=$?
set -e
if [ "$ui_found" -eq 0 ]; then
  read -r X Y < "$OUT/tapcoords.txt"
else
  echo "UIAUTOMATOR_NO_SEMANTICS_USING_LAYOUT_FALLBACK"
  X=360
  Y=745
fi
echo "TAPPING ESSENCE2 SAMPLE BUTTON X=$X Y=$Y"
adb shell input tap "$X" "$Y"
for i in 1 2 3 4 5 6; do
    sleep 20
    echo "AFTER_TAP_SECONDS=$((i*20)) PROCESS=$(adb shell pidof "$PACKAGE" | tr -d '\r')"
done
adb exec-out screencap -p > "$OUT/essence2-after-tap.png" || true
adb shell run-as "$PACKAGE" sh -c 'find . -name boot_status.txt -type f' \
    > "$OUT/boot-status-paths.txt" 2>&1 || true
while IFS= read -r path; do
  if [[ "$path" == *boot_status.txt ]]; then
    adb shell run-as "$PACKAGE" cat "$path" > "$OUT/boot-status.txt" 2>/dev/null || true
    break
  fi
done < "$OUT/boot-status-paths.txt"
adb logcat -d -v time | grep -E 'BithumanPlugin|HITEL_Essence2|FlutterJNI|AndroidRuntime|FATAL EXCEPTION|UnsatisfiedLinkError|Essence2|E2UAvatar|GPU|Native' \
    | tail -350 > "$OUT/selected-native-logcat.txt" || true
python3 - "$OUT" <<'PY'
from pathlib import Path
import re,sys
root=Path(sys.argv[1])
for name in ('selected-native-logcat.txt','boot-status.txt'):
    p=root/name
    if not p.exists(): continue
    x=p.read_text(errors='replace')
    x=re.sub(r'https://[^\s]+?\?[^\s]+','[SIGNED_HTTPS_URL_REDACTED]',x)
    x=re.sub(r'(?i)Bearer\s+\S+','Bearer [REDACTED]',x)
    x=re.sub(r'(?i)api-secret[=:]\S+','api-secret=[REDACTED]',x)
    p.write_text(x)
PY
echo "BOOT_STATUS_LINES:"
tail -32 "$OUT/boot-status.txt" 2>/dev/null || true
echo "NATIVE_STATUS_LINES:"
tail -30 "$OUT/selected-native-logcat.txt" || true
if adb shell pidof "$PACKAGE" | grep -q '[0-9]'; then
  echo "PASS_ESSENCE2_EMULATOR_INSTALLED_LAUNCHED_AND_PROCESS_ALIVE_120S"
else
  echo "FAIL_ESSENCE2_APP_PROCESS_DEAD_AFTER_START"
  exit 13
fi
if grep -Eq 'boot:load:ok|avatar ready.*essence-2' \
     "$OUT/boot-status.txt" "$OUT/selected-native-logcat.txt" 2>/dev/null; then
  echo "PASS_ESSENCE2_ORIGINAL_NATIVE_AVATAR_LOADED_IN_ANDROID_EMULATOR"
else
  echo "ESSENCE2_EMULATOR_LAUNCHED_BUT_RENDER_NOT_YET_CONFIRMED"
fi
