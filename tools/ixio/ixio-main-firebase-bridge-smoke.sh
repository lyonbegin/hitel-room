#!/usr/bin/env bash
# MAIN ONLY: distinguish Firebase provider Context from IXIApplication startup.
# Only output logs/metadata; do not upload original vendor APKs.
set -euo pipefail
ROOT=.ixio-bridge
RESULT=ixio-main-firebase-bridge-results
mkdir -p "$RESULT"
: > "$RESULT/compare.tsv"
echo -e 'variant\tinstall\tfirebase\tprocess_8s\ttarget_crash' >> "$RESULT/compare.tsv"

adb wait-for-device
adb shell getprop ro.build.version.release > "$RESULT/android-version.txt" || true

for variant in shell framework baseline; do
  pkg=com.lguplus.aicallagent
  out="$RESULT/$variant"
  mkdir -p "$out"
  adb uninstall "$pkg" > "$out/uninstall-before.txt" 2>&1 || true
  adb logcat -c || true
  mapfile -d '' -t apks < <(find "$ROOT/$variant" -type f \
    \( -name 'base.apk' -o -name 'signed-split_[0-9].apk' \) -print0 | sort -z)
  echo "APK_COUNT=${#apks[@]}" > "$out/apk-count.txt"
  test "${#apks[@]}" -eq 4
  if adb install-multiple "${apks[@]}" > "$out/install.txt" 2>&1; then
    installed=PASS
  else
    installed=FAIL
  fi
  adb shell pm path "$pkg" > "$out/installed-apk-paths.txt" 2>&1 || true
  if [ "$installed" = PASS ]; then
    adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 \
      > "$out/launch.txt" 2>&1 || true
    sleep 8
  fi
  adb shell pidof "$pkg" > "$out/pid-after-8sec.txt" 2>&1 || true
  adb logcat -d -v threadtime -t 10000 > "$out/logcat.txt" 2>&1 || true
  adb exec-out screencap -p > "$out/screenshot.png" 2>/dev/null || true
  alive=NO
  test ! -s "$out/pid-after-8sec.txt" || alive=YES
  firebase=UNKNOWN
  if grep -qE 'FirebaseApp initialization successful' "$out/logcat.txt"; then
    firebase=PASS
  elif grep -qE 'Unable to get provider com.google.firebase.provider.FirebaseInitProvider' "$out/logcat.txt"; then
    firebase=CRASH_IN_PROVIDER
  elif grep -qE 'Default FirebaseApp is not initialized' "$out/logcat.txt"; then
    firebase=NOT_INITIALIZED
  fi
  crash=NO
  if grep -A 12 -E 'FATAL EXCEPTION|Fatal signal' "$out/logcat.txt" \
      | grep -q "$pkg"; then
    crash=YES
  fi
  echo -e "$variant\t$installed\t$firebase\t$alive\t$crash" \
    | tee -a "$RESULT/compare.tsv"
  grep -E -A 25 'FATAL EXCEPTION|FirebaseInitProvider: FirebaseApp initialization successful' \
    "$out/logcat.txt" | head -n 200 > "$out/startup-crash-and-firebase.txt" || true
  printf 'VARIANT=%s\nINSTALL=%s\nFIREBASE=%s\nPROCESS_8S=%s\nTARGET_CRASH=%s\n' \
    "$variant" "$installed" "$firebase" "$alive" "$crash" > "$out/status.env"
  adb uninstall "$pkg" > "$out/uninstall-after.txt" 2>&1 || true
done

cat "$RESULT/compare.tsv"
# The job always reports objective results, regardless of application startup status.
