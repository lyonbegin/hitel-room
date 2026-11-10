#!/usr/bin/env python3
"""Reproducible native streaming performance metrics from a diagnostic ZIP.

RTF is defined for 16 kHz PCM. It is NOT caller sound-to-screen latency, since
a pre-recorded M4A may be decoded and buffered at different rates than a live
Samsung call. Comparisons require same input, model, emulator and CPU.
"""
import argparse, json, statistics, zipfile
from pathlib import Path

def load(path):
    with zipfile.ZipFile(path) as z:
        names=[n for n in z.namelist() if n.endswith("latency-trace.jsonl")]
        if len(names)!=1:raise RuntimeError("expected exactly one latency-trace.jsonl")
        return [json.loads(s) for s in z.read(names[0]).decode().splitlines() if s]

def metric(rows):
    stages={}
    for event in rows:stages.setdefault(event.get("event"),[]).append(event)
    def first(tag):return stages.get(tag,[{}])[0]
    def last(tag):return stages.get(tag,[{}])[-1]
    pcm=stages.get("PIPE_WRITE_END",[])
    live=stages.get("LIVE",[])
    decodes=stages.get("DECODE",[])
    total_audio_ms=max([x.get("data",{}).get("audioEndMs",0) for x in pcm] or [0])
    total_decode_ms=sum(x.get("data",{}).get("durationUs",0)/1000 for x in decodes)
    model_load_ms=first("MODEL_LOAD").get("data",{}).get("durationUs",0)/1000
    begin=first("PIPE_WRITE_END").get("boot_ns")
    end=last("PIPE_WRITE_END").get("boot_ns")
    live_end=last("LIVE").get("boot_ns")
    def diff_ms(a,b):return (b-a)/1e6 if a is not None and b is not None else None
    def divide(a,b):return a/b if a is not None and b else None
    data={
      "input_audio_ms":total_audio_ms,
      "num_pcm_chunks":len(pcm),
      "num_native_decode_events":len(decodes),
      "num_native_live_updates":len(live),
      "native_model_load_ms":round(model_load_ms,2),
      "native_decode_sum_ms":round(total_decode_ms,2),
      "native_decode_rtf":round(divide(total_decode_ms,total_audio_ms),3),
      "first_to_last_pcm_write_ms":round(diff_ms(begin,end),2),
      "pcm_write_rtf":round(divide(diff_ms(begin,end),total_audio_ms),3),
      "first_pcm_to_last_native_hypothesis_ms":round(diff_ms(begin,live_end),2),
      "end_to_end_processing_rtf":round(divide(diff_ms(begin,live_end),total_audio_ms),3),
      "num_ui_text_updates":len(stages.get("LIVE_SET_TEXT",[])),
      "diagnostic_dropped_events":last("LOG_CLOSED").get("dropped",0)
    }
    return data
if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("diagnostic_zip")
    p.add_argument("--output",default="rtf-metrics.json")
    args=p.parse_args()
    result=metric(load(args.diagnostic_zip))
    Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(result,ensure_ascii=False,indent=2))
