#!/usr/bin/env python3
"""Measure the official Flutter SDK's native Essence2 PCM streaming, not a rendered fixture.
Requires actual typed user turn, feed before response.done, nonempty device audio,
and real speech frames. Do not equate render callbacks with sound quality.
"""
import argparse
import json
import re
from pathlib import Path

def number(line, key):
    match = re.search(r"\b" + re.escape(key) + r"=(\d+)", line)
    return int(match.group(1)) if match else None

def run(native, protocol, report):
    events = [x for x in protocol.read_text(errors="replace").splitlines()
              if "[HITEL_AI_E2E]" in x]
    trace = native.read_text(errors="replace").splitlines()
    typed = [number(x, "wallMs") for x in events if "ui.text.submit " in x]
    typed = [x for x in typed if x is not None]
    start = typed[-1] if typed else None
    done = [number(x, "wallMs") for x in events if "client.rx type=response.done" in x]
    done = [x for x in done if x is not None and (start is None or x >= start)]
    stop = done[0] if done else None
    def after(rows, pattern, until=None):
        found = []
        for line in rows:
            timestamp = number(line, "wallMs")
            if timestamp is None or start is None or timestamp < start:
                continue
            if until is not None and timestamp >= until:
                continue
            if pattern(line):
                found.append((timestamp, line))
        return found
    feed = after(trace, lambda x: "stage=sdk.feed.begin" in x)
    feed_before_done = after(trace, lambda x: "stage=sdk.feed.begin" in x, stop)
    positive_writes = after(trace, lambda x:
        "stage=audio.track.write" in x and
        (number(x, "returnedBytes") or 0) > 0)
    frames = after(trace, lambda x:
        "stage=display.present" in x and
        "kind=S" in x and "newMouthFrame=true" in x)
    first_write = positive_writes[0][0] if positive_writes else None
    snapshots = [{
        "uniqueShown": number(line, "uniqueShown"),
        "due": number(line, "due"),
        "speechPresented": number(line, "speechPresented")
    } for _,line in frames]
    best = max(snapshots, key=lambda x: (x["due"] or 0, x["uniqueShown"] or 0), default={})
    checks = {
        "typed_input": start is not None,
        "mock_reply_done": stop is not None,
        "original_sdk_fed_before_response_done": bool(feed_before_done),
        "actual_native_audio_write": bool(positive_writes),
        "actual_speech_frame_presented": bool(frames)
    }
    result = {
        "passed": all(checks.values()), "checks": checks,
        "source": "pristine Flutter 2.6.37 AvatarPlayer MODE_STREAM; fixed local PCM mock",
        "original_model_modified": False, "physical_device_tested": False,
        "turn_start_ms": start, "response_done_ms": stop,
        "first_sdk_feed_ms": feed[0][0] if feed else None,
        "feed_before_done_count": len(feed_before_done),
        "first_audio_write_ms": first_write,
        "time_to_first_native_audio_ms":
            first_write - start if first_write is not None and start is not None else None,
        "speech_frame_events": len(frames),
        "last_speech_frame_snapshot": best,
        "visual_lipsync_accuracy_verified": False,
        "actual_speaker_waveform_verified": False
    }
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    if not result["passed"]:
        raise SystemExit("FAIL_ORIGINAL_ESSENCE2_REAL_PCM_STREAM_NOT_VERIFIED")
    print("PASS_ORIGINAL_ESSENCE2_PCM_FEED_AUDIO_FRAME_CAUSALITY")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--native", type=Path, required=True)
    p.add_argument("--protocol", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    a = p.parse_args()
    run(a.native, a.protocol, a.report)
