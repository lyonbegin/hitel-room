#!/usr/bin/env bash
# Existing Flutter text input -> local mock server -> official WAV PCM -> original Essence2.
set -euo pipefail
APK="$1"
OUT="$2"
test -s "$APK"
mkdir -p "$OUT/boot" "$OUT/speech"
bash tools/bithuman_deep/essence2_hitel_no_key_boot_probe.sh "$APK" "$OUT/boot"
echo PASS_WG128_OLD_APP_AUTH_SOFIA_GPU_BOOT
bash tools/bithuman_deep/essence2_android_speech_turn_probe.sh "$OUT/speech"
echo PASS_ORIGINAL_TEXT_INPUT_AND_ORIGINAL_SPEECH_PRESENTER
adb logcat -d -v threadtime > "$OUT/all-logcat.txt"
adb shell run-as ai.bithuman.example.avatar_chat.essence2 \
    cat ./app_flutter/hitel_e2_trace.log > "$OUT/native-trace.txt" || true
adb shell run-as ai.bithuman.example.avatar_chat.essence2 \
    cat ./app_flutter/hitel_ai_e2e.log > "$OUT/local-server-events.txt" || true
adb exec-out screencap -p > "$OUT/speech-finish.png" || true
python3 - "$OUT" <<'PY'
from pathlib import Path
import sys,re,json
p=Path(sys.argv[1])
log=(p/'all-logcat.txt').read_text(errors='replace')
native=(p/'native-trace.txt').read_text(errors='replace') if (p/'native-trace.txt').exists() else ''
speech=(p/'speech/full-after-speech-logcat.txt').read_text(errors='replace')
local=(p/'local-server-events.txt').read_text(errors='replace') if (p/'local-server-events.txt').exists() else ''
text='\n'.join((log,native,speech,local))
checks={
    'originalWavLoaded': 'OFFICIAL_WAV_PCM_READY' in text,
    'originalChatSubmitted': 'ui.text.submit' in text or 'mock.rx type=response.create' in text,
    'localServerResponseStart': 'official.wav.begin' in text,
    'localServerSendsPCM': 'official.wav.first_pcm' in text,
    'originalPCMFeed': bool(re.search(r'\bbhfeed\b.*\+[1-9]',text)),
    'speechFramePresented': bool(re.search(r'speechWritten=[1-9][0-9]*.*speechPresented=[1-9][0-9]*',text)),
    'originalHardwareRoute': 'hardwareOutput' in text or 'nativeHwBuffer' in text,
    'noFatalCrash': not bool(re.search(r'FATAL EXCEPTION|UnsatisfiedLinkError|OFFICIAL_WAV_PCM_FAILED',text))
}
(p/'e2e-result.json').write_text(json.dumps(checks,indent=2,ensure_ascii=False)+'\n')
print(json.dumps(checks,indent=2,ensure_ascii=False))
if not all(checks.values()):
    raise SystemExit('FAIL_ORIGINAL_CHAT_TO_LOCAL_WAV_TO_ESSENCE2_NOT_FULLY_VERIFIED')
print('PASS_WG128_ORIGINAL_LOCAL_INPUT_OFFICIAL_WAV_PCM_NATIVE_SPEECH')
PY
