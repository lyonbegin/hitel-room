#!/usr/bin/env bash
set -euo pipefail
out=reports/essence2-fold-diagnostics-ui-smoke
apk='build/essence2-installable-apk/Essence2_0.10.3_ARM64_Galaxy_Z_Fold_Diagnostics.apk'
mkdir -p "$out"
adb wait-for-device
adb shell getprop ro.product.cpu.abilist > "$out/abis.txt"
adb shell getprop ro.dalvik.vm.native.bridge > "$out/native-bridge.txt"
adb uninstall com.example.e2hello > "$out/uninstall-prior.txt" 2>&1 || true
adb install -r "$apk" | tee "$out/install.txt"
adb shell am start -W -n com.example.e2hello/.MainActivity | tee "$out/launch.txt"
sleep 6
adb shell uiautomator dump /sdcard/essence2-ui.xml > "$out/uiautomator-command.txt" 2>&1
adb pull /sdcard/essence2-ui.xml "$out/ui-hierarchy.xml" > "$out/ui-pull.txt" 2>&1
adb exec-out screencap -p > "$out/screenshot.png"
adb logcat -d -v time > "$out/logcat.txt"
# Dismiss the (required) local user API-secret entry without logging credentials,
# then inspect the underlying physical phone diagnostics button.
adb shell input keyevent KEYCODE_BACK || true
sleep 2
adb shell uiautomator dump /sdcard/essence2-main-ui.xml > "$out/underlying-ui-dump-command.txt" 2>&1 || true
adb pull /sdcard/essence2-main-ui.xml "$out/underlying-ui-hierarchy.xml" > "$out/underlying-ui-pull.txt" 2>&1 || true
adb logcat -d -v time > "$out/logcat-after-dismiss.txt" || true
python3 - <<'PY'
from pathlib import Path
import json
base=Path("reports/essence2-fold-diagnostics-ui-smoke")
xml=(base/"ui-hierarchy.xml").read_text(errors="replace")
install=(base/"install.txt").read_text(errors="replace")
launch=(base/"launch.txt").read_text(errors="replace")
log=(base/"logcat.txt").read_text(errors="replace")
under=(base/"underlying-ui-hierarchy.xml").read_text(errors="replace") if (base/"underlying-ui-hierarchy.xml").is_file() else ""
assert "Success" in install,install
assert "Status: ok" in launch,launch
checks={
    "adb_install_success":"Success" in install,
    "activity_launched":"Status: ok" in launch,
    "api_secret_dialog_title_visible":"Essence 2 실기기 테스트" in xml,
    "api_secret_password_input_visible":"API Secret" in xml,
    "start_test_button_visible":"테스트 시작" in xml,
    "no_immediate_fatal_crash":"FATAL EXCEPTION: main" not in log,
    "galaxy_fold_diagnostic_button_exists":"진단 로그 복사" in under,
    "original_sdk_launch_marker_exists":"ORIGINAL_ESSENCE2_ANDROID_0_10_3_DEVICE_TEST_READY" in log,
}
report={
    "all_checks_pass":all(checks.values()),"checks":checks,
    "original_sdk_machine_code_modified":False,
    "vendor_api_secret_included":False,
    "physical_arm64_phone_tested":False,
    "model_rendering_tested":False,
}
(base/"RESULT.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print("ESSENCE2_INSTALLABLE_ANDROID_PROMPT_UI_SMOKE",report)
if not all(checks.values()):raise SystemExit(1)
PY
