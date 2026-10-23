#!/usr/bin/env bash
set -euo pipefail
out="mobile-test-results/ios"
mkdir -p "$out"
xcrun simctl list -j devices available > "$out/available-devices.json"
udid="$(python3 - <<'PY'
import json
d=json.load(open('mobile-test-results/ios/available-devices.json'))
for runtime, devices in d['devices'].items():
    if 'iOS' not in runtime: continue
    for dev in devices:
        if dev.get('isAvailable') and dev.get('name','').startswith('iPhone'):
            print(dev['udid'])
            raise SystemExit(0)
raise SystemExit('No iPhone Simulator found on runner')
PY
)"
echo "Selected iPhone: $udid"
xcrun simctl boot "$udid" || true
xcrun simctl bootstatus "$udid" -b
xcodegen generate --spec mobile/ios/project.yml --project mobile/ios
xcodebuild -project mobile/ios/HitelNative.xcodeproj \
    -scheme HitelNative -configuration Debug -sdk iphonesimulator \
    -destination "platform=iOS Simulator,id=$udid" \
    -derivedDataPath /tmp/hitel-ios-build CODE_SIGNING_ALLOWED=NO \
    build > "$out/build.log" 2>&1 || {
        tail -100 "$out/build.log"; exit 1;
    }
xcrun simctl install "$udid" /tmp/hitel-ios-build/Build/Products/Debug-iphonesimulator/HitelNative.app
SIMCTL_CHILD_HITEL_LAB_URL="${HITEL_LAB_URL:-https://hitel-communication-web-production.up.railway.app/sdk-lab/device?side=ios}" \
SIMCTL_CHILD_HITEL_LAB_TICKET="${HITEL_LAB_TICKET:-}" \
xcrun simctl launch "$udid" app.hitel.native | tee "$out/launch.txt"
sleep 40
xcrun simctl io "$udid" screenshot "$out/screen.png"
xcrun simctl spawn "$udid" log show --last 5m --style compact \
    --predicate 'eventMessage CONTAINS "HITEL_E2E"' > "$out/events.log" || true
tail -100 "$out/events.log"
grep -q "APP_STARTED" "$out/events.log"
grep -q "WEB_LOADED" "$out/events.log"
grep -q "BRIDGE_PING_OK" "$out/events.log"
grep -q "LAB_SOCKET_CONNECTED" "$out/events.log"
grep -q "CAPABILITIES_OK" "$out/events.log"
grep -q "hitel-communication-web-production.up.railway.app/sdk-lab/device" "$out/events.log"
if grep -q "WEB_ERROR" "$out/events.log"; then
    echo "FAIL: HITEL WKWebView navigation error"
    exit 1
fi
echo "PASS: iOS app started, remote Vite page loaded, trusted native bridge responded"
