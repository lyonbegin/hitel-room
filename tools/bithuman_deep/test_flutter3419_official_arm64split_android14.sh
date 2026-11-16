#!/usr/bin/env bash
# Test the EXACT downloaded Flutter 3.41.9 no-app-abiFilters APK on the
# already established Android 14 x86_64 + NativeBridge emulator.
# No abi override, no altered Flutter SDK, no CPU/GPU route override.
set -euo pipefail
cd "$GITHUB_WORKSPACE"
OUT="$GITHUB_WORKSPACE/reports/flutter3419-official-arm64split-android14-runtime"
APK="$GITHUB_WORKSPACE/reports/hitel-avatar-chat-flutter-3419-official-arm64-split/apk/HITEL_Original_avatar_chat_Expression2_Public_HTTPS_Flutter3419_Official_Arm64Split_Debug.apk"
PKG=ai.hitel.avatar_chat.localauto
mkdir -p "$OUT"
test -s "$APK"
echo ORIGINAL_DOWNGRADED_APK_SHA256
sha256sum "$APK" | tee "$OUT/apk-sha256.txt"
adb wait-for-device
adb shell getprop sys.boot_completed | tee "$OUT/booted.txt"
adb shell getprop ro.product.cpu.abilist | tee "$OUT/abis.txt"
adb shell getprop ro.dalvik.vm.native.bridge | tee "$OUT/native-bridge.txt"
echo '--- REAL APK INSTALL WITHOUT ANY ABI OVERRIDE ---'
set +e
adb install -r "$APK" >"$OUT/install.txt" 2>&1
install_rc=$?
set -e
cat "$OUT/install.txt"
if [[ $install_rc -ne 0 ]] || ! grep -Fq Success "$OUT/install.txt"; then
  printf 'INSTALL_FAILED\n' > "$OUT/verdict.txt"
  exit 12
fi
adb shell pm path "$PKG" | tee "$OUT/pm-path.txt"
adb shell dumpsys package "$PKG" > "$OUT/installed-package.txt" || true
adb logcat -c || true
echo '--- ACTUAL ORIGINAL FLUTTER START ---'
set +e
adb shell am start -W -n "$PKG/ai.bithuman.example.avatar_chat.MainActivity" >"$OUT/start.txt" 2>&1
start_rc=$?
set -e
cat "$OUT/start.txt"
sleep 75
adb logcat -d -v time > "$OUT/logcat-full.txt" || true
adb exec-out screencap -p > "$OUT/screenshot.png" 2>/dev/null || true
adb shell run-as "$PKG" cat app_flutter/boot_status.txt > "$OUT/flutter-boot.txt" 2>/dev/null || true
adb shell pidof "$PKG" > "$OUT/pid.txt" || true
python3 - "$OUT" "$start_rc" <<'PY'
import json,sys,re
from pathlib import Path
p=Path(sys.argv[1]);start_rc=int(sys.argv[2])
log=(p/'logcat-full.txt').read_text(errors='replace')
boot=(p/'flutter-boot.txt').read_text(errors='replace') if (p/'flutter-boot.txt').exists() else ''
pkg=(p/'installed-package.txt').read_text(errors='replace')
checks={
 "android14_emulator_booted":(p/'booted.txt').read_text().strip()=="1",
 "adb_installed_exact_apk":"Success" in (p/'install.txt').read_text(),
 "package_installed":"package:" in (p/'pm-path.txt').read_text(),
 "activity_launch_command_accepted":start_rc==0 and "Status: ok" in (p/'start.txt').read_text(),
 "native_bridge_arm64_selected":"arm64-v8a" in pkg or "arm64" in pkg,
 "flutter_initialized":("Flutter initialization failed" not in log and "EM_AARCH64 (183) instead of EM_X86_64 (62)" not in log and bool((p/'pid.txt').read_text().strip())),
 "public_https_session_observed":"hitel:public_https_demo_session_issued" in boot or "hitel:public_https_demo_session_issued" in log,
 "original_model_verified":"LOCAL_TEST_ORIGINAL_MODEL_READY" in log,
 "expression2_sdk_created":"ORIGINAL_AUTO_HARDWARE_MODEL_CREATED_BY_FLUTTER" in log,
 "flutter_first_texture_frame":"first frame on the texture" in log,
 "no_android_fatal":"FATAL EXCEPTION" not in log,
}
errors=[]
for line in log.splitlines():
 if any(x in line for x in ("Flutter initialization failed","dlopen failed","FATAL EXCEPTION","UnsatisfiedLinkError","load failed:","PlatformException")):
  errors.append(re.sub(r'htdemo\\.v1\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+','[REDACTED]',line[:550]))
report={
 "experiment":"Flutter 3.41.9, app ABI filter removed, official --split-per-abi arm64 package, original Expression2 0.6.2 native binaries",
 "emulator":"Android14 API34 x86_64 + NativeBridge as in prior SDK test",
 "abi_override":False, "official_flutter_split_per_abi":True, "original_sdk_inference_route":"AUTO",
 "package_primary_abi":(re.search(r'primaryCpuAbi=([^\\s]+)',pkg).group(1) if re.search(r'primaryCpuAbi=([^\\s]+)',pkg) else "unknown"),
 "checks":checks,"errors":errors[:25],
 "success":all(checks.values())}
(p/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
(p/'verdict.txt').write_text("PASS\n" if report["success"] else "RUNTIME_FAILED\n")
if not report["success"]:raise SystemExit(73)
print("REAL_ANDROID14_FLUTTER3419_WITHOUT_APP_ABIFILTERS_E2E_PASS")
PY
