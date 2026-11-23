#!/usr/bin/env bash
set -euo pipefail
ENGINE=speaker-standalone/app/src/main/java/app/hitel/speakeronly/SpeakerEngine.java
SOURCE=speaker-standalone/app/src/main/java/app/hitel/speakeronly/GithubFaad2PcmSource.java
STT=speaker-standalone/app/src/main/java/app/hitel/speakeronly/DirectPcmKoreanStt.java
grep -F 'FAAD2_NEWEST_RECORDING_SELECTED' "$ENGINE"
grep -F 'faadSource.pump(context,mirror,!folder' "$ENGINE"
grep -F 'CHUNK_SAMPLES=512' "$SOURCE"
grep -F 'pcmFill==CHUNK_BYTES' "$SOURCE"
grep -F 'LinkedBlockingQueue<byte[]>' "$STT"
grep -F 'PcmReadyLatestGate.trimPreReadyBacklog(queue)' "$STT"
grep -F 'queue.poll(32,TimeUnit.MILLISECONDS)' "$STT"
grep -F 'IXIO_FIRST_READY_LATEST_PCM_SNAPSHOT' "$STT"
grep -F 'IXIO_FIRST_READY_NEWEST_PCM_SELECTED' "$STT"
grep -F 'recognizer.finishAndWait()' "$ENGINE"
grep -F 'com.lguplus.ixispeech_ktn.speechSDK' "$STT"
if grep -E 'aac_mdat_follow|followPcm\(|codec.feedAdtsFrame|LIVE_PLAYBACK_CUTOFF|requiredPositiveGrowthEvents|StreamingAacPcmDecoder' "$ENGINE";then
  echo ERROR_OLD_AAC_PATH_EXECUTABLE;exit 1
fi
mkdir -p /tmp/ixio-faadv12-junit
javac -d /tmp/ixio-faadv12-junit \
 speaker-standalone/app/src/main/java/app/hitel/speakeronly/IxioPcmNormalizer.java \
 speaker-standalone/ci/IxioPcmNormalizerTest.java \
 speaker-standalone/app/src/main/java/app/hitel/speakeronly/PcmReadyLatestGate.java \
 speaker-standalone/ci/PcmReadyLatestGateTest.java
java -cp /tmp/ixio-faadv12-junit app.hitel.speakeronly.IxioPcmNormalizerTest
java -cp /tmp/ixio-faadv12-junit app.hitel.speakeronly.PcmReadyLatestGateTest
mkdir -p /tmp/ixio-faadv12-original /tmp/ixio-faadv12-dex
gh release download ixio-main-original-fgs-prestart-qa-20261122 \
 -R lyonbegin/hitel-room -p IXIO_Main_OriginalFGSPrestartQA_20261122.apk \
 -D /tmp/ixio-faadv12-original
SRC=/tmp/ixio-faadv12-original/IXIO_Main_OriginalFGSPrestartQA_20261122.apk
test -s "$SRC"
unzip -t "$SRC" >/dev/null
unzip -p "$SRC" classes6.dex > /tmp/ixio-faadv12-dex/classes.dex
unzip -p "$SRC" classes16.dex > /tmp/ixio-faadv12-dex/classes2.dex
unzip -p "$SRC" classes9.dex > /tmp/ixio-faadv12-dex/classes3.dex
mkdir -p speaker-standalone/app/src/main/assets/ixio
(cd /tmp/ixio-faadv12-dex && zip -q -0 "$GITHUB_WORKSPACE/speaker-standalone/app/src/main/assets/ixio/ixio-original-sdk.jar" classes.dex classes2.dex classes3.dex)
unzip -p "$SRC" assets/stt/bpe.vocab > speaker-standalone/app/src/main/assets/ixio/bpe.vocab
ROOT=speaker-standalone/app/src/main/jniLibs/arm64-v8a
for LIB in libsherpa-onnx-jni.so libonnxruntime.so;do
  unzip -p "$SRC" "lib/arm64-v8a/$LIB" > "$ROOT/$LIB"
  test -s "$ROOT/$LIB"
done
gradle -p speaker-standalone :app:assembleDebug --no-daemon --stacktrace
APK=speaker-standalone/app/build/outputs/apk/debug/app-debug.apk
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --verbose "$APK"
"$ANDROID_HOME/build-tools/35.0.0/aapt" dump badging "$APK" \
 | grep -F 'app.hitel.recording.ixio.githubfaad2v13'
unzip -Z1 "$APK" > /tmp/ixio-faadv12-apk-files.txt
grep -Fx 'lib/arm64-v8a/libfaad2-growing-pcm.so' /tmp/ixio-faadv12-apk-files.txt
grep -Fx 'lib/arm64-v8a/libsherpa-onnx-jni.so' /tmp/ixio-faadv12-apk-files.txt
grep -Fx 'assets/ixio/ixio-original-sdk.jar' /tmp/ixio-faadv12-apk-files.txt
grep -Fx 'assets/licenses/FAAD2_GPLv2.txt' /tmp/ixio-faadv12-apk-files.txt
if grep -E 'libaac-mdat-follow|libavcodec|libswresample' /tmp/ixio-faadv12-apk-files.txt;then
  echo ERROR_OLD_FFMPEG_LIBS_STILL_PACKAGED;exit 1
fi
mkdir -p speaker-standalone/dist
cp "$APK" speaker-standalone/dist/HITEL_IXIO_GitHub_FAAD2_FirstReadyLatest_V13_20261123.apk
(cd speaker-standalone/dist && sha256sum HITEL_IXIO_GitHub_FAAD2_FirstReadyLatest_V13_20261123.apk > SHA256.txt)
echo PASS_IXIO_V13_FIRST_READY_LATEST_PCM_AND_THEN_FIFO_ARM64_SIGNED_APK
