#!/usr/bin/env bash
set -euo pipefail
# Native-only experiment: public Sherpa v2.0.3 plus matching public ONNX Runtime.
# NEVER stage the original IXIO JNI or original IXIO ONNX Runtime in this APK.
test -d speaker-standalone
NDK="${ANDROID_HOME}/ndk/27.2.12479018"
if [ ! -f "$NDK/build/cmake/android.toolchain.cmake" ];then
  yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" 'ndk;27.2.12479018' 'platforms;android-35' 'build-tools;35.0.0' || true
fi
test -f "$NDK/build/cmake/android.toolchain.cmake"
ARCHIVE=/tmp/hitel-sherpa-v2.0.3-android.tar.bz2
curl -fLsS --retry 5 --retry-delay 2 'https://github.com/k2-fsa/sherpa-onnx/releases/download/v2.0.3/sherpa-onnx-v2.0.3-android.tar.bz2' -o "$ARCHIVE"
echo '2a30b222abae6d5cf544df4a1c27944279449c25dbb9c755097189cb45db1df0  /tmp/hitel-sherpa-v2.0.3-android.tar.bz2' | sha256sum -c -
mkdir -p /tmp/hitel-sherpa-v2.0.3/include/sherpa-onnx/c-api
tar -xjf "$ARCHIVE" -C /tmp/hitel-sherpa-v2.0.3
curl -fLsS --retry 4 'https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/v2.0.3/sherpa-onnx/c-api/c-api.h' -o /tmp/hitel-sherpa-v2.0.3/include/sherpa-onnx/c-api/c-api.h
UPSTREAM=/tmp/hitel-sherpa-v2.0.3/jniLibs/arm64-v8a
test -s "$UPSTREAM/libsherpa-onnx-c-api.so"
test -s "$UPSTREAM/libonnxruntime.so"
readelf -hW "$UPSTREAM/libsherpa-onnx-c-api.so" | grep -F AArch64
cmake -S hitel-native-stt -B /tmp/hitel-native-arm64-apk -G Ninja \
 -DCMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake" \
 -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=android-26 \
 -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=OFF \
 -DHITEL_WITH_SHERPA=ON -DHITEL_BUILD_JNI=ON \
 -DSHERPA_HEADER_ROOT=/tmp/hitel-sherpa-v2.0.3/include \
 -DSHERPA_C_API_LIBRARY="$UPSTREAM/libsherpa-onnx-c-api.so"
cmake --build /tmp/hitel-native-arm64-apk --parallel 2
ROOT=speaker-standalone/app/src/main/jniLibs/arm64-v8a
mkdir -p "$ROOT"
if [ -e "$ROOT/libsherpa-onnx-jni.so" ];then
  echo ORIGINAL_IXIO_JNI_MUST_NOT_BE_PACKAGED_IN_NATIVE_EXPERIMENT;exit 40
fi
cp /tmp/hitel-native-arm64-apk/libhitel-native-stt-jni.so "$ROOT/"
cp "$UPSTREAM/libsherpa-onnx-c-api.so" "$ROOT/"
cp "$UPSTREAM/libonnxruntime.so" "$ROOT/"
nm -D "$ROOT/libhitel-native-stt-jni.so" | grep -F Java_app_hitel_speakeronly_NativeSttBridge_nativeOpen
readelf -dW "$ROOT/libhitel-native-stt-jni.so" | grep -F libsherpa-onnx-c-api.so
gradle -p speaker-standalone :app:assembleDebug --no-daemon
APK=speaker-standalone/app/build/outputs/apk/debug/app-debug.apk
test -s "$APK"
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose "$APK"
"$ANDROID_HOME/build-tools/35.0.0/aapt" dump badging "$APK" | tee /tmp/hitel-native-apk-badging.txt
grep -F 'app.hitel.recording.ixio.nativestt.experiment' /tmp/hitel-native-apk-badging.txt
unzip -t "$APK" >/dev/null
unzip -Z1 "$APK" > /tmp/hitel-native-apk-files.txt
for LIB in libhitel-native-stt-jni.so libsherpa-onnx-c-api.so libonnxruntime.so libfaad2-growing-pcm.so;do
  grep -Fx "lib/arm64-v8a/$LIB" /tmp/hitel-native-apk-files.txt
done
if grep -F 'lib/arm64-v8a/libsherpa-onnx-jni.so' /tmp/hitel-native-apk-files.txt;then
  echo ORIGINAL_IXIO_JNI_CONFLICT_DETECTED;exit 41
fi
if grep -F 'assets/ixio/ixio-original-sdk.jar' /tmp/hitel-native-apk-files.txt;then
  echo ORIGINAL_IXIO_SDK_CONFLICT_DETECTED;exit 42
fi
OUT=speaker-standalone/dist/HITEL_NativeSTT_OriginalModel_Experiment_20261123.apk
mkdir -p speaker-standalone/dist
cp "$APK" "$OUT"
(cd speaker-standalone/dist && sha256sum HITEL_NativeSTT_OriginalModel_Experiment_20261123.apk > NATIVE_STT_SHA256.txt)
echo VERIFIED_SIGNED_ISOLATED_NATIVE_STT_EXPERIMENT_APK
