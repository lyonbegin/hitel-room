#!/usr/bin/env bash
# Generate an ORIGINAL spoken-English test sentence without cloud TTS or keys.
# eSpeak generates acoustic phonemes (not a 180 Hz synthetic sine); ffmpeg
# converts the output to raw mono PCM16 @ 24 kHz for original SDK test feed.
set -euo pipefail
OUT="${1:?24k PCM output path}"
command -v espeak >/dev/null
command -v ffmpeg >/dev/null
mkdir -p "$(dirname "$OUT")"
TMP="$(mktemp --suffix=.wav)"
trap 'rm -f "$TMP"' EXIT
espeak -v en-us -s 145 -w "$TMP" \
  "Hello, this is a spoken language test. I am speaking clearly so the avatar should move its mouth, close its lips and follow every syllable. This test checks real speech input instead of a sine wave."
ffmpeg -y -loglevel error -i "$TMP" -ar 24000 -ac 1 -f s16le "$OUT"
python3 - "$OUT" <<'PY'
from pathlib import Path
import sys, struct, math
s=Path(sys.argv[1]).read_bytes()
assert len(s)%2==0 and len(s)>=24000*2*5, "Voice test too short"
samples=struct.unpack('<'+str(len(s)//2)+'h',s)
peak=max(abs(x) for x in samples)
rms=math.sqrt(sum(x*x for x in samples)/len(samples))
assert peak>1000 and rms>300, ("Insufficient voiced energy",peak,rms)
print("PASS_REAL_VOICED_TEST_PCM24K",len(s),"bytes",len(s)/48000,"seconds","peak",peak,"rms",round(rms))
PY
sha256sum "$OUT"
