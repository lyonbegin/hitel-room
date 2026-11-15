#!/usr/bin/env bash
set -uo pipefail
export PATH="$PWD/.ixio-objection-venv/bin:$PATH"
OUT=ixio-objection-results
mkdir -p "$OUT" .ixio-objection-private
adb root > "$OUT/adb-root.log" 2>&1 || true
adb wait-for-device
adb shell id > "$OUT/adb-id.txt" 2>&1 || true
adb shell getprop ro.product.cpu.abilist > "$OUT/device-abi.txt" 2>&1 || true
adb shell getprop ro.dalvik.vm.native.bridge > "$OUT/nativebridge.txt" 2>&1 || true
adb push .ixio-objection-tools/frida-server /data/local/tmp/ixio-frida-server > "$OUT/frida-push.log" 2>&1
adb shell chmod 755 /data/local/tmp/ixio-frida-server
adb shell '/data/local/tmp/ixio-frida-server -D' > "$OUT/frida-launch.log" 2>&1 || true
sleep 3
timeout 20 frida-ps -U > "$OUT/frida-ps.txt" 2>&1 || true
mkdir -p .ixio-inputs/main-splits
unzip -qo .ixio-inputs/main.xapk -d .ixio-inputs/main-splits
mapfile -d '' -t splits < <(find .ixio-inputs/main-splits -maxdepth 2 -type f -name '*.apk' -print0)
adb install-multiple -r "${splits[@]}" > "$OUT/main-install.txt" 2>&1
adb install -r .ixio-inputs/recorder.apk > "$OUT/recorder-install.txt" 2>&1
found=0
for pkg in com.lguplus.aicallagent com.lguplus.callrecorder; do
  grp=main
  [ "$pkg" = com.lguplus.callrecorder ] && grp=recorder
  mkdir -p "$OUT/$grp"
  adb shell am force-stop "$pkg" > "$OUT/$grp/force-stop.log" 2>&1 || true
  (adb shell monkey -p "$pkg" 1 > "$OUT/$grp/launch.log" 2>&1) &
  launcher=$!
  for tick in $(seq 1 30); do
    adb shell ps -A -o PID,NAME > "$OUT/$grp/processes.txt" 2>&1 || true
    pids="$(awk -v target="$pkg" '$1 ~ /^[0-9]+$/ && ($2 == target || index($2,target":") == 1) {print $1}' "$OUT/$grp/processes.txt" | sort -nu | xargs)" || true
    if [ -n "$pids" ]; then break; fi
    sleep 0.2
  done
  wait "$launcher" || true
  adb shell ps -A -o PID,NAME > "$OUT/$grp/processes-final.txt" 2>&1 || true
  pids="$(awk -v target="$pkg" '$1 ~ /^[0-9]+$/ && ($2 == target || index($2,target":") == 1) {print $1}' "$OUT/$grp/processes-final.txt" | sort -nu | xargs)" || true
  echo "PACKAGE=$pkg PIDS=$pids" | tee -a "$OUT/$grp/summary.txt"
  for pid in $pids; do
    adb shell cat /proc/"$pid"/maps > "$OUT/$grp/maps-$pid.txt" 2>&1 || true
    raw=".ixio-objection-private/$grp-$pid.bin"
    echo "DUMPER=upstream-sensepost/objection PID=$pid" >> "$OUT/$grp/summary.txt"
    timeout --signal=TERM --kill-after=10s 220 objection --name "$pid" --no-pause run memory dump all "$raw" > "$OUT/$grp/objection-$pid.log" 2>&1
    rc=$?
    echo "PID_$pid EXIT_CODE=$rc" >> "$OUT/$grp/summary.txt"
    if [ -s "$raw" ]; then
      stat -c '%s' "$raw" > "$OUT/$grp/dump-$pid-raw-bytes.txt"
      sha256sum "$raw" > "$OUT/$grp/dump-$pid-raw-sha256.txt"
      gzip -1 "$raw"
      openssl cms -encrypt -binary -aes256 -in "$raw.gz" -out "$OUT/$grp/objection-$pid.cms" -outform DER -recip tools/ixio/dump-public-20261115.crt > "$OUT/$grp/encrypt-$pid.log" 2>&1
      if [ -s "$OUT/$grp/objection-$pid.cms" ]; then
        sha256sum "$OUT/$grp/objection-$pid.cms" > "$OUT/$grp/dump-$pid-encrypted-sha256.txt"
        found=$((found+1))
      fi
      rm -f "$raw.gz"
    else
      echo "PID_$pid NO_DUMP_OUTPUT" >> "$OUT/$grp/summary.txt"
    fi
    rm -f "$raw"
  done
  adb logcat -d -t 1200 -v threadtime > "$OUT/$grp/logcat.txt" 2>&1 || true
done
rm -rf .ixio-objection-private
echo "$found" > "$OUT/encrypted-output-count.txt"
test "$found" -ge 1
