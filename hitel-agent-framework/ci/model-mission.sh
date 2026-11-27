#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/hitel-framework-results"
cd "$ROOT/upstream-artemis"
if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "Gemini secret missing; live model tests blocked" blocked
  exit 1
fi
if ! uv run python "$ROOT/hitel-agent-framework/ci/gemini-preflight.py" "$OUT"; then
  bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "Gemini API authentication or generation preflight failed" failure
  exit 1
fi
model="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["chosen_model"])' "$OUT/gemini-preflight.json")"
bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "Gemini API authenticated and generation succeeded: $model"
# Use a bounded, non-sensitive mission on the disposable device. No fixed third-party app list.
# CLI traces are deliberately not uploaded; only sanitized checkpoint outcomes are emitted.
adb shell am start -W -a android.intent.action.MAIN -c android.intent.category.HOME >/dev/null
if ! timeout 600 uv run artemis run "On this test Android emulator, open the Android system Settings app from the launcher. Confirm the Settings screen is displayed and stop. Do not change any setting, sign in, enter any credential or use ADB shell shortcuts." --profile pro --explorer-pro-mode pro --standalone > /tmp/hitel-model-mission.log 2>&1; then
  bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "ARTEMIS real model mission failed or timed out" failure
  exit 1
fi
adb shell dumpsys activity activities > "$OUT/model-mission-activity.txt"
if ! grep -E 'mResumedActivity|topResumedActivity|ResumedActivity' "$OUT/model-mission-activity.txt" | grep -q 'com.android.settings'; then
  bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "ARTEMIS model mission ended but target Settings screen not verified" failure
  exit 1
fi
bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "ARTEMIS actual AI-driven Android Settings navigation verified"
if ! timeout 600 uv run artemis run "Explore the installed apps for a generic document reader capability. If no suitable app exists, open Google Play and search for a free document reader. Identify any login gate and stop there; do not enter credentials, create accounts, purchase, send messages, or accept permissions. Do not install an app unless the store already permits a free installation. Report only what is actually observed." --profile pro --explorer-pro-mode pro --standalone > /tmp/hitel-discovery-mission.log 2>&1; then
  bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "ARTEMIS autonomous capability exploration failed or timed out" failure
  exit 1
fi
adb shell dumpsys activity activities > "$OUT/ai-discovery-activity.txt"
bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "ARTEMIS autonomous exploration command finished (app installation not independently verified)"
