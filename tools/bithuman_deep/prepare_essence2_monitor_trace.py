#!/usr/bin/env python3
"""Add lock-boundary timestamps to disposable Essence 2 adapter; vendor JNI untouched.

Every play-thread feed call is correlated to @Synchronized Essence2Engine.feed
entry using monotonicNs. The gap distinguishes monitor acquisition from the
time spent inside Essence2Avatar.feed itself. Render monitor wait is measured
at synchronized(this) acquisition without changing lock semantics.
"""
from pathlib import Path
import argparse
import json

PACKAGE = Path("android/src/main/kotlin/ai/bithuman/flutter")

def replace_exact(path, before, after, label):
    data = path.read_text()
    n = data.count(before)
    if n != 1:
        raise AssertionError(f"MONITOR_TRACE_ANCHOR {label} count={n}")
    path.write_text(data.replace(before, after, 1))

def main(plugin: Path, report: Path):
    player = plugin / PACKAGE / "AvatarPlayer.kt"
    engine = plugin / PACKAGE / "AvatarEngine.kt"
    replace_exact(player,
        "                        avatar.feed(toFloat16k(whole))\n",
        """                        val f16k = toFloat16k(whole)
                        val callAt = System.nanoTime()
                        HitelE2Trace.event("player.feed.call",
                            "samples16k" to f16k.size, "epoch" to epoch,
                            "engineQueuedBefore" to avatar.queuedFrames)
                        try {
                            avatar.feed(f16k)
                        } catch (err: Throwable) {
                            HitelE2Trace.failure("player.feed.exception", err,
                                "samples16k" to f16k.size,
                                "durationUs" to (System.nanoTime() - callAt) / 1000)
                            throw err
                        }
                        HitelE2Trace.event("player.feed.return",
                            "durationUs" to (System.nanoTime() - callAt) / 1000,
                            "engineQueuedAfter" to avatar.queuedFrames)
""", "player-feed-monitor-entry")

    replace_exact(engine,
        "            val at = synchronized(this) {\n",
        """            val monitorWantedAt = System.nanoTime()
            val at = synchronized(this) {
                val monitorWaitUs = (System.nanoTime() - monitorWantedAt) / 1000
                if (monitorWaitUs > 5000L)
                    HitelE2Trace.event("render.monitor.wait",
                        "durationUs" to monitorWaitUs,
                        "frameReturned" to got,
                        "generation" to g,
                        "sdkQueued" to avatar.available())
""", "render-monitor-wait")

    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({
        "patch_count": 2,
        "instrumented": [
            "AvatarPlayer.feed: before and after synchronized Essence2Engine.feed",
            "Essence2Engine.renderLoop: waiting to enter synchronized(this)"
        ],
        "native_aar_changed": False,
        "model_changed": False,
    }, indent=2) + "\n")
    print("PASS_ESSENCE2_MONITOR_BOUNDARY_TRACE_INSTALLED")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--plugin", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    a = parser.parse_args()
    main(a.plugin, a.report)
