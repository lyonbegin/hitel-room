#!/usr/bin/env bash
set -euo pipefail
for exe in cmake ninja ffmpeg cc python3; do command -v "$exe" || { echo "MISSING_BUILD_TOOL=$exe"; exit 19; }; done
NDK="$ANDROID_HOME/ndk/27.2.12479018"
if [ ! -x "$NDK/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android26-clang" ]; then
  (yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --install "ndk;27.2.12479018" "platforms;android-35" "build-tools;35.0.0") || true
fi
test -x "$NDK/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android26-clang"
curl -fLsS --retry 4 https://codeload.github.com/knik0/faad2/tar.gz/refs/tags/2.11.4 -o /tmp/faad2-2.11.4.tar.gz
FAAD=/tmp/ixio-faadv12-src
mkdir -p "$FAAD"
tar -xzf /tmp/faad2-2.11.4.tar.gz -C "$FAAD" --strip-components=1
test -s "$FAAD/libfaad/decoder.c"
mkdir -p speaker-standalone/app/src/main/assets/licenses
cp "$FAAD/COPYING" speaker-standalone/app/src/main/assets/licenses/FAAD2_GPLv2.txt
printf 'Code from FAAD2 is copyright (c) Nero AG, www.nero.com\nSource: https://github.com/knik0/faad2 tag 2.11.4\n' \
  > speaker-standalone/app/src/main/assets/licenses/FAAD2_UPSTREAM.txt
cmake -S "$FAAD" -B /tmp/faadv12-host -G Ninja -D CMAKE_BUILD_TYPE=Release -D BUILD_SHARED_LIBS=OFF -D BUILD_FAAD_CLI=OFF
cmake --build /tmp/faadv12-host --target faad --parallel 4
STATIC="$(find /tmp/faadv12-host -type f -name libfaad.a | head -1)"
test -s "$STATIC"
cc -O2 -std=c11 -Wall -Wextra -I"$FAAD/include" \
  speaker-standalone/native/faad2_growing_m4a_pcm.c "$STATIC" -lm -o /tmp/faadv12-host-decoder
ffmpeg -hide_banner -loglevel error -f lavfi \
  -i 'sine=frequency=440:sample_rate=48000:duration=6' \
  -ac 1 -c:a aac -b:a 64000 -y /tmp/faadv12-healthy.m4a
python3 - <<'PY'
from pathlib import Path
p=Path('/tmp/faadv12-healthy.m4a').read_bytes()
out=bytearray();i=0;atoms=[]
while i+8<=len(p):
    n=int.from_bytes(p[i:i+4],'big');typ=p[i+4:i+8]
    if n==1:n=int.from_bytes(p[i+8:i+16],'big')
    elif n==0:n=len(p)-i
    assert n>=8 and i+n<=len(p),(i,n,typ)
    atoms.append(typ.decode('latin1'))
    if typ!=b'moov':out+=p[i:i+n]
    i+=n
assert 'moov' in atoms and 'mdat' in atoms
Path('/tmp/faadv12-no-moov.m4a').write_bytes(out)
print('FAAD2_NO_MOOV_SOURCE_ATOMS',atoms)
PY
if ! timeout 90 /tmp/faadv12-host-decoder /tmp/faadv12-no-moov.m4a --complete > /tmp/faadv12-complete.pcm 2> /tmp/faadv12-complete.log; then
  echo FAILED_EXTERNAL_FAAD2_DECODE_TEST;tail -60 /tmp/faadv12-complete.log;exit 20
fi
tail -15 /tmp/faadv12-complete.log
test "$(stat -c %s /tmp/faadv12-complete.pcm)" -gt 450000
grep -F FAAD2_COMPLETE /tmp/faadv12-complete.log
echo PASS_UPSTREAM_FAAD2_RAW_M4A_NO_MOOV_TO_PCM16
python3 - <<'PY'
from pathlib import Path
import subprocess,time
source=Path('/tmp/faadv12-no-moov.m4a').read_bytes()
with Path('/tmp/faadv12-growing.m4a').open('wb') as growing, \
     Path('/tmp/faadv12-growing.pcm').open('wb') as pcm, \
     Path('/tmp/faadv12-growing.log').open('wb') as logs:
    process=subprocess.Popen(['/tmp/faadv12-host-decoder','/tmp/faadv12-growing.m4a'],stdout=pcm,stderr=logs)
    try:
        for i in range(0,len(source),907):
            growing.write(source[i:i+907]);growing.flush()
            time.sleep(.005)
        time.sleep(1)
    finally:
        process.terminate()
        try:process.wait(timeout=4)
        except subprocess.TimeoutExpired:process.kill();process.wait()
full=Path('/tmp/faadv12-complete.pcm').stat().st_size
grow=Path('/tmp/faadv12-growing.pcm').stat().st_size
print('FAAD2_GROWING_TEST',full,grow)
assert grow>450000 and abs(full-grow)<=4096,(full,grow)
PY
tail -15 /tmp/faadv12-growing.log
echo PASS_FAAD2_INCREASING_M4A_PCM_EQUALS_COMPLETE_M4A
cmake -S "$FAAD" -B /tmp/faadv12-arm64 -G Ninja \
 -D CMAKE_BUILD_TYPE=Release -D BUILD_SHARED_LIBS=OFF -D BUILD_FAAD_CLI=OFF \
 -D CMAKE_TOOLCHAIN_FILE="$NDK/build/cmake/android.toolchain.cmake" \
 -D ANDROID_ABI=arm64-v8a -D ANDROID_PLATFORM=android-26
cmake --build /tmp/faadv12-arm64 --target faad --parallel 4
STATIC="$(find /tmp/faadv12-arm64 -type f -name libfaad.a | head -1)"
test -s "$STATIC"
ROOT=speaker-standalone/app/src/main/jniLibs/arm64-v8a
mkdir -p "$ROOT"
LLVM="$NDK/toolchains/llvm/prebuilt/linux-x86_64/bin"
"$LLVM/aarch64-linux-android26-clang" -O2 -std=c11 -fPIE -pie \
 -I"$FAAD/include" speaker-standalone/native/faad2_growing_m4a_pcm.c \
 "$STATIC" -lm -o "$ROOT/libfaad2-growing-pcm.so"
"$LLVM/llvm-readelf" -h "$ROOT/libfaad2-growing-pcm.so" | grep -F 'AArch64'
"$LLVM/llvm-readelf" -d "$ROOT/libfaad2-growing-pcm.so" > /tmp/faadv12-needed.txt
! grep -F 'libavcodec' /tmp/faadv12-needed.txt
echo PASS_GITHUB_FAAD2_ANDROID_ARM64_NO_FFMPEG
