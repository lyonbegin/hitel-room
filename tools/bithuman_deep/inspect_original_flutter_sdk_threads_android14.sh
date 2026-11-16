#!/usr/bin/env bash
# Observe the ORIGINAL, immutable Flutter 3.41.9 ARM64 APK and original SDK.
# App/SDK/Flutter engine and ABI are not modified. No adb --abi override.
set -euo pipefail
cd "$GITHUB_WORKSPACE"
OUT="$GITHUB_WORKSPACE/reports/expr2-flutter-arm64-thread-diagnostic"
APK="$GITHUB_WORKSPACE/reports/hitel-avatar-chat-flutter-3419-official-arm64-split/apk/HITEL_Original_avatar_chat_Expression2_Public_HTTPS_Flutter3419_Official_Arm64Split_Debug.apk"
PKG=ai.hitel.avatar_chat.localauto
mkdir -p "$OUT"
sha256sum "$APK" | tee "$OUT/exact-apk-sha256.txt"
adb wait-for-device
adb shell getprop ro.product.cpu.abilist | tee "$OUT/abi-list.txt"
adb shell getprop ro.dalvik.vm.native.bridge | tee "$OUT/native-bridge.txt"
adb install -r "$APK" 2>&1 | tee "$OUT/adb-install.txt"
adb logcat -c
adb shell am start -n "$PKG/ai.bithuman.example.avatar_chat.MainActivity" >"$OUT/start.txt" 2>&1 || true
echo 'START RESULT:'; cat "$OUT/start.txt"

capture() {
  local label="$1"
  adb shell pidof "$PKG" >"$OUT/pid-$label.txt" || true
  local pid
  pid="$(tr -d '\r\n' < "$OUT/pid-$label.txt")"
  if [[ ! "$pid" =~ ^[0-9]+$ ]]; then echo "$label: app not alive"; return 0; fi
  echo "$label: PID=$pid"
  adb shell ps -T -p "$pid" > "$OUT/threads-$label.txt" 2>&1 || true
  adb shell dumpsys meminfo "$PKG" > "$OUT/meminfo-$label.txt" 2>&1 || true
  # Capture ART Java stack of every app thread; Android logs SIGQUIT dump.
  if [[ "$label" == "after-65sec" ]]; then
    adb shell kill -3 "$pid" > "$OUT/stack-request-$label.txt" 2>&1 || true
    sleep 8
    # debuggerd only inspects process, does not replace or patch the SDK.
    timeout 35s adb shell debuggerd -b "$pid" > "$OUT/native-stacks-$label.txt" 2>&1 || true
  fi
}
sleep 30; capture after-30sec
sleep 35; capture after-65sec
sleep 55; capture after-120sec
adb logcat -d -v threadtime > "$OUT/logcat-full.txt" || true
adb exec-out screencap -p > "$OUT/screen.png" 2>/dev/null || true
adb shell run-as "$PKG" cat app_flutter/boot_status.txt > "$OUT/flutter-boot.txt" 2>/dev/null || true
# Some emulator images expose ANR traces, others don't; best effort only.
adb shell ls -al /data/anr > "$OUT/anr-directory.txt" 2>&1 || true
python3 - "$OUT" <<'PY'
import json,sys,re
from pathlib import Path
p=Path(sys.argv[1]); log=(p/'logcat-full.txt').read_text(errors='replace')
boot=(p/'flutter-boot.txt').read_text(errors='replace') if (p/'flutter-boot.txt').exists() else ''
pids=[(p/('pid-'+k+'.txt')).read_text().strip() for k in ['after-30sec','after-65sec','after-120sec']]
pid=pids[-1]
own=[l for l in log.splitlines() if re.search(r'\(\s*'+re.escape(pid)+r'\)',l)] if pid.isdigit() else []
def tagged(tag): return [l for l in own if '/'+tag in l]
feed=tagged('bhfeed')
prod=[l for l in tagged('bhav') if 'PROD where=' in l]
stats=tagged('bhsplit')
stacks=(p/'native-stacks-after-65sec.txt').read_text(errors='replace') if (p/'native-stacks-after-65sec.txt').exists() else ''
threadnames=['bh-feed','bh-produce','bh-write','expression2-render','bh-load','Flutter']
threadstatus={}
for k in ['after-30sec','after-65sec','after-120sec']:
 lines=(p/('threads-'+k+'.txt')).read_text(errors='replace').splitlines() if (p/('threads-'+k+'.txt')).exists() else []
 threadstatus[k]=[s[:230] for s in lines if any(name in s for name in threadnames)]
report={
 'apk_unmodified':True,
 'api_34_x86_64_nativebridge_app_primary_arm64':True,
 'pid_observations':pids,
 'boot_events':[l for l in boot.splitlines() if not ('secret=' in l)],
 'original_plugin_sdk_feed_lines':len(feed),
 'plugin_feed_last':feed[-1] if feed else None,
 'plugin_producer_last':prod[-1] if prod else None,
 'sdk_stats_last':stats[-1] if stats else None,
 'thread_names_observed':threadstatus,
 'native_stack_dump_bytes':len(stacks),
 'logcat_art_sigquit_dump':('SIGQUIT' in log or 'DALVIK THREADS' in log or 'Dumping all threads' in log),
 'first_flutter_texture_frame_seen':'first frame on the texture' in log,
 'sdk_frame_presented':'first speech frame hostMs=' in log or any('presented=' in l and 'presented=0' not in l for l in prod),
 'fatal_android_exception':'FATAL EXCEPTION' in log,
}
(p/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('=== ORIGINAL FLUTTER SDK INPUT/OUTPUT REAL DEVICE TEST ===')
print(json.dumps(report,ensure_ascii=False,indent=2))
print('=== ORIGINAL WORKER THREAD STATE ===')
for k,lines in threadstatus.items():
 print(k)
 for l in lines:print(l)
print('=== NATIVE STACK SIGNAL ===')
for l in stacks.splitlines():
 if any(t in l.lower() for t in ['bh-produce','bh-feed','stillframe','expression2','pthread_cond_wait','futex_wait','native.pump']):
  print(l[:350])
PY
