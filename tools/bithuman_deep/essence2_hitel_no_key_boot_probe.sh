#!/usr/bin/env bash
set -euo pipefail
APK="${1:?APK path}"
OUT="${2:?output directory}"
PACKAGE=ai.bithuman.example.avatar_chat.essence2
mkdir -p "$OUT"
adb shell svc wifi disable
adb shell svc data disable
bash tools/bithuman_deep/essence2_android_emulator_smoke.sh "$APK" "$OUT"
for attempt in $(seq 1 60); do
  adb shell run-as "$PACKAGE" cat ./app_flutter/boot_status.txt > "$OUT/no-key-boot.txt"
  if grep -q 'boot:session:open' "$OUT/no-key-boot.txt"; then break; fi
  if ! adb shell pidof "$PACKAGE" | grep -q '[0-9]'; then
    echo FAIL_HITEL_LOCAL_APP_EXITED
    exit 21
  fi
  sleep 5
done
grep -Fq 'hitel:essence2:local_test_session_started' "$OUT/no-key-boot.txt"
grep -Fq 'boot:load:ok' "$OUT/no-key-boot.txt"
grep -Fq 'boot:session:open' "$OUT/no-key-boot.txt"
if grep -Eq 'boot:refuse|boot:error|metering_no_credential' "$OUT/no-key-boot.txt"; then
  echo FAIL_HITEL_NO_KEY_BOOT
  exit 22
fi
adb exec-out screencap -p > "$OUT/hitel-session-open.png"
python3 - "$OUT" <<'PY'
import json, pathlib, sys
out=pathlib.Path(sys.argv[1])
result={
 'installed':True,'network_disabled':True,
 'hitel_session_started':True,'native_model_loaded':True,'local_websocket_open':True,
 'vendor_api_secret_entered':False,'vendor_api_secret_input_required':False,
 'native_lipsync_quality_verified':False,'physical_audibility_verified':False,
}
(out/'hitel-no-key-result.json').write_text(json.dumps(result,indent=2)+'\n')
print('PASS_HITEL_NO_KEY_INSTALLED_MODEL_LOADED_AND_LOCAL_SESSION_OPEN')
PY
