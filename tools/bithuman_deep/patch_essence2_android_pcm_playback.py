#!/usr/bin/env python3
"""Narrow app-build fix for the archived bitHuman Essence2 Android PCM path.

Runs AFTER prepare_essence2_function_trace.py. The original AAR, native SDK,
model files, GPU auto-selection, and archived pristine plugin remain unmodified.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def replace_once(text: str, before: str, after: str, label: str) -> str:
    hits = text.count(before)
    if hits != 1:
        raise AssertionError(f"{label}: expected exactly one anchor, found {hits}")
    return text.replace(before, after, 1)


def run(app: Path, plugin: Path, report: Path) -> None:
    player = plugin / "android/src/main/kotlin/ai/bithuman/flutter/AvatarPlayer.kt"
    source = player.read_text(encoding="utf-8")
    # Instrumentation from prepare_essence2_function_trace.py owns "val write".
    source = replace_once(
        source,
        "                    val write = runCatching { track.write(u.audio, 0, u.audio.size) }\n",
        """                    // AudioTrack.write may return fewer bytes than requested on a real phone.
                    // Never discard the remainder or advance the unit clock on a short write.
                    // Keep the original audio track, speech-unit order and cancellation epoch.
                    val write = runCatching {
                        var offset = 0
                        var noProgress = 0
                        while (running && u.epoch == epoch && offset < u.audio.size) {
                            val remaining = u.audio.size - offset
                            val n = track.write(u.audio, offset, remaining)
                            if (n < 0) throw IllegalStateException("AudioTrack.write failed: $n")
                            if (n == 0) {
                                if (++noProgress > 16)
                                    throw IllegalStateException("AudioTrack.write made no progress")
                                Thread.sleep(1)
                                continue
                            }
                            if (n < remaining) {
                                HitelE2Trace.event("audio.track.partial",
                                    "seq" to u.seq, "kind" to u.kind,
                                    "remainingBytes" to remaining, "acceptedBytes" to n,
                                    "offsetBytes" to offset)
                            }
                            offset += n
                            noProgress = 0
                        }
                        offset
                    }
""",
        "write short-retry preserving PCM ordering",
    )
    assert "val write = runCatching { track.write(u.audio, 0, u.audio.size) }" not in source
    player.write_text(source, encoding="utf-8")

    main = app / "lib/main.dart"
    text = main.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "BithumanAvatar.load(agentDir, engine: _engine, apiSecret: secret)",
        "BithumanAvatar.load(agentDir, engine: _engine, apiSecret: secret, skipAhead: true)",
        "original Essence2 SDK opt-in playout skip-ahead for slower GPU rendering",
    )
    main.write_text(text, encoding="utf-8")

    runtime = (app / "lib/hitel_offline_runtime.dart").read_text(encoding="utf-8")
    engine = (plugin / "android/src/main/kotlin/ai/bithuman/flutter/AvatarEngine.kt").read_text(encoding="utf-8")
    android_plugin = (plugin / "android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt").read_text(encoding="utf-8")
    assert "sendAudioDelta" in runtime, "must retain existing Dart loopback PCM source"
    assert "Essence2Engine(avatar, zeroCopy = !forceCopy, playoutClock = clockOn)" in android_plugin
    assert "zeroCopy && runCatching { avatar.useHardwareBuffers(HW_SLOTS) }" in engine
    assert "val forceCopy = true" not in android_plugin
    assert not (plugin / "android/src/main/kotlin/ai/bithuman/flutter/HitelKoreanTts.kt").exists()

    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(
        json.dumps({
            "mode": "DART_PCM_FILE_ORIGINAL_ESSENCE2_GPU",
            "sdkPlayoutSkipAheadRequested": True,
            "androidHardwareBufferAutoSelectPreserved": True,
            "audioTrackPartialWriteRetries": True,
            "audioTrackPartialWriteTrace": "audio.track.partial",
            "nativeSdkOrAvatarModelModified": False,
            "ttsOrSttInstalled": False,
            "physicalGpuPlaybackVerified": False,
            "physicalAudioVerified": False,
        }, indent=2) + "\n", encoding="utf-8",
    )
    print("PASS_ORIGINAL_ESSENCE2_GPU_PCM_SKIP_AHEAD_AND_AUDIO_TRACK_RETRY")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", required=True, type=Path)
    parser.add_argument("--plugin", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    a = parser.parse_args()
    run(a.app, a.plugin, a.report)
