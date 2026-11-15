#!/usr/bin/env bash
# IXIO third-party amdump experiment. Only IXIO app PIDs are targeted.
# No locally authored memory dumping implementation; keep encrypted ELF cores.
set -u -o pipefail
OUT="ixio-lab-results/amdump"
PRIVATE=".ixio-amdump-private"
BIN="/data/local/tmp/ixio-amdump"
CERT="tools/ixio/dump-public-20261115.crt"
mkdir -p "$OUT" "$PRIVATE"
printf 'IXIO_DUMPER=boykopovar/amdump\nIXIO_APPLICATION_SCOPE_ONLY=YES\n' > "$OUT/status.env"
if [ ! -f "$CERT" ] || [ ! -x .ixio-tools/amdump ]; then
  echo "CERT_OR_AMDUMP_MISSING" | tee -a "$OUT/status.env"
  exit 2
fi
adb push .ixio-tools/amdump "$BIN" > "$OUT/push.log" 2>&1 || exit 3
adb shell chmod 755 "$BIN" || exit 3
adb shell su -c "$BIN --help" > "$OUT/help.txt" 2>&1 || true
for package in com.lguplus.aicallagent com.lguplus.callrecorder; do
  group=main
  [ "$package" = com.lguplus.callrecorder ] && group=recorder
  mkdir -p "$OUT/$group"
  echo "=== STARTING $package ==="
  adb shell am force-stop "$package" > "$OUT/$group/force-stop.txt" 2>&1 || true
  (adb shell monkey -p "$package" 1 > "$OUT/$group/launch.txt" 2>&1) &
  launcher=$!
  for tick in $(seq 1 45); do
    discovered="$(adb shell su -c "pidof $package" 2>/dev/null | tr -d '\r')" || true
    if [ -n "$discovered" ]; then break; fi
    sleep 0.1
  done
  wait "$launcher" || true
  adb shell ps -A > "$OUT/$group/ps.txt" 2>&1 || true
  adb shell su -c 'ps -A -o PID,NAME' > "$OUT/$group/ps-names.txt" 2>&1 || true
  pids="$(adb shell su -c "pidof $package" 2>/dev/null | tr -d '\r')" || true
  remote="$(awk -v pkg="$package" 'index($NF,pkg":")==1 && $1 ~ /^[0-9]+$/ {print $1}' "$OUT/$group/ps-names.txt" | xargs)" || true
  pids="$(printf '%s\n%s\n' "$pids" "$remote" | tr ' ' '\n' | awk '/^[0-9]+$/ {print}' | sort -un | xargs)" || true
  echo "PACKAGE=$package" | tee -a "$OUT/$group/summary.env"
  echo "PIDS=$pids" | tee -a "$OUT/$group/summary.env"
  if [ -z "$pids" ]; then
    echo "CAPTURE=FAIL_NO_LIVE_PROCESS" | tee -a "$OUT/$group/summary.env"
    continue
  fi
  for pid in $pids; do
    # Read IXIO app-installed files, app-private mappings and dynamically
    # generated ART/DEX/JIT mappings, never Android framework .so mappings.
    app_private="/data/user/0/$package/"
    app_legacy="/data/data/$package/"
    dest="/data/local/tmp/ixio-$group-$pid.core"
    echo "DUMPING_PID=$pid"
    adb shell su -c "cat /proc/$pid/maps" > "$OUT/$group/maps-$pid.txt" 2>&1 || true
    adb shell su -c "$BIN $pid '$dest' --max-gb 4 --region-prefix /data/app/ --region-prefix '$app_private' --region-prefix '$app_legacy' --region-prefix '[anon:dalvik' --region-prefix '[anon:jit' --region-prefix /memfd:" \
      > "$OUT/$group/amdump-$pid.log" 2>&1
    rc=$?
    echo "DUMPER_EXIT_$pid=$rc" | tee -a "$OUT/$group/summary.env"
    tail -12 "$OUT/$group/amdump-$pid.log"
    if [ "$rc" -ne 0 ]; then
      echo "PID_$pid=DUMP_ERROR" | tee -a "$OUT/$group/summary.env"
      adb shell su -c "rm -f '$dest'" >/dev/null 2>&1 || true
      continue
    fi
    raw="$PRIVATE/$group-$pid.core"
    adb pull "$dest" "$raw" > "$OUT/$group/pull-$pid.log" 2>&1
    pull_rc=$?
    adb shell su -c "rm -f '$dest'" >/dev/null 2>&1 || true
    if [ "$pull_rc" -ne 0 ] || [ ! -s "$raw" ]; then
      echo "PID_$pid=PULL_ERROR" | tee -a "$OUT/$group/summary.env"
      rm -f "$raw"
      continue
    fi
    if ! file "$raw" | grep -Eq 'ELF 64-bit.*core'; then
      echo "PID_$pid=INVALID_CORE_HEADER" | tee -a "$OUT/$group/summary.env"
      file "$raw" > "$OUT/$group/core-$pid-file.txt"
      rm -f "$raw"
      continue
    fi
    stat -c '%s' "$raw" > "$OUT/$group/core-$pid-bytes.txt"
    sha256sum "$raw" > "$OUT/$group/core-$pid-sha256.txt"
    readelf -W -l "$raw" > "$OUT/$group/core-$pid-phdr.txt" 2>&1 || true
    encrypted="$OUT/$group/ixio-$group-$pid.cms"
    if openssl cms -encrypt -binary -aes256 -in "$raw" -out "$encrypted" \
        -outform DER -recip "$CERT" > "$OUT/$group/encrypt-$pid.log" 2>&1; then
      echo "PID_$pid=ENCRYPTED_CORE_SUCCESS" | tee -a "$OUT/$group/summary.env"
    else
      rm -f "$encrypted"
      echo "PID_$pid=ENCRYPT_FAILED" | tee -a "$OUT/$group/summary.env"
    fi
    rm -f "$raw"
  done
done
rm -rf "$PRIVATE"
if ! find "$OUT" -type f -name '*.cms' | grep -q .; then
  echo 'OVERALL=NO_VALID_CORE_DUMP' | tee -a "$OUT/status.env"
  exit 4
fi
echo 'OVERALL=AT_LEAST_ONE_ENCRYPTED_CORE' | tee -a "$OUT/status.env"
