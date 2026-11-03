#!/usr/bin/env bash
set -euo pipefail
# Exact asset referenced in video-town-front/src/mask/MaskedCamera.ts.
# Pin upstream MindAR 1.2.5 and verify the exact source bytes.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$SCRIPT_DIR/PublicRoomApp/face-mask.png"
URL="https://raw.githubusercontent.com/hiukim/mind-ar-js/v1.2.5/examples/face-tracking/assets/sparkar/face-mask.png"
SHA="bce04e1c6a9e2e3158fbb81ceed25d6987b56c93253bc9895c8fc31a4299523e"
if [[ -f "$OUT" ]] && echo "$SHA  $OUT" | shasum -a 256 --check --status; then
  echo "Original HITEL VideoCore mask asset verified"
  exit 0
fi
mkdir -p "$(dirname "$OUT")"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
curl --fail --location --silent --show-error --retry 3 --retry-delay 1 "$URL" -o "$TMP"
printf '%s  %s\n' "$SHA" "$TMP" | shasum -a 256 --check --status
mv "$TMP" "$OUT"
echo "Pinned original MindAR face-mask.png installed in native iOS sources"
