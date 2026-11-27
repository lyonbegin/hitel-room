#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# Reboot the disposable test device, not an authenticated persistent farm.
adb shell 'echo hitel-restart-probe > /data/local/tmp/hitel-restart-probe.txt'
old_boot="$(adb shell cat /proc/sys/kernel/random/boot_id | tr -d '\r')"
adb reboot
timeout 1800 adb wait-for-device
for i in $(seq 1 600); do
  new_boot="$(adb shell cat /proc/sys/kernel/random/boot_id 2>/dev/null | tr -d '\r' || true)"
  if [[ -n "$new_boot" && "$new_boot" != "$old_boot" && "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)" == 1 ]]; then break; fi
  sleep 3
done
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1
 test "$(adb shell cat /proc/sys/kernel/random/boot_id | tr -d '\r')" != "$old_boot"
test "$(adb shell cat /data/local/tmp/hitel-restart-probe.txt | tr -d '\r')" = hitel-restart-probe
adb shell rm -f /data/local/tmp/hitel-restart-probe.txt || echo "::warning::Probe cleanup failed after verified persistence"
adb shell pm path com.android.vending | grep -q '^package:'
bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "Android reboot storage persistence verified (no account session tested)"
