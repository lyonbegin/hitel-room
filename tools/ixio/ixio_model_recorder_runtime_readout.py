#!/usr/bin/env python3
"""Read real model/recorder evidence, including Android shorthand components."""
import argparse
import json
import re
from pathlib import Path


def readout(root: Path, run_id: int):
    gsm=root/"ixio-hitel-android-results/gsm-call-smoke"
    sources=[root/"ixio-pages-qa-emulator-evidence/logcat-full.txt",
             gsm/"logcat-before-call.txt",gsm/"logcat-simulated-call.txt"]
    lines=list(dict.fromkeys(line for p in sources if p.exists()
                            for line in p.read_text(errors="replace").splitlines()))
    log="\n".join(lines)
    versions=dict(re.findall(r"\[AiModelUpdateRepository\] Downloaded (\w+) version: ([\d.]+)",log))
    dumps="\n".join(p.read_text(errors="replace") for p in
                    [gsm/"connected-services.txt",gsm/"record_toggle-services.txt"] if p.exists())
    blocks=re.split(r"(?m)^[ \t]*\* ServiceRecord",dumps)
    bound=any(re.search(r"com\.lguplus\.callrecorder/(?:\.|com\.lguplus\.callrecorder\.)?InCallService",b.splitlines()[0])
              and "ixio.ACTION_RECORDING_START" in b and "hasBound=true" in b
              and "com.lguplus.aicallagent" in b for b in blocks if b.splitlines())
    call=json.loads((gsm/"result.json").read_text())
    required=dict(re.findall(r"IXIO_REQUIRED_PERMISSION_ITEM: (android\.permission\.[A-Z_]+)=(-?\d+)",log))
    connected="[AidlRecordingStrategy] CallRecordingService connected" in log
    after=(gsm/"after-visible.txt").read_text(errors="replace") if (gsm/"after-visible.txt").exists() else ""
    return {
        "source_run_id":run_id,
        "download_worker_success_count":sum("Worker result SUCCESS" in x and
             "com.lguplus.aicallagent.data.worker.DownloadWorker" in x for x in lines),
        "unzip_worker_success_count":sum("Worker result SUCCESS" in x and
             "com.lguplus.aicallagent.data.worker.FileUnzipWorker" in x for x in lines),
        "downloaded_versions":versions,
        "original_dek_initialization_success":"ORIGINAL_ENSURE_PROVISIONED_SUCCESS" in log,
        "original_required_permission_result_true":"IXIO_REQUIRED_PERMISSION_RESULT: true" in log,
        "original_required_android_permissions":{k:int(v) for k,v in required.items()},
        "original_call_screen_seen":call.get("caller_screen_seen"),
        "synthetic_call_only":True,
        "record_button_tapped":call.get("record_button_tapped"),
        "recorder_aidl_connection_logged":connected,
        "recorder_component_bound_to_main":bound,
        "record_listener_registrations":log.count("Register CallRecordListener"),
        "record_start_failure_observed":"result=Failure(error=Fail)" in log and "outcome=start_failed reason=Fail" in log,
        "model_file_missing_flag_after_call":"isModelFileNotFound=true" in log,
        "unsupported_phone_screen_after_call":"익시오를 이용할 수 없는 휴대폰이에요" in after,
        "actual_voice_file_or_pcm_verified":False,
        "stt_text_verified":False,
        "legacy_component_name_heuristic_false_negative":connected and bound and
             call.get("recording_service_bound_after_toggle") is False,
        "causal_link_between_remaining_flags_and_record_start_failure_proven":False,
    }


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--evidence",required=True,type=Path)
    p.add_argument("--run-id",required=True,type=int)
    p.add_argument("--report",required=True,type=Path)
    a=p.parse_args();r=readout(a.evidence,a.run_id)
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps(r,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps(r,ensure_ascii=False,indent=2))


if __name__=="__main__":main()
