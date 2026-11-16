#!/usr/bin/env bash
# Validate *single* APK install, Firebase startup, foreground Activity.
# Does not test real PSTN call, privileged PCM capture or native ARM ABI.
set -euo pipefail
OUT="ixio-main-single-apk-results"
PKG="com.lguplus.aicallagent"
APK="ixio-main-single-apk/IXIO_Main_NoAppSealing_Single.apk"
mkdir -p "$OUT"

adb wait-for-device
adb shell getprop ro.build.version.release > "$OUT/android-version.txt" 2>&1 || true
adb shell getprop ro.product.cpu.abilist > "$OUT/android-abis.txt" 2>&1 || true
adb uninstall "$PKG" > "$OUT/uninstall-old.txt" 2>&1 || true
adb logcat -c >/dev/null 2>&1 || true

if adb install "$APK" > "$OUT/install.txt" 2>&1; then
    echo "INSTALL_SINGLE_APK=PASS" | tee "$OUT/status.env"
else
    echo "INSTALL_SINGLE_APK=FAIL" | tee "$OUT/status.env"
    cat "$OUT/install.txt"
    exit 1
fi

adb shell pm path "$PKG" > "$OUT/pm-path.txt" 2>&1 || true
pmcount="$(grep -c '^package:' "$OUT/pm-path.txt" || true)"
echo "INSTALLED_APK_PATH_COUNT=$pmcount" | tee -a "$OUT/status.env"
test "$pmcount" -eq 1

adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 \
  > "$OUT/launch.txt" 2>&1 || true
sleep 8
adb shell pidof "$PKG" > "$OUT/pid-after-8s.txt" 2>&1 || true
sleep 8
adb shell pidof "$PKG" > "$OUT/pid-after-16s.txt" 2>&1 || true
adb logcat -d -v threadtime -t 12000 > "$OUT/logcat.txt" 2>&1 || true
adb shell dumpsys activity activities > "$OUT/activity-state.txt" 2>&1 || true
adb exec-out screencap -p > "$OUT/screenshot.png" 2>/dev/null || true

if [ -s "$OUT/pid-after-16s.txt" ]; then
    echo "PROCESS_16S=ALIVE" | tee -a "$OUT/status.env"
else
    echo "PROCESS_16S=DEAD" | tee -a "$OUT/status.env"
fi
if grep -q 'HITEL_FB_BRIDGE.*FIREBASE_INITIALIZE_RETURNED=true' "$OUT/logcat.txt"; then
    echo "FIREBASE_BRIDGE=SUCCESS" | tee -a "$OUT/status.env"
else
    echo "FIREBASE_BRIDGE=NOT_CONFIRMED" | tee -a "$OUT/status.env"
fi
if grep -A 15 'FATAL EXCEPTION' "$OUT/logcat.txt" | grep -q "$PKG"; then
    echo "APP_CRASH=YES" | tee -a "$OUT/status.env"
else
    echo "APP_CRASH=NONE_OBSERVED" | tee -a "$OUT/status.env"
fi
if grep -E 'mResumedActivity|topResumedActivity|Resumed: ActivityRecord' "$OUT/activity-state.txt" | grep -q "$PKG"; then
    echo "FOREGROUND_ACTIVITY=TARGET" | tee -a "$OUT/status.env"
else
    echo "FOREGROUND_ACTIVITY=NOT_VERIFIED" | tee -a "$OUT/status.env"
fi
grep -E -A 20 'HITEL_FB_BRIDGE|FATAL EXCEPTION|FirebaseInitProvider|FirebaseApp initialization successful' \
  "$OUT/logcat.txt" | head -n 200 > "$OUT/relevant-logcat.txt" || true
cat "$OUT/status.env"
