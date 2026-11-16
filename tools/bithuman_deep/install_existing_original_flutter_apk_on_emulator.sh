#!/usr/bin/env bash
# ADB install of the exact existing Flutter APK, NO code/ABI/GPU change.
set -euo pipefail
cd "$GITHUB_WORKSPACE"
OUT="$GITHUB_WORKSPACE/reports/original-flutter-android14-install"
APK="$GITHUB_WORKSPACE/reports/hitel-avatar-chat-public-https-auto/apk/HITEL_Original_avatar_chat_Expression2_Public_HTTPS_AUTO_Debug.apk"
PKG=ai.hitel.avatar_chat.localauto
mkdir -p "$OUT"
test -s "$APK"
adb wait-for-device
adb shell getprop ro.product.cpu.abilist | tee "$OUT/abis.txt"
adb shell getprop ro.dalvik.vm.native.bridge | tee "$OUT/bridge.txt"
adb shell getprop sys.boot_completed | tee "$OUT/boot-complete.txt"
adb install -r "$APK" 2>&1 | tee "$OUT/installed.txt"
adb shell pm path "$PKG" | tee "$OUT/pm.txt"
adb logcat -c
adb shell am start -W -n "$PKG/ai.bithuman.example.avatar_chat.MainActivity" 2>&1 | tee "$OUT/started.txt"
sleep 65
adb logcat -d -v time > "$OUT/logcat.txt" || true
adb exec-out screencap -p > "$OUT/screenshot.png" || true
adb shell run-as "$PKG" cat app_flutter/boot_status.txt > "$OUT/boot.txt" 2>/dev/null || true
adb shell pidof "$PKG" > "$OUT/pid.txt" || true
grep -Fq 'Success' "$OUT/installed.txt"
grep -Fq 'package:' "$OUT/pm.txt"
grep -Fq 'Status: ok' "$OUT/started.txt"
echo 'EXISTING_ORIGINAL_FLUTTER_APK_ADB_INSTALL_AND_ACTIVITY_LAUNCH_PASS'
echo '--- REAL BOOT STATUS ---'
cat "$OUT/boot.txt" || true
echo '--- NATIVE LIBRARY / FLUTTER ERRORS ---'
grep -E 'BH_EXPR2_LOCAL_TEST|first frame on the texture|FATAL EXCEPTION|load failed|[Ll]ite[Rr]t|BithumanPlugin' "$OUT/logcat.txt" | tail -55 || true
python3 - "$OUT" <<'PY'
import json,sys
from pathlib import Path
p=Path(sys.argv[1])
log=(p/'logcat.txt').read_text(errors='replace')
boot=(p/'boot.txt').read_text(errors='replace') if (p/'boot.txt').exists() else ''
r={
  "real_apk_installed":"Success" in (p/'installed.txt').read_text(),
  "real_flutter_activity_launched":"Status: ok" in (p/'started.txt').read_text(),
  "public_https_demo_token_issued":"hitel:public_https_demo_session_issued" in boot,
  "original_model_ready":"LOCAL_TEST_ORIGINAL_MODEL_READY" in log,
  "original_expression2_create_success":"ORIGINAL_AUTO_HARDWARE_MODEL_CREATED_BY_FLUTTER" in log,
  "flutter_first_texture_frame":"first frame on the texture" in log,
  "original_app_boot_error":next((s.split('boot:error=',1)[1].strip() for s in boot.splitlines() if 'boot:error=' in s),None),
  "native_abi_selection":"NO_OVERRIDES",
}
(p/'RESULT.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(r,ensure_ascii=False,indent=2))
PY
