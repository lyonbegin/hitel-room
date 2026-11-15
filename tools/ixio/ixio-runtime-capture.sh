#!/usr/bin/env bash
set -uo pipefail
mkdir -p ixio-lab-results
do_step() { local key="$1"; shift; echo "=== $key"; if "$@"; then echo "$key=PASS" | tee -a ixio-lab-results/summary.env; else echo "$key=FAIL" | tee -a ixio-lab-results/summary.env; fi; }

adb wait-for-device
adb root || true
adb wait-for-device
adb shell 'chmod 755 /data/local/tmp/ixio-frida-server' || true
adb shell '/data/local/tmp/ixio-frida-server -D' || true
sleep 4
adb shell 'ps -A | grep -E "lspd|magiskd|zygiskd" ' > ixio-lab-results/zygisk-ps.txt 2>&1 || true
if [ -x .ixio-tools/venv/bin/frida-ps ]; then
  do_step FRIDA_AFTER_REBOOT .ixio-tools/venv/bin/frida-ps -Uai
fi
adb shell 'ls -l /data/adb/lspd/config/modules_config.db' > ixio-lab-results/lsposed-db-presence.txt 2>&1 || true

for p in com.lguplus.aicallagent com.lguplus.callrecorder; do
  d="ixio-lab-results/$p"
  mkdir -p "$d/local-dump"
  echo "=== TARGET $p"
  adb shell 'logcat -c' || true
  adb shell am force-stop "$p" || true
  adb shell monkey -p "$p" 1 > "$d/first-launch.log" 2>&1 || true
  # Capture several runtime stages because AppSealing can spawn/restart the app
  # and materialize different DEX segments as it initializes.
  snapshot_payload() {
    local at="$1"
    local home="$d/local-dump/snapshot-${at}s"
    mkdir -p "$home"
    adb shell pidof "$p" > "$d/pid-at-${at}s.txt" 2>&1 || true
    local pid
    pid="$(head -1 "$d/pid-at-${at}s.txt" | awk '{print $1}')"
    if [ -n "$pid" ]; then
      adb shell su -c "cat /proc/$pid/maps" > "$d/maps-at-${at}s.txt" 2>&1 || true
    fi
    adb shell su -c "find /data/user/0/$p/app_payload_lib -maxdepth 5 -type f" \
      > "$d/payload-files-${at}s.txt" 2>&1 || true
    adb pull "/data/user/0/$p/app_payload_lib" "$home/app_payload_lib" \
      > "$d/payload-pull-${at}s.log" 2>&1 || true
  }
  sleep 1
  snapshot_payload 1
  sleep 2
  snapshot_payload 3
  sleep 4
  snapshot_payload 7
  sleep 5
  snapshot_payload 12
  adb shell pidof "$p" > "$d/pid-after-12sec.txt" 2>&1 || true
  adb shell 'logcat -d -t 2500 -v threadtime' > "$d/after-launch-logcat.txt" 2>&1 || true
  adb shell su -c "find /data/user/0/$p/apppeal_dump -type f" > "$d/apppealing-found.txt" 2>&1 || true
  adb pull "/data/user/0/$p/apppeal_dump" "$d/local-dump/apppeal_dump" > "$d/apppealing-pull.log" 2>&1 || true

  target_pid="$(adb shell pidof "$p" 2>/dev/null | tr -d '\r' | awk '{print $1}')"
  if [ -n "$target_pid" ]; then
    adb shell su -c "head -n 250 /proc/$target_pid/maps" > "$d/process-maps.txt" 2>&1 || true
    # Target the existing PID without Frida-spawn, which timed out on both apps.
    timeout 44 .ixio-tools/venv/bin/clsdumper "$target_pid" \
      --no-anti-frida --strategies memory_scan,cookie,art_walk,fart_dump \
      -o "$d/local-dump" -d > "$d/frida-attach.log" 2>&1 || true
  else
    echo "NO_STABLE_PID" > "$d/frida-attach.log"
  fi
  # Final fallback: attach by package without force-killing/spawning it.
  if ! find "$d/local-dump" -type f \( -name '*.dex' -o -name '*.cdex' \) | grep -q .; then
    timeout 32 .ixio-tools/venv/bin/clsdumper "$p" --no-anti-frida \
      --strategies memory_scan,art_walk,cookie,fart_dump \
      -o "$d/local-dump" -d > "$d/frida-package-attach.log" 2>&1 || true
  fi

  if [ -d "/data/user/0/$p/apppeal_dump" ]; then
    echo "DUMP_PRESENT_ON_HOST_DISK"
  fi
  adb shell su -c "find /data/user/0/$p/apppeal_dump -type f" > "$d/apppealing-found-final.txt" 2>&1 || true
  adb pull "/data/user/0/$p/apppeal_dump" "$d/local-dump/apppeal_dump" >> "$d/apppealing-pull.log" 2>&1 || true
  # Keep only restored DEX bytes for independent per-app reconstruction.
  if [ "${IXIO_SEPARATE_REASSEMBLE:-0}" = 1 ]; then
    group=main
    [ "$p" = com.lguplus.callrecorder ] && group=recorder
    mkdir -p ".ixio-rebuild-input/$group"
    while IFS= read -r -d '' dexfile; do
      cp -f "$dexfile" ".ixio-rebuild-input/$group/$(basename "$dexfile")"
    done < <(find "$d/local-dump/snapshot-12s" -type f -name '*.dex' -print0 2>/dev/null)
    sha256sum ".ixio-rebuild-input/$group/"*.dex \
      > "$d/restored-rebuild-input-sha256.txt" 2>/dev/null || true
  fi
  python3 tools/ixio/package_runtime_dump.py "$p" "$d/local-dump" "$d" || true
  adb shell 'logcat -d -t 3500 -v threadtime' > "$d/final-logcat.txt" 2>&1 || true
  rm -rf "$d/local-dump"
done
