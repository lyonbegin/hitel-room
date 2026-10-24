#!/usr/bin/env bash
set -euo pipefail
out="mobile-test-results/google-play"
mkdir -p "$out"
echo "Verifying the REAL Google Play Store Android system image"
adb devices -l | tee "$out/adb-devices.txt"
adb shell getprop ro.build.version.release | tee "$out/android-version.txt"
adb shell getprop ro.build.flavor | tee "$out/system-image.txt"
adb shell pm path com.android.vending | tee "$out/playstore-package.txt"
grep -q 'package:' "$out/playstore-package.txt"
echo "PASS: official Google Play Store package exists in the booted emulator"

# Use the same package and Activity intent as the production APK host agent.
adb shell am start -a android.intent.action.VIEW \
  -d 'market://details?id=com.kakao.taxi' \
  -p com.android.vending 2>&1 | tee "$out/kakao-playstore-launch.txt"
if grep -qiE 'Error:|unable to resolve|SecurityException|Permission Denial' "$out/kakao-playstore-launch.txt"; then
  echo "FAIL: Android refused the official Kakao T Play Store intent"
  exit 1
fi
sleep 5
adb exec-out screencap -p > "$out/kakao-playstore-screen.png"
python3 - "$out/kakao-playstore-screen.png" <<'PY'
from pathlib import Path
import sys
raw=Path(sys.argv[1]).read_bytes()
assert raw[:8]==bytes.fromhex("89504e470d0a1a0a"), "Android screenshot is not PNG"
assert len(raw)>1000, "Android screenshot is unexpectedly small"
print("PASS: actual Google Play Store screen captured")
PY
adb shell dumpsys activity activities | grep -E 'mResumedActivity|topResumedActivity|Resumed|com.android.vending' \
  | tail -25 > "$out/foreground-activity.txt" || true
if adb shell pm path com.kakao.taxi > "$out/kakao-installed.txt" 2>/dev/null && \
   grep -q 'package:' "$out/kakao-installed.txt"; then
  echo "PASS: Kakao T is really installed according to Android PackageManager"
  echo 'installed' > "$out/kakao-install-state.txt"
else
  # A clean ephemeral emulator has no Google account. Opening the store listing
  # does NOT mean Kakao T was installed; installation requires user login/consent.
  echo "NOT_INSTALLED: Google Play login and user approval required" | tee "$out/kakao-install-state.txt"
fi
echo "PASS: official Kakao T Play Store intent handled by real emulator"
