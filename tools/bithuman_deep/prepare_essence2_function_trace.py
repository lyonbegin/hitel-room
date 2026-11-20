#!/usr/bin/env python3
"""Patch the disposable local Essence 2 plugin, never vendor JNI or model bytes."""
from pathlib import Path
import argparse
import json

PKG = "android/src/main/kotlin/ai/bithuman/flutter"

def one(s, old, new, label):
    n = s.count(old)
    if n != 1:
        raise AssertionError("E2TRACE_ANCHOR_MISMATCH " + label + " matches=" + str(n))
    return s.replace(old, new, 1)

def patch(path, changes):
    s = path.read_text()
    for label, anchor, replacement in changes:
        s = one(s, anchor, replacement, label)
    path.write_text(s)
    return len(changes)

def run(app, plugin, source, report):
    folder = plugin / PKG
    assert folder.is_dir()
    target = folder / "HitelE2Trace.kt"
    assert not target.exists()
    target.write_bytes(source.read_bytes())
    plugin_file = folder / "BithumanPlugin.kt"
    count = patch(plugin_file, [
        ("entry", "        val (entry, texture) = newTexture()\n", """        HitelE2Trace.init(context)
        HitelE2Trace.event("load.begin", "engine" to canonical, "agent" to code,
            "secretPresent" to !secret.isNullOrBlank(),
            "skipAheadRequested" to skipAhead,
            "apiLevel" to android.os.Build.VERSION.SDK_INT,
            "abi" to android.os.Build.SUPPORTED_ABIS.firstOrNull())
        val (entry, texture) = newTexture()
"""),
        ("load-result", "                // A cancel that came while the engine was being created: close it, start no player.\n",
         """                HitelE2Trace.event("load.engine.created", "engine" to avatar.name,
                    "width" to avatar.width, "height" to avatar.height,
                    "fpsConfigured" to avatar.fps, "hardwareFrames" to avatar.hardwareFrames,
                    "elapsedMs" to (System.nanoTime() - t0) / 1000000)
                // A cancel that came while the engine was being created: close it, start no player.
"""),
        ("load-error", "            } catch (e: Throwable) {\n                // Asked for (BithumanAvatar.cancelLoad, or clearCredentials):",
         """            } catch (e: Throwable) {
                HitelE2Trace.failure("load.exception", e, "engine" to canonical,
                    "elapsedMs" to (System.nanoTime() - t0) / 1000000)
                // Asked for (BithumanAvatar.cancelLoad, or clearCredentials):"""),
        ("fetch-start", "                val originalBundle = HitelEssence2PublicAndroidBundle.fetch(\n",
         """                val fetchAt = System.nanoTime()
                HitelE2Trace.event("model.localFetch.begin", "agent" to code)
                val originalBundle = HitelEssence2PublicAndroidBundle.fetch(
"""),
        ("fetch-complete", "                originalBundle\n            },\n            setCredential = { s -> Essence2Credential.set(s) },",
         """                HitelE2Trace.event("model.localFetch.end",
                    "elapsedMs" to (System.nanoTime() - fetchAt) / 1000000,
                    "files" to (originalBundle.dir.listFiles()?.size ?: -1))
                originalBundle
            },
            setCredential = { s -> Essence2Credential.set(s) },"""),
        ("create-sdk", "            create = { bundle -> createEssence2(store!!, code, bundle, handle) },",
         """            create = { bundle ->
                val began = System.nanoTime()
                HitelE2Trace.event("sdk.create.begin", "agent" to code)
                try {
                    createEssence2(store!!, code, bundle, handle).also {
                        HitelE2Trace.event("sdk.create.end",
                            "elapsedMs" to (System.nanoTime() - began) / 1000000,
                            "width" to it.width, "height" to it.height,
                            "targetFrames" to it.targetFrames)
                    }
                } catch (err: Throwable) {
                    HitelE2Trace.failure("sdk.create.exception", err,
                        "elapsedMs" to (System.nanoTime() - began) / 1000000)
                    throw err
                }
            },"""),
        ("surface-invalid", "            if (!surface.isValid) return\n",
         """            if (!surface.isValid) {
                HitelE2Trace.event("surface.invalid", "hardwareCanvas" to hwCanvas)
                return
            }
"""),
        ("surface-post", "            framesDrawn++\n            if (!ready.getAndSet(true))",
         """            framesDrawn++
            if (framesDrawn <= 3L || framesDrawn % 25L == 0L)
                HitelE2Trace.event("surface.post.ok", "frames" to framesDrawn,
                    "hardwareCanvas" to hwCanvas, "bitmapWidth" to bmp.width,
                    "bitmapHeight" to bmp.height)
            if (!ready.getAndSet(true))"""),
        ("surface-lock-failure", '                if (!stopped.get()) Log.w(TAG, "lock',
         '                HitelE2Trace.failure("surface.lock.exception", e, "hardwareCanvas" to hwCanvas)\n                if (!stopped.get()) Log.w(TAG, "lock'),
        ("surface-post-failure", '                    if (!stopped.get() && !texture.surfaceGone) Log.w(TAG, "unlockCanvasAndPost',
         '                    HitelE2Trace.failure("surface.post.exception", e)\n                    if (!stopped.get() && !texture.surfaceGone) Log.w(TAG, "unlockCanvasAndPost'),
        ("gpu-choice", "        val e = Essence2Engine(avatar, zeroCopy = !forceCopy, playoutClock = clockOn)\n",
         """        val e = Essence2Engine(avatar, zeroCopy = !forceCopy, playoutClock = clockOn)
        HitelE2Trace.event("gpu.routing",
            "hardwareFrames" to e.hardwareFrames, "forcedCpuCopy" to forceCopy,
            "skipAhead" to clockOn, "clockLever" to clockLever,
            "renderWidth" to avatar.width, "renderHeight" to avatar.height)
""")
    ])
    engine = folder / "AvatarEngine.kt"
    count += patch(engine, [
        ("gpu-reason", '        .onFailure { Log.w("bhav",',
         '        .onFailure { HitelE2Trace.failure("gpu.hardwareBuffer.exception", it, "requested" to zeroCopy); Log.w("bhav",'),
        ("gpu-result", '        .isSuccess\n    override val width get() = avatar.width',
         """        .isSuccess
    init {
        HitelE2Trace.event("gpu.hardwareBuffer.result",
            "hardwareFrames" to hardwareFrames, "frameSlots" to HW_SLOTS,
            "width" to avatar.width, "height" to avatar.height,
            "fpsConfigured" to FPS, "skipAhead" to playoutClock)
    }
    override val width get() = avatar.width"""),
        ("resetAudio", '        clock.reset(uttBase) { avatar.resetAudio(startFrame = synchronized(idleLock) { cursor }) }\n        utterances++',
         """        val resetAt = System.nanoTime()
        HitelE2Trace.event("sdk.resetAudio.begin", "base16k" to uttBase, "cursor" to cursor)
        clock.reset(uttBase) { avatar.resetAudio(startFrame = synchronized(idleLock) { cursor }) }
        HitelE2Trace.event("sdk.resetAudio.end",
            "durationUs" to (System.nanoTime() - resetAt) / 1000)
        utterances++"""),
        ("feed", "        avatar.feed(f16k)\n        uttFed += f16k.size",
         """        val began = System.nanoTime()
        HitelE2Trace.event("sdk.feed.begin", "samples16k" to f16k.size,
            "fedBefore" to uttFed, "open" to open, "closed" to closed)
        try {
            avatar.feed(f16k)
        } catch (err: Throwable) {
            HitelE2Trace.failure("sdk.feed.exception", err,
                "samples16k" to f16k.size,
                "durationUs" to (System.nanoTime() - began) / 1000)
            throw err
        }
        uttFed += f16k.size
        HitelE2Trace.event("sdk.feed.end",
            "durationUs" to (System.nanoTime() - began) / 1000,
            "fedAfter" to uttFed, "sdkQueued" to avatar.available())"""),
        ("end-audio", '        if (open && !closed) { avatar.endOfAudio(); closed = true; queued = avatar.available() }',
         """        if (open && !closed) {
            val began = System.nanoTime()
            HitelE2Trace.event("sdk.endOfAudio.begin", "fed16k" to uttFed)
            avatar.endOfAudio(); closed = true; queued = avatar.available()
            HitelE2Trace.event("sdk.endOfAudio.end",
                "durationUs" to (System.nanoTime() - began) / 1000, "sdkQueued" to queued)
        }"""),
        ("sdk-pull-exception", "            val got = if (hardwareFrames) hf != null else avatar.pull(buf!!)\n",
         """            val got = try {
                if (hardwareFrames) hf != null else avatar.pull(buf!!)
            } catch (err: Throwable) {
                HitelE2Trace.failure("sdk.pull.exception", err,
                    "hardwareFrame" to hardwareFrames, "bufferCapacity" to (buf?.capacity() ?: -1))
                throw err
            }
"""),
        ("sdk-hw-exception", '            val hf: Essence2HardwareFrame? = if (hardwareFrames) avatar.pullHardwareBuffer() else null\n',
         """            val hf: Essence2HardwareFrame? = try {
                if (hardwareFrames) avatar.pullHardwareBuffer() else null
            } catch (err: Throwable) {
                HitelE2Trace.failure("sdk.pullHardwareBuffer.exception", err)
                throw err
            }
"""),
        ("sdk-pull-result", "            val k = if (got) avatar.lastFrameIndex else -1L\n",
         """            val k = if (got) avatar.lastFrameIndex else -1L
            if (got || (System.nanoTime() / 1000000000L) % 7L == 0L)
                HitelE2Trace.event("sdk.pull.result", "frame" to got,
                    "ordinal" to k, "durationUs" to (System.nanoTime() - t0) / 1000,
                    "hardwareFrame" to hardwareFrames, "readyDepth" to ready.size,
                    "sdkAvailable" to avatar.available(), "generation" to g)
"""),
        ("render-queue", '            } else { renderBackoff.served(); buf?.rewind(); ready.offer(Rendered(buf, hf, at, g)) }',
         """            } else {
                renderBackoff.served(); buf?.rewind()
                val accepted = ready.offer(Rendered(buf, hf, at, g))
                HitelE2Trace.event("render.queue", "accepted" to accepted,
                    "at16k" to at, "readyDepth" to ready.size, "gen" to g)
                if (!accepted) HitelE2Trace.event("render.queue.full", "depth" to DEPTH)
            }""")
    ])
    player = folder / "AvatarPlayer.kt"
    count += patch(player, [
        ("received-frame", '                lastPullOk = f >= 0\n',
         """                if (f >= 0) HitelE2Trace.event("player.pull.received",
                    "at16k" to f, "slot" to slot, "epoch" to e,
                    "engineQueued" to avatar.queuedFrames,
                    "durationUs" to (System.nanoTime() - t0) / 1000)
                lastPullOk = f >= 0
"""),
        ("stale-frame", "                if (stale) { heldFrom = -1L; continue }",
         """                if (stale) {
                    HitelE2Trace.event("player.frame.stale",
                        "atBytes" to heldFrom, "headBytes" to head,
                        "staleCount" to nStale)
                    heldFrom = -1L; continue
                }"""),
        ("feed-conversion", '                        nFed16k += whole.size / 3\n',
         """                        nFed16k += whole.size / 3
                        HitelE2Trace.event("audio.feed.converted",
                            "inputPcm24kBytes" to pcm.size,
                            "convertedPcm24kBytes" to whole.size,
                            "carryBytes" to carry.size,
                            "fed16kSamples" to nFed16k,
                            "engineQueue" to avatar.queuedFrames)
"""),
        ("admitted-unit", "        admit(AvUnit(sessionSamples, f, e, true, stats.turnGen, body, seq, kind, fedEnd, fedGen))",
         """        if (kind == 'S' || seq % 25L == 0L)
            HitelE2Trace.event("player.unit.admit",
                "seq" to seq, "kind" to kind, "epoch" to e,
                "pts24k" to sessionSamples, "audioBytes" to body.size,
                "writeQueue" to toWrite.size, "presentQueue" to toPresent.size,
                "slot" to slot, "headBytes" to head)
        admit(AvUnit(sessionSamples, f, e, true, stats.turnGen, body, seq, kind, fedEnd, fedGen))"""),
        ("audio-track-write", "                    runCatching { track.write(u.audio, 0, u.audio.size) }",
         """                    val write = runCatching { track.write(u.audio, 0, u.audio.size) }
                    if (u.kind == 'S' || (u.speech && nWritten % 25L == 0L) ||
                        write.isFailure || write.getOrNull() != u.audio.size)
                        HitelE2Trace.event("audio.track.write",
                            "seq" to u.seq, "kind" to u.kind,
                            "pcmBytes" to u.audio.size,
                            "returnedBytes" to (write.getOrNull() ?: -999),
                            "durationUs" to (System.nanoTime() - writeT0) / 1000,
                            "head24k" to track.playbackHeadPosition,
                            "writeQueue" to toWrite.size)
                    write.exceptionOrNull()?.let {
                        HitelE2Trace.failure("audio.track.write.exception", it, "seq" to u.seq)
                    }"""),
        ("present-surface", "        onFrame(u.frame)\n",
         """        if (u.kind == 'S' || shown % 25L == 0L)
            HitelE2Trace.event("display.present",
                "seq" to u.seq, "kind" to u.kind,
                "newMouthFrame" to (u.kind == 'S'),
                "pts24k" to u.ptsSamples, "deviceClock24k" to pos,
                "late24k" to (pos - u.ptsSamples),
                "speechWritten" to nWriteSpeech, "speechPresented" to nPresSpeech,
                "uniqueShown" to coverage.uniqueTotal, "due" to coverage.dueTotal,
                "coveragePct" to coverage.coveragePct,
                "coalesced" to nCoalesced, "presentQueue" to toPresent.size)
        try { onFrame(u.frame) } catch (err: Throwable) {
            HitelE2Trace.failure("display.onFrame.exception", err, "seq" to u.seq)
            throw err
        }
""")
    ])
    main = app / "lib/main.dart"
    count += patch(main, [
        ("dart-clipboard-load", "      final detail = 'HITEL Essence 2 Android diagnostics\\n'\n",
         """      final nativeFile = File('__DOLLAR__{dir.path}/hitel_e2_trace.log');
      final trace = await nativeFile.exists()
          ? await nativeFile.readAsString() : '(native trace unavailable)';
      final previousNativeFile = File('__DOLLAR__{dir.path}/hitel_e2_trace.previous.log');
      final previousTrace = await previousNativeFile.exists()
          ? await previousNativeFile.readAsString() : '';
      final headSource = previousTrace.isNotEmpty ? previousTrace : trace;
      final traceHead = (previousTrace.isNotEmpty || trace.length > 100000)
          ? headSource.substring(0, headSource.length > 12000 ? 12000 : headSource.length)
          : '';
      final traceTail = trace.length > 100000
          ? trace.substring(trace.length - 100000) : trace;
      final detail = 'HITEL Essence 2 Android diagnostics\\n'
""".replace("__DOLLAR__", "$")),
        ("dart-clipboard-append", "          '--- boot_status.txt ---\\n$safe';",
         """          '--- boot_status.txt ---\\n$safe\\n'
          '--- hitel_e2_trace.log head / previous rotation ---\\n$traceHead\\n'
          '--- hitel_e2_trace.log recent ---\\n$traceTail';""")
    ])
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({
        "patchedAnchors": count,
        "traceFile": "app_flutter/hitel_e2_trace.log",
        "clipboardExport": "first 12000 chars of previous rotation or boot plus last 100000 chars of current trace",
        "rotateAtBytes": 4194304,
        "eventIdFields": ["seq", "monotonicNs", "tid", "thread", "stage"],
        "functionStages": [
            "load.begin/engine.created/exception", "model.localFetch.begin/end",
            "sdk.create.begin/end/exception", "gpu.routing/hardwareBuffer.result/exception",
            "sdk.resetAudio.begin/end", "sdk.feed.begin/end/exception", "sdk.pull.result/exception",
            "render.queue", "player.pull.received", "player.frame.stale",
            "audio.feed.converted", "player.unit.admit", "audio.track.write",
            "display.present", "surface.post.ok/exception"
        ],
        "recordsRawPCM": False, "recordsApiSecret": False,
        "nativeSDKOrModelModified": False,
        "phonePhysicalGpuVerified": False
    }, indent=2) + "\n")
    print("PASS_E2TRACE_INSTRUMENTED_ANCHORS=" + str(count))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", required=True, type=Path)
    parser.add_argument("--plugin", required=True, type=Path)
    parser.add_argument("--trace-source", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    run(args.app, args.plugin, args.trace_source, args.report)
