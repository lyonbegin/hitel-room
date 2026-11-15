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
    step IXIO_MAIN_INSTALL adb install-multiple -r .ixio-inputs/main-splits/base.apk .ixio-inputs/main-splits/split_0.apk .ixio-inputs/main-splits/split_1.apk .ixio-inputs/main-splits/split_2.apk
  else
    mark IXIO_MAIN_INSTALL XAPK_EXTRACTION_FAILED
  fi
  step IXIO_RECORDER_INSTALL adb install -r .ixio-inputs/recorder.apk
  adb shell pm list packages | grep -E 'com.lguplus.(aicallagent|callrecorder)' || true
  for p in com.lguplus.aicallagent com.lguplus.callrecorder; do
    echo "### Launch $p"
    adb shell monkey -p "$p" 1 || true
    sleep 8
    adb shell pidof "$p" || true
    mkdir -p "ixio-lab-results/$p"
    if [ -x .ixio-tools/venv/bin/clsdumper ]; then
      (timeout 75 .ixio-tools/venv/bin/clsdumper "$p" --spawn -o "ixio-lab-results/$p/local-dump" -d > "ixio-lab-results/$p/dump-attempt.log" 2>&1 || true)
      if [ -f "ixio-lab-results/$p/local-dump/metadata.json" ]; then
        python3 -c 'import json,sys; p=sys.argv[1]; j=json.load(open(p)); print(json.dumps({"target":sys.argv[2],"metadata_keys":list(j.keys()),"dump_file_count":len(list(__import__("pathlib").Path(p).parent.glob("dex/*.dex")))}))' "ixio-lab-results/$p/local-dump/metadata.json" "$p" | tee "ixio-lab-results/$p/dump-summary.json" || true
      fi
      if find "ixio-lab-results/$p/local-dump/dex" -type f -name '*.dex' -print -quit 2>/dev/null | grep -q .; then
        tar -czf "ixio-lab-results/$p/local-dump.tar.gz" -C "ixio-lab-results/$p/local-dump" .
        if openssl cms -encrypt -binary -aes256 \
          -in "ixio-lab-results/$p/local-dump.tar.gz" \
          -out "ixio-lab-results/$p/DEX_ENCRYPTED.cms" -outform DER \
          -recip tools/ixio/dump-public-20261115.crt; then
          mark "DEX_DUMP_$p" ENCRYPTED_FOR_USER_ONLY
        else
          mark "DEX_DUMP_$p" ENCRYPTION_FAILED
          rm -f "ixio-lab-results/$p/DEX_ENCRYPTED.cms"
        fi
        rm -f "ixio-lab-results/$p/local-dump.tar.gz"
      else
        mark "DEX_DUMP_$p" NO_RUNTIME_DEX_FOUND
      fi
      # Never expose plaintext third-party DEX on a public GitHub Actions artifact.
      rm -rf "ixio-lab-results/$p/local-dump"
    else
      mark "DUMP_$p" CLSDUMPER_NOT_INSTALLED
    fi
  done
elif [ -d .ixio-inputs/play-main ] && [ -d .ixio-inputs/play-recorder ]; then
  mapfile -d '' -t main_apks < <(find .ixio-inputs/play-main -type f -name '*.apk' -print0)
  mapfile -d '' -t recorder_apks < <(find .ixio-inputs/play-recorder -type f -name '*.apk' -print0)
  if [ "${#main_apks[@]}" -gt 0 ]; then
    step IXIO_MAIN_PLAY_INSTALL adb install-multiple -r "${main_apks[@]}"
  else
    mark IXIO_MAIN_PLAY_INSTALL NO_VERSION_MATCH_DOWNLOAD
  fi
  if [ "${#recorder_apks[@]}" -gt 0 ]; then
    step IXIO_RECORDER_PLAY_INSTALL adb install-multiple -r "${recorder_apks[@]}"
  else
    mark IXIO_RECORDER_PLAY_INSTALL NO_VERSION_MATCH_DOWNLOAD
  fi
  for p in com.lguplus.aicallagent com.lguplus.callrecorder; do
    mkdir -p "ixio-lab-results/$p"
    adb shell dumpsys package "$p" | grep -E 'versionName=|primaryCpuAbi=|versionCode=' | head -12 > "ixio-lab-results/$p/installed-package.txt" || true
    adb shell monkey -p "$p" 1 || true
    sleep 8
    adb shell pidof "$p" || true
    if [ -x .ixio-tools/venv/bin/clsdumper ]; then
      (timeout 90 .ixio-tools/venv/bin/clsdumper "$p" --spawn -o "ixio-lab-results/$p/local-dump" -d > "ixio-lab-results/$p/dump-attempt.log" 2>&1 || true)
      if [ -f "ixio-lab-results/$p/local-dump/metadata.json" ]; then
        python3 -c 'import json,sys; p=sys.argv[1]; j=json.load(open(p)); print(json.dumps({"target":sys.argv[2],"metadata_keys":list(j.keys()),"dump_file_count":len(list(__import__("pathlib").Path(p).parent.glob("dex/*.dex")))}))' "ixio-lab-results/$p/local-dump/metadata.json" "$p" | tee "ixio-lab-results/$p/dump-summary.json" || true
      fi
      if find "ixio-lab-results/$p/local-dump/dex" -type f -name '*.dex' -print -quit 2>/dev/null | grep -q .; then
        tar -czf "ixio-lab-results/$p/local-dump.tar.gz" -C "ixio-lab-results/$p/local-dump" .
        if openssl cms -encrypt -binary -aes256 \
          -in "ixio-lab-results/$p/local-dump.tar.gz" \
          -out "ixio-lab-results/$p/DEX_ENCRYPTED.cms" -outform DER \
          -recip tools/ixio/dump-public-20261115.crt; then
          mark "DEX_DUMP_$p" ENCRYPTED_FOR_USER_ONLY
        else
          mark "DEX_DUMP_$p" ENCRYPTION_FAILED
          rm -f "ixio-lab-results/$p/DEX_ENCRYPTED.cms"
        fi
        rm -f "ixio-lab-results/$p/local-dump.tar.gz"
      else
        mark "DEX_DUMP_$p" NO_RUNTIME_DEX_FOUND
      fi
      rm -rf "ixio-lab-results/$p/local-dump"
    fi
  done
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
