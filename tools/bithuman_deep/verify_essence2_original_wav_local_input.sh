#!/usr/bin/env bash
# Test the original text input, full WAV consumption, animated speech and monitor output.
set -euo pipefail
APK="$1"
OUT="$2"
mkdir -p "$OUT"
bash tools/bithuman_deep/essence2_hitel_no_key_boot_probe.sh "$APK" "$OUT/boot"
parec --device=essence2_test.monitor --rate=16000 --channels=1 --format=s16le > "$OUT/speaker.pcm" &
monitor=$!
trap 'kill "$monitor" 2>/dev/null || true' EXIT
bash tools/bithuman_deep/essence2_android_speech_turn_probe.sh "$OUT/speech"
for ((i=0; i<180; i++)); do
    adb logcat -d -s bhwav:I BithumanAvatar:I bhav:I > "$OUT/playout.txt"
    if grep -q WAV_ERROR "$OUT/playout.txt"; then exit 1; fi
    if grep -q WAV_DRAINED "$OUT/playout.txt"; then break; fi
    sleep 1
done
kill "$monitor"
wait "$monitor" || true
trap - EXIT
python3 - "$OUT" <<'PY'
from array import array
from pathlib import Path
import re, sys, wave
out = Path(sys.argv[1])
log = (out/'playout.txt').read_text()
assert 'WAV_ATTACH' in log and 'WAV_DRAINED' in log
end = re.search(r'WAV_EOF samples=(\d+) played24=(\d+)', log)
assert end and int(end[2]) >= (int(end[1])-32000)*3//2
counts = [int(v) for v in re.findall(r'uniqueShown=(\d+)',log)]
assert counts and max(counts) >= 12, counts
raw = (out/'speaker.pcm').read_bytes()
pcm = array('h', raw)
step = 1600
active = sum(sum(x*x for x in pcm[i:i+step]) > 60**2 * step for i in range(0,len(pcm),step))
assert active >= 35, f'only {active/10}s of audible output'
with wave.open(str(out/'speaker.wav'),'wb') as dst:
    dst.setparams((1,2,16000,0,'NONE',''))
    dst.writeframes(raw)
(out/'speaker.pcm').unlink()
print(f'WAV_DRAINED, {max(counts)} distinct speech frames, {active/10:.1f}s monitor audio')
PY
