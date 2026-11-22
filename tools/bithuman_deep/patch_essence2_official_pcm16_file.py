#!/usr/bin/env python3
"""Attach HITEL's PCM16 audio-clock presenter to the temporary Flutter plugin."""
from pathlib import Path
import argparse
import shutil


def replace_one(source: str, old: str, new: str, tag: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{tag}: expected one anchor, found {count}")
    return source.replace(old, new, 1)


def patch(plugin: Path, sources: Path) -> None:
    folder = plugin / "android/src/main/kotlin/ai/bithuman/flutter"
    shutil.copyfile(sources / "OfficialEssence2FileEngine.kt",
                    folder / "OfficialEssence2FileEngine.kt")
    shutil.copyfile(sources / "HitelVoiceSync.kt", folder / "HitelVoiceSync.kt")
    shutil.copyfile(sources / "HitelSdkProbe.kt", folder / "HitelSdkProbe.kt")

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
        '        HitelSdkProbe.install(context)\n'
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
    existing = s.index("        val debuggable = ", begin + 1)
    end = s.index("        if (hit != null) store?.let", existing)
    s = s[:existing] + (
        '        val sync = !debuggable || AvatarPlayer.devInt("debug.bh.e2.sync") != 2\n'
        '        val clockOn = !debuggable || AvatarPlayer.devInt("debug.bh.e2.clock") != 2\n'
        '        val e = OfficialEssence2FileEngine(avatar, voiceSync = sync, skipAhead = clockOn)\n'
        '        HitelE2Trace.event("sync.route", "mode" to (if (sync) "audio-master" else "direct"),\n'
        '            "rate" to 16000, "requestedHeight" to requestedHeight, "width" to avatar.width,\n'
        '            "height" to avatar.height, "gpuHardware" to e.hardwareFrames, "skipAhead" to clockOn)\n'
    ) + s[end:]

    s = replace_one(s,
        '                val s = AvatarSession(code, avatar, entry, texture)\n',
        '                val s = AvatarSession(code, avatar, entry, texture)\n'
        '                if (avatar is OfficialEssence2FileEngine) {\n'
        '                    if (avatar.voiceSync) {\n'
        '                        avatar.attachSyncRenderer { bitmap ->\n'
        '                            val before = s.framesDrawn\n'
        '                            s.draw(bitmap)\n'
        '                            s.framesDrawn > before\n'
        '                        }\n'
        '                    } else {\n'
        '                        // Keep the previous immediate presentation for the comparison.\n'
        '                        // An SDK GPU buffer must outlive unlockCanvasAndPost().\n'
        '                        val heldGpu = java.util.ArrayDeque<HwFrame>()\n'
        '                        avatar.attachRenderer { bitmap, hardware ->\n'
        '                            val queuedAt = System.nanoTime()\n'
        '                            main.post {\n'
        '                                val drawAt = System.nanoTime()\n'
        '                                try {\n'
        '                                    if (!s.stopped.get()) {\n'
        '                                        val before = s.framesDrawn\n'
        '                                        s.draw(bitmap)\n'
        '                                        if (s.framesDrawn > before && (s.framesDrawn == 1L || s.framesDrawn % 25L == 0L))\n'
        '                                            Log.i("E2STREAM", "LIVE_DRAW frame=" + s.framesDrawn\n'
        '                                                + " route=" + (if (hardware != null) "GPU" else "CPU"))\n'
        '                                        HitelE2Trace.event("video.draw", "frame" to s.framesDrawn,\n'
        '                                            "drawn" to (s.framesDrawn > before),\n'
        '                                            "gpuHardware" to (hardware != null),\n'
        '                                            "uiQueueMs" to (drawAt - queuedAt) / 1_000_000,\n'
        '                                            "drawMs" to (System.nanoTime() - drawAt) / 1_000_000)\n'
        '                                    }\n'
        '                                } finally {\n'
        '                                    if (hardware != null) {\n'
        '                                        heldGpu.addLast(hardware)\n'
        '                                        while (heldGpu.size > 4) heldGpu.removeFirst().release()\n'
        '                                    } else bitmap.recycle()\n'
        '                                }\n'
        '                            }\n'
        '                        }\n'
        '                    }\n'
        '                }\n',
        "attach voice-clock presentation or the direct comparison")

    s = replace_one(s,
        '                val p = newPlayer(s)\n                s.player = p\n',
        '                val p: AvatarPlayer? = if (avatar is OfficialEssence2FileEngine) null else newPlayer(s)\n'
        '                s.player = p\n',
        "select only one player for the file")
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
                    if (s != null) speak(s, s.upsampler.flush())
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
    print("PASS_ESSENCE2_AUDIO_MASTER_AND_DIRECT_COMPARISON")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--plugin", type=Path, required=True)
    parser.add_argument("--sources", type=Path, required=True)
    args = parser.parse_args()
    patch(args.plugin, args.sources)
