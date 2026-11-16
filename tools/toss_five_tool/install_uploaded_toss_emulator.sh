#!/usr/bin/env bash
set -Eeuo pipefail
mkdir -p reports/toss-original-install
adb wait-for-device
adb devices -l | tee reports/toss-original-install/adb-devices.txt
adb shell getprop ro.product.cpu.abilist | tee reports/toss-original-install/abis.txt
adb shell getprop ro.dalvik.vm.native.bridge | tee reports/toss-original-install/native-bridge.txt
adb shell wm density | tee reports/toss-original-install/density.txt
echo "ADB_INSTALL_MULTIPLE_BEGIN"
set +e
adb install-multiple -r build/input/base.apk build/input/split_config.arm64_v8a.apk build/input/split_config.xxhdpi.apk > reports/toss-original-install/install.log 2>&1
rc=$?
set -e
cat reports/toss-original-install/install.log
echo "adb_install_exit_code=$rc" > reports/toss-original-install/verdict.txt
if ((rc!=0)); then
  echo "TOSS_ORIGINAL_INSTALL_FAILED"
  exit "$rc"
fi
adb shell pm path viva.republica.toss | tee reports/toss-original-install/package-paths.txt
adb shell monkey -p viva.republica.toss -c android.intent.category.LAUNCHER 1 | tee reports/toss-original-install/launch.txt
sleep 15
adb shell pidof viva.republica.toss | tee reports/toss-original-install/pid.txt || true
adb logcat -d -b all -v threadtime > reports/toss-original-install/logcat-all.txt || true
adb logcat -d -b crash -v threadtime > reports/toss-original-install/logcat-crash.txt || true
adb logcat -d -v time | grep -E "FATAL EXCEPTION|viva.republica.toss|UnsatisfiedLinkError|SecurityException" | tail -400 > reports/toss-original-install/logcat.txt || true
adb shell dumpsys activity exit-info viva.republica.toss > reports/toss-original-install/exit-info.txt 2>&1 || true
adb root > reports/toss-original-install/adb-root.txt 2>&1 || true
adb wait-for-device || true
adb shell ls -l /data/tombstones > reports/toss-original-install/tombstone-list.txt 2>&1 || true
mkdir -p reports/toss-original-install/tombstones
adb pull /data/tombstones reports/toss-original-install/tombstones/ > reports/toss-original-install/tombstone-pull.txt 2>&1 || true
adb shell screencap -p /sdcard/toss.png
adb pull /sdcard/toss.png reports/toss-original-install/screenshot.png
echo TOSS_USER_ORIGINAL_INSTALL_TEST_DONE
