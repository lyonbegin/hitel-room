#!/usr/bin/env bash
# Serve the ORIGINAL Android Emulator Platform frontend, Express, Android 11
# and the ORIGINAL native scrcpy/noVNC. Original 53 files are never edited.
set -Eeuo pipefail
ROOT="$(git rev-parse --show-toplevel)"
UPSTREAM="$ROOT/vendor/android-emulator-platform"
OVERRIDE="$ROOT/infra/android-original/github-4cpu.compose.yml"
EDGE="$ROOT/infra/android-original/native-transport.nginx.conf"
export DB_PASSWORD="original-github-temporary"
export PUBLIC_HOST="127.0.0.1"
HITEL_WEB_CLAIMED="$(printenv HITEL_WEB_CLAIMED || echo false)"
cd "$UPSTREAM"
com(){ docker compose -f docker-compose.yml -f "$OVERRIDE" "$@"; }
cleanup(){
  python3 "$ROOT/mobile/tools/original-native-url.py" finish || true
  if [[ "$HITEL_WEB_CLAIMED" == "true" ]]; then
    python3 "$ROOT/mobile/tools/finish-ui-request.py" || true
  fi
  docker rm -f hitel-original-native-edge >/dev/null 2>&1 || true
  com down --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "ORIGINAL_NATIVE_SOURCE_FILES=$(git -C "$ROOT" ls-files vendor/android-emulator-platform | wc -l)"
echo 'ORIGINAL_NATIVE_BUILD_START'
com config -q
com build emulator-1 scrcpy-1 backend
com up -d --no-build redis postgres emulator-1 scrcpy-1 backend
com ps

ready=false
for i in $(seq 1 52); do
  guest="$(docker exec android-emulator-1 adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [[ "$guest" = "1" ]] && docker exec emulator-scrcpy-1 pgrep scrcpy >/dev/null 2>&1; then
    ready=true; break
  fi
  sleep 5
done
[[ "$ready" == true ]] || { echo 'ORIGINAL_NATIVE_ANDROID_OR_SCRCPY_NOT_READY'; docker logs android-emulator-1 --tail 100; docker logs emulator-scrcpy-1 --tail 100; exit 1; }
echo 'ORIGINAL_NATIVE_ANDROID_AND_SCRCPY_READY'

cd "$UPSTREAM/frontend"
npm install --no-audit --no-fund
npm run build
test -s dist/index.html
cd "$ROOT"

docker run -d --rm --name hitel-original-native-edge \
  --network emulator-network -p 127.0.0.1:8081:80 \
  -v "$EDGE:/etc/nginx/conf.d/default.conf:ro" \
  -v "$UPSTREAM/frontend/dist:/usr/share/nginx/html:ro" \
  nginx:1.27-alpine >/dev/null
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8081/health -o /tmp/original-native-health.json &&
     curl -fsS http://127.0.0.1:8081/stream/1/phone.html -o /tmp/original-native-phone.html; then break; fi
  sleep 2
done
grep -q healthy /tmp/original-native-health.json
grep -q 'import RFB' /tmp/original-native-phone.html
curl -fsS http://127.0.0.1:8081/api/emulator/devices > /tmp/original-native-devices.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/original-native-devices.json'))
assert len(d['devices']) == 1,d
assert d['devices'][0]['device']=='Samsung Galaxy S10',d
print('ORIGINAL_NATIVE_API_AND_VIEWER_HTTP_OK',d,flush=True)
PY

# Validate the ORIGINAL Express /session API, not the former Railway API adapter.
python3 - <<'PY'
import json, urllib.request, urllib.error, time
url="http://127.0.0.1:8081/api/emulator/session"
request=urllib.request.Request(url,data=json.dumps({"device":"Samsung Galaxy S10","timeout":3}).encode(),
 headers={"content-type":"application/json"},method="POST")
start=time.monotonic()
try:
 with urllib.request.urlopen(request,timeout=90) as response:
  result=json.load(response)
  assert response.status==201,result
except urllib.error.HTTPError as e:
 print("ORIGINAL_REAL_SESSION_CREATE_FAILED",e.code,e.read().decode()[:600],flush=True)
 raise
print("ORIGINAL_REAL_SESSION_CREATED",result["sessionId"],"elapsed_seconds",round(time.monotonic()-start,1),flush=True)
assert result.get("vncUrl")=="/stream/1/",result
request=urllib.request.Request("http://127.0.0.1:8081/api/emulator/session/"+result["sessionId"],method="DELETE")
with urllib.request.urlopen(request,timeout=30) as response:
 assert response.status==200
 print("ORIGINAL_REAL_SESSION_RELEASED",response.status,flush=True)
PY

# Native noVNC websocket upgrade is required for actual touch/drag input.
# A websocket returns HTTP 101, and curl subsequently times out because it
# keeps the socket open; checking only the initial status is intentional.
curl -sS --http1.1 --max-time 4 -D /tmp/original-ws-headers -o /dev/null \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' \
  -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  http://127.0.0.1:8081/stream/1/websockify || true
head -n 6 /tmp/original-ws-headers
grep -q '101 Switching Protocols' /tmp/original-ws-headers
echo 'ORIGINAL_NOVNC_WEBSOCKET_HANDSHAKE_101_OK'

# Diagnostics read real Android11 guest state, no replacement emulator behavior.
echo 'ORIGINAL_ANDROID_NATIVE_GUEST_DIAGNOSTICS_BEGIN'
docker exec android-emulator-1 adb shell getprop ro.build.version.release || true
docker exec android-emulator-1 adb shell getprop sys.boot_completed || true
if docker exec android-emulator-1 adb shell pm path com.android.vending | grep -q 'package:'; then
  echo 'ORIGINAL_GOOGLE_PLAY_INSTALLED=YES'
else
  echo 'ORIGINAL_GOOGLE_PLAY_INSTALLED=NO'
fi
if docker exec android-emulator-1 timeout 15s adb shell ping -c 1 -W 5 1.1.1.1 >/tmp/native-internet-ip.txt 2>&1; then
  echo 'ORIGINAL_ANDROID_INTERNET_IPV4_ICMP=OK'
else
  echo 'ORIGINAL_ANDROID_INTERNET_IPV4_ICMP=FAILED'
fi
if docker exec android-emulator-1 timeout 15s adb shell ping -c 1 -W 5 www.google.com >/tmp/native-internet-dns.txt 2>&1; then
  echo 'ORIGINAL_ANDROID_INTERNET_DNS_ICMP=OK'
else
  echo 'ORIGINAL_ANDROID_INTERNET_DNS_ICMP=FAILED'
fi
head -n 8 /tmp/native-internet-ip.txt /tmp/native-internet-dns.txt 2>/dev/null || true
echo 'ORIGINAL_ANDROID_NATIVE_GUEST_DIAGNOSTICS_END'

# A disposable account-free outbound HTTPS route, no service API subscription.
/usr/bin/curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /tmp/hitel-native-cloudflared
chmod +x /tmp/hitel-native-cloudflared
/tmp/hitel-native-cloudflared tunnel --url http://127.0.0.1:8081 --output json \
  > /tmp/hitel-native-cloudflare.log 2>&1 &
tunnel_pid=$!
native_url=''
for i in $(seq 1 45); do
  native_url="$(grep -Eo 'https://[a-z0-9]+(-[a-z0-9]+)*\.trycloudflare\.com' /tmp/hitel-native-cloudflare.log | head -1 || true)"
  [[ -n "$native_url" ]] && break
  kill -0 "$tunnel_pid" >/dev/null 2>&1 || { echo 'ORIGINAL_NATIVE_TUNNEL_EXITED'; cat /tmp/hitel-native-cloudflare.log; exit 1; }
  sleep 2
done
[[ -n "$native_url" ]] || { echo 'ORIGINAL_NATIVE_TUNNEL_URL_MISSING'; cat /tmp/hitel-native-cloudflare.log; exit 1; }
echo "ORIGINAL_NATIVE_PUBLIC_LINK=$native_url"
for i in $(seq 1 20); do
  if curl -fsS --max-time 10 "$native_url/health" -o /tmp/original-native-public-health &&
     curl -fsS --max-time 10 "$native_url/stream/1/phone.html" -o /tmp/original-native-public-phone; then break; fi
  sleep 3
done
grep -q healthy /tmp/original-native-public-health
grep -q 'import RFB' /tmp/original-native-public-phone
echo 'ORIGINAL_NATIVE_PUBLIC_HTTPS_AND_NOVNC_OK'
python3 "$ROOT/mobile/tools/original-native-url.py" register "$native_url"

# Run BOTH official MCP servers against the real browser and the native video.
# Failure is fatal; a blank remote screen must never be treated as success.
if [[ "$(printenv HITEL_OFFICIAL_MCP_VERIFY || echo 0)" == "1" ]]; then
  bash "$ROOT/mobile/browser-mcp/native-geometry.sh"
  node "$ROOT/mobile/browser-mcp/inspect.mjs"
  echo HITEL_OFFICIAL_BOTH_BROWSER_MCP_NATIVE_VERIFIED
  if [[ "$(printenv HITEL_SCRCPY_FULLSCREEN_AB || echo 0)" == "1" ]]; then
    evidence="$ROOT/mobile-test-results/android-browser-mcp"
    cp "$evidence/report.json" "$evidence/before-fullscreen-report.json"
    cp "$evidence/chrome-native.png" "$evidence/before-fullscreen.png"
    HITEL_FORCE_FULLSCREEN=1 bash "$ROOT/mobile/browser-mcp/fix-scrcpy-fullscreen.sh"
    sleep 4
    HITEL_MCP_TEST_INPUT=1 node "$ROOT/mobile/browser-mcp/inspect.mjs"
    cp "$evidence/report.json" "$evidence/after-fullscreen-report.json"
    cp "$evidence/chrome-native.png" "$evidence/after-fullscreen.png"
    node - "$evidence" <<'JS'
const fs=require('fs'),dir=process.argv[2];
const before=JSON.parse(fs.readFileSync(dir+'/before-fullscreen-report.json'));
const after=JSON.parse(fs.readFileSync(dir+'/after-fullscreen-report.json'));
const a=before.layout?.pixels?.nonBlackWidthFraction||0;
const b=after.layout?.pixels?.nonBlackWidthFraction||0;
console.log('HITEL_NATIVE_FULLSCREEN_AB_COMPARISON',JSON.stringify({
 before:a,after:b,improvement:+(b-a).toFixed(3),
 input:after.layout?.nativeInput
}));
if(b<0.80) {console.error('HITEL_NATIVE_FULLSCREEN_STILL_UNDERSIZED');process.exitCode=2;}
JS
  fi
fi

# E2E gate: after real Docker/KVM boot and tunnel registration, the SAME
# Playwright Chromium process checks Railway's actual iframe and confirms
# received native noVNC frames. A missing screen makes the job FAIL.
if [[ "$(printenv ANDROID_ONECLICK_VERIFY || echo 0)" == "1" ]]; then
  echo 'ANDROID_ONECLICK_NATIVE_CHROMIUM_VERIFY_START'
  HITEL_REQUIRE_NATIVE_PHONE=1 python3 "$ROOT/mobile/tests/android-native-playwright-e2e.py"
  echo 'ANDROID_ONECLICK_NATIVE_CHROMIUM_VERIFY_PASS'
fi

duration="$(printenv ANDROID_SESSION_SECONDS || echo 480)"
stop_at=$((SECONDS+duration))
while [[ $SECONDS -lt $stop_at ]]; do
  if ! docker exec emulator-scrcpy-1 pgrep scrcpy >/dev/null 2>&1; then
    echo ORIGINAL_NATIVE_SCRCPY_LOST; exit 1
  fi
  answer="$(python3 "$ROOT/mobile/tools/original-native-url.py" stop-requested 2>/dev/null || echo continue)"
  [[ "$answer" == stop ]] && { echo ORIGINAL_NATIVE_USER_STOP_REQUESTED; break; }
  sleep 12
done
echo ORIGINAL_NATIVE_SESSION_FINISHED
