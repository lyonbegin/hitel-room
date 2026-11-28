#!/usr/bin/env bash
set -eu
cd "$GITHUB_WORKSPACE/upstream-artemis"
adb shell pm list packages -3 > "$GITHUB_WORKSPACE/console-results/third-party-packages.txt"
set +e
timeout 600 uv run artemis run "This is a disposable, unauthenticated test emulator. Work only on harmless read-only navigation and inspection of installed apps. No login, credentials, purchases, messages, account creation, app installation, permissions changes or shell shortcuts. Stop if any are needed. User test goal: $HITEL_MISSION" --profile pro --explorer-pro-mode pro --standalone > /tmp/artemis-console.log 2>&1
result=$?
set -e
export ARTEMIS_EXIT_CODE="$result"
python3 - <<'PY'
import os,json,pathlib
p=pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'console-results'/'result.json'
code=int(os.environ['ARTEMIS_EXIT_CODE'])
p.write_text(json.dumps({'cli_exit_code':code,'execution':'upstream ARTEMIS on disposable emulator','goal_independently_verified':False,'functiongemma_connected':False},indent=2))
PY
adb shell dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity|ResumedActivity' > "$GITHUB_WORKSPACE/console-results/foreground.txt" || true
exit "$result"
