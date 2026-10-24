#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/vendor/android-emulator-platform"
export DB_PASSWORD="original-chrome-one-shot"
OUT="$ROOT/mobile-test-results/android-original-chrome"
mkdir -p "$OUT"
compose(){ docker compose -f docker-compose.yml -f ../../infra/android-original/github-4cpu.compose.yml "$@"; }
trap 'compose down --remove-orphans >/dev/null 2>&1 || true' EXIT
compose build emulator-1 > "$OUT/build.log" 2>&1 || { tail -n 70 "$OUT/build.log"; exit 1; }
compose up -d --no-build emulator-1
guest(){ docker exec android-emulator-1 adb "$@"; }
for i in $(seq 1 55); do
 ready="$(guest shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
 [[ "$ready" == '1' ]] && break
 sleep 3
done
[[ "$ready" == '1' ]] || { echo ORIGINAL_CHROME_BOOT_FAILED; exit 1; }
echo ORIGINAL_CHROME_ANDROID_BOOT_OK

snapshot(){
 label="$1"
 guest shell uiautomator dump "/sdcard/hitel-$label.xml" > "$OUT/$label-dump.log" 2>&1 || true
 guest exec-out cat "/sdcard/hitel-$label.xml" > "$OUT/$label.xml" 2>/dev/null || true
 guest exec-out screencap -p > "$OUT/$label.png" || true
}
click_label(){
 local label="$1" word="$2" xy
 xy="$(python3 - "$OUT/$label.xml" "$word" <<'PY'
import sys,re,xml.etree.ElementTree as ET
try:
 r=ET.parse(sys.argv[1]).getroot()
 for node in r.iter('node'):
  txt=(node.get('text','')+' '+node.get('content-desc','')).strip()
  if sys.argv[2].lower() in txt.lower():
   b=node.get('bounds','')
   nums=list(map(int,re.findall(r'\d+',b)))
   if len(nums)==4:
    print((nums[0]+nums[2])//2,(nums[1]+nums[3])//2)
    sys.exit(0)
except Exception as e:print(type(e).__name__,str(e),file=sys.stderr)
sys.exit(1)
PY
)" || return 1
 read -r x y <<< "$xy"
 echo "ORIGINAL_CHROME_TAP_UI word=$word x=$x y=$y"
 guest shell input tap "$x" "$y"
}
guest shell am start -W -a android.intent.action.VIEW -d 'https://example.com/' > "$OUT/first-visit.txt" 2>&1 || true
sleep 7
snapshot first-run
if click_label first-run 'Accept & continue'; then
 echo ORIGINAL_CHROME_FIRST_RUN_ACCEPTED
 sleep 5
 snapshot after-accept
 for text in 'No thanks' 'Use without an account' 'Not now' 'Continue without account' 'Skip';do
  if click_label after-accept "$text";then
   echo "ORIGINAL_CHROME_FIRST_RUN_SKIPPED_SYNC $text"
   sleep 5
   break
  fi
 done
else
 echo ORIGINAL_CHROME_NO_FIRST_RUN_ACCEPT_BUTTON_FOUND
fi
guest shell am start -W -a android.intent.action.VIEW -d 'https://example.com/' > "$OUT/retry-visit.txt" 2>&1 || true
sleep 20
snapshot final-example-com
python3 - "$OUT/final-example-com.xml" <<'PY'
import sys,xml.etree.ElementTree as ET
try:
 nodes=list(ET.parse(sys.argv[1]).iter('node'))
 texts=[(x.get('text') or x.get('content-desc') or '') for x in nodes]
 text=' | '.join(t for t in texts if t)
 print("ORIGINAL_CHROME_FINAL_VISIBLE_TEXT",text[:2600],flush=True)
 if 'Example Domain' in text:print("ORIGINAL_ANDROID_REAL_HTTPS_RENDER_PASS",flush=True)
 elif 'No internet' in text or 'ERR_INTERNET' in text:print("ORIGINAL_ANDROID_REAL_HTTPS_RENDER_NETWORK_FAILURE",flush=True)
 else:print("ORIGINAL_ANDROID_REAL_HTTPS_RENDER_UNRESOLVED",flush=True)
except Exception as e: print("ORIGINAL_CHROME_XML_ERROR",type(e).__name__,str(e),flush=True)
PY
guest forward tcp:9222 localabstract:chrome_devtools_remote > "$OUT/cdp-forward.txt" 2>&1 || true
docker exec android-emulator-1 sh -c 'curl -fsS --max-time 10 http://127.0.0.1:9222/json' \
 > "$OUT/chrome-devtools-pages.json" 2>&1 || true
python3 - "$OUT/chrome-devtools-pages.json" <<'PY'
import json,sys
try:
 data=json.load(open(sys.argv[1]))
 for item in data[:8]:print("ORIGINAL_CHROME_CDP_PAGE",item.get("title"),item.get("url"),flush=True)
except Exception as e: print("ORIGINAL_CHROME_CDP_UNAVAILABLE",type(e).__name__,flush=True)
PY
guest shell dumpsys connectivity > "$OUT/connectivity-after-browser.txt" 2>&1 || true
guest shell logcat -d -t 6000 > "$OUT/logcat-after-browser.txt" 2>&1 || true
echo ORIGINAL_CHROME_HTTPS_DIAGNOSTIC_COMPLETED
