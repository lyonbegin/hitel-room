#!/usr/bin/env bash
set -euo pipefail
mkdir -p emulator-qa-v12-arm64bridge
adb wait-for-device
adb shell settings put system screen_off_timeout 1800000
echo 'Android ABI: '$(adb shell getprop ro.product.cpu.abi)
echo 'Supported ABIs: '$(adb shell getprop ro.product.cpu.abilist)
echo 'Native bridge: '$(adb shell getprop ro.dalvik.vm.native.bridge)
adb shell getprop ro.product.cpu.abilist | tee emulator-qa-v12-arm64bridge/native-bridge-abis.txt
adb shell getprop ro.dalvik.vm.native.bridge | tee emulator-qa-v12-arm64bridge/native-bridge-property.txt
adb shell input keyevent 82
set +e
adb install -r --abi arm64-v8a arm64-apk/Galaxy-Korean-Zipformer-174M-PrewarmGate-v12.apk > emulator-qa-v12-arm64bridge/install.txt 2>&1
rc=$?
set -e
cat emulator-qa-v12-arm64bridge/install.txt
if [[ $rc -ne 0 ]]; then
  echo "ARM64_APK_INSTALL_FAILED_STATUS=$rc" | tee emulator-qa-v12-arm64bridge/FAIL.txt
  exit 3
fi
adb shell pm path app.hitel.koreanzipformer.prewarm12 | tee emulator-qa-v12-arm64bridge/installed-package.txt
adb shell mkdir -p /sdcard/Download
adb push /tmp/ko_live_test.m4a /sdcard/Download/ko_live_test.m4a
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Download/ko_live_test.m4a || true
python3 sherpa-original-launcher/ci/test_galaxy_latency_v11_emulator.py
cp emulator-qa-v11/PASS.txt emulator-qa-v12-arm64bridge/PASS.txt
cp emulator-qa-v11/checks.json emulator-qa-v12-arm64bridge/checks.json
cp emulator-qa-v11/emulator-v11-diagnostics.zip emulator-qa-v12-arm64bridge/diagnostics.zip
cp emulator-qa-v11/stt-completed-or-timeout.png emulator-qa-v12-arm64bridge/caption-screen.png
echo 'ARM64-only APK tested through Android 15 x86_64 Native Bridge, not physical ARM64 CPU.' >> emulator-qa-v12-arm64bridge/PASS.txt
