#!/usr/bin/env bash
# Main app Android14 service enrollment diagnostic. Never initiate registration.
set -euo pipefail
OUT=ixio-main-service-enrollment-diagnostic
PKG=com.lguplus.aicallagent
APK=.ixio-service-test/IXIO_Main_NoAppSealing_Single.apk
mkdir -p "$OUT"
adb wait-for-device
adb logcat -c || true
{
  echo "Android $(adb shell getprop ro.build.version.release)"
  echo "ABIs: $(adb shell getprop ro.product.cpu.abilist)"
  echo "Native bridge: $(adb shell getprop ro.dalvik.vm.native.bridge)"
  echo "SIM state: $(adb shell getprop gsm.sim.state)"
  echo "Operator numeric: $(adb shell getprop gsm.operator.numeric)"
  echo "Operator alpha: $(adb shell getprop gsm.operator.alpha)"
} > "$OUT/emulator-env.txt" 2>&1
adb uninstall "$PKG" > "$OUT/pre-uninstall.txt" 2>&1 || true
if adb install "$APK" > "$OUT/install.txt" 2>&1; then
  echo "INSTALL=PASS" | tee "$OUT/status.env"
else
  echo "INSTALL=FAIL" | tee "$OUT/status.env"
  cat "$OUT/install.txt"
  exit 1
fi
adb shell pm path "$PKG" > "$OUT/package-paths.txt" 2>&1 || true
adb shell dumpsys package "$PKG" > "$OUT/dumpsys-package.txt" 2>&1 || true
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 \
  > "$OUT/launch.txt" 2>&1 || true
sleep 8

capture() {
  local stage="$1"
  echo "### CAPTURE_STAGE=$stage"
  adb shell pidof "$PKG" > "$OUT/$stage-pid.txt" 2>&1 || true
  adb shell dumpsys activity activities > "$OUT/$stage-activity.txt" 2>&1 || true
  adb exec-out screencap -p > "$OUT/$stage-screen.png" 2>/dev/null || true
  adb shell uiautomator dump /sdcard/ixio-$stage.xml \
    > "$OUT/$stage-ui-dump-command.txt" 2>&1 || true
  adb pull /sdcard/ixio-$stage.xml "$OUT/$stage-ui.xml" \
    > "$OUT/$stage-ui-pull.txt" 2>&1 || true
  STAGE="$stage" OUTDIR="$OUT" python3 - <<'PY'
import os, xml.etree.ElementTree as ET
from pathlib import Path
stage=os.environ["STAGE"];out=Path(os.environ["OUTDIR"])
file=out/f"{stage}-ui.xml"
nodes=[]
if file.exists():
    try:
        root=ET.parse(file).getroot()
        for e in root.iter("node"):
            d=e.attrib
            if d.get("text") or d.get("content-desc"):
                nodes.append({
                    "text":d.get("text",""), "desc":d.get("content-desc",""),
                    "resource_id":d.get("resource-id",""), "bounds":d.get("bounds",""),
                    "clickable":d.get("clickable",""),"class":d.get("class","")
                })
    except Exception as exc:
        nodes.append({"error":str(exc)})
for n in nodes[:100]:
    print("IXIO_UI_NODE",stage,n)
(out/f"{stage}-ui-visible.txt").write_text("\n".join(repr(x) for x in nodes),encoding="utf8")
PY
}
capture "after8s"
sleep 22
capture "after30s"

# Dismiss only an EXISTING observed alert; never register a subscription.
OUTDIR="$OUT" python3 - <<'PY' > "$OUT/dialog-action.txt"
import os,xml.etree.ElementTree as ET,re
from pathlib import Path
p=Path(os.environ["OUTDIR"])/"after30s-ui.xml"
if not p.exists():
    print("NO_XML");raise SystemExit
try:root=ET.parse(p).getroot()
except Exception as ex:
    print("XML_INVALID",ex);raise SystemExit
nodes=list(root.iter("node"))
text=" ".join(n.attrib.get("text","")+" "+n.attrib.get("content-desc","") for n in nodes)
blockers=["서비스에 가입할 수 없","서비스 가입","서비스를 이용할 수 없","가입할 수 없","가입이 불가능","가입 대상"]
if not any(t in text for t in blockers):
    print("NO_ENROLLMENT_ERROR_DETECTED");raise SystemExit
print("ENROLLMENT_ERROR_DETECTED")
for n in nodes:
    d=n.attrib
    label=(d.get("text","")+" "+d.get("content-desc","")).strip()
    if label in ("확인","닫기","OK","알겠습니다","취소") and d.get("bounds"):
        m=re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",d["bounds"])
        if m:
            x=(int(m.group(1))+int(m.group(3)))//2
            y=(int(m.group(2))+int(m.group(4)))//2
            print(f"DISMISS_TAP={x},{y} LABEL={label}")
            break
else:
    print("ERROR_FOUND_NO_DISMISS_BUTTON")
PY
if grep -q '^DISMISS_TAP=' "$OUT/dialog-action.txt"; then
  coord="$(sed -n 's/^DISMISS_TAP=\([0-9]*,[0-9]*\).*/\1/p' "$OUT/dialog-action.txt" | head -1)"
  x="${coord%,*}"; y="${coord#*,}"
  adb shell input tap "$x" "$y" > "$OUT/tap-result.txt" 2>&1 || true
  echo "DISMISSED_EXISTING_ERROR_DIALOG=YES" | tee -a "$OUT/status.env"
else
  echo "DISMISSED_EXISTING_ERROR_DIALOG=NO" | tee -a "$OUT/status.env"
fi
sleep 12
capture "after-dismiss"
sleep 25
capture "after60plus"
adb logcat -d -v threadtime -t 25000 > "$OUT/logcat-full.txt" 2>&1 || true
grep -Ei "com\.lguplus\.aicallagent|Firebase|HITEL_FB_BRIDGE|ixio|ixispeech|signup|registration|subscription|carrier|SIM|auth|APPCRASH|FATAL EXCEPTION|SecurityException|checkSignatures|exception|Enrollment" \
 "$OUT/logcat-full.txt" | head -n 1800 > "$OUT/logcat-target-filtered.txt" || true
for stage in after8s after30s after-dismiss after60plus; do
  if [ -s "$OUT/$stage-pid.txt" ]; then
    echo "$stage=PROCESS_ALIVE" | tee -a "$OUT/status.env"
  else
    echo "$stage=PROCESS_NOT_RUNNING" | tee -a "$OUT/status.env"
  fi
done
if grep -qiE '서비스에 가입할 수 없|서비스 가입|가입할 수 없|가입이 불가능' "$OUT"/*-ui-visible.txt; then
  echo "ENROLLMENT_DIALOG_SEEN=YES" | tee -a "$OUT/status.env"
else
  echo "ENROLLMENT_DIALOG_SEEN=NOT_OBSERVED" | tee -a "$OUT/status.env"
fi
if grep -q 'HITEL_FB_BRIDGE.*FIREBASE_INITIALIZE_RETURNED=true' "$OUT/logcat-full.txt"; then
  echo "FIREBASE_BRIDGE=SUCCESS" | tee -a "$OUT/status.env"
else
  echo "FIREBASE_BRIDGE=UNCONFIRMED" | tee -a "$OUT/status.env"
fi
grep -E 'FATAL EXCEPTION|Process: com.lguplus.aicallagent|Force finishing activity com.lguplus.aicallagent' \
 "$OUT/logcat-full.txt" | head -n 90 > "$OUT/crash-events.txt" || true
cat "$OUT/status.env"
cat "$OUT/dialog-action.txt"
