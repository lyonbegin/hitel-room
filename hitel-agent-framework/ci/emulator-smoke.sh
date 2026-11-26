#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/hitel-framework-results"
mkdir -p "$OUT"
adb wait-for-device
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1
adb devices -l > "$OUT/devices.txt"
adb shell getprop ro.build.version.sdk > "$OUT/android-api.txt"
adb shell getprop ro.product.cpu.abi > "$OUT/android-abi.txt"
adb shell pm path com.android.vending | tee "$OUT/play-store.txt"
grep -q '^package:' "$OUT/play-store.txt"
adb shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p com.android.vending
sleep 5
adb exec-out screencap -p > "$OUT/play-store-clean.png"
# No accounts are provisioned or copied to this disposable public CI runner.
# Do not upload authenticated screenshots, UI trees, or mission traces.
cd "$ROOT/upstream-artemis"
uv run python - "$OUT" <<'PY'
import asyncio, json, os, sys
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    params = StdioServerParameters(command=sys.executable, args=["-m", "mcp_server"], cwd=os.getcwd())
    async with asyncio.timeout(90):
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.list_tools()
                names = sorted(t.name for t in result.tools)
                required = {"mobile_run_task", "mobile_manage_task", "mobile_get_device_state", "mobile_inspect_trace", "mobile_diagnose"}
                Path(sys.argv[1], "mcp-tools.json").write_text(json.dumps(names, indent=2))
                assert required <= set(names), required - set(names)
                print("ARTEMIS MCP initialized; required tools registered.")
asyncio.run(main())
PY
if [[ -n "${HITEL_MISSION:-}" ]]; then
  if [[ -z "${GEMINI_API_KEY:-}" ]]; then
    echo "Mission requested but GEMINI_API_KEY secret not configured." >&2
    exit 1
  fi
  # This is an operator-authorized, non-sensitive test mission. Never add real
  # credentials, purchases, communications or personal data to public CI.
  uv run artemis run "Explore this task on the current emulator. Discover installed apps first, then discover and install a suitable app through Google Play only if needed and permitted. Do not create accounts, send messages, accept paid transactions, enter credentials, or bypass authentication. If login is required, stop and report it. Task: $HITEL_MISSION" --profile pro
fi
echo "Google Play boot and ARTEMIS MCP registration smoke completed."
