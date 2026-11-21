#!/usr/bin/env python3
"""Require the file reply to reach the native speaker and finish rendering."""
import argparse
from collections import defaultdict
import json
from pathlib import Path
import re
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


def summarize_original(trace):
    decoded = {}
    fed_samples = 0
    finished_shown = 0
    finished_due = 0
    observed_shown = 0
    observed_due = 0
    frozen = False
    for line in trace.splitlines():
        row = parse_line(line)
        if row.get("stage") == "file.decode.begin":
            decoded, fed_samples = {}, 0
            finished_shown, finished_due = 0, 0
            observed_shown, observed_due = 0, 0
            frozen = False
        elif row.get("stage") == "file.decode.done":
            decoded = row
        feed = re.search(r"\bbhfeed\s*:\s*\+(\d+) fed=", line)
        if feed:
            fed_samples += int(feed[1])
        utterance = re.search(r"\bbhcov\s*:\s*UTT \d+ unique=(\d+) due=(\d+)", line)
        if utterance:
            finished_shown += int(utterance[1])
            finished_due += int(utterance[2])
        coverage = re.search(r"\bCOVERAGE .*?uniqueShown=(\d+) due=(\d+)", line)
        if coverage:
            observed_shown, observed_due = int(coverage[1]), int(coverage[2])
        if re.search(r"\bbhcov\s*:\s*FROZEN utterance=", line):
            frozen = True

    file_bytes = int(decoded.get("bytes24k", 0))
    # The stock player maps every 3 input bytes to one 16 kHz sample
    # and schedules a 24 kHz, 16-bit audio unit per 25 fps speech frame.
    expected_units = file_bytes // (24000 * 2 // 25)
    shown = max(finished_shown, observed_shown)
    due = max(finished_due, observed_due)
    checks = {
        "file_decoded": file_bytes > 0,
        "source_pcm_reached_engine": file_bytes > 0 and fed_samples * 3 == file_bytes,
        "voice_units_presented": expected_units > 0 and due >= expected_units,
        "mouth_frame_presented": shown > 0,
        "no_coverage_freeze": not frozen,
        "utterance_finished": expected_units > 0 and finished_due >= expected_units,
    }
    return {
        "passed": all(checks.values()),
        "checks": checks,
        "chunks": int(decoded.get("chunks", 0)),
        "file_pcm_bytes": file_bytes,
        "native_pcm_bytes": fed_samples * 3,
        "expected_units": expected_units,
        "unique_shown": shown,
        "due": due,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--timeout", type=float, default=240)
    parser.add_argument("--original-playback", action="store_true")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + args.timeout
    tags = ["HITEL_E2TRACE:I"]
    if args.original_playback:
        tags.extend(["bhfeed:I", "bhcov:I", "BithumanAvatar:I"])
    while True:
        trace = subprocess.check_output(
            ["adb", "logcat", "-d", "-v", "threadtime", "-s", *tags],
            text=True,
            errors="replace",
            timeout=20,
        )
        result = summarize_original(trace) if args.original_playback else summarize(trace)
        if result["passed"] or time.monotonic() >= deadline:
            break
        time.sleep(5)
    (args.output / "file-reply-native.txt").write_text(trace)
    (args.output / "file-reply-playout.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result), flush=True)
    return int(not result["passed"])


if __name__ == "__main__":
    raise SystemExit(main())
