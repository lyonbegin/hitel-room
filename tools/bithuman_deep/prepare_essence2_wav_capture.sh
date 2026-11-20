#!/usr/bin/env bash
set -euo pipefail
mkdir -p "$(dirname "$QEMU_WAV_PATH")"
RAW="${QEMU_WAV_PATH%.fifo}.raw"
python3 tools/bithuman_deep/capture_qemu_wav_stream.py collect --pipe "$QEMU_WAV_PATH" --raw "$RAW" > "${RAW%.raw}-recorder.txt" 2>&1 &
for i in $(seq 1 50); do
  if [ -f "${RAW%.raw}.ready" ]; then
    test -p "$QEMU_WAV_PATH"
    echo PASS_CONTINUOUS_ACTUAL_QEMU_WAV_CAPTURE_READY
    exit 0
  fi
  sleep 0.1
done
cat "${RAW%.raw}-recorder.txt"
exit 22
