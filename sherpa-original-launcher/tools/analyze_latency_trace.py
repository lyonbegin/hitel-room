#!/usr/bin/env python3
"""Read the Galaxy v11 ZIP; write timestamped stage and caption latency CSV files.

CLOCK_BOOTTIME is shared by Android SystemClock.elapsedRealtimeNanos and the
C++ native recorder. This measures AFTER the Android recorder exposes audio.
It cannot independently prove when real sound was heard/uttered by a person.
"""
import argparse
import csv
import json
import math
import statistics
import zipfile
from collections import defaultdict
from pathlib import Path


def read_lines(source):
    path = Path(source)
    if path.is_dir():
        text = (path / "latency-trace.jsonl").read_text(encoding="utf-8")
    elif zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as z:
            names = [n for n in z.namelist() if n.endswith("latency-trace.jsonl")]
            if len(names) != 1:
                raise ValueError(f"expected one latency-trace.jsonl, got {names}")
            text = z.read(names[0]).decode("utf-8")
    else:
        text = path.read_text(encoding="utf-8")
    return sorted((json.loads(x) for x in text.splitlines() if x.strip()),
                  key=lambda v: (v.get("boot_ns", 0), v.get("id", 0)))


def delta_ms(a, b):
    if a is None or b is None or int(a) <= 0 or int(b) <= 0:
        return None
    return round((int(b) - int(a)) / 1e6, 3)


def summary(values):
    values = sorted(v for v in values if v is not None and v >= 0)
    if not values:
        return "N/A (not observed)"
    p95 = values[max(0, math.ceil(len(values) * .95) - 1)]
    return (f"n={len(values)} min={values[0]:.1f}ms "
            f"p50={statistics.median(values):.1f}ms p95={p95:.1f}ms "
            f"max={values[-1]:.1f}ms")


def dump_csv(path, rows, headers):
    with open(path, "w", newline="", encoding="utf-8-sig") as out:
        w = csv.DictWriter(out, fieldnames=headers, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def analyze(rows, target):
    target.mkdir(parents=True, exist_ok=True)
    all_rows = [dict(id=r.get("id"), wall_iso=r.get("wall_iso"),
                     boot_ns=r.get("boot_ns"), elapsed_ms=r.get("elapsed_ms"),
                     stage=r.get("stage"), event=r.get("event"),
                     data=json.dumps(r.get("data", {}), ensure_ascii=False))
                for r in rows]
    dump_csv(target / "all_stages.csv", all_rows,
             ["id", "wall_iso", "boot_ns", "elapsed_ms", "stage", "event", "data"])

    sent, native, decodes = {}, {}, defaultdict(list)
    native_live, broadcast, ui_set, ui_recv, ui_frame = {}, {}, {}, {}, {}
    model_loads = []
    dropped = 0
    for r in rows:
        stage, event, ts = r.get("stage"), r.get("event"), r.get("boot_ns")
        d = r.get("data") or {}
        if event == "LOG_CLOSED":
            dropped = r.get("dropped", 0)
        if stage == "PCM" and event == "PIPE_WRITE_END":
            sent[int(d["seq"])] = ts
        if stage == "NATIVE" and event == "INPUT":
            native[int(d["sampleId"])] = ts
        if stage == "NATIVE" and event == "DECODE":
            decodes[int(d["sampleId"])].append(float(d["durationUs"]) / 1000)
        if stage == "NATIVE" and event == "MODEL_LOAD":
            model_loads.append(float(d["durationUs"]) / 1000)
        if stage == "NATIVE" and event == "LIVE":
            native_live[int(d["sampleId"])] = ts
        if stage == "BROADCAST" and event == "LIVE_SEND_BEGIN":
            broadcast[int(d["captionSeq"])] = (ts, int(d.get("nativeHypothesisId", 0)))
        if stage == "UI" and event == "LIVE_BROADCAST_RECEIVED":
            ui_recv[int(d["captionSeq"])] = ts
        if stage == "UI" and event == "LIVE_SET_TEXT":
            ui_set[int(d["captionSeq"])] = ts
        if stage == "UI" and event == "NEXT_FRAME_CALLBACK":
            ui_frame[int(d["captionSeq"])] = (ts, bool(d.get("sameTextStillPresent")))

    pcm_rows = []
    for seq in sorted(set(sent) | set(native) | set(decodes)):
        pcm_rows.append(dict(seq=seq, write_end_boot_ns=sent.get(seq),
            native_input_boot_ns=native.get(seq),
            android_pipe_to_native_ms=delta_ms(sent.get(seq), native.get(seq)),
            native_decode_count=len(decodes[seq]),
            native_decode_total_ms=round(sum(decodes[seq]), 3) if decodes[seq] else None))
    dump_csv(target / "pcm_latency.csv", pcm_rows, [
        "seq", "write_end_boot_ns", "native_input_boot_ns",
        "android_pipe_to_native_ms", "native_decode_count", "native_decode_total_ms"])

    caption_rows = []
    for seq, (service_ns, hyp_id) in sorted(broadcast.items()):
        live_ns = native_live.get(hyp_id)
        frame = ui_frame.get(seq)
        caption_rows.append(dict(
            caption_seq=seq, hypothesis_id=hyp_id, native_live_boot_ns=live_ns,
            service_send_boot_ns=service_ns, ui_receive_boot_ns=ui_recv.get(seq),
            ui_set_text_boot_ns=ui_set.get(seq),
            ui_frame_callback_boot_ns=frame[0] if frame else None,
            native_to_service_ms=delta_ms(live_ns, service_ns),
            service_to_ui_receive_ms=delta_ms(service_ns, ui_recv.get(seq)),
            native_to_ui_set_text_ms=delta_ms(live_ns, ui_set.get(seq)),
            native_to_next_frame_callback_ms=delta_ms(live_ns, frame[0]) if frame else None,
            same_text_at_frame=frame[1] if frame else None))
    headers = list(caption_rows[0]) if caption_rows else [
        "caption_seq", "hypothesis_id", "native_live_boot_ns", "service_send_boot_ns",
        "ui_receive_boot_ns", "ui_set_text_boot_ns", "ui_frame_callback_boot_ns",
        "native_to_service_ms", "service_to_ui_receive_ms", "native_to_ui_set_text_ms",
        "native_to_next_frame_callback_ms", "same_text_at_frame"]
    dump_csv(target / "caption_latency.csv", caption_rows, headers)

    report = [
        f"events: {len(rows)}; dropped: {dropped}",
        f"native model load: {summary(model_loads)}",
        "PCM Android pipe-write -> native acceptance: " +
            summary([r["android_pipe_to_native_ms"] for r in pcm_rows]),
        "native decode per PCM batch: " +
            summary([r["native_decode_total_ms"] for r in pcm_rows]),
        "native hypothesis -> service broadcast: " +
            summary([r["native_to_service_ms"] for r in caption_rows]),
        "native hypothesis -> Android TextView.setText: " +
            summary([r["native_to_ui_set_text_ms"] for r in caption_rows]),
        "native hypothesis -> next frame callback (not proof of scanout): " +
            summary([r["native_to_next_frame_callback_ms"] for r in caption_rows]),
        "",
        "WARNING: The above are processing-stage latencies, NOT independently",
        "sound-to-display latencies. Samsung may buffer original audio before",
        "it becomes visible in the growing M4A. ENERGY_ONSET_CANDIDATE",
        "is a PCM loudness heuristic; only synchronized external audio/video",
        "timestamps can establish actual heard-speech-to-pixel delay.",
        "In background, UI events will be absent because TextView is not visible.",
    ]
    (target / "latency_summary.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("zip_or_jsonl", help="Exported Galaxy v11 ZIP, directory, or latency-trace.jsonl")
    p.add_argument("--output", default="galaxy-latency-report")
    args = p.parse_args()
    analyze(read_lines(args.zip_or_jsonl), Path(args.output))
