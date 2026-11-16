#!/usr/bin/env bash
# Android14 UI end-to-end: actually tap the onboarding "시작하기" button.
# Never accept service terms, log in, enroll, or submit account data.
set -euo pipefail
OUT=ixio-main-start-button-validation
PKG=com.lguplus.aicallagent
APK=.ixio-start-test/IXIO_Main_NoAppSealing_Single.apk
mkdir -p "$OUT"
adb wait-for-device
adb logcat -c >/dev/null 2>&1 || true
adb uninstall "$PKG" > "$OUT/pre-uninstall.txt" 2>&1 || true
if adb install "$APK" > "$OUT/install.txt" 2>&1; then
  echo "INSTALL=PASS" > "$OUT/status.env"
else
  echo "INSTALL=FAIL" > "$OUT/status.env"
  exit 1
fi
{
echo "Android=$(adb shell getprop ro.build.version.release)"
echo "Emulator_model=$(adb shell getprop ro.product.model)"
echo "SIM_STATE=$(adb shell getprop gsm.sim.state)"
echo "OPERATOR=$(adb shell getprop gsm.operator.alpha)"
echo "OPERATOR_NUMERIC=$(adb shell getprop gsm.operator.numeric)"
echo "NATIVE_BRIDGE=$(adb shell getprop ro.dalvik.vm.native.bridge)"
} > "$OUT/emulator.txt"
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 \
 > "$OUT/launch.txt" 2>&1 || true

capture() {
 local stage="$1"
 adb shell pidof "$PKG" > "$OUT/$stage-pid.txt" 2>&1 || true
 adb shell dumpsys activity activities > "$OUT/$stage-activity.txt" 2>&1 || true
 adb exec-out screencap -p > "$OUT/$stage-screen.png" 2>/dev/null || true
 adb shell uiautomator dump "/sdcard/ixio-$stage.xml" \
   > "$OUT/$stage-uiautomator.log" 2>&1 || true
 adb pull "/sdcard/ixio-$stage.xml" "$OUT/$stage-ui.xml" \
   > "$OUT/$stage-pull.log" 2>&1 || true
 STAGE="$stage" OUT="$OUT" python3 - <<'PY'
import os,xml.etree.ElementTree as ET
from pathlib import Path
out=Path(os.environ["OUT"]);stage=os.environ["STAGE"]
path=out/f"{stage}-ui.xml"
nodes=[]
if path.exists():
 try:
  for e in ET.parse(path).getroot().iter("node"):
   d=e.attrib
   if d.get("text") or d.get("content-desc"):
    nodes.append({"text":d.get("text",""),"desc":d.get("content-desc",""),
                  "bounds":d.get("bounds",""),"resource":d.get("resource-id",""),
                  "clickable":d.get("clickable",""),"class":d.get("class","")})
 except Exception as exc:
  nodes=[{"error":str(exc)}]
lines=[str(x) for x in nodes]
(out/f"{stage}-nodes.txt").write_text("\n".join(lines),encoding="utf8")
print("=== VISIBLE UI",stage,"===")
print("\n".join(lines[:65]))
PY
}
sleep 6
capture before-tap
OUT="$OUT" python3 - <<'PY' > "$OUT/tap-coordinates.txt"
import os,xml.etree.ElementTree as ET,re
from pathlib import Path
path=Path(os.environ["OUT"])/"before-tap-ui.xml"
if not path.exists():print("BUTTON_NOT_FOUND");raise SystemExit
nodes=list(ET.parse(path).getroot().iter("node"))
for n in nodes:
 t=n.attrib.get("text","").strip()
 if t=="시작하기":
  rect=n.attrib.get("bounds","")
  match=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",rect)
  if match:
   a,b,c,d=map(int,match.groups())
   print(f"START_TAP={(a+c)//2},{(b+d)//2}");break
else:print("START_BUTTON_NOT_FOUND")
PY
cat "$OUT/tap-coordinates.txt"
if grep -q '^START_TAP=' "$OUT/tap-coordinates.txt"; then
 coords="$(sed -n 's/^START_TAP=//p' "$OUT/tap-coordinates.txt" | head -1)"
 x="${coords%,*}";y="${coords#*,}"
 adb shell input tap "$x" "$y" > "$OUT/start-tap.log" 2>&1 || true
 echo "ONBOARDING_START_TAPPED=YES" >> "$OUT/status.env"
else
 echo "ONBOARDING_START_TAPPED=NO" >> "$OUT/status.env"
fi
sleep 5
capture after-tap-5s
sleep 12
capture after-tap-17s
sleep 23
capture after-tap-40s
# Dismiss ONLY a visible error's "확인" and observe if app quits afterwards.
OUT="$OUT" python3 - <<'PY' > "$OUT/error-dismiss-coordinates.txt"
import os,re,xml.etree.ElementTree as ET
from pathlib import Path
p=Path(os.environ["OUT"])/"after-tap-40s-ui.xml"
if not p.exists():print("XML_MISSING");raise SystemExit
nodes=list(ET.parse(p).getroot().iter("node"))
text=" ".join(n.attrib.get("text","")+" "+n.attrib.get("content-desc","") for n in nodes)
if not any(x in text for x in ("서비스에 가입할 수 없","가입할 수 없","가입할 수 없습니다","서비스 이용 불가","가입이 불가능")):
 print("NO_SUBSCRIPTION_ERROR_IN_UI");raise SystemExit
print("SUBSCRIPTION_ERROR_IN_UI")
for n in nodes:
 label=n.attrib.get("text","").strip()
 if label in ("확인","닫기","OK","취소","알겠습니다"):
  m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",n.attrib.get("bounds",""))
  if m:
   a,b,c,d=map(int,m.groups())
   print(f"DISMISS_TAP={(a+c)//2},{(b+d)//2}")
   break
else:
 print("NO_DISMISS_BUTTON")
PY
if grep -q '^DISMISS_TAP=' "$OUT/error-dismiss-coordinates.txt"; then
 coords="$(sed -n 's/^DISMISS_TAP=//p' "$OUT/error-dismiss-coordinates.txt" | head -1)"
 x="${coords%,*}";y="${coords#*,}"
 adb shell input tap "$x" "$y" > "$OUT/dismiss-tap.log" 2>&1 || true
 echo "ERROR_DISMISSED=YES" >> "$OUT/status.env"
else
 echo "ERROR_DISMISSED=NO" >> "$OUT/status.env"
fi
sleep 10
capture post-error-dismiss
adb logcat -d -v threadtime -t 30000 > "$OUT/logcat-full.txt" 2>&1 || true
grep -iE 'com\.lguplus\.aicallagent|ixio|HITEL_FB_BRIDGE|FATAL EXCEPTION|SecurityException|auth|login|가입|subscription|registration|enroll|unsupported|carrier|forbidden|exception|telephony|sim' \
 "$OUT/logcat-full.txt" | head -n 2300 > "$OUT/logcat-relevant.txt" || true
grep -A 35 'FATAL EXCEPTION' "$OUT/logcat-full.txt" | head -n 100 > "$OUT/crash-blocks.txt" || true
for name in before-tap after-tap-5s after-tap-17s after-tap-40s post-error-dismiss; do
 if [ -s "$OUT/$name-pid.txt" ]; then
   echo "$name=PROCESS_ALIVE" | tee -a "$OUT/status.env"
 else
   echo "$name=PROCESS_NOT_RUNNING" | tee -a "$OUT/status.env"
 fi
done
if grep -q '서비스에 가입할 수 없\|가입할 수 없\|가입이 불가능' "$OUT"/*-nodes.txt; then
 echo "SERVICE_SUBSCRIPTION_ERROR=OBSERVED" | tee -a "$OUT/status.env"
else
 echo "SERVICE_SUBSCRIPTION_ERROR=NOT_OBSERVED" | tee -a "$OUT/status.env"
fi
cat "$OUT/status.env"
cat "$OUT/error-dismiss-coordinates.txt"
