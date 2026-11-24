#!/usr/bin/env bash
# Strictly local test. Do not commit or upload the model ZIP, audio, or logs.
# Run: bash tools/ixio-original-private-emulator-regression.sh APK ORIGINAL_STT.zip CALL.m4a
set -euo pipefail
if [ "$#" -ne 3 ]; then echo "Expected: APK STT.zip M4A" >&2; exit 2; fi
APK="$(realpath "$1")"; ZIP="$(realpath "$2")"; M4A="$(realpath "$3")"
PKG=app.hitel.recording.ixio.stablevirtual
OUT="ixio-private-emulator-report-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
WORK="$(mktemp -d)"
REMOTE=/data/local/tmp/ixio_private_original
trap 'adb shell rm -rf "$REMOTE" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
python3 - "$ZIP" "$WORK" <<'PY'
import sys,zipfile,pathlib,shutil
p=pathlib.Path(sys.argv[2])
with zipfile.ZipFile(sys.argv[1]) as z:
 for n in ('encoder.ort','decoder.ort','joiner.ort','vad.onnx','tokens.txt','bpe.vocab'):
  m=[e for e in z.namelist() if e==n or e.endswith('/'+n)]
  if len(m)!=1:raise RuntimeError('Missing or duplicated original IXIO '+n)
  with z.open(m[0]) as src,(p/n).open('wb') as dst:shutil.copyfileobj(src,dst)
  if (p/n).stat().st_size<128:raise RuntimeError('Invalid '+n)
print('PASS_PRIVATE_STT_ZIP_HAS_SIX_MODELS')
PY
adb wait-for-device
adb shell getprop ro.product.cpu.abilist | tee "$OUT/abis.txt"
grep -q arm64-v8a "$OUT/abis.txt"
adb install -r --abi arm64-v8a "$APK" | tee "$OUT/install.txt"
grep -q Success "$OUT/install.txt"
adb shell mkdir -p "$REMOTE"
adb shell run-as "$PKG" mkdir -p files/ixio-stt files/virtual_call
for n in encoder.ort decoder.ort joiner.ort vad.onnx tokens.txt bpe.vocab; do
 adb push "$WORK/$n" "$REMOTE/$n" >/dev/null
 adb shell run-as "$PKG" cp "$REMOTE/$n" "files/ixio-stt/$n"
 expected="$(stat -c %s "$WORK/$n")"
 actual="$(adb shell run-as "$PKG" stat -c %s "files/ixio-stt/$n" | tr -d '\r')"
 test "$expected" = "$actual" || { echo "MODEL_COPY_MISMATCH $n" >&2; exit 3; }
done
adb push "$M4A" "$REMOTE/call.m4a" >/dev/null
adb shell run-as "$PKG" cp "$REMOTE/call.m4a" files/virtual_call/original.m4a
adb shell rm -rf "$REMOTE"
adb logcat -c
adb shell am start -W -n "$PKG/app.hitel.speakeronly.MainActivity" \
 -a app.hitel.speakeronly.VIRTUAL_CALL_REPLAY \
 --ei firstWriteDelayMs 800 --ei periodMs 300 --ei bytesPerPeriod 4900 \
 | tee "$OUT/activity.txt"
for ((n=0;n<65;n++));do
 sleep 5
 adb logcat -d -s GrowingM4aDiag:I IXIO_VIRTUAL_CALL:I '*:S' > "$OUT/progress.log" || true
 grep -q 'IXIO_SESSION_FINAL\|IXIO_SPEECHSDK_FAILURE' "$OUT/progress.log" && break
done
adb logcat -d -v threadtime > "$OUT/logcat.txt"
adb logcat -d -b crash > "$OUT/crash.txt"
adb shell screencap -p /sdcard/Download/ixio-private-original.png
adb pull /sdcard/Download/ixio-private-original.png "$OUT/screen.png" >/dev/null
adb shell run-as "$PKG" find files/diagnostics -name events.jsonl | tr -d '\r' > "$OUT/event-files.txt" || true
: > "$OUT/events.jsonl"
while IFS= read -r f;do
 test -z "$f" && continue
 adb exec-out run-as "$PKG" cat "$f" >> "$OUT/events.jsonl"
done < "$OUT/event-files.txt"
python3 - "$OUT/events.jsonl" "$OUT/stage-report.json" <<'PY'
import sys,json,pathlib
events=[]
for line in pathlib.Path(sys.argv[1]).read_text(errors='replace').splitlines():
 try: events.append(json.loads(line))
 except json.JSONDecodeError: pass
k=('LATEST_M4A_SELECTED_NO_GROWTH_GATE','IXIO_ORIGINAL_SPEECHSDK_READY',
   'IXIO_FIRST_READY_LATEST_PCM_SNAPSHOT','IXIO_SPEECHSDK_TRIPLE_RESULT',
   'IXIO_SESSION_FINAL','IXIO_SPEECHSDK_FAILURE')
times={e:next((x.get('elapsed_ms') for x in events if x.get('event')==e),None) for e in k}
pathlib.Path(sys.argv[2]).write_text(json.dumps({'first_event_elapsed_ms':times,'private_upload':False},indent=2))
print('PRIVATE_IXIO_EMULATOR_TIMELINE',times)
if not(times[k[1]] is not None and times[k[2]] is not None and times[k[3]] is not None):
 raise SystemExit('FAIL_ANDROID_ORIGINAL_STT_NOT_YET_VERIFIED')
print('PASS_ANDROID_ORIGINAL_SPEECHSDK_FIRST_CAPTION')
PY
