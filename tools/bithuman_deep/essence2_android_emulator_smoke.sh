#!/usr/bin/env bash
# First-run smoke test of the real ARM64 Essence2 APK on an Android 11
# Google APIs x86_64 emulator. Not a Galaxy Flip3 hardware-performance test.
set -euo pipefail
APK="${1:?APK path}"
OUT="${2:?proof folder}"
PACKAGE="ai.bithuman.example.avatar_chat.essence2"
mkdir -p "$OUT"
echo "EMULATOR_ABIS=$(adb shell getprop ro.product.cpu.abilist | tr -d '\r')"
echo "EMULATOR_SDK=$(adb shell getprop ro.build.version.sdk | tr -d '\r')"
echo "APK_SIZE=$(stat -c '%s' "$APK")"
adb shell wm size 720x1280 || true
adb shell wm density 320 || true
set +e
adb install --abi arm64-v8a -r "$APK" > "$OUT/install-result.txt" 2>&1
installed=$?
set -e
cat "$OUT/install-result.txt"
adb shell dumpsys package "$PACKAGE" | grep -E "primaryCpuAbi|secondaryCpuAbi" | head -8 || true
if [ "$installed" -ne 0 ]; then
  echo "FAIL_EMULATOR_ARM64_INSTALL_NOT_SUPPORTED"
  exit 12
fi
adb shell logcat -c
# Capture ALL logcat buffers from the start. Narrow grep missed the earlier
# fatal signal/LMKD process termination in the translated ARM64 emulator.
adb logcat -b all -v threadtime > "$OUT/full-system-logcat.txt" 2>&1 &
FULL_LOGCAT_PID=$!
adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 \
    > "$OUT/launch-result.txt" 2>&1 || true
sleep 55
# ARM64 translation delays Flutter's first rendered chooser; never tap a splash screen.
adb exec-out screencap -p > "$OUT/essence2-chooser.png" || true
adb shell uiautomator dump /sdcard/essence2-ui.xml \
    > "$OUT/uiautomator-result.txt" 2>&1 || true
adb shell cat /sdcard/essence2-ui.xml > "$OUT/essence2-ui.xml" 2>/dev/null || true
# A cold Google APIs image can put the launcher's own ANR dialog above the app.
# Never send the model-selector tap into that dialog and then wait seven minutes.
# Handle ONLY the known launcher, preserving failures belonging to our app.
if grep -Fq "Pixel Launcher isn't responding" "$OUT/essence2-ui.xml"; then
  echo RECOVER_EMULATOR_PIXEL_LAUNCHER_ANR_BEFORE_MODEL_SELECTION
  adb shell am force-stop com.google.android.apps.nexuslauncher
  adb shell am start -n "$PACKAGE/ai.bithuman.example.avatar_chat.MainActivity" > "$OUT/relaunch-after-launcher-anr.txt"
  sleep 5
  adb shell uiautomator dump /sdcard/essence2-ui.xml > "$OUT/uiautomator-after-launcher-recovery.txt" 2>&1 || true
  adb shell cat /sdcard/essence2-ui.xml > "$OUT/essence2-ui.xml"
  adb exec-out screencap -p > "$OUT/chooser-after-launcher-recovery.png"
fi
if grep -Fq "isn't responding" "$OUT/essence2-ui.xml"; then
  echo FAIL_UNHANDLED_ANR_DIALOG_BEFORE_MODEL_SELECTION
  exit 18
fi
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
echo "PRE_TAP_LOCAL_BOOT_PATHS:"
adb shell run-as "$PACKAGE" find . -name boot_status.txt -type f || true
echo "TAPPING ESSENCE2 SAMPLE BUTTON X=$X Y=$Y"
adb shell input tap "$X" "$Y"
for i in $(seq 1 42); do
    sleep 10
    pid="$(adb shell pidof "$PACKAGE" | tr -d '\r' || true)"
    echo "AFTER_TAP_SECONDS=$((i*10)) PROCESS=$pid"
    if [ -z "$pid" ]; then
      echo "EMULATOR_PROCESS_EXIT_DETECTED_AT_$((i*10))_SECONDS"
      adb shell dumpsys activity exit-info "$PACKAGE" > "$OUT/exit-info.txt" 2>&1 || true
      adb shell dumpsys activity processes > "$OUT/processes-at-exit.txt" 2>&1 || true
      adb exec-out screencap -p > "$OUT/essence2-at-exit.png" || true
      break
    fi
    if [ "$((i%6))" -eq 0 ]; then
      adb exec-out screencap -p > "$OUT/essence2-at-$((i*10))s.png" || true
      adb shell run-as "$PACKAGE" cat ./app_flutter/boot_status.txt > "$OUT/boot-status-checkpoint.txt" 2>/dev/null || true
      echo "CHECKPOINT_${i}_BOOT:"
      tail -6 "$OUT/boot-status-checkpoint.txt" || true
      if grep -q 'boot:load:ok' "$OUT/boot-status-checkpoint.txt"; then
        echo "PASS_ESSENCE2_NATIVE_LOAD_READY_AT_$((i*10))_SECONDS"
        sleep 45
        break
      fi
    fi
    if [ "$i" -eq 1 ]; then
       adb exec-out screencap -p > "$OUT/essence2-at-10s.png" || true
    fi
done
adb exec-out screencap -p > "$OUT/essence2-after-tap.png" || true
kill "$FULL_LOGCAT_PID" 2>/dev/null || true
wait "$FULL_LOGCAT_PID" 2>/dev/null || true
adb shell dumpsys activity exit-info "$PACKAGE" > "$OUT/exit-info.txt" 2>&1 || true
adb shell dumpsys meminfo "$PACKAGE" > "$OUT/app-meminfo.txt" 2>&1 || true
adb shell cat /proc/meminfo > "$OUT/system-meminfo.txt" 2>&1 || true
# Pass find arguments directly through run-as; sh -c loses -name/-type under
# adb's shell quoting rules and previously listed directories instead of logs.
adb shell run-as "$PACKAGE" find . -name boot_status.txt -type f \
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
for name in ('selected-native-logcat.txt','full-system-logcat.txt','boot-status.txt','exit-info.txt','processes-at-exit.txt'):
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
echo "APP_TERMINATION_EVIDENCE:"
grep -Ei "FATAL EXCEPTION|Fatal signal|lowmemory|lmkd|am_kill|am_crash|tombstone|OutOfMemoryError|SIGSEGV|SIGABRT|avc: denied|Dart Error|Process.*has died|Killing.*ai.bithuman|signal 9|memory pressure" "$OUT/full-system-logcat.txt" | tail -70 || true
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
  echo "FAIL_ESSENCE2_EMULATOR_NATIVE_RENDER_NOT_CONFIRMED_AFTER_MODEL_BOOT"
  exit 14
fi


