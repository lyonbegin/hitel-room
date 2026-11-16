#!/usr/bin/env bash
# Single-app experiment. Firebase remains a provider, IXIApplication is unchanged.
set -euo pipefail
OUT=ixio-main-context-bridge-results
RAW=.ixio-bridge-fix
PKG=com.lguplus.aicallagent
mkdir -p "$OUT"
adb wait-for-device
adb uninstall "$PKG" >/dev/null 2>&1 || true
adb logcat -c || true
apks=("$RAW/base.apk" "$RAW/signed-split_0.apk" "$RAW/signed-split_1.apk" "$RAW/signed-split_2.apk")
if adb install-multiple "${apks[@]}" > "$OUT/install.txt" 2>&1; then
  echo "INSTALL=PASS" | tee "$OUT/status.env"
else
  echo "INSTALL=FAIL" | tee "$OUT/status.env"
  cat "$OUT/install.txt"
  exit 1
fi
adb shell pm path "$PKG" > "$OUT/package-path.txt" 2>&1 || true
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > "$OUT/launch.txt" 2>&1 || true
sleep 8
adb shell pidof "$PKG" > "$OUT/pid-8s.txt" 2>&1 || true
sleep 8
adb shell pidof "$PKG" > "$OUT/pid-16s.txt" 2>&1 || true
adb logcat -d -v threadtime -t 12000 > "$OUT/logcat.txt" 2>&1 || true
adb exec-out screencap -p > "$OUT/screen.png" 2>/dev/null || true
if [ -s "$OUT/pid-8s.txt" ]; then echo "PROCESS_8S=ALIVE";else echo "PROCESS_8S=DEAD";fi | tee -a "$OUT/status.env"
if [ -s "$OUT/pid-16s.txt" ]; then echo "PROCESS_16S=ALIVE";else echo "PROCESS_16S=DEAD";fi | tee -a "$OUT/status.env"
if grep -q 'HITEL_FB_BRIDGE.*FIREBASE_INITIALIZE_RETURNED=true' "$OUT/logcat.txt"; then
  echo "FIREBASE_BRIDGE=SUCCESS" | tee -a "$OUT/status.env"
elif grep -q 'HITEL_FB_BRIDGE.*FIREBASE_INITIALIZE_FAILED' "$OUT/logcat.txt"; then
  echo "FIREBASE_BRIDGE=FAIL_EXCEPTION" | tee -a "$OUT/status.env"
else
  echo "FIREBASE_BRIDGE=NOT_CONFIRMED" | tee -a "$OUT/status.env"
fi
if grep -A 15 'FATAL EXCEPTION' "$OUT/logcat.txt" | grep -q "$PKG"; then
  echo "APP_CRASH=YES" | tee -a "$OUT/status.env"
else
  echo "APP_CRASH=NONE_OBSERVED" | tee -a "$OUT/status.env"
fi
grep -E -A 20 'HITEL_FB_BRIDGE|FATAL EXCEPTION|FirebaseInitProvider|FirebaseApp initialization successful' \
  "$OUT/logcat.txt" | head -n 150 > "$OUT/key-events.txt" || true
cat "$OUT/status.env"
