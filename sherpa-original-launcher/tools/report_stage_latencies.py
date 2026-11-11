#!/usr/bin/env python3
"""Export individual v21 Galaxy stage durations from a local diagnostic ZIP or JSONL.

No duration is accumulated across calls. Each row describes ONE measured
stage instance on CLOCK_BOOTTIME. Codec frame IDs and PCM chunk IDs are not
interchangeable, and stage durations may overlap or be inclusive.
Usage: python report_stage_latencies.py Galaxy_Call_Diagnostic.zip --out stage-report
"""
import argparse
import csv
import json
import statistics
import zipfile
from collections import defaultdict
from pathlib import Path

def lines_from(source):
    if zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as archive:
            matches=[n for n in archive.namelist() if n.endswith("latency-trace.jsonl")]
            if len(matches)!=1:
                raise ValueError("Expected one latency-trace.jsonl; found "+str(len(matches)))
            for line in archive.read(matches[0]).decode("utf-8").splitlines():
                yield line
    else:
        yield from Path(source).read_text(encoding="utf-8").splitlines()

def percentile(data,p):
    ordered=sorted(data)
    if not ordered: return None
    rank=(len(ordered)-1)*p
    lo=int(rank)
    hi=min(len(ordered)-1,lo+1)
    return ordered[lo]+(ordered[hi]-ordered[lo])*(rank-lo)

def build_report(source,outdir):
    out=Path(outdir)
    out.mkdir(parents=True,exist_ok=True)
    individual=[]
    errors=[]
    for line_number,line in enumerate(lines_from(source),1):
        try:
            item=json.loads(line)
        except json.JSONDecodeError:
            errors.append({"line":line_number,"error":"INVALID_JSON"})
            continue
        if item.get("stage")!="PIPELINE":
            continue
        data=item.get("data") or {}
        name=item.get("event","")
        if "durationMs" not in data:
            continue
        try:
            duration=float(data["durationMs"])
        except (TypeError,ValueError):
            errors.append({"line":line_number,"error":"INVALID_DURATION"})
            continue
        if duration<0:
            errors.append({"line":line_number,"error":"NEGATIVE_DURATION"})
            continue
        individual.append({
            "event_id":item.get("id"),
            "stage":name,
            "chunk_seq":data.get("chunkSeq", ""),
            "aac_frame":data.get("aacFrame",data.get("frame","")),
            "output_chunk":data.get("outputChunk",""),
            "audio_end_ms":data.get("audioEndMs",data.get("pcmAudioEndMs","")),
            "source_byte":data.get("sourceByte",""),
            "start_boot_ns":data.get("startBootNs",""),
            "end_boot_ns":data.get("endBootNs",item.get("boot_ns","")),
            "duration_ms":round(duration,6),
            "note":data.get("note","")
        })
    names=["event_id","stage","chunk_seq","aac_frame","output_chunk",
           "audio_end_ms","source_byte","start_boot_ns","end_boot_ns",
           "duration_ms","note"]
    with (out/"individual_stage_durations.csv").open("w",encoding="utf-8-sig",newline="") as file:
        writer=csv.DictWriter(file,fieldnames=names)
        writer.writeheader()
        writer.writerows(individual)
    grouped=defaultdict(list)
    for row in individual:
        grouped[row["stage"]].append(row["duration_ms"])
    summary=[]
    for stage,measurements in sorted(grouped.items()):
        summary.append({
            "stage":stage, "count":len(measurements),
            "median_ms":round(statistics.median(measurements),3),
            "p95_ms":round(percentile(measurements,.95),3),
            "max_ms":round(max(measurements),3),
        })
    (out/"stage_statistics.json").write_text(json.dumps({
        "interpretation":"Each measurement is one event. Never add inclusive and overlapping stages.",
        "rows":len(individual),"stages":summary,"invalid_rows":errors
    },ensure_ascii=False,indent=2),encoding="utf-8")
    print("individual stages:",len(individual),"categories:",len(summary),"errors:",len(errors))
    for item in summary:
        print(item["stage"],"count",item["count"],"p50",item["median_ms"],"p95",item["p95_ms"])

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("source",type=Path)
    parser.add_argument("--out",default="stage-report")
    args=parser.parse_args()
    build_report(args.source,args.out)
