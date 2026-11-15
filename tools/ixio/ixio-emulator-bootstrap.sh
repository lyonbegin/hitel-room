#!/usr/bin/env bash
set -uo pipefail
mkdir -p ixio-lab-results
exec > >(tee -a ixio-lab-results/runtime.log) 2>&1
fail=0
mark() { printf '%s=%s\n' "$1" "$2" | tee -a ixio-lab-results/summary.env; }
step() { label="$1"; shift; echo "### $label"; if "$@"; then mark "$label" PASS; else mark "$label" FAIL; fail=$((fail+1)); fi; }
wait_boot() {
  timeout --signal=TERM --kill-after=3s 50 adb wait-for-device || return 1
  for i in $(seq 1 90); do
    local completed
    completed="$(timeout 8 adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" || true
    [ "$completed" = 1 ] && return 0
    sleep 2
  done
  return 1
}
step EMULATOR_BOOT wait_boot
adb devices -l || true
adb shell getprop ro.build.version.release || true
adb shell getprop ro.product.cpu.abilist || true
adb shell getprop ro.dalvik.vm.native.bridge || true
step ADB_ROOT adb root
adb shell id || true
if [ -x .ixio-tools/avdroot ]; then
  step MAGISK_ROOT .ixio-tools/avdroot root --magisk .ixio-tools/Magisk-v30.7.apk --yes --timeout 8m
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
  timeout --signal=TERM --kill-after=3s 25 adb reboot || true
  if wait_boot; then mark POST_ZYGISK_REBOOT PASS; else mark POST_ZYGISK_REBOOT FAIL; adb devices -l || true; fi
  timeout 12 adb shell su -c 'ls -la /data/adb/modules/' || true
else mark LSPOSED_MODULE SKIPPED_NO_SU; fi
if [ -f .ixio-tools/apppealing-debug.apk ]; then
  step APPPEALING_APK_INSTALL adb install -r .ixio-tools/apppealing-debug.apk
  adb shell pm path com.october.apppealing || true
else mark APPPEALING_APK_INSTALL NO_APK; fi
if [ -f .ixio-tools/frida-server ]; then
  adb push .ixio-tools/frida-server /data/local/tmp/ixio-frida-server
  adb shell 'chmod 755 /data/local/tmp/ixio-frida-server' || true
  if ! adb shell 'pgrep -f ixio-frida-server' >/dev/null; then
    adb shell '/data/local/tmp/ixio-frida-server -D' || true
  fi
  sleep 5
  if [ -x .ixio-tools/venv/bin/frida-ps ]; then
    step FRIDA_USB_LIST .ixio-tools/venv/bin/frida-ps -U
  else mark FRIDA_USB_LIST NO_CLIENT; fi
else mark FRIDA_USB_LIST NO_SERVER; fi
if [ -f .ixio-inputs/main.xapk ] && [ -f .ixio-inputs/recorder.apk ]; then
  mkdir -p .ixio-inputs/main-splits
  if unzip -qq -o .ixio-inputs/main.xapk -d .ixio-inputs/main-splits; then
    mapfile -d '' -t splits < <(find .ixio-inputs/main-splits -maxdepth 2 -type f -name '*.apk' -print0)
    if [ "${#splits[@]}" -gt 0 ]; then
      step IXIO_MAIN_INSTALL adb install-multiple -r "${splits[@]}"
    else
      mark IXIO_MAIN_INSTALL NO_APKS_IN_XAPK
    fi
  else
    mark IXIO_MAIN_INSTALL XAPK_EXTRACTION_FAILED
  fi
  step IXIO_RECORDER_INSTALL adb install -r .ixio-inputs/recorder.apk
  echo "### LSPosed module scope setup"
  if python3 tools/ixio/enable_apppealing_scope.py \
    > ixio-lab-results/lsposed-scope-config.log 2>&1; then
    mark IXIO_LSPOSED_SCOPE PASS
    wait_boot || true
  else
    mark IXIO_LSPOSED_SCOPE FAIL
    tail -60 ixio-lab-results/lsposed-scope-config.log || true
  fi
  if timeout --signal=TERM --kill-after=12s 310 \
    bash tools/ixio/ixio-runtime-capture.sh \
      > ixio-lab-results/ixio-capture-summary.log 2>&1; then
    mark IXIO_RUNTIME_CAPTURE PASS
  else
    mark IXIO_RUNTIME_CAPTURE TIMEOUT_OR_ERROR
    tail -65 ixio-lab-results/ixio-capture-summary.log || true
  fi
else
  mark IXIO_TARGET_INPUTS MISSING
fi
for p in com.lguplus.aicallagent com.lguplus.callrecorder; do
  if adb shell pm path "$p" 2>/dev/null | grep -q package:; then
    mark "TARGET_$p" INSTALLED
  else mark "TARGET_$p" MISSING; fi
done
adb shell getprop ro.dalvik.vm.native.bridge > ixio-lab-results/nativebridge.txt || true
adb shell getprop ro.product.cpu.abilist > ixio-lab-results/abilist.txt || true
adb logcat -d -t 700 -s 'AppSealing:*' 'LSPosed:*' 'Frida:*' > ixio-lab-results/logcat_filtered.txt 2>&1 || true
echo "STEPS_WITH_FAILURE=$fail" | tee -a ixio-lab-results/summary.env
