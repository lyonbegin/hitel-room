#!/usr/bin/env bash
# Original Android11 emulator internet and Google Play validation.
# Pure ADB tests against original runtime. No upstream source changes.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/vendor/android-emulator-platform"
export DB_PASSWORD="original-temporary-network-test"
docker compose -f docker-compose.yml -f ../../infra/android-original/github-4cpu.compose.yml build emulator-1 \
 > "$ROOT/original-network-build.log" 2>&1 || { tail -n 100 "$ROOT/original-network-build.log"; exit 1; }
docker compose -f docker-compose.yml -f ../../infra/android-original/github-4cpu.compose.yml up -d --no-build emulator-1
mkdir -p "$ROOT/mobile-test-results/android-original-internet"
OUT="$ROOT/mobile-test-results/android-original-internet"
trap 'docker compose -f docker-compose.yml -f ../../infra/android-original/github-4cpu.compose.yml down --remove-orphans >/dev/null 2>&1 || true' EXIT
for i in $(seq 1 60); do
  state="$(docker exec android-emulator-1 adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  [[ "$state" == "1" ]] && break
  sleep 3
done
[[ "$state" == "1" ]] || { echo 'ORIGINAL_ANDROID_BOOT_FAILURE'; exit 1; }
echo 'ORIGINAL_ANDROID_BOOT_SUCCESS'
function guest() { docker exec android-emulator-1 adb "$@"; }
guest shell getprop ro.build.version.release | tee "$OUT/android-version.txt"
guest shell dumpsys connectivity > "$OUT/connectivity.txt" 2>&1 || true
guest shell dumpsys wifi > "$OUT/wifi.txt" 2>&1 || true
guest shell ip route > "$OUT/routes.txt" 2>&1 || true
guest shell getprop > "$OUT/properties.txt" 2>&1 || true
guest shell settings get global airplane_mode_on | tee "$OUT/airplane-mode.txt" || true
guest shell pm path com.android.vending | tee "$OUT/playstore-package.txt"
grep -q package: "$OUT/playstore-package.txt"
echo 'ORIGINAL_GOOGLE_PLAY_PACKAGE_CONFIRMED'
if grep -q 'VALIDATED' "$OUT/connectivity.txt";then echo 'ORIGINAL_ANDROID_VALIDATED_NETWORK_YES'
else echo 'ORIGINAL_ANDROID_VALIDATED_NETWORK_NO';fi

# Check DNS resolution inside Android and TCP. Android images don't always ship
# curl/wget. An ICMP failure by itself is not an HTTPS verdict.
if guest shell ping -c 1 -W 5 www.google.com > "$OUT/dns-ping.txt" 2>&1;then
 echo 'ORIGINAL_ANDROID_DNS_AND_ICMP_PASS'
else
 echo 'ORIGINAL_ANDROID_DNS_PING_FAILED'
fi
if grep -Eq '^PING [^ ]+ \([0-9.]+' "$OUT/dns-ping.txt";then
 echo 'ORIGINAL_ANDROID_DNS_RESOLUTION_PASS'
else echo 'ORIGINAL_ANDROID_DNS_RESOLUTION_FAIL';fi
for program in curl wget busybox;do
 guest shell which "$program" >> "$OUT/guest-http-tools.txt" 2>&1 || true
done
cat "$OUT/guest-http-tools.txt"

# Force Google Play to load the exact Kakao T listing, then capture UI XML.
guest shell am start -W -a android.intent.action.VIEW \
  -d 'market://details?id=com.kakao.taxi' -p com.android.vending \
  > "$OUT/playstore-launch.txt" 2>&1 || true
echo 'ORIGINAL_KAKAOT_PLAYSTORE_ACTIVITY_ATTEMPTED'
cat "$OUT/playstore-launch.txt"
sleep 20
guest shell uiautomator dump /sdcard/hitel-original-play.xml > "$OUT/playstore-uiautomator.txt" 2>&1 || true
guest pull /sdcard/hitel-original-play.xml "$OUT/playstore-ui.xml" >/dev/null 2>&1 || true
guest exec-out screencap -p > "$OUT/playstore-kakaot.png" || true
guest shell dumpsys activity activities > "$OUT/playstore-activities.txt" 2>&1 || true
guest shell dumpsys package com.android.vending > "$OUT/playstore-package-info.txt" 2>&1 || true
if grep -Eiq 'kakao|카카오|install|설치' "$OUT/playstore-ui.xml";then
 echo 'ORIGINAL_PLAYSTORE_UI_MATCHES_KAKAOT_OR_INSTALL'
else echo 'ORIGINAL_PLAYSTORE_UI_NOT_YET_KAKAOT';fi

# Ask original Android browser to open a known HTTPS page, inspect visible text.
guest shell am start -W -a android.intent.action.VIEW \
  -d 'https://example.com/' > "$OUT/browser-launch.txt" 2>&1 || true
sleep 20
guest shell uiautomator dump /sdcard/hitel-https.xml > "$OUT/browser-uiautomator.txt" 2>&1 || true
guest pull /sdcard/hitel-https.xml "$OUT/browser-ui.xml" >/dev/null 2>&1 || true
guest exec-out screencap -p > "$OUT/browser-https.png" || true
guest shell dumpsys activity activities > "$OUT/browser-activities.txt" 2>&1 || true
guest shell logcat -d -v time -t 4000 > "$OUT/guest-logcat.txt" 2>&1 || true
if grep -iq 'Example Domain' "$OUT/browser-ui.xml";then
 echo 'ORIGINAL_ANDROID_HTTPS_EXAMPLE_COM_RENDERED'
else
 echo 'ORIGINAL_ANDROID_HTTPS_BROWSER_RESULT_UNKNOWN'
fi
echo 'ORIGINAL_ANDROID_BROWSER_UI_TEXT'
python3 - "$OUT/browser-ui.xml" "$OUT/playstore-ui.xml" <<'PY'
from xml.etree import ElementTree
import sys
for filename in sys.argv[1:]:
 print("UI_FILE",filename)
 try:
  r=ElementTree.parse(filename)
  text=[e.attrib.get("text","") for e in r.iter() if e.attrib.get("text")]
  print("VISIBLE_TEXT", " | ".join(text)[:1500])
 except Exception as e:print("XML_READ_ERROR",type(e).__name__,str(e))
PY
echo 'ORIGINAL_ANDROID_CONNECTIVITY_VALIDATION'
grep -E 'VALIDATED|VALIDATION|INTERNET|NOT_VPN|NOT_METERED|CaptivePortal' "$OUT/connectivity.txt" | head -n 35 || true
echo 'ORIGINAL_ANDROID_NETWORK_PROOF_COMPLETE'
