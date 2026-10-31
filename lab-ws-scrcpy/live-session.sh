#!/usr/bin/env bash
# On-demand GitHub KVM Android 11 -> ws-scrcpy -> browser session.
# All video is H.264/WebSocket, not VNC, and never goes through Railway media relay.
set -Eeuo pipefail
ROOT="$(pwd)"
UPSTREAM="$ROOT/.cache/hitel-ws-scrcpy"
OUT="$ROOT/mobile-test-results/ws-scrcpy-live"
mkdir -p "$OUT"
[[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" == "1" ]] || exit 21
[[ "$(adb shell getprop ro.build.version.release | tr -d '\r')" == "11" ]] || exit 22
(
 cd "$UPSTREAM/dist"
 export WS_SCRCPY_CONFIG="$UPSTREAM/hitel.yaml"
 exec node index.js
) >"$OUT/ws-scrcpy.log" 2>&1 &
SERVER_PID=$!
RELAY_PID=0
GATEWAY_PID=0
cleanup(){
 node lab-ws-scrcpy/session.mjs finish || true
 if [[ "$RELAY_PID" -gt 0 ]];then kill -TERM "$RELAY_PID" 2>/dev/null || true;fi
 if [[ "$GATEWAY_PID" -gt 0 ]];then kill -TERM "$GATEWAY_PID" 2>/dev/null || true;fi
 kill -TERM "$SERVER_PID" 2>/dev/null || true
 sleep 1
 [[ "$RELAY_PID" -gt 0 ]] && kill -KILL "$RELAY_PID" 2>/dev/null || true
 [[ "$GATEWAY_PID" -gt 0 ]] && kill -KILL "$GATEWAY_PID" 2>/dev/null || true
 kill -KILL "$SERVER_PID" 2>/dev/null || true
 wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT
fail_progress(){
 local code="$1" line="$2"
 node lab-ws-scrcpy/progress.mjs failed "Android 실행 스크립트 오류 (라인 $line, 종료 코드 $code). GitHub 로그를 확인해 주십시오." || true
}
trap 'fail_progress "$?" "$LINENO"' ERR
node lab-ws-scrcpy/progress.mjs booted 'Android 11 부팅 및 ADB 연결을 확인했습니다.' || true
for n in $(seq 1 75);do
 if ! kill -0 "$SERVER_PID" 2>/dev/null;then tail -n 100 "$OUT/ws-scrcpy.log";exit 31;fi
 curl -fsS --max-time 2 http://127.0.0.1:8000/ >/dev/null 2>&1 && break
 sleep 1
done
node lab-ws-scrcpy/proof.mjs
echo WS_SCRCPY_REAL_ANDROID11_KVM_STREAM_SERVER_READY
node lab-ws-scrcpy/progress.mjs scrcpy '실제 Android 11 ws-scrcpy 서버가 실행되었습니다.' || true
adb shell input keyevent 224 || true
adb shell wm dismiss-keyguard || true
adb shell input keyevent 3 || true
sleep 2
adb exec-out screencap -p > "$OUT/adb-native-screen.png" || true
node lab-ws-scrcpy/gateway.mjs > "$OUT/gateway.log" 2>&1 &
GATEWAY_PID=$!
for n in $(seq 1 15);do
 if curl -fsS --max-time 3 http://127.0.0.1:8081/__hitel_ws_scrcpy > "$OUT/local-health.json";then break;fi
 sleep 1
done
grep -q '"engine":"ws-scrcpy"' "$OUT/local-health.json"
node lab-ws-scrcpy/progress.mjs tunnel 'Android 실행기에서 Railway 역방향 WebSocket 연결을 설정하고 있습니다.' || true
node lab-ws-scrcpy/session.mjs register
node lab-ws-scrcpy/session.mjs relay >"$OUT/railway-relay.log" 2>&1 &
RELAY_PID=$!
for n in $(seq 1 65);do
  curl -fsS --max-time 8 https://hitel-communication-web-production.up.railway.app/lab-sandbox/ws-scrcpy/status > "$OUT/railway-status.json" && grep -q '"online":true' "$OUT/railway-status.json" && break
  kill -0 "$RELAY_PID" || { cat "$OUT/railway-relay.log";exit 35; }
  sleep 2
done
grep -q '"online":true' "$OUT/railway-status.json" || { echo WS_SCRCPY_RAILWAY_RELAY_NOT_READY;cat "$OUT/railway-status.json";exit 36; }
echo HITEL_WS_SCRCPY_RAILWAY_REVERSE_H264_READY
node lab-ws-scrcpy/progress.mjs ready 'Railway 역방향 WebSocket으로 실제 Android 화면 연결을 확인했습니다.' || true
if [[ "${HITEL_WS_E2E:-0}" == "1" ]]; then
  echo HITEL_APK_E2E_BEGIN
  timeout 120s bash lab-ws-scrcpy/apk-e2e.sh
  echo HITEL_APK_E2E_FINISHED
  command -v google-chrome
  google-chrome --version
  npm install --no-save --ignore-scripts --no-audit --no-fund playwright@1.56.0
  node lab-ws-scrcpy/kvm-browser-e2e.mjs
  adb shell input keyevent 3 || true
fi
SESSION_SECONDS="${HITEL_WS_SCRCPY_SESSION_SECONDS:-20400}"
[[ "$SESSION_SECONDS" =~ ^[0-9]+$ ]] || SESSION_SECONDS=20400
(( SESSION_SECONDS>=60 && SESSION_SECONDS<=20400 )) || SESSION_SECONDS=20400
SESSION_STARTED=$SECONDS
while true;do
 if ! kill -0 "$SERVER_PID" || ! kill -0 "$RELAY_PID";then
  echo WS_SCRCPY_LIVE_TRANSPORT_EXITED;break
 fi
 decision="$(node lab-ws-scrcpy/session.mjs check | tail -1)"
 [[ "$decision" == "stop" ]] && { echo WS_SCRCPY_USER_STOPPED;break; }
 if (( SECONDS-SESSION_STARTED>=SESSION_SECONDS ));then
  node lab-ws-scrcpy/progress.mjs stopping 'GitHub 실행기 제한 전에 Android 이미지를 저장하고 종료합니다. 계속하려면 웹의 재시작 버튼을 눌러 주십시오.' || true
  echo WS_SCRCPY_RUNNER_STOPPED_MANUAL_RESTART_REQUIRED
  break
 fi
 sleep 3
done
echo WS_SCRCPY_LIVE_LOOP_FINISHED
