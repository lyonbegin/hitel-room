#!/usr/bin/env bash
# Temporary GitHub KVM Android 11 -> ws-scrcpy -> browser.
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
TUNNEL_PID=0
GATEWAY_PID=0
cleanup(){
 node lab-ws-scrcpy/session.mjs finish || true
 if [[ "$TUNNEL_PID" -gt 0 ]];then kill -TERM "$TUNNEL_PID" 2>/dev/null || true;fi
 if [[ "$GATEWAY_PID" -gt 0 ]];then kill -TERM "$GATEWAY_PID" 2>/dev/null || true;fi
 kill -TERM "$SERVER_PID" 2>/dev/null || true
 sleep 1
 [[ "$TUNNEL_PID" -gt 0 ]] && kill -KILL "$TUNNEL_PID" 2>/dev/null || true
 [[ "$GATEWAY_PID" -gt 0 ]] && kill -KILL "$GATEWAY_PID" 2>/dev/null || true
 kill -KILL "$SERVER_PID" 2>/dev/null || true
 wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT
for n in $(seq 1 75);do
 if ! kill -0 "$SERVER_PID" 2>/dev/null;then tail -n 100 "$OUT/ws-scrcpy.log";exit 31;fi
 curl -fsS --max-time 2 http://127.0.0.1:8000/ >/dev/null 2>&1 && break
 sleep 1
done
node lab-ws-scrcpy/proof.mjs
echo WS_SCRCPY_REAL_ANDROID11_KVM_STREAM_SERVER_READY
adb shell input keyevent 224 || true
adb shell wm dismiss-keyguard || true
adb shell input keyevent 3 || true
node lab-ws-scrcpy/gateway.mjs > "$OUT/gateway.log" 2>&1 &
GATEWAY_PID=$!
for n in $(seq 1 15);do
 if curl -fsS --max-time 3 http://127.0.0.1:8081/__hitel_ws_scrcpy > "$OUT/local-health.json";then break;fi
 sleep 1
done
grep -q '"engine":"ws-scrcpy"' "$OUT/local-health.json"
curl -fsSL --retry 3 --max-time 100 \
 https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
 -o /tmp/hitel-ws-cloudflared
chmod +x /tmp/hitel-ws-cloudflared
/tmp/hitel-ws-cloudflared tunnel --url http://127.0.0.1:8081 \
 --output json >"$OUT/cloudflared.log" 2>&1 &
TUNNEL_PID=$!
TUNNEL=''
for n in $(seq 1 65);do
 TUNNEL="$(grep -Eo 'https://[a-z0-9]+(-[a-z0-9]+)*\.trycloudflare\.com' "$OUT/cloudflared.log" | head -1 || true)"
 [[ -n "$TUNNEL" ]] && break
 kill -0 "$TUNNEL_PID" || { echo WS_SCRCPY_TUNNEL_EXITED;exit 35; }
 sleep 1
done
[[ -n "$TUNNEL" ]] || { echo WS_SCRCPY_TUNNEL_URL_FAILED;exit 36; }
for n in $(seq 1 16);do
 curl -fsS --max-time 8 "$TUNNEL/__hitel_ws_scrcpy" > "$OUT/public-health.json" && break
 sleep 2
done
grep -q '"engine":"ws-scrcpy"' "$OUT/public-health.json"
echo HITEL_WS_SCRCPY_PUBLIC_HOST_REAL_H264_READY
node lab-ws-scrcpy/session.mjs register "$TUNNEL"
echo HITEL_WS_SCRCPY_RAILWAY_PUBLIC_VIEWER_REGISTERED
SESSION_SECONDS="${HITEL_WS_SCRCPY_SESSION_SECONDS:-600}"
[[ "$SESSION_SECONDS" =~ ^[0-9]+$ ]] || SESSION_SECONDS=600
(( SESSION_SECONDS>=15 && SESSION_SECONDS<=600 )) || SESSION_SECONDS=600
SESSION_ITERATIONS=$(( (SESSION_SECONDS+2)/3 ))
for n in $(seq 1 "$SESSION_ITERATIONS");do
 if ! kill -0 "$SERVER_PID" || ! kill -0 "$TUNNEL_PID";then
  echo WS_SCRCPY_LIVE_TRANSPORT_EXITED;break
 fi
 decision="$(node lab-ws-scrcpy/session.mjs check | tail -1)"
 [[ "$decision" == "stop" ]] && { echo WS_SCRCPY_USER_STOPPED_OR_EXPIRED;break; }
 sleep 3
done
echo WS_SCRCPY_LIVE_10_MINUTE_SESSION_CLOSED
