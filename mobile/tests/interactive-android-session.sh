#!/usr/bin/env bash
set -euo pipefail
out="mobile-test-results/android-interactive"
mkdir -p "$out"
adb wait-for-device
adb shell getprop sys.boot_completed | tee "$out/boot-completed.txt"
adb shell pm path com.android.vending | tee "$out/google-play-installed.txt"
grep -q 'package:' "$out/google-play-installed.txt"
# Show the REAL Android launcher. The user can tap its Play Store icon in
# /sdk-lab after the agent's first authenticated screenshot arrives.
adb shell input keyevent KEYCODE_HOME
sleep 3
adb exec-out screencap -p > "$out/home-before-session.png"
python3 - "$out/home-before-session.png" <<'PY'
from pathlib import Path
p=Path("mobile-test-results/android-interactive/home-before-session.png")
s=p.read_bytes()
assert s[:8]==bytes.fromhex("89504e470d0a1a0a") and len(s)>1000
print("PASS: actual Google Play Android launcher captured")
PY
python3 mobile/tools/init-ui-test.py
echo "HITEL_INTERACTIVE_SESSION_BEGIN ci-playstore"
# Timeboxed, not persistent. Signed GitHub Actions OIDC authenticates screen
# updates and remote taps. On expiration the emulator is destroyed by Actions.
set +e
timeout --signal=TERM --kill-after=10s "${ANDROID_SESSION_SECONDS:-780}s" \
  python3 -u mobile/tools/apk-emulator-agent.py \
    --device ci-playstore --serial emulator-5554 --interval 2 \
    2>&1 | tee "$out/emulator-session.log"
code=${PIPESTATUS[0]}
set -e
adb exec-out screencap -p > "$out/home-after-session.png" || true
echo "HITEL_INTERACTIVE_SESSION_END exit=$code"
if [[ "$code" -ne 0 && "$code" -ne 124 && "$code" -ne 143 ]]; then
  echo "::error::Interactive Android host agent failed with code $code"
  exit "$code"
fi
if ! grep -q "EMULATOR_FULL_SCREEN_CAPTURED" "$out/emulator-session.log" &&
   ! grep -q "APK_JOB_REPORTED" "$out/emulator-session.log"; then
  # screenshot is captured *before* each poll; capture-frame successes logged
  # by the agent even when no job exists (added with this workflow).
  if ! grep -q "EMULATOR_FRAME_PUBLISHED" "$out/emulator-session.log"; then
    echo "::error::No authenticated Android screen reached Railway"
    exit 1
  fi
fi
echo "PASS: Android interactive session finished and native screenshots were stored"
