#!/usr/bin/env bash
# Build pinned upstream MIT ws-scrcpy in a disposable KVM runner.
set -Eeuo pipefail
ROOT="$(pwd)"
UPSTREAM="$ROOT/.cache/hitel-ws-scrcpy"
PIN="cd6cea6ebde17af6685c2b325183fc24bef9d52b"
mkdir -p "$ROOT/.cache" "$ROOT/mobile-test-results/ws-scrcpy"
if [[ ! -d "$UPSTREAM/.git" ]]; then
  git clone --quiet --depth 1 https://github.com/NetrisTV/ws-scrcpy.git "$UPSTREAM"
fi
git -C "$UPSTREAM" fetch --quiet --depth 1 origin "$PIN" || true
git -C "$UPSTREAM" checkout --quiet "$PIN"
[[ "$(git -C "$UPSTREAM" rev-parse HEAD)" == "$PIN" ]] || { echo WS_SCRCPY_PIN_MISMATCH; exit 31; }
cat > "$UPSTREAM/build.config.override.json" <<'JSON'
{
  "INCLUDE_APPL": false,
  "INCLUDE_GOOG": true,
  "INCLUDE_ADB_SHELL": false,
  "INCLUDE_DEV_TOOLS": false,
  "INCLUDE_FILE_LISTING": false,
  "USE_QVH_SERVER": false,
  "USE_WDA_MJPEG_SERVER": false,
  "USE_BROADWAY": false,
  "USE_H264_CONVERTER": true,
  "USE_TINY_H264": false,
  "USE_WEBCODECS": true,
  "SCRCPY_LISTENS_ON_ALL_INTERFACES": false,
  "PATHNAME": "/"
}
JSON
cat > "$UPSTREAM/hitel.yaml" <<'YAML'
runGoogTracker: true
announceGoogTracker: true
runApplTracker: false
announceApplTracker: false
server:
  - secure: false
    port: 8000
YAML
echo WS_SCRCPY_UPSTREAM_PIN_CONFIRMED "$PIN"
cd "$UPSTREAM"
npm ci --omit=optional --ignore-scripts --no-audit --no-fund
npm run dist
cd dist
npm install --omit=optional --ignore-scripts --no-audit --no-fund
test -s index.js
test -s public/index.html
test -s public/bundle.js
test -s vendor/Genymobile/scrcpy/scrcpy-server.jar
echo WS_SCRCPY_UPSTREAM_BUILD_PASS
