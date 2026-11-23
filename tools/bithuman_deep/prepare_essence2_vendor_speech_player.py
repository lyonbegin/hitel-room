#!/usr/bin/env python3
"""Connect the maker's renderOnce/play pattern to the already loaded Essence2 session.

Run AFTER existing source preparation/instrumentation. Model, credentials, transport,
app layout, Expression2 playback and native inference bytes are not replaced.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

PIN = "fea69e72515af7d05f384a9d2147ac0cc181b411"


def once(text, before, after):
    if text.count(before) != 1:
        raise AssertionError(f"vendor speech integration anchor count={text.count(before)}: {before[:80]}")
    return text.replace(before, after, 1)


def prepare(plugin, upstream, sources, report):
    kotlin = plugin / 'android/src/main/kotlin/ai/bithuman/flutter'
    original = upstream / 'android/essence2-hello/app/src/main/java/com/example/e2hello'
    wav = (original / 'Wav.kt').read_text(encoding='utf-8')
    wav = once(wav, 'package com.example.e2hello', 'package ai.bithuman.flutter')
    wav = once(wav, 'object Wav {', 'object Essence2VendorWav {')
    (kotlin / 'Essence2VendorWav.kt').write_text(wav, encoding='utf-8')
    shutil.copyfile(sources / 'Essence2SpeechPlayer.kt', kotlin / 'Essence2SpeechPlayer.kt')
    shutil.copyfile(sources / 'Essence2VendorRender.kt', kotlin / 'Essence2VendorRender.kt')
    engine = kotlin / 'AvatarEngine.kt'
    code = engine.read_text(encoding='utf-8')
    mark = "    override fun newFrameBitmap(): Bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)\n"
    bridge = "    internal fun renderPrepared(pcm: ByteArray, active: () -> Boolean,\n        onFrame: (java.nio.ByteBuffer, Long) -> Unit) {\n        Essence2VendorRender.render(avatar, synchronized(idleLock) { cursor }, pcm, active, onFrame)\n    }\n\n"
    engine.write_text(once(code, mark, bridge + mark), encoding='utf-8')
    target = kotlin / 'BithumanPlugin.kt'
    text = target.read_text(encoding='utf-8')
    text = once(text, 'var player: AvatarPlayer? = null', 'var player: SpeechPlayer? = null')
    text = once(text, 'private fun newPlayer(s: AvatarSession): AvatarPlayer {',
                'private fun newPlayer(s: AvatarSession): SpeechPlayer {')
    text = once(text,
        '        return AvatarPlayer(s.avatar, workers, debuggable = debuggable, capturable = false,\n'
        '            onPlayout = { played -> notePlayed(s, played) }) { bmp -> s.draw(bmp) }',
        '        if (s.avatar is Essence2Engine && HitelSdkLoader.route() == "BASELINE") return Essence2SpeechPlayer(s.avatar, workers,\n'
        '            onPlayout = { played -> notePlayed(s, played) }) { bmp -> s.draw(bmp) }\n'
        '        return LegacySpeechPlayer(AvatarPlayer(s.avatar, workers, debuggable = debuggable, capturable = false,\n'
        '            onPlayout = { played -> notePlayed(s, played) }) { bmp -> s.draw(bmp) })')
    # The maker's ImageView scales its half-resolution decode; the existing Texture needs the same scaling.
    text = once(text, 'try { canvas.drawBitmap(bmp, 0f, 0f, null) } finally {',
        'try {\n'
        '                if (bmp.width == canvas.width && bmp.height == canvas.height)\n'
        '                    canvas.drawBitmap(bmp, 0f, 0f, null)\n'
        '                else canvas.drawBitmap(bmp, null, android.graphics.Rect(0, 0, canvas.width, canvas.height), null)\n'
        '            } finally {')
    # Match the maker's ByteBuffer pull path; do not enable a competing hardware-buffer delivery queue.
    text = once(text, 'val e = Essence2Engine(avatar, zeroCopy = !forceCopy, playoutClock = clockOn)',
                'val e = Essence2Engine(avatar, zeroCopy = if (HitelSdkLoader.route() == "BASELINE") false else !forceCopy, playoutClock = clockOn)')
    if '"forcedCpuCopy" to forceCopy,' in text:
        text = once(text, '"forcedCpuCopy" to forceCopy,', '"forcedCpuCopy" to (HitelSdkLoader.route() == "BASELINE" || forceCopy),')
    text = once(text, "                entry.setSize(avatar.width, avatar.height)", "                val hitelTextureWidth = if (avatar is Essence2Engine && HitelSdkLoader.route() == "BASELINE") (avatar.width + 1) / 2 else avatar.width\n                val hitelTextureHeight = if (avatar is Essence2Engine && HitelSdkLoader.route() == "BASELINE") (avatar.height + 1) / 2 else avatar.height\n                entry.setSize(hitelTextureWidth, hitelTextureHeight)\n                HitelE2Trace.event(\"display.texture.config\", \"width\" to hitelTextureWidth, \"height\" to hitelTextureHeight)")
    target.write_text(text, encoding='utf-8')
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({
        'vendor_repository': 'bithuman-product/bithuman-examples', 'vendor_commit': PIN,
        'source_functions': ['MainActivity.renderOnce', 'MainActivity.play', 'Wav.read16kMono', 'Wav.resample'],
        'vendor_sources_sha256': {name: hashlib.sha256((original/name).read_bytes()).hexdigest()
                                  for name in ['MainActivity.kt', 'Wav.kt']},
        'mode': 'utterance_preparation_then_audio_clock_playback',
        'not_realtime_streaming': True, 'native_inference_modified': False,
        'model_loading_modified': False, 'transport_modified': False,
        'scope': 'original BASELINE prior working utterance render/audio path, WG128 GPU player unchanged',
    }, indent=2) + '\n', encoding='utf-8')
    print('PASS_VENDOR_ESSENCE2_RENDER_ONCE_PLAY_INTEGRATED')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--plugin', type=Path, required=True)
    p.add_argument('--upstream', type=Path, required=True)
    p.add_argument('--sources', type=Path, required=True)
    p.add_argument('--report', type=Path, required=True)
    a = p.parse_args()
    prepare(a.plugin, a.upstream, a.sources, a.report)

