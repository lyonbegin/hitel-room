#!/usr/bin/env bash
# Sign and separately install the original-bytecode IXIO main and recorder packages.
set -euo pipefail
OUT=".ixio-rebuild-output"
mkdir -p "$OUT" "ixio-lab-results/separate-repack"
LOG="ixio-lab-results/separate-repack"
python3 tools/ixio/ixio_repack_separate.py \
  --xapk .ixio-inputs/main.xapk \
  --recorder .ixio-inputs/recorder.apk \
  --restored-dir .ixio-rebuild-input \
  --out "$OUT" | tee "$LOG/repack-console.txt"
cp "$OUT/reassembly-report.json" "$LOG/reassembly-report.json"

BUILD_TOOLS=$(find "${ANDROID_HOME:-/usr/local/lib/android/sdk}/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)
test -x "$BUILD_TOOLS/apksigner"
test -x "$BUILD_TOOLS/zipalign"
KEYSTORE=".ixio-rebuild-input/ixio-test-key.jks"
keytool -genkeypair -noprompt -keystore "$KEYSTORE" -storepass android -keypass android \
  -alias ixio -keyalg RSA -keysize 2048 -validity 3650 \
  -dname "CN=IXIO reconstruction TEST ONLY" >/dev/null 2>&1

sign_apk() {
  local src="$1" dest="$2" aligned="$LOG/$(basename "$src").aligned.apk"
  "$BUILD_TOOLS/zipalign" -p -f 4 "$src" "$aligned"
  "$BUILD_TOOLS/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:android \
    --key-pass pass:android --ks-key-alias ixio --out "$dest" "$aligned"
  "$BUILD_TOOLS/apksigner" verify --verbose "$dest" \
    > "$LOG/$(basename "$dest").signature.txt" 2>&1
  "$BUILD_TOOLS/zipalign" -c -p 4 "$dest"
}

for src in "$OUT/main/"*".apk"; do
  target="$OUT/main/$(basename "$src" | sed 's/-unsigned//;s/^split_/signed-split_/')"
  if [ "$src" = "$target" ]; then
    target="$OUT/main/signed-$(basename "$src")"
  fi
  sign_apk "$src" "$target"
done
sign_apk "$OUT/recorder/recorder-unsigned.apk" "$OUT/recorder/recorder-reassembled-signed.apk"

# The same app identity is preserved, but use one clean installation at a time.
adb uninstall com.lguplus.aicallagent >/dev/null 2>&1 || true
adb uninstall com.lguplus.callrecorder >/dev/null 2>&1 || true

test_package() {
  local group="$1" pkg="$2"
  local installstatus="$LOG/$group-install.log"
  adb logcat -c || true
  echo "### $group independent install" | tee "$LOG/$group-status.txt"
  if [ "$group" = main ]; then
    mapfile -d '' -t apks < <(find "$OUT/main" -maxdepth 1 -type f \
      \( -name 'base.apk' -o -name 'signed-split_*.apk' \) -print0)
    if [ "${#apks[@]}" -lt 4 ]; then
      echo "INSTALL=FAIL_MISSING_SPLIT; APK_COUNT=${#apks[@]}" | tee -a "$LOG/$group-status.txt"
      return 1
    fi
    if adb install-multiple -r "${apks[@]}" > "$installstatus" 2>&1; then
      echo "INSTALL=PASS" | tee -a "$LOG/$group-status.txt"
    else
      echo "INSTALL=FAIL" | tee -a "$LOG/$group-status.txt"
      cat "$installstatus"
      return 1
    fi
  else
    if adb install -r "$OUT/recorder/recorder-reassembled-signed.apk" > "$installstatus" 2>&1; then
      echo "INSTALL=PASS" | tee -a "$LOG/$group-status.txt"
    else
      echo "INSTALL=FAIL" | tee -a "$LOG/$group-status.txt"
      cat "$installstatus"
      return 1
    fi
  fi
  adb shell pm path "$pkg" > "$LOG/$group-pm-path.txt" 2>&1 || true
  if [ "$group" = main ]; then
    adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 \
      > "$LOG/$group-launch.txt" 2>&1 || true
  else
    adb shell monkey -p "$pkg" -c android.intent.category.LAUNCHER 1 \
      > "$LOG/$group-launch.txt" 2>&1 || true
    adb shell su -c "am start-foreground-service -n $pkg/.CallRecordingService" \
      > "$LOG/$group-startservice.txt" 2>&1 || true
  fi
  sleep 8
  adb shell pidof "$pkg" > "$LOG/$group-pid-after-8sec.txt" 2>&1 || true
  adb logcat -d -v threadtime -t 4500 > "$LOG/$group-logcat.txt" 2>&1 || true
  adb shell dumpsys package "$pkg" > "$LOG/$group-package.txt" 2>&1 || true
  if [ -s "$LOG/$group-pid-after-8sec.txt" ]; then
    echo "PROCESS_ALIVE_AFTER_8S=PASS" | tee -a "$LOG/$group-status.txt"
  else
    echo "PROCESS_ALIVE_AFTER_8S=NO" | tee -a "$LOG/$group-status.txt"
  fi
  adb exec-out screencap -p > "$LOG/$group-screenshot.png" 2>/dev/null || true
  echo "$group completion" | tee -a "$LOG/$group-status.txt"
  adb uninstall "$pkg" > "$LOG/$group-uninstall.log" 2>&1 || true
}
test_package main com.lguplus.aicallagent || true
test_package recorder com.lguplus.callrecorder || true
sha256sum "$OUT/main/"*.apk "$OUT/recorder/"*.apk \
  > "$OUT/SHA256SUMS.txt"
echo "IXIO_SEPARATE_REPACK_REPORT=$OUT/reassembly-report.json" | tee -a "$LOG/summary.txt"
cat "$LOG/main-status.txt" "$LOG/recorder-status.txt" | tee -a "$LOG/summary.txt"
