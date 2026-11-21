#!/usr/bin/env python3
"""Adapt the pinned bitHuman player to HITEL's 16 kHz PCM file playback.

Only the temporary Flutter plugin used to build the test APK is patched.
The direct file renderer remains available for a same-APK comparison.
"""
from pathlib import Path
import argparse
import re
import shutil


def replace_one(source: str, old: str, new: str, tag: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{tag}: expected one anchor, found {count}")
    return source.replace(old, new, 1)


def patch_sync_player(folder: Path) -> None:
    path = folder / "AvatarPlayer.kt"
    source = replace_one(path.read_text(),
        '    private val onFrame: (Bitmap) -> Unit,\n',
        '    private val feedFilePcm16: ((ByteArray) -> Unit)? = null,\n'
        '    private val onFrame: (Bitmap) -> Unit,\n',
        "allow 16 kHz file PCM input")
    body, companion = source.split("    companion object {", 1)
    # The producer, device writes, presenter, and sync marker share a clock.
    # Keep the 24 kHz public constants and converter for existing callers.
    body = re.sub(r'\bRATE\b', 'playbackRate', body)
    body = body.replace('BYTES_PER_SAMPLE16', 'pcmBytesPerSdkSample')
    body = replace_one(body,
        '    val SAMPLES_PER_FRAME = playbackRate / avatar.fps',
        '    private val playbackRate = if (feedFilePcm16 == null) RATE else 16_000\n'
        '    private val pcmBytesPerSdkSample = if (feedFilePcm16 == null) BYTES_PER_SAMPLE16 else 2L\n'
        '    private val pcmAlignment = if (feedFilePcm16 == null) 6 else 2\n'
        '    private val clickSamples = playbackRate * 12 / 1000\n'
        '    val SAMPLES_PER_FRAME = playbackRate / avatar.fps',
        "one sample timeline for SDK and playback")
    body = replace_one(body, 'val usable = joined.size / 6 * 6',
        'val usable = joined.size / pcmAlignment * pcmAlignment', "preserve odd numbers of PCM16 samples")
    body = replace_one(body, '                        avatar.feed(toFloat16k(whole))\n',
        '                        if (feedFilePcm16 == null) avatar.feed(toFloat16k(whole))\n'
        '                        else feedFilePcm16.invoke(whole)\n', "feed the same PCM bytes played by AudioTrack")
    body = replace_one(body,
        '                    (if (heldFrameReply == replyOfHead() && head + BYTES_PER_FRAME <= audioLen) take(head + BYTES_PER_FRAME) else null)\n',
        '                    (if (feedFilePcm16 == null && heldFrameReply == replyOfHead() && head + BYTES_PER_FRAME <= audioLen) {\n'
        '                        take(head + BYTES_PER_FRAME)\n'
        '                    } else null)\n',
        "leave speech queued while a matching video frame is missing")
    body = replace_one(body,
        '                        lastSpeechSlot >= 0 && head + BYTES_PER_FRAME <= heldFrom -> {\n',
        '                        lastSpeechSlot >= 0 && head + BYTES_PER_FRAME <= heldFrom &&\n'
        '                            (feedFilePcm16 == null || heldFrameReply == replyOfHead()) -> {\n',
        "keep catch-up units within the same reply")
    body = replace_one(body, '                    runCatching { track.write(u.audio, 0, u.audio.size) }\n',
        '                    if (feedFilePcm16 == null) runCatching { track.write(u.audio, 0, u.audio.size) }\n'
        '                    else if (!writeFileUnit(u)) { u = toWrite.poll(); continue }\n',
        "publish a unit after its full audio write")
    body = replace_one(body, '    private fun handToPresenter(u: AvUnit) {\n',
        '''    private fun handToPresenter(u: AvUnit) {
        if (feedFilePcm16 != null && u.speech) {
            HitelE2Trace.event("sync.audio.commit", "epoch" to u.epoch, "turn" to u.turnGen,
                "kind" to u.kind, "ptsSamples" to u.ptsSamples, "samples" to (u.audio.size / 2),
                "spokenSamples" to (if (carriesAudio(u)) u.audio.size / 2 else 0))
        }
''', "trace device commitment of paired audio and video")
    body = replace_one(body, '    private fun writeLoop() {\n',
        '''    // Serialize each non-blocking write with pause/flush. A cancelled unit cannot
    // write its remainder after the device has been rebased to a new epoch.
    private fun writeFileUnit(unit: AvUnit): Boolean {
        var offset = 0
        while (offset < unit.audio.size) {
            val written = synchronized(trackLock) {
                if (!running || unit.epoch != epoch) return false
                track.write(unit.audio, offset, unit.audio.size - offset, AudioTrack.WRITE_NON_BLOCKING)
            }
            check(written >= 0) { "AudioTrack.write=$written, pts=${unit.ptsSamples}" }
            if (written == 0) Thread.sleep(2) else offset += written
        }
        return true
    }

    private fun writeLoop() {
''', "handle partial speaker writes and cancel atomically")
    body = body.replace('whole.size / 3', 'whole.size / pcmBytesPerSdkSample')
    body = body.replace('CLICK_SAMPLES', 'clickSamples')
    companion = replace_one(companion, '        private val CLICK_SAMPLES = RATE * 12 / 1000\n',
        '', "make the marker duration independent of sample rate")
    body = replace_one(body, '        onFrame(u.frame)\n',
        '''        onFrame(u.frame)
        if (feedFilePcm16 != null && u.speech) {
            HitelE2Trace.event("sync.present",
                "epoch" to u.epoch, "turn" to u.turnGen, "kind" to u.kind,
                "ptsSamples" to u.ptsSamples, "audioSamples" to pos, "offsetMs" to stats.offsetMs,
                "dacClock" to tsValid, "uniqueShown" to coverage.uniqueTotal, "due" to coverage.dueTotal,
                "stale" to nStale, "coalesced" to nCoalesced, "held" to nHold,
                "catchUp" to nCatchUp, "underruns" to stats.underruns, "marker" to (u.frame === markerFrame))
        }
''', "report display timing on the audible clock")
    path.write_text(body + "    companion object {" + companion)


def patch_sync_engine(folder: Path) -> None:
    path = folder / "AvatarEngine.kt"
    source = replace_one(path.read_text(),
        '    private val visibility: AppVisibility = AppVisibility.process,\n) : AvatarEngine {',
        '    private val visibility: AppVisibility = AppVisibility.process,\n'
        '    private val fileTrace: Boolean = false,\n) : AvatarEngine {',
        "enable file diagnostics only for the test engine")
    source = replace_one(source, '    private val pending = ArrayList<FloatArray>()\n',
        '    private class PendingInput(val samples: Int, val feed: () -> Unit)\n'
        '    private val pending = ArrayList<PendingInput>()\n', "queue either supported SDK input during tail drain")
    source = replace_one(source, '''    @Synchronized override fun feed(f16k: FloatArray) {
        if (f16k.isEmpty()) return
        if (closed && open) { pending.add(f16k); pendingN = pending.size; return }
        if (!open || closed) startUtterance()
        avatar.feed(f16k)
        uttFed += f16k.size
''', '''    override fun feed(f16k: FloatArray) = feedSamples(f16k.size) { avatar.feed(f16k) }

    internal fun feedPcm16(pcm: ByteArray) {
        require(pcm.size % 2 == 0) { "16-bit PCM byte length must be even" }
        feedSamples(pcm.size / 2) { avatar.feed(pcm) }
    }

    @Synchronized private fun feedSamples(samples: Int, feed: () -> Unit) {
        if (samples == 0) return
        if (closed && open) { pending.add(PendingInput(samples, feed)); pendingN = pending.size; return }
        if (!open || closed) startUtterance()
        traced("HITEL.e2.feed", feed)
        uttFed += samples
''', "reuse the vendor utterance lifecycle for raw PCM16")
    source = replace_one(source, '            for (p in pending) { avatar.feed(p); uttFed += p.size }\n',
        '            for (p in pending) { traced("HITEL.e2.feed", p.feed); uttFed += p.samples }\n',
        "preserve the sample offset when queued speech starts")
    source = source.replace('avatar.endOfAudio(); closed = true',
        'traced("HITEL.e2.endOfAudio") { avatar.endOfAudio() }; closed = true')
    source = replace_one(source, '    private val clock = PlayoutClock({ avatar.setPlayoutPosition(it) }, { open })\n',
        '''    private inline fun <T> traced(section: String, call: () -> T): T =
        if (fileTrace) HitelE2Trace.section(section, call) else call()

    private val clock = PlayoutClock({ samples ->
        traced("HITEL.e2.setPlayoutPosition") { avatar.setPlayoutPosition(samples) }
    }, { open })
''', "trace independent SDK clock updates")
    source = replace_one(source, '''            val hf: Essence2HardwareFrame? = if (hardwareFrames) avatar.pullHardwareBuffer() else null
            val got = if (hardwareFrames) hf != null else avatar.pull(buf!!)
''', '''            if (fileTrace && android.os.Trace.isEnabled()) {
                android.os.Trace.setCounter("HITEL.e2.motionReady", avatar.available().toLong())
            }
            val cpuStart = if (fileTrace) android.os.Debug.threadCpuTimeNanos() else 0L
            val pullStart = if (fileTrace) System.nanoTime() else 0L
            val hf: Essence2HardwareFrame? = if (hardwareFrames) {
                traced("HITEL.e2.pullHardwareBuffer") { avatar.pullHardwareBuffer() }
            } else null
            val got = if (hardwareFrames) hf != null else traced("HITEL.e2.pullBytes") { avatar.pull(buf!!) }
''', "time actual native pulls in the synced player")
    source = replace_one(source, '            val k = if (got) avatar.lastFrameIndex else -1L\n',
        '''            val k = if (got) avatar.lastFrameIndex else -1L
            if (fileTrace && got) {
                val pullUs = (System.nanoTime() - pullStart) / 1000
                val cpuUs = (android.os.Debug.threadCpuTimeNanos() - cpuStart) / 1000
                HitelE2Trace.event("sync.pull", "sdkFrameIndex" to k, "gpuHardware" to hardwareFrames,
                    "pullUs" to pullUs, "pullThreadCpuUs" to cpuUs, "readyDepth" to ready.size)
            }
''', "separate wall and calling-thread CPU duration")
    path.write_text(source)


def patch(plugin: Path, sources: Path) -> None:
    folder = plugin / "android/src/main/kotlin/ai/bithuman/flutter"
    shutil.copyfile(sources / "OfficialEssence2FileEngine.kt",
                    folder / "OfficialEssence2FileEngine.kt")
    patch_sync_engine(folder)
    patch_sync_player(folder)

    # The existing MediaCodec/MediaExtractor file decoder already provides 16k PCM16.
    # Remove the gratuitous 16 -> 24 -> 16 conversion. Dart merely forwards bytes.
    decoder_path = folder / "HitelFileAudioSource.kt"
    decoder = decoder_path.read_text()
    decoder = replace_one(decoder,
        '            val converter = Pcm16kTo24k() // unchanged original bitHuman stream converter\n',
        '', "remove upsamp")
    decoder = replace_one(decoder,
        '            var bytes24k = 0L\n', '            var bytes16k = 0L\n', "count rate")
    decoder = decoder.replace('digest.update(pcm); bytes24k += pcm.size',
                              'digest.update(pcm); bytes16k += pcm.size')
    decoder = decoder.replace('"totalBytes" to bytes24k', '"totalBytes" to bytes16k')
    decoder = decoder.replace('"bytes24k" to bytes24k', '"bytes16k" to bytes16k')
    decoder = replace_one(decoder, '"wireRate" to 24000', '"wireRate" to 16000',
                          "source format")
    decoder = replace_one(decoder, 'val pcm24 = converter.process(pcm16)',
                          'val pcm24 = pcm16', "identity pcm")
    decoder = replace_one(decoder,
                          '            publish(converter.flush())\n',
                          '', "no upsamp tail")
    decoder = decoder.replace('"pcm24Bytes" to pcm24.size',
                              '"pcm16OutputBytes" to pcm24.size')
    decoder = decoder.replace('"pcmSha256" to hash',
                              '"pcm16Sha256" to hash')
    decoder = decoder.replace('HitelE2Trace.event("file.resample"',
                              'HitelE2Trace.event("file.pcm16.forward"')
    decoder = replace_one(decoder, '"wireRate" to 16000',
                          '"wireRate" to 16000', "wire assert")
    assert "Pcm16kTo24k()" not in decoder
    decoder_path.write_text(decoder)

    target = folder / "BithumanPlugin.kt"
    s = target.read_text()

    # Keep the vendor player as the default. The previous direct renderer
    # remains available on a debuggable build for a controlled comparison.
    s = replace_one(s,
        'import ai.bithuman.elevate.Essence2Avatar\n',
        'import ai.bithuman.elevate.Essence2Avatar\nimport ai.bithuman.elevate.Essence2Options\n',
        "import SDK output options")
    s = replace_one(s,
        '        val avatar = loadInOrder(code, "essence-2", secret, gen, credentials,\n',
        '        val debuggable = (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0\n'
        '        val requestedHeight = if (debuggable && AvatarPlayer.devInt("debug.bh.e2.height") == 720) 720 else 0\n'
        '        val options = Essence2Options(outputHeight = requestedHeight)\n'
        '        val avatar = loadInOrder(code, "essence-2", secret, gen, credentials,\n',
        "choose SDK output height before avatar creation")
    s = replace_one(s,
        'createEssence2(store!!, code, bundle, handle)',
        'createEssence2(store!!, code, bundle, handle, options)',
        "pass SDK output options")
    s = replace_one(s,
        'bundle: Essence2ModelStore.Bundle, handle: LoadHandle): Essence2Avatar =',
        'bundle: Essence2ModelStore.Bundle, handle: LoadHandle, options: Essence2Options): Essence2Avatar =',
        "accept SDK output options")
    for bundle in ("bundle", "fresh"):
        s = replace_one(s,
            f'Essence2Avatar.create({bundle}.dir, java.io.File({bundle}.dir, Essence2Avatar.W2V_MEMBER), 0)',
            f'Essence2Avatar.create({bundle}.dir, options, java.io.File({bundle}.dir, Essence2Avatar.W2V_MEMBER), 0)',
            f"open {bundle} at requested height")
    pos = s.index("private fun loadEssence2(")
    begin = s.index("        val debuggable = ", pos)
    existing = s.index('        val debuggable = ', begin + 1)
    s = s[:existing] + s[s.index('\n', existing) + 1:]
    s = replace_one(s,
        'PlayoutClock.enabled(clockLever, skipAhead, Essence2Engine.SKIP_AHEAD_DEFAULT)',
        'PlayoutClock.enabled(clockLever, skipAhead, false)', "keep every source frame in synchronized mode by default")
    s = replace_one(s,
        '        val e = Essence2Engine(avatar, zeroCopy = !forceCopy, playoutClock = clockOn)\n',
        '''        val direct = debuggable && AvatarPlayer.devInt("debug.bh.e2.sync") == 2
        val e: AvatarEngine = if (direct) {
            OfficialEssence2FileEngine(avatar, java.io.File(context.cacheDir, "e2-official-file"))
        } else {
            Essence2Engine(avatar, zeroCopy = !forceCopy, playoutClock = clockOn, fileTrace = true)
        }
        HitelE2Trace.event("sync.route", "mode" to (if (direct) "direct" else "synchronized"),
            "rate" to 16000, "requestedHeight" to requestedHeight, "width" to avatar.width,
            "height" to avatar.height, "gpuHardware" to e.hardwareFrames, "skipAhead" to (direct || clockOn))
''', "select the file sync mode at avatar load")
    s = replace_one(s,
        '        return AvatarPlayer(s.avatar, workers, debuggable = debuggable, capturable = false,\n'
        '            onPlayout = { played -> notePlayed(s, played) }) { bmp -> s.draw(bmp) }\n',
        '''        val fileEngine = s.avatar as? Essence2Engine
        return AvatarPlayer(s.avatar, workers, debuggable = debuggable, capturable = fileEngine != null,
            onPlayout = { played -> notePlayed(s, played) },
            feedFilePcm16 = fileEngine?.let { it::feedPcm16 }) { bmp -> s.draw(bmp) }
''', "keep the original player and use one PCM16 sample timeline")

    s = replace_one(s,
        '                val s = AvatarSession(code, avatar, entry, texture)\n',
        '                val s = AvatarSession(code, avatar, entry, texture)\n'
        '                if (avatar is OfficialEssence2FileEngine) {\n'
        '                    // Preserve a short presentation ring, just like AvatarPlayer.\n'
        '                    // An SDK GPU buffer must outlive unlockCanvasAndPost().\n'
        '                    val heldGpu = java.util.ArrayDeque<HwFrame>()\n'
        '                    avatar.attachRenderer { bitmap, hardware ->\n'
        '                        val queuedAt = System.nanoTime()\n'
        '                        main.post {\n'
        '                            val drawAt = System.nanoTime()\n'
        '                            try {\n'
        '                                if (!s.stopped.get()) {\n'
        '                                    val before = s.framesDrawn\n'
        '                                    s.draw(bitmap)\n'
        '                                    if (s.framesDrawn > before && (s.framesDrawn == 1L || s.framesDrawn % 25L == 0L))\n'
        '                                        Log.i("E2STREAM", "LIVE_DRAW frame=" + s.framesDrawn\n'
        '                                            + " route=" + (if (hardware != null) "GPU" else "CPU"))\n'
        '                                    HitelE2Trace.event("video.draw", "frame" to s.framesDrawn,\n'
        '                                        "drawn" to (s.framesDrawn > before),\n'
        '                                        "gpuHardware" to (hardware != null),\n'
        '                                        "uiQueueMs" to (drawAt - queuedAt) / 1_000_000,\n'
        '                                        "drawMs" to (System.nanoTime() - drawAt) / 1_000_000)\n'
        '                                }\n'
        '                            } finally {\n'
        '                                if (hardware != null) {\n'
        '                                    heldGpu.addLast(hardware)\n'
        '                                    while (heldGpu.size > 4) heldGpu.removeFirst().release()\n'
        '                                } else bitmap.recycle()\n'
        '                            }\n'
        '                        }\n'
        '                    }\n'
        '                }\n',
        "deliver original SDK hardware Bitmap to Flutter HardwareCanvas")

    s = replace_one(s,
        '                val p = newPlayer(s)\n                s.player = p\n',
        '                val p: AvatarPlayer? = if (avatar is OfficialEssence2FileEngine) null else newPlayer(s)\n'
        '                s.player = p\n',
        "start the original player for synchronized mode")
    s = replace_one(s,
        '                    p.start()\n                    result.success(entry.id().toInt())\n',
        '                    if (p == null) s.ready.set(true) else p.start()\n'
        '                    result.success(entry.id().toInt())\n',
        "ready without player")

    s = replace_one(s,
        '                speak(s, call.argument<ByteArray>("pcm"))\n                result.success(null)\n',
        '                val raw = call.argument<ByteArray>("pcm")\n'
        '                if (s.avatar is OfficialEssence2FileEngine) {\n'
        '                    if (raw != null && raw.isNotEmpty()) s.avatar.appendPcm16(raw)\n'
        '                } else speak(s, raw)\n'
        '                result.success(null)\n',
        "deliver file PCM16 to either playback mode")

    s = replace_one(s,
        '                if (pcm != null && pcm.isNotEmpty()) speak(s, s.upsampler.process(pcm))\n',
        '''                if (pcm != null && pcm.isNotEmpty()) {
                    when (val engine = s.avatar) {
                        is OfficialEssence2FileEngine -> engine.appendPcm16(pcm)
                        is Essence2Engine -> speak(s, pcm)
                        else -> speak(s, s.upsampler.process(pcm))
                    }
                }
''', "honor native PCM16 through the pushAudio entry point")

    old_end = '''                if (s != null) speak(s, s.upsampler.flush())
                s?.player?.endOfReply(); result.success(null)'''
    new_end = '''                val direct = s?.avatar as? OfficialEssence2FileEngine
                if (direct != null) {
                    // End of INPUT only. PCM and video have already been running.
                    direct.endOfPcm()
                } else {
                    if (s != null && s.avatar !is Essence2Engine) speak(s, s.upsampler.flush())
                    s?.player?.endOfReply()
                }
                result.success(null)'''
    s = replace_one(s, old_end, new_end, "end of complete official PCM input")
    s = replace_one(s,
        '                s?.player?.bargeIn(call.argument<String>("reason") ?: "app")\n',
        '                (s?.avatar as? OfficialEssence2FileEngine)?.cancelFile()\n'
        '                    ?: s?.player?.bargeIn(call.argument<String>("reason") ?: "app")\n',
        "cancel old file")
    # A held direct session stays on its own renderer when its texture returns.
    s = replace_one(s,
        '    private fun resume(s: AvatarSession) {\n',
        '    private fun resume(s: AvatarSession) {\n'
        '        if (s.avatar is OfficialEssence2FileEngine) return\n',
        "avoid starting a second audio track in direct mode")
    assert "OfficialEssence2FileEngine(avatar" in s
    assert "direct.endOfPcm()" in s
    assert "avatar.attachRenderer" in s
    assert "s.avatar.appendPcm16(raw)" in s
    target.write_text(s)
    assert "heldGpu.addLast(hardware)" in s
    print("PASS_ESSENCE2_PCM16_SYNC_PLAYER_AND_DIRECT_COMPARISON")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--plugin", type=Path, required=True)
    parser.add_argument("--sources", type=Path, required=True)
    args = parser.parse_args()
    patch(args.plugin, args.sources)
