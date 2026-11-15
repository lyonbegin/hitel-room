#!/usr/bin/env bash
set -uo pipefail
mkdir -p ixio-lab-results
exec > >(tee -a ixio-lab-results/runtime.log) 2>&1
fail=0
mark() { printf '%s=%s\n' "$1" "$2" | tee -a ixio-lab-results/summary.env; }
step() { label="$1"; shift; echo "### $label"; if "$@"; then mark "$label" PASS; else mark "$label" FAIL; fail=$((fail+1)); fi; }
wait_boot() { adb wait-for-device && for i in $(seq 1 90); do [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ] && return 0; sleep 2; done; return 1; }
step EMULATOR_BOOT wait_boot
adb devices -l || true
adb shell getprop ro.build.version.release || true
adb shell getprop ro.product.cpu.abilist || true
adb shell getprop ro.dalvik.vm.native.bridge || true
step ADB_ROOT adb root
adb shell id || true
if [ -x .ixio-tools/avdroot ]; then
  step MAGISK_ROOT .ixio-tools/avdroot root --yes --timeout 8m
  wait_boot || true
  adb shell su -c id || true
else mark MAGISK_ROOT NO_BINARY; fi
cat > .ixio-tools/enable-zygisk.sh <<'ZZ'
#!/system/bin/sh
magisk --sqlite "INSERT OR REPLACE INTO settings (key,value) VALUES ('zygisk',1);"
ZZ
if adb shell su -c id 2>/dev/null | grep -q uid=0; then
  if [ -f .ixio-tools/LSPosed.zip ]; then
    adb push .ixio-tools/LSPosed.zip /data/local/tmp/ixio-lsposed.zip
    step LSPOSED_MODULE adb shell su -c 'magisk --install-module /data/local/tmp/ixio-lsposed.zip'
  else mark LSPOSED_MODULE NO_ZIP; fi
  adb push .ixio-tools/enable-zygisk.sh /data/local/tmp/ixio-enable-zygisk.sh
  step ZYGISK_ENABLE adb shell su -c 'sh /data/local/tmp/ixio-enable-zygisk.sh'
  adb reboot || true
  wait_boot || true
  adb shell su -c 'ls -la /data/adb/modules/' || true
else mark LSPOSED_MODULE SKIPPED_NO_SU; fi
if [ -f .ixio-tools/apppealing-debug.apk ]; then
  step APPPEALING_APK_INSTALL adb install -r .ixio-tools/apppealing-debug.apk
  adb shell pm path com.october.apppealing || true
else mark APPPEALING_APK_INSTALL NO_APK; fi
if [ -f .ixio-tools/frida-server ]; then
  adb push .ixio-tools/frida-server /data/local/tmp/ixio-frida-server
  adb shell su -c 'chmod 755 /data/local/tmp/ixio-frida-server' || true
  adb shell 'su -c "/data/local/tmp/ixio-frida-server -D"' || true
  sleep 5
  if [ -x .ixio-tools/venv/bin/frida-ps ]; then
    step FRIDA_USB_LIST .ixio-tools/venv/bin/frida-ps -U
  else mark FRIDA_USB_LIST NO_CLIENT; fi
else mark FRIDA_USB_LIST NO_SERVER; fi
for p in com.lguplus.aicallagent com.lguplus.callrecorder; do
  if adb shell pm path "$p" 2>/dev/null | grep -q package:; then
    mark "TARGET_$p" INSTALLED
  else mark "TARGET_$p" MISSING; fi
done
adb shell getprop ro.dalvik.vm.native.bridge > ixio-lab-results/nativebridge.txt || true
adb shell getprop ro.product.cpu.abilist > ixio-lab-results/abilist.txt || true
adb logcat -d -t 700 -s 'AppSealing:*' 'LSPosed:*' 'Frida:*' > ixio-lab-results/logcat_filtered.txt 2>&1 || true
echo "STEPS_WITH_FAILURE=$fail" | tee -a ixio-lab-results/summary.env
