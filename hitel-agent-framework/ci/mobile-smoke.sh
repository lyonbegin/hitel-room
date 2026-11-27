#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/mobile-smoke-results"
mkdir -p "$OUT"
adb wait-for-device
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1
adb shell pm path com.android.vending > "$OUT/play-store.txt"
grep -q '^package:' "$OUT/play-store.txt"
for app in gallery pokeclaw; do
  case "$app" in
    gallery) pkg=com.google.aiedge.gallery; component="$pkg/com.google.ai.edge.gallery.MainActivity" ;;
    pokeclaw) pkg=io.agents.pokeclaw; component="$pkg/.ui.splash.SplashActivity" ;;
  esac
  mapfile -t apks < <(find "$ROOT/mobile-apks/$app-debug-apk" -type f -name '*.apk' | sort)
  if [[ ${#apks[@]} -ne 1 ]]; then
    echo "::error::Expected one installable debug APK for $app; got ${#apks[@]}"
    exit 1
  fi
  adb install -r "${apks[0]}" | tee "$OUT/$app-install.txt"
  grep -q Success "$OUT/$app-install.txt"
  adb shell pm path "$pkg" | tee "$OUT/$app-package.txt"
  grep -q '^package:' "$OUT/$app-package.txt"
  adb logcat -c
  bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "$app APK installed"
  adb shell am start -W -n "$component" | tee "$OUT/$app-launch.txt"
  grep -q "Status: ok" "$OUT/$app-launch.txt"
  sleep 30
  adb shell pidof "$pkg" | tee "$OUT/$app-pid.txt"
  test -s "$OUT/$app-pid.txt"
  adb logcat -d -b crash > "$OUT/$app-crashes.txt"
  if grep -F "Process: $pkg," "$OUT/$app-crashes.txt"; then
    echo "::error::$app crashed during startup"
    exit 1
  fi
  adb exec-out screencap -p > "$OUT/$app-clean.png"
  bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "$app launched without startup crash"
  adb shell am force-stop "$pkg"
done
echo "Both APKs installed and launched on the clean emulator; this does not establish remote control or LLM execution."

# Launch the added native gateway UI, not just the original app.
adb shell am start -W -n io.agents.pokeclaw/io.agents.pokeclaw.hitel.HitelBridgeActivity | tee "$OUT/hitel-bridge-launch.txt"
grep -q "Status: ok" "$OUT/hitel-bridge-launch.txt"
sleep 5
adb shell uiautomator dump /sdcard/hitel-bridge.xml >/dev/null
adb pull /sdcard/hitel-bridge.xml "$OUT/hitel-bridge.xml" >/dev/null
grep -qi "Check pending task" "$OUT/hitel-bridge.xml"
adb exec-out screencap -p > "$OUT/hitel-bridge-clean.png"
bash "$ROOT/hitel-agent-framework/ci/milestone.sh" "Patched PokeClaw native task bridge installed and UI verified (remote native callback pending)"

bash "$ROOT/hitel-agent-framework/ci/direct-native-smoke.sh"
