#!/usr/bin/env bash
# Run ONLY after an Android emulator has booted. Invoke via explicit "bash" from
# reactivecircus/android-emulator-runner; action scripts otherwise run /usr/bin/sh.
# Do not interpret unsupported x86_64 ABI as a damaged original ARM64 SDK.
set -euo pipefail

dir=reports/expression2-reassembled-emulator
mkdir -p "$dir"
adb wait-for-device
adb shell getprop ro.product.cpu.abilist | tee "$dir/emulator-abis.txt"
adb shell getprop ro.dalvik.vm.native.bridge | tee "$dir/native-bridge.txt"
adb shell getprop ro.build.version.release | tee "$dir/android-version.txt"
adb devices -l | tee "$dir/adb-devices.txt"
adb shell pm list packages | grep 'com.example.x2hello' > "$dir/package-before.txt" || true

original="build/reassembled-vendor-example/official-app-reassembled-sdk.apk"
patched="build/patched-vendor-example/expression2-original-jvm-text-patch.apk"
count=0
launched=0
expected_unsupported=0

for variant in original patched; do
  if [[ "$variant" == "original" ]]; then apk="$original"; else apk="$patched"; fi
  test -s "$apk" || { echo "MISSING_APK:$apk"; exit 2; }
  mkdir -p "$dir/$variant"
  unzip -t "$apk" > "$dir/$variant/apk-zip-test.txt"
  unzip -Z1 "$apk" > "$dir/$variant/apk-contents.txt"
  grep -Fx 'lib/arm64-v8a/libexpr2jni.so' "$dir/$variant/apk-contents.txt"
  grep -Fx 'lib/arm64-v8a/libLiteRt.so' "$dir/$variant/apk-contents.txt"
  sha256sum "$apk" > "$dir/$variant/apk-sha256.txt"
  adb shell am force-stop com.example.x2hello || true
  adb uninstall com.example.x2hello > "$dir/$variant/uninstall-prior.txt" 2>&1 || true
  adb logcat -c || true

  set +e
  adb install -r "$apk" > "$dir/$variant/install.txt" 2>&1
  install_code=$?
  set -e
  cat "$dir/$variant/install.txt"
  printf '%s\n' "$install_code" > "$dir/$variant/install-exit-code.txt"
  if [[ "$install_code" -ne 0 ]]; then
    if grep -q 'INSTALL_FAILED_NO_MATCHING_ABIS' "$dir/$variant/install.txt"; then
      echo "INCOMPATIBLE_X86_EMULATOR_OR_MISSING_NATIVE_TRANSLATION_EXPECTED_FOR_ARM64_ONLY_APK" \
        > "$dir/$variant/outcome.txt"
      expected_unsupported=$((expected_unsupported+1))
      continue
    fi
    echo "APK_INSTALL_FAILED_UNEXPECTED" > "$dir/$variant/outcome.txt"
    exit 1
  fi
  count=$((count+1))
  echo "APK_INSTALL_SUCCESS" > "$dir/$variant/outcome.txt"

  set +e
  adb shell am start -W -n com.example.x2hello/.MainActivity \
    > "$dir/$variant/launch.txt" 2>&1
  start_code=$?
  set -e
  cat "$dir/$variant/launch.txt"
  if [[ "$start_code" -ne 0 ]] || grep -qE 'Error type|Exception occurred|Activity class .* does not exist' "$dir/$variant/launch.txt"; then
    echo "ACTIVITY_START_FAILED" >> "$dir/$variant/outcome.txt"
    exit 1
  fi
  launched=$((launched+1))
  sleep 12
  adb logcat -d -v time > "$dir/$variant/full-logcat.txt"
  adb shell pidof com.example.x2hello > "$dir/$variant/pid.txt" || true
  adb shell dumpsys activity activities > "$dir/$variant/activities.txt" || true
  adb shell screencap -p /sdcard/expression2-smoke.png || true
  adb pull /sdcard/expression2-smoke.png "$dir/$variant/screenshot.png" || true
  grep -Ei 'EXPR2|EXPRESSION2|X2HELLO|appsealing|protect|native bridge|UnsatisfiedLinkError' \
    "$dir/$variant/full-logcat.txt" > "$dir/$variant/filtered-logcat.txt" || true

  if grep -E 'FATAL EXCEPTION|UnsatisfiedLinkError|NoClassDefFoundError|VerifyError' \
    "$dir/$variant/filtered-logcat.txt" "$dir/$variant/full-logcat.txt" \
    > "$dir/$variant/runtime-errors.txt"; then
    echo "RUNTIME_CLASS_OR_NATIVE_LOAD_FAILURE" >> "$dir/$variant/outcome.txt"
    cat "$dir/$variant/runtime-errors.txt"
    exit 1
  fi
  echo "ACTIVITY_LAUNCH_NO_DETECTED_FATAL_EXCEPTION" >> "$dir/$variant/outcome.txt"
  if [[ "$variant" == "patched" ]] && grep -Fq 'HITEL_EXPRESSION2_JVM_TEXT_PATCH_OK_20261114' "$dir/$variant/full-logcat.txt";then
    echo "PATCHED_JVM_ERROR_LOG_OBSERVED" >> "$dir/$variant/outcome.txt"
  fi
  echo "AVATAR_MODEL_RENDERING_NOT_ESTABLISHED" >> "$dir/$variant/outcome.txt"
done

{
echo "SDK_ORIGINAL_APK_INSTALL_SUCCESS_COUNT=$count"
echo "ACTIVITY_LAUNCH_SUCCESS_COUNT=$launched"
echo "EXPECTED_ARM64_UNSUPPORTED_INSTALL_COUNT=$expected_unsupported"
echo "HOST_EMULATOR_ARCH=x86_64"
echo "NOTE=SDK_RUNTIME_AND_MODEL_RENDERING_ARE_NOT_PROVEN_ON_ARM64"
} | tee "$dir/SUMMARY.txt"
if [[ "$expected_unsupported" -gt 0 ]]; then
  echo "EMULATOR_ABI_LIMITATION_EXPLICITLY_REPORTED"
fi
