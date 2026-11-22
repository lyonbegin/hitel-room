#!/usr/bin/env bash
# Convert a legally obtained, already-decrypted iOS .ipa for an Apple Silicon simulator.
# Requires a built copy of the original EthanArbuckle/simforge CLI.
set -Eeuo pipefail

usage() {
  cat <<'USAGE'
Usage: convert-decrypted-ios-ipa.sh /absolute/path/to/decrypted.ipa /absolute/path/to/simforge /output/directory [simulator-udid]
The input IPA must already be decrypted and authorized for testing.
This tool does not download applications, log in to Apple, or defeat App Store encryption.
Output: converted .app.zip and the simulator launch/capture logs.
USAGE
}
if [[ ${1:-} == "--help" || $# -lt 3 ]]; then usage; [[ ${1:-} == "--help" ]] && exit 0 || exit 2; fi
IPA="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
SIMFORGE="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
OUTPUT="$3"
UDID="${4:-booted}"
[[ -f "$IPA" && "$IPA" == *.ipa ]] || { echo 'ERROR: Provide a real decrypted .ipa file' >&2; exit 2; }
[[ -x "$SIMFORGE" ]] || { echo 'ERROR: simforge executable not found' >&2; exit 2; }
command -v xcrun >/dev/null || { echo 'ERROR: macOS Xcode is required' >&2; exit 2; }
command -v codesign >/dev/null || { echo 'ERROR: codesign is required' >&2; exit 2; }
mkdir -p "$OUTPUT"
OUTPUT="$(cd "$OUTPUT" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Unzip without leaving the temporary directory, and reject malformed bundles.
unzip -qq "$IPA" -d "$WORK"
mapfile -d '' APPS < <(find "$WORK/Payload" -mindepth 1 -maxdepth 1 -type d -name '*.app' -print0 2>/dev/null)
[[ ${#APPS[@]} -eq 1 ]] || { echo 'ERROR: IPA must contain exactly one Payload/*.app bundle' >&2; exit 3; }
APP="${APPS[0]}"
ID="$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP/Info.plist")"
[[ -n "$ID" ]] || { echo 'ERROR: bundle identifier missing' >&2; exit 3; }
echo "IOS_APP_BUNDLE_ID=$ID"
echo "SIMFORGE_CONVERT_BEGIN"
"$SIMFORGE" convert "$APP" 2>&1 | tee "$OUTPUT/simforge-convert.log"

# Sign nested app bundles and frameworks from deepest to shallowest after Mach-O edits.
while IFS= read -r -d '' ITEM; do
  codesign --force --sign - --timestamp=none "$ITEM" >> "$OUTPUT/codesign.log" 2>&1 || {
    echo "ERROR: nested codesign failed for $ITEM" >&2; exit 4;
  }
done < <(find "$APP" -mindepth 1 \( -name '*.appex' -o -name '*.framework' -o -name '*.dylib' \) -print0 |   perl -0ne 'print join("", reverse split /(?<=\\0)/)' 2>/dev/null)
codesign --force --deep --sign - --timestamp=none "$APP" >> "$OUTPUT/codesign.log" 2>&1
codesign --verify --deep --strict "$APP" >> "$OUTPUT/codesign.log" 2>&1

(
 cd "$WORK/Payload"
 zip -qry "$OUTPUT/$(basename "$APP").zip" "$(basename "$APP")"
)
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" "$ID" 2>&1 | tee "$OUTPUT/launch.txt"
sleep 5
xcrun simctl io "$UDID" screenshot "$OUTPUT/converted-app-screen.png"
echo "PASS: Converted app signed, installed and launch requested: $ID"
