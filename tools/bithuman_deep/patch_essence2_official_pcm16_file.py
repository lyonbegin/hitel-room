#!/usr/bin/env python3
"""Build-time patch for HITEL's isolated, official Essence2 PCM16 file mode.

This is applied ONLY to a temporary checkout of the bitHuman Flutter plugin.
It neither mutates the pristine vendor archive nor uses AvatarPlayer to render
the file. The Android native Essence2 SDK itself is unchanged.
"""
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

    # The model still loads through the already-working original SDK/meter
    # path; ONLY the file renderer is replaced. The old synchronization
    # player is neither started nor fed in this test build.
    pos = s.index("private fun loadEssence2(")
    begin = s.index("        val debuggable = ", pos)
    end = s.index("        if (hit != null) store?.let", begin)
    s = s[:begin] + (
        '        val e = OfficialEssence2FileEngine(avatar, java.io.File(context.cacheDir, "e2-official-file"))\n'
        '        Log.i(TAG, "Essence2 official file path: PCM16 feed(byte[]) -> endOfAudio() -> pull() -> checkRender(); no AvatarPlayer")\n'
    ) + s[end:]

    s = replace_one(s,
        '                val p = newPlayer(s)\n                s.player = p\n',
        '                val p: AvatarPlayer? = if (avatar is OfficialEssence2FileEngine) null else newPlayer(s)\n'
        '                s.player = p\n',
        "do not start sync player")
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
        "deliver direct raw PCM16")

    old_end = '''                if (s != null) speak(s, s.upsampler.flush())
                s?.player?.endOfReply(); result.success(null)'''
    new_end = '''                val direct = s?.avatar as? OfficialEssence2FileEngine
                if (direct != null) {
                    direct.endOfPcm { bitmap ->
                        // A Flutter SurfaceProducer is drawn on the platform thread.
                        // No custom frame admission, speech re-timing, or skip-ahead.
                        val latch = java.util.concurrent.CountDownLatch(1)
                        main.post {
                            try { if (s != null && !s.stopped.get()) s.draw(bitmap) }
                            finally { latch.countDown() }
                        }
                        latch.await()
                    }
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
    # Keep the code of the pristine plugin as evidence, but disable its
    # custom synchronization path completely for the official file mode.
    assert "OfficialEssence2FileEngine(avatar" in s
    assert "direct.endOfPcm" in s
    assert "s.avatar.appendPcm16(raw)" in s
    target.write_text(s)
    print("PASS_OFFICIAL_ESSENCE2_PCM16_NO_CUSTOM_SYNC")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--plugin", type=Path, required=True)
    parser.add_argument("--sources", type=Path, required=True)
    args = parser.parse_args()
    patch(args.plugin, args.sources)
