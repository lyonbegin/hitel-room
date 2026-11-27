#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export HITEL_OUT="$ROOT/hitel-framework-results"
mkdir -p "$HITEL_OUT"
export HITEL_CONTROLLER_TOKEN="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
export HITEL_DEVICE_TOKEN="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
export HITEL_TASK_DB="$(mktemp -d)/tasks.sqlite"
cd "$ROOT/upstream-artemis"
export PYTHONPATH="$ROOT/hitel-agent-framework/runtime:$PWD"
uv run python -m uvicorn gateway:application --host 127.0.0.1 --port 8765 > "$HITEL_OUT/gateway.log" 2>&1 &
pid=$!
trap 'kill "$pid" 2>/dev/null || true' EXIT
uv run python "$ROOT/hitel-agent-framework/runtime/gateway_smoke.py"
bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "ARTEMIS authenticated HTTP MCP and real device observation verified"
bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "PokeClaw gateway callback protocol verified with simulated device (native callback pending)"
