#!/usr/bin/env python3
"""Audit actual Android device's bounded causal trace, never pretend frame counts == unique lipsync.

Outputs structured evidence, not a synthetic PASS. It verifies required events,
summarizes distribution including feed stalls, monitor wait and lip coverage.
"""
from pathlib import Path
import argparse
import json
import re
from collections import Counter, defaultdict, deque

KV = re.compile(r"(?:^|\s)([A-Za-z_][A-Za-z_0-9]*)=([^\s]+)")
REQUIRED_BOOT = (
    "load.begin", "model.localFetch.end", "sdk.create.end",
    "gpu.hardwareBuffer.result", "gpu.routing", "surface.post.ok",
)
REQUIRED_AUDIO = (
    "player.feed.call", "sdk.feed.begin", "sdk.feed.end",
    "sdk.pull.result", "audio.track.write", "display.present",
)

def parse_line(s):
    d = {}
    for k, v in KV.findall(s):
        # Unlike player unit 'seq', trace's first seq is the event identifier.
        if k in d and k == "seq":
            d["unitSeq"] = v
        else:
            d[k] = v
    return d

def metric(rows, stage, key="durationUs"):
    values = sorted(float(r[key]) for r in rows
                    if r.get("stage") == stage and key in r)
    if not values:
        return {"count": 0}
    def q(frac):
        return round(values[min(len(values)-1,int((len(values)-1)*frac))],2)
    return {"count": len(values), "min": q(0), "p50": q(.50),
            "p95": q(.95), "max": q(1),
            "over_1000ms": sum(v >= 1000000 for v in values)}

def summarize(path: Path):
    rows = [parse_line(x) for x in path.read_text(errors="replace").splitlines()]
    rows = [x for x in rows if x.get("stage")]
    counts = Counter(x["stage"] for x in rows)
    pending = defaultdict(deque)
    waits = []
    for item in rows:
        tid = item.get("tid")
        if item["stage"] == "player.feed.call":
            pending[tid].append((int(item.get("monotonicNs","0")), item.get("samples16k")))
        elif item["stage"] == "sdk.feed.begin" and pending[tid]:
            called, samples = pending[tid].popleft()
            if samples == item.get("samples16k"):
                waited = (int(item.get("monotonicNs","0")) - called)/1000
                if waited >= 0:
                    waits.append(round(waited, 2))
    presentations = [x for x in rows if x["stage"] == "display.present"]
    gpu = [x for x in rows if x["stage"].startswith("gpu.")]
    lost = [int(x.get("lost", "0")) for x in rows if x.get("lost","0").isdigit()]
    return {
        "file": path.name, "events": len(rows),
        "stages": dict(counts),
        "missing_boot": [x for x in REQUIRED_BOOT if not counts[x]],
        "missing_speech": [x for x in REQUIRED_AUDIO if not counts[x]],
        "lost_log_events": max(lost) if lost else None,
        "sdk_feed_duration_us": metric(rows,"sdk.feed.end"),
        "sdk_pull_duration_us": metric(rows,"sdk.pull.result"),
        "player_feed_total_us": metric(rows,"player.feed.return"),
        "render_monitor_wait_us": metric(rows,"render.monitor.wait"),
        "monitor_entry_gap_us": {
            "count":len(waits),
            "max":max(waits) if waits else None,
            "p50":sorted(waits)[len(waits)//2] if waits else None,
        },
        "gpu_route": [{k: r.get(k) for k in ("stage", "hardwareFrames","message",
                         "errorClass","source","requested","forcedCpuCopy")
                      if r.get(k) is not None} for r in gpu],
        "speech": {
            "samples_of_display_events": len(presentations),
            "sampled_new_mouth_events": sum(x.get("newMouthFrame")=="true" for x in presentations),
            "uniqueShown_last": next((r["uniqueShown"] for r in reversed(presentations)
                                      if "uniqueShown" in r), None),
            "due_last": next((r["due"] for r in reversed(presentations)
                              if "due" in r), None),
            "coveragePct_last": next((r["coveragePct"] for r in reversed(presentations)
                                      if "coveragePct" in r), None),
            "kinds": dict(Counter(r.get("kind") for r in presentations)),
        },
        "warning": "Device trace sampling is NOT total render count. JNIs internal instructions are not instrumented."
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--input",required=True,type=Path)
    p.add_argument("--output",required=True,type=Path)
    p.add_argument("--require-boot",action="store_true")
    p.add_argument("--require-speech",action="store_true")
    args=p.parse_args()
    r=summarize(args.input)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(r,indent=2,ensure_ascii=False)+"\n")
    print("E2TRACE_SUMMARY eventCount=%s feedP95us=%s feedMaxUs=%s mouthUnique=%s due=%s loss=%s" % (
        r["events"],r["sdk_feed_duration_us"].get("p95"),
        r["sdk_feed_duration_us"].get("max"),r["speech"]["uniqueShown_last"],
        r["speech"]["due_last"],r["lost_log_events"]))
    if args.require_boot and r["missing_boot"]:
        raise SystemExit("E2TRACE_MISSING_BOOT: "+",".join(r["missing_boot"]))
    if args.require_speech and r["missing_speech"]:
        raise SystemExit("E2TRACE_MISSING_SPEECH: "+",".join(r["missing_speech"]))

if __name__ == "__main__":
    main()
