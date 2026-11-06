#!/usr/bin/env bash
set -u
APP="$1"; PKG="$2"; mkdir -p "evidence/$APP/installed"; log="evidence/$APP/installed/install.log"
file="source/$APP.xapk"
if [[ ! -f "$file" ]]; then echo 'Verified XAPK missing' | tee "$log"; exit 21; fi
mkdir -p "source/unpacked/$APP"
unzip -oq "$file" -d "source/unpacked/$APP"
mapfile -d '' -t apks < <(find "source/unpacked/$APP" -type f -iname '*.apk' -print0)
printf 'XAPK contains %s APKs\n' "${#apks[@]}" | tee "$log"
if (( ${#apks[@]} == 0 )); then echo 'No APKs inside XAPK' | tee -a "$log"; exit 22; fi
adb wait-for-device
adb shell settings put system screen_off_timeout 1800000 || true
adb shell settings put system accelerometer_rotation 0 || true
adb shell wm size 440x956 || true
adb shell wm density 320 || true
if (( ${#apks[@]} == 1 )); then adb install -r -g "${apks[0]}" >> "$log" 2>&1; result=$?;
else adb install-multiple -r -g "${apks[@]}" >> "$log" 2>&1; result=$?; fi
if (( result != 0 )); then
  echo 'First install failed; trying base-only to distinguish incompatible split configuration' | tee -a "$log"
  base=$(find "source/unpacked/$APP" -type f \( -iname 'base.apk' -o -iname "${PKG}.apk" \) | head -1)
  if [[ -n "$base" ]]; then adb install -r -g "$base" >> "$log" 2>&1 || true; fi
fi
adb shell pm path "$PKG" | tee -a "$log"
if ! adb shell pm path "$PKG" | grep -q 'package:'; then echo 'INSTALL_FAILED: no installed package' | tee -a "$log"; exit 23; fi
exit 0