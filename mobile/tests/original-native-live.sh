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
cd "$UPSTREAM"
com(){ docker compose -f docker-compose.yml -f "$OVERRIDE" "$@"; }
cleanup(){
  python3 "$ROOT/mobile/tools/original-native-url.py" finish || true
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
