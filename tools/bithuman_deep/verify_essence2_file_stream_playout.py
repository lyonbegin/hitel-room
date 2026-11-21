#!/usr/bin/env python3
"""Require the file reply to reach the native speaker and finish rendering."""
import argparse
from collections import defaultdict
import json
from pathlib import Path
import subprocess
import time

from analyze_essence2_e2trace import parse_line


def summarize(trace):
    stages = defaultdict(list)
    for line in trace.splitlines():
        row = parse_line(line)
        stage = row.get("stage")
        if stage == "file.decode.begin":
            stages.clear()
        if stage:
            stages[stage].append(row)

    def last(stage):
        return stages[stage][-1] if stages[stage] else {}

    def number(row, key):
        return int(row.get(key, 0))

    decoded = last("file.decode.done")
    drain = last("sdk.utterance.drained")
    display = last("display.present")
    file_bytes = number(decoded, "bytes24k")
    fed_bytes = sum(number(row, "convertedPcm24kBytes") for row in stages["audio.feed.converted"])
    audio_write = any(
        row.get("kind") in {"S", "C", "T"}
        and number(row, "returnedBytes") == number(row, "pcmBytes") > 0
        for row in stages["audio.track.write"]
    )
    shown = number(display, "uniqueShown")
    idle_after_drain = (
        display.get("kind") == "I"
        and number(display, "monotonicNs") > number(drain, "monotonicNs")
    )
    checks = {
        "file_decoded": file_bytes > 0,
        "source_pcm_reached_engine": file_bytes > 0 and fed_bytes == file_bytes,
        "voice_audio_written": audio_write,
        "mouth_frame_presented": shown > 0,
        "native_turn_completed": drain.get("complete") == "true",
        "returned_to_idle": bool(drain) and idle_after_drain,
    }
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "chunks": number(decoded, "chunks"),
        "file_pcm_bytes": file_bytes,
        "native_pcm_bytes": fed_bytes,
        "max_feed_ms": max(
            (number(row, "durationUs") for row in stages["sdk.feed.end"]), default=0
        ) / 1000,
        "unique_shown": shown,
        "due": number(display, "due"),
        "stale_count": number(last("player.frame.stale"), "staleCount"),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--timeout", type=float, default=240)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + args.timeout
    while True:
        trace = subprocess.check_output(
            ["adb", "logcat", "-d", "-v", "threadtime", "-s", "HITEL_E2TRACE:I"],
            text=True,
            errors="replace",
            timeout=20,
        )
        result = summarize(trace)
        if result["passed"] or time.monotonic() >= deadline:
            break
        time.sleep(5)
    (args.output / "file-reply-native.txt").write_text(trace)
    (args.output / "file-reply-playout.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result), flush=True)
    return int(not result["passed"])


if __name__ == "__main__":
    raise SystemExit(main())
