#!/usr/bin/env bash
# One-time REAL Android + Chromium noVNC E2E. Runs on a KVM-enabled GitHub runner.
set -euo pipefail
out=mobile-test-results/android-live-e2e
mkdir -p "$out"
base='https://hitel-communication-web-production.up.railway.app'
cookie="$out/owner.cookie"
session="$out/request.json"
test -s "$cookie" && test -s "$session"
export HITEL_KVM_MANUAL_LAUNCH=1
bash lab-kvm/run-live.sh >"$out/android-runner.log" 2>&1 &
runner_pid=$!
cleanup(){
  curl -sS --max-time 12 -X POST "$base/lab-kvm/stop" -b "$cookie" \
    -H "Origin: $base" -H 'Content-Type: application/json' -d '{}' \
    >"$out/stop.json" 2>&1 || true
  kill "$runner_pid" 2>/dev/null || true
  wait "$runner_pid" 2>/dev/null || true
}
trap cleanup EXIT
echo ANDROID_E2E_WAIT_FOR_REAL_RUNNER
ready=0
for n in $(seq 1 100);do
 if ! kill -0 "$runner_pid" 2>/dev/null;then
   echo ANDROID_E2E_RUNNER_PREMATURE_EXIT
   tail -n 100 "$out/android-runner.log" || true
   exit 32
 fi
 status=$(curl -sS --max-time 8 -b "$cookie" "$base/lab-kvm/status" || true)
 if [[ "$status" == *'"status":"running"'* ]];then ready=1;break;fi
 sleep 2
done
if [[ "$ready" != 1 ]];then echo ANDROID_E2E_RUNNER_NOT_READY;tail -n 100 "$out/android-runner.log";exit 33;fi
echo ACTUAL_ANDROID_11_RELAY_CONNECTED
# Independent control: Chrome directly connects to the SAME local VNC server.
# If direct succeeds and Railway fails, the relay is the fault.
git clone --quiet --depth 1 --branch v1.6.0 https://github.com/novnc/noVNC.git "$out/novnc"
cp lab-kvm/direct-phone.html "$out/novnc/phone.html"
python3 -m http.server 8099 --bind 127.0.0.1 --directory "$out/novnc" > "$out/local-web.log" 2>&1 &
python3 lab-kvm/e2e-browser.py
echo ANDROID_11_VNC_BROWSER_E2E_SUCCESS
