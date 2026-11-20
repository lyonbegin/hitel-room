#!/usr/bin/env python3
"""Strict evidence that ADB keyboard typing triggered request -> reply -> PCM -> UI done.

The result MUST be labelled local mock; it is never evidence of real AI service.
"""
import argparse
from pathlib import Path
import json
import re

CHECKS=[
("typed_ui_event",r"ui\.text\.submit chars=[1-9]\d*"),
("client_user_message_tx",r"client\.tx type=conversation\.item\.create"),
("client_response_request_tx",r"client\.tx type=response\.create"),
("mock_response_request_rx",r"mock\.rx type=response\.create"),
("mock_response_created_tx",r"mock\.tx type=response\.created"),
("client_response_created_rx",r"client\.rx type=response\.created"),
("mock_first_voice_delta_tx",r"mock\.tx type=response\.output_audio\.delta first=true"),
("client_first_voice_delta_rx",r"client\.rx type=response\.output_audio\.delta first=true"),
("mock_response_done_tx",r"mock\.tx type=response\.done"),
("client_response_done_rx",r"client\.rx type=response\.done"),
("ui_response_done_state",r"ui\.status=responseDone"),
]

def verify(log_path:Path, native_path:Path, output:Path):
    log=log_path.read_text(errors="replace").splitlines()
    events=[]
    for idx,line in enumerate(log):
        if "[HITEL_AI_E2E]" in line:
            # Only metadata after tag; never put text prompt into report.
            events.append({"log_line":idx+1,"event":line.split("[HITEL_AI_E2E]",1)[1].strip()[:240]})
    checks={}
    offsets=[]
    for label, regex in CHECKS:
        hit=next(((i,e) for i,e in enumerate(events) if re.search(regex,e["event"])),None)
        checks[label]={"passed":hit is not None,"event_index":hit[0] if hit else None}
        if hit: offsets.append((label,hit[0]))
    for i in range(1,len(offsets)):
        if offsets[i][1] < offsets[i-1][1]:
            checks["event_order"]={"passed":False,"before":offsets[i-1],"after":offsets[i]}
            break
    else:
        checks["event_order"]={"passed":True}
    trace=native_path.read_text(errors="replace").splitlines()
    def count(pattern):
        return sum(1 for s in trace if pattern in s)
    audio_writes=[s for s in trace if "stage=audio.track.write" in s]
    nonzero_writes=sum(1 for s in audio_writes
        if re.search(r"returnedBytes=([1-9]\d*)",s))
    checks["native_pcm_audio_write"]={"passed":nonzero_writes>0,
                                         "writes_with_positive_return":nonzero_writes}
    checks["native_video_presentation"]={"passed":count("stage=display.present")>0,
                                           "sampled_events":count("stage=display.present")}
    checks["native_sdk_feed"]={"passed":count("stage=sdk.feed.end")>0,
                                  "observed_completions":count("stage=sdk.feed.end")}
    success=all(c["passed"] for c in checks.values())
    result={
        "passed":success,
        "backend":"127.0.0.1 LOCAL SYNTHETIC MOCK, NO REAL AI SERVER",
        "input":"ADB UI text field + KEYCODE_ENTER, not injected protocol event",
        "text_payload_logged":False,
        "real_ai_verified":False,
        "human_audible_voice_verified":False,
        "original_vendor_renderer_logic_changed":False,
        "stages":checks,
        "event_chronology":events[:160],
        "last_ui_state_events":[x for x in events if "ui.status=" in x["event"]][-12:]
    }
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
    for label,val in checks.items():
        print(("PASS_" if val["passed"] else "FAIL_")+"E2E_"+label.upper())
    if not success:
        raise SystemExit("FAIL_ESSENCE2_KEYBOARD_TO_MOCK_REPLY_TO_VOICE_COMPLETE")
    print("PASS_ESSENCE2_KEYBOARD_TO_MOCK_RESPONSE_DONE_AND_NATIVE_PCM_VIDEO")

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--logcat",type=Path,required=True)
    p.add_argument("--native-trace",type=Path,required=True)
    p.add_argument("--report",type=Path,required=True)
    x=p.parse_args()
    verify(x.logcat,x.native_trace,x.report)
