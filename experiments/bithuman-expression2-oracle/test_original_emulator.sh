#!/usr/bin/env bash
# Only PASS when the *unmodified* original SDK native function executed
# and numerical discrepancies for identical PCM vectors were measured.
set -euo pipefail
OUT="$GITHUB_WORKSPACE/reports/expression2-original-oracle"
APK="$GITHUB_WORKSPACE/build/oracle/expression2-original-preprocessor-oracle.apk"
mkdir -p "$OUT"
test -s "$APK"
adb wait-for-device
for property in ro.build.version.sdk ro.product.cpu.abi ro.product.cpu.abilist ro.dalvik.vm.native.bridge; do
  echo "$property=$(adb shell getprop "$property" | tr -d '\r')" >> "$OUT/device.txt"
done
sha256sum "$APK" > "$OUT/apk-sha256.txt"
adb install -r "$APK" | tee "$OUT/install.log"
adb logcat -c
# Keep all early native bridge messages and crash evidence before the filtered poll.
adb logcat -v time > "$OUT/complete-live.logcat" 2>&1 &
LOGCAT_PID=$!
adb shell am start -n com.example.x2hello/.MainActivity | tee "$OUT/launch.log"
for i in $(seq 1 110); do
  adb logcat -d -v time -s EXPR2_ORACLE:I EXPR2_ORIGINAL_ORACLE:I '*:S' > "$OUT/differential.logcat" || true
  if grep -q ORIGINAL_ORACLE_AB_COMPLETE "$OUT/differential.logcat"; then break; fi
  if grep -q ORIGINAL_ORACLE_FAILURE "$OUT/differential.logcat"; then break; fi
  sleep 2
done
adb logcat -d -v time > "$OUT/all.logcat" || true
adb logcat -b crash -d -v time > "$OUT/crash-buffer.logcat" || true
kill "$LOGCAT_PID" 2>/dev/null || true
sleep 1
adb shell dumpsys meminfo com.example.x2hello > "$OUT/meminfo.txt" || true
adb exec-out screencap -p > "$OUT/screenshot.png" || true
cat "$OUT/device.txt"
grep -E 'ORIGINAL_STREAM_WINDOW|ORIGINAL_LIBRARIES_LOADED|ORIGINAL_ADDRESS_PASS|ORIGINAL_FUNCTION_INVOKED|ORACLE_CASE|ORIGINAL_PCM_GUARD|ORIGINAL_FEED_ACCUM|ORIGINAL_FEED_STATE|ORIGINAL_END_BOUNDARY|ORIGINAL_FRAME_POP|ORIGINAL_FRAME_TRANSFER|ORIGINAL_ORACLE_AB_COMPLETE|ORIGINAL_ORACLE_FAILURE' "$OUT/differential.logcat" || true
if ! grep -q ORIGINAL_ORACLE_AB_COMPLETE "$OUT/differential.logcat"; then
  grep -E 'ORACLE_ENTER|ORACLE_ADDRESS|ORACLE_JNI|ORACLE_DLOPEN|ORACLE_ORIGINAL_FEED|fatal signal|SIGSEGV|FATAL EXCEPTION' "$OUT/complete-live.logcat" | tail -55 || true
  echo ORIGINAL_SDK_ORACLE_NOT_VERIFIED > "$OUT/VERDICT.txt"
  exit 1
fi
if [ "$(grep -c ORIGINAL_FUNCTION_INVOKED "$OUT/differential.logcat")" -lt 5 ]; then
  echo ORIGINAL_SDK_ORACLE_WRONG_CALL_COUNT > "$OUT/VERDICT.txt"
  exit 1
fi
adb exec-out run-as com.example.x2hello cat files/original_feed_accumulation_report.json > "$OUT/original_feed_accumulation_report.json"
python3 - <<'PY'
import json
from pathlib import Path
x=json.loads(Path("reports/expression2-original-oracle/original_feed_accumulation_report.json").read_text())
assert x["original_rva"]=="0x001a7fbc"
assert x["actual_original_arm64_function"]=="FUN_001a7fbc"
assert x["real_model_invoked"] is False
assert x["case_count"]==6 and len(x["cases"])==6
assert x["status"]=="PASS" and x["failures"]==0
for case in x["cases"]:
    assert case["buffer_content_size_capacity_equal"] is True,case
    assert case["original_canon_history_exact"] is True,case
    assert case["no_inference_steps"] is True,case
    assert case["first_failed_chunk"]==-1,case
print("EXPR2_ACTUAL_ORIGINAL_ACCUMULATION_BRANCH_PASS",x["case_count"],"CASES")
PY
adb exec-out run-as com.example.x2hello cat files/original_feed_state_report.json > "$OUT/original_feed_state_report.json"
python3 - <<'PY'
import json
from pathlib import Path
d=json.loads(Path("reports/expression2-original-oracle/original_feed_state_report.json").read_text())
assert d["original_feed_rva"]=="0x001a7fbc"
assert d["backend_inference_disabled_by_source_verified_capacity_guard"] is True
assert d["total_cases"]==9 and d["passed"]==9 and d["failed"]==0, d
for c in d["cases"]:
    assert c["pass"] is True,c
    assert c["first_failed_chunk"]==-1,c
    assert c["history_matches_16x"]=="YES",c
    assert c["original_step"]==0,c
print("ORIGINAL_FUN_001A7FBC_FEED_STATE_ACTUAL_ARM64_PASS",d["passed"])
PY
adb exec-out run-as com.example.x2hello cat files/original_end_segment_guard_report.json > "$OUT/original_end_segment_guard_report.json"
python3 - <<'PY'
import json
from pathlib import Path
d=json.loads(Path("reports/expression2-original-oracle/original_end_segment_guard_report.json").read_text())
assert d["original_rva"]=="0x001a8230"
assert d["synthetic_backpressure_blocks_inference"] is True
assert d["case_count"]==11 and d["passed"]==11 and d["failures"]==0,d
assert len(d["cases"])==11
for c in d["cases"]:
    assert c["pass"] is True,c
    assert c["original_return"]==1,c
    assert c["sample"]==c["expected"],c
print("EXPR2_ORIGINAL_ARM64_ENDSEGMENT_GUARD_PASS",d["passed"])
PY
adb exec-out run-as com.example.x2hello cat files/original_frame_pop_report.json > "$OUT/original_frame_pop_report.json"
python3 - <<'PY'
import json
from pathlib import Path
d=json.loads(Path("reports/expression2-original-oracle/original_frame_pop_report.json").read_text())
assert d["original_pop_rva"]=="0x001aa40c"
assert d["original_queue_count_rva"]=="0x001a84cc"
assert d["frame_bytes"]==1198080
assert d["case_count"]==4 and d["passed"]==4 and d["failures"]==0,d
for x in d["cases"]:
    assert x["pass"] is True,x
    assert x["pop_return"]==1 and x["empty_return"]==0,x
    assert x["image_exact"] is True and x["ownership_cleared"] is True,x
    assert x["head_incremented"] is True and x["queue_empty"] is True,x
print("EXPR2_ORIGINAL_ARM64_FRAME_POP_OWNERSHIP_PASS",d["passed"])
PY
adb exec-out run-as com.example.x2hello cat files/original_frame_transfer_report.json > "$OUT/original_frame_transfer_report.json"
python3 - <<'PY'
import json
from pathlib import Path
d=json.loads(Path("reports/expression2-original-oracle/original_frame_transfer_report.json").read_text())
assert d["original_transfer_rva"]=="0x001a7a04"
assert d["original_pop_rva"]=="0x001aa40c"
assert d["native_frame_bytes"]==1198080
assert d["case_count"]==2 and d["passed"]==2 and d["failures"]==0,d
assert sorted(x["frames"] for x in d["cases"])==[1,2]
for x in d["cases"]:
    assert x["pass"] is True,x
    assert x["original_queued"]==x["frames"],x
    assert x["exact_popped"]==x["frames"],x
print("EXPR2_ACTUAL_ORIGINAL_ARM64_FRAME_BACKEND_TRANSFER_PASS",d["passed"])
PY
adb exec-out run-as com.example.x2hello cat files/original_pcm_guard_report.json > "$OUT/original_pcm_guard_report.json"
python3 - <<'PY'
import json
from pathlib import Path
p=Path("reports/expression2-original-oracle/original_pcm_guard_report.json")
r=json.loads(p.read_text())
assert r["unmodified_arm64_original_executed"] is True
assert r["original_append_rva"]=="0x001acf1c"
assert r["original_schedule_rva"]=="0x001a80dc"
assert r["append_case_count"]==11
assert r["scheduler_guard_case_count"]==12
assert r["append_failures"]==0 and r["scheduler_guard_failures"]==0
assert r["status"]=="PASS"
assert len(r["append_cases"])==11
assert len(r["scheduler_guard_cases"])==12
for c in r["append_cases"]:
    assert c["byte_exact_and_capacity_equal"] is True,c
    assert c["first_different_chunk"]==-1,c
for c in r["scheduler_guard_cases"]:
    assert c["guard_pass"] is True,c
    assert c["original_return"]==1,c
    assert c["step_before"]==c["step_after"],c
print("ORIGINAL_PCM_APPEND_BIT_EXACT_PASS",len(r["append_cases"]),
      "REAL_ORIGINAL_SCHEDULER_PRE_INFERENCE_GUARDS_PASS",
      len(r["scheduler_guard_cases"]))
PY
adb exec-out run-as com.example.x2hello cat files/original_differential_report.json > "$OUT/original_differential_report.json"
python3 - <<'PY'
import json
from pathlib import Path
d=json.loads(Path("reports/expression2-original-oracle/original_differential_report.json").read_text())
assert d["result"]=="REFERENCE_EXECUTED_AND_COMPARED"
assert len(d["cases"])==5
for x in d["cases"]:
    assert x["count"]==35200 and x["nonfinite_count"]==0
    # Source-of-truth requirement: original and candidate arrays must match
    # numerically, not merely produce correctly sized shapes.
    assert x["mae"] <= 1e-9, (x["case"],"MAE",x["mae"])
    assert x["max_abs"] <= 1.2e-7, (x["case"],"MAX_ABS",x["max_abs"])
    assert x["float_exact_count"] >= 34848, (x["case"],"EXACT",x["float_exact_count"])
    if x["case"] in ("silence","impulse"):
        assert x["bit_exact"], (x["case"],"MUST_MATCH_BITWISE")
    print("ORIGINAL_REFERENCE_REAL",x["case"],"exact",x["float_exact_count"],
          "mae",x["mae"],"max",x["max_abs"],"ref_sha",x["original_sha256"])
PY
for case in silence impulse sine fixed_noise spoken_tts; do
  adb exec-out run-as com.example.x2hello cat "files/$case"_input.f32 > "$OUT/$case"_input.f32
  test "$(stat -c %s "$OUT/$case"_input.f32)" -eq 176000
  adb exec-out run-as com.example.x2hello cat "files/$case"_original.f32 > "$OUT/$case"_original.f32
  adb exec-out run-as com.example.x2hello cat "files/$case"_candidate.f32 > "$OUT/$case"_candidate.f32
  adb exec-out run-as com.example.x2hello cat "files/$case"_input.f32 > "$OUT/$case"_input.f32
  test "$(stat -c %s "$OUT/$case"_input.f32)" -eq 176000
  test "$(stat -c %s "$OUT/$case"_original.f32)" -eq 140800
  test "$(stat -c %s "$OUT/$case"_candidate.f32)" -eq 140800
done
# Verify actual original ARM64 preprocessor outputs on source-derived
# FUN_001a8500 44,000-sample windows, including startup zero padding.
adb exec-out run-as com.example.x2hello cat files/original_stream_window_report.json > "$OUT/original_stream_window_report.json"
for name in step0_threshold step0_extra step1_full step2_full step3_partial step3_full step0_active_tail step1_active_tail; do
  adb exec-out run-as com.example.x2hello cat "files/stream_${name}_window.f32" > "$OUT/stream_${name}_window.f32"
  adb exec-out run-as com.example.x2hello cat "files/stream_${name}_original_preprocessed.f32" > "$OUT/stream_${name}_original_preprocessed.f32"
  adb exec-out run-as com.example.x2hello cat "files/stream_${name}_original_encoder_x3.f32" > "$OUT/stream_${name}_original_encoder_x3.f32"
done
python3 - <<'PY'
import json
import hashlib
import math
import struct
from pathlib import Path
root=Path("reports/expression2-original-oracle")
d=json.loads((root/"original_stream_window_report.json").read_text())
assert d["source_window_rva"]=="0x001a8500",d
assert d["executed_original_preprocessor_rva"]=="0x001a9794",d
assert d["source_derived_not_runtime_full_inference"] is True
assert d["case_count"]==8 and d["status"]=="PASS",d
assert d["active_tail_step0_invariant"] is True and d["active_tail_step1_sensitive"] is True,d
expected={
    "step0_threshold":(0,25600,18400),
    "step0_extra":(0,25600,18400),
    "step1_full":(0,44000,0),
    "step2_full":(25600,44000,0),
    "step3_partial":(51200,28800,15200),
    "step3_full":(51200,44000,0),
    "step0_active_tail":(0,25600,18400),
    "step1_active_tail":(0,44000,0),
}
assert {x["name"] for x in d["cases"]}==set(expected)
for case in d["cases"]:
    name=case["name"]
    start,count,padding=expected[name]
    assert (case["start"],case["copied_samples"],case["zero_padded_samples"])==(start,count,padding),case
    assert case["actual_original_arm64_preprocessor_invoked"] is True
    assert case["actual_original_full_inference_invoked"] is False
    assert case["output_samples"]==35200
    sample=(root/f"stream_{name}_window.f32").read_bytes()
    prep=(root/f"stream_{name}_original_preprocessed.f32").read_bytes()
    enc=(root/f"stream_{name}_original_encoder_x3.f32").read_bytes()
    assert len(sample)==176000 and len(prep)==len(enc)==140800,name
    assert sample[count*4:]==bytes(padding*4),name
    assert hashlib.sha256(sample).hexdigest()==case["window_sha256"],name
    assert hashlib.sha256(prep).hexdigest()==case["original_preprocessed_sha256"],name
    assert hashlib.sha256(enc).hexdigest()==case["original_encoder_x3_sha256"],name
    # Exact round-to-Float32, same as original ARM64 fmul v1.4S by 3.0f.
    source=struct.iter_unpack("<f",prep)
    rendered=struct.iter_unpack("<f",enc)
    for (x,),(y,) in zip(source,rendered):
        assert math.isfinite(x) and math.isfinite(y)
        assert struct.pack("<f",x*3.0)==struct.pack("<f",y),name
    print("ORIGINAL_STREAM_SOURCE_WINDOW_AND_NATIVE_DSP_PASS",name,
          "start",start,"copied",count,"pad",padding)
# First fully observed 44k original input is the same original TTS reference.
assert (root/"stream_step0_active_tail_window.f32").read_bytes()==(root/"stream_step0_extra_window.f32").read_bytes()
assert (root/"stream_step0_active_tail_original_encoder_x3.f32").read_bytes()==(root/"stream_step0_extra_original_encoder_x3.f32").read_bytes()
assert (root/"stream_step1_active_tail_window.f32").read_bytes()!=(root/"stream_step1_full_window.f32").read_bytes()
assert (root/"stream_step1_active_tail_original_encoder_x3.f32").read_bytes()!=(root/"stream_step1_full_original_encoder_x3.f32").read_bytes()
assert (root/"stream_step1_full_window.f32").read_bytes()==(root/"spoken_tts_input.f32").read_bytes()
assert (root/"stream_step1_full_original_preprocessed.f32").read_bytes()==(root/"spoken_tts_original.f32").read_bytes()
print("ORIGINAL_STREAM_PREPROCESSOR_SAME_PCM_REPRODUCIBLE_PASS",len(d["cases"]))
PY
# Actual original ARM64 native feed is invoked in the SAME PROCESS as the
# independently compiled HITEL stream state. Zero divergence is required.
adb exec-out run-as com.example.x2hello cat files/original_vs_dropin_native_state.json \
    > "$OUT/original_vs_dropin_native_state.json"
python3 - <<'PY'
import json
from pathlib import Path
p=Path("reports/expression2-original-oracle/original_vs_dropin_native_state.json")
d=json.loads(p.read_text())
assert d["reference"]=="actual unmodified original ARM64 FUN_001a7fbc",d
assert d["original_instruction_verified"] is True,d
print("ACTUAL_ORIGINAL_AND_CANDIDATE_SAME_INPUT_CASES",d["total_cases"])
for row in d["cases"]:
    for step in row["states"]:
        print("DIFF",row["case"],step["chunk"],"PCM",
              step["orig_samples"],step["candidate_samples"],
              "CAP",step["orig_capacity"],step["candidate_capacity"],
              "EQUAL",step["match"])
assert d["first_divergence_case_index"]==-1,d
assert d["failed_cases"]==0 and d["conclusion"]=="PASS",d
print("EXPR2_ORIGINAL_VS_INDEPENDENT_STREAM_MEMORY_PARITY_PASS")
PY

echo ORIGINAL_REFERENCE_NUMERIC_PARITY_TOLERANCE_PASS_NOT_BIT_EXACT | tee "$OUT/VERDICT.txt"
