#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/mobile-smoke-results"
mkdir -p "$OUT"
export HITEL_CONTROLLER_TOKEN="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
export HITEL_DEVICE_TOKEN="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
export HITEL_DIRECT_REPORT="$OUT/direct-native.json"
# Use only random one-run tokens, no Google login or other real credentials.
echo "::add-mask::$HITEL_CONTROLLER_TOKEN"
echo "::add-mask::$HITEL_DEVICE_TOKEN"
export PYTHONPATH="$ROOT/hitel-agent-framework/runtime:$ROOT/hitel-agent-framework/ci"
python3 -m venv "$RUNNER_TEMP/direct-venv"
"$RUNNER_TEMP/direct-venv/bin/pip" -q install 'mcp>=1.12,<2' uvicorn
cp "$ROOT/hitel-agent-framework/ci/direct-test-gateway.py" "$RUNNER_TEMP/direct_test_gateway.py"
export PYTHONPATH="$PYTHONPATH:$RUNNER_TEMP"
"$RUNNER_TEMP/direct-venv/bin/python" -m uvicorn direct_test_gateway:application --host 127.0.0.1 --port 8766 > "$OUT/direct-gateway.log" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true; adb reverse --remove tcp:8766 >/dev/null 2>&1 || true' EXIT
for i in $(seq 1 40); do
  if curl -s --max-time 1 -o /dev/null -H "Authorization: Bearer $HITEL_DEVICE_TOKEN" http://127.0.0.1:8766/device/actions/pending; then break; fi
  sleep 1
done
adb reverse tcp:8766 tcp:8766
adb shell am start -W -n io.agents.pokeclaw/io.agents.pokeclaw.hitel.HitelDirectActivity --es test_endpoint http://127.0.0.1:8766 --es test_token "$HITEL_DEVICE_TOKEN" >/dev/null
sleep 3
# UIAutomator is only used to find the consent button before enabling accessibility.
adb shell uiautomator dump /sdcard/hitel-direct-setup.xml >/dev/null
adb pull /sdcard/hitel-direct-setup.xml "$RUNNER_TEMP/hitel-direct-setup.xml" >/dev/null
read -r x y < <(python3 - "$RUNNER_TEMP/hitel-direct-setup.xml" <<'PY'
import sys,re,xml.etree.ElementTree as ET
n=next(n for n in ET.parse(sys.argv[1]).iter("node") if n.get("text","").lower()=="approve direct session")
x1,y1,x2,y2=map(int,re.findall(r"\d+",n.get("bounds")))
print((x1+x2)//2,(y1+y2)//2)
PY
)
rm -f "$RUNNER_TEMP/hitel-direct-setup.xml"
adb shell rm /sdcard/hitel-direct-setup.xml || true
# Developer emulator setup only. Customer devices enable Accessibility through Settings.
adb shell settings put secure enabled_accessibility_services io.agents.pokeclaw/io.agents.pokeclaw.service.ClawAccessibilityService
adb shell settings put secure accessibility_enabled 1
sleep 5
adb shell input tap "$x" "$y"
sleep 2
"$RUNNER_TEMP/direct-venv/bin/python" "$ROOT/hitel-agent-framework/ci/direct-native-smoke.py"
bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "Authenticated MCP to real PokeClaw Accessibility direct open, screen read, tap and back verified"
