#!/usr/bin/env bash
# Inspect files already emitted by AppSealing and upstream AppPealing.
# This is not a memory dumper. Plaintext never goes into an Actions artifact.
set -euo pipefail
OUT="ixio-lab-results/runtime-payload-audit"
PRIVATE=".ixio-payload-private"
CERT="tools/ixio/dump-public-20261115.crt"
mkdir -p "$OUT" "$PRIVATE"
trap 'rm -rf "$PRIVATE"' EXIT
test -s "$CERT"
openssl x509 -in "$CERT" -noout >/dev/null
# ADB root after Magisk / LSPosed boot is required for app private directories.
adb root > "$OUT/adb-root.log" 2>&1 || true
adb wait-for-device
success=0
for item in "com.lguplus.aicallagent main" "com.lguplus.callrecorder recorder"; do
  read -r pkg group <<< "$item"
  dest="$OUT/$group"
  raw="$PRIVATE/$group"
  mkdir -p "$dest" "$raw"
  echo "PACKAGE=$pkg" > "$dest/status.env"
  adb shell am force-stop "$pkg" >/dev/null 2>&1 || true
  adb shell monkey -p "$pkg" 1 > "$dest/launch.log" 2>&1 || true
  # Capture at two stages; AppSealing may change the payload or exit rapidly.
  for step in early late; do
    if [ "$step" = early ]; then sleep 1; else sleep 5; fi
    mkdir -p "$raw/$step"
    adb shell su -c "find /data/user/0/$pkg/app_payload_lib -maxdepth 5 -type f" \
      > "$dest/payload-files-$step.txt" 2>&1 || true
    adb shell su -c "find /data/user/0/$pkg/apppeal_dump -maxdepth 3 -type f" \
      > "$dest/apppealing-files-$step.txt" 2>&1 || true
    adb pull "/data/user/0/$pkg/app_payload_lib" "$raw/$step/app_payload_lib" \
      > "$dest/pull-payload-$step.log" 2>&1 || true
    adb pull "/data/user/0/$pkg/apppeal_dump" "$raw/$step/apppeal_dump" \
      > "$dest/pull-apppealing-$step.log" 2>&1 || true
    python3 tools/ixio/ixio_runtime_payload_verify.py --input "$raw/$step" \
      --originals ".ixio-inputs" --output "$dest/validation-$step.json" \
      > "$dest/validation-$step.log" 2>&1 || \
      echo "VALIDATION_$step=FAILED" >> "$dest/status.env"
  done
  # Record AppPealing activation messages without publishing proprietary payload.
  adb shell su -c "logcat -d -v threadtime -s 'AppSealing:I' 'LSPosed:I'" \
    > "$dest/appsealing-lsposed-logcat.txt" 2>&1 || true
  if find "$raw" -type f -name '*.dex' -size +0c -print -quit | grep -q .; then
    echo "PAYLOAD_DEX_PRESENT=yes" >> "$dest/status.env"
  else
    echo "PAYLOAD_DEX_PRESENT=no" >> "$dest/status.env"
  fi
  # Encrypt entire private capture, including AppPealing's actual dump ZIP.
  tar -czf "$PRIVATE/$group.tar.gz" -C "$PRIVATE" "$group"
  openssl cms -encrypt -binary -aes256 \
    -in "$PRIVATE/$group.tar.gz" \
    -out "$dest/$group-appsealing-runtime.cms" -outform DER -recip "$CERT" \
    > "$dest/encryption.log" 2>&1
  printf 'ENCRYPTED_BYTES=%s\n' "$(stat -c '%s' "$dest/$group-appsealing-runtime.cms")" >> "$dest/status.env"
  success=$((success+1))
  rm -rf "$raw" "$PRIVATE/$group.tar.gz"
done
printf 'ENCRYPTED_APP_GROUPS=%s\n' "$success" | tee "$OUT/status.env"
test "$success" -eq 2
