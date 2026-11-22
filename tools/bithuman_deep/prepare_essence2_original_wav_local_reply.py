#!/usr/bin/env python3
"""Connect the chat screen to a demand-driven WAV source on the original player."""
from pathlib import Path
import argparse,shutil,json,wave

def one(s,a,b,where):
    if s.count(a)!=1: raise AssertionError(f"{where} source anchor {s.count(a)}")
    return s.replace(a,b,1)

# The existing local server already instantiates HitelFileReply and invokes it
# after conversation.item.create -> response.create. Do not change that flow.
# The local session stays available for the original UI. Its replies carry no media.
DART = """import 'package:mock_realtime/mock_realtime.dart';

class HitelFileReply {
  Future<void> reply(MockConnection conn, String input, void Function(String)? trace) async {
    conn.sendResponseCreated();
    conn.sendResponseDone();
  }
  void cancel() {}
  void close() {}
}
"""

def patch(app,plugin,wavkt,wav,report):
    n=plugin/'android/src/main/kotlin/ai/bithuman/flutter'
    with wav.open('rb') as raw, wave.open(raw) as audio:
        assert (audio.getnchannels(), audio.getsampwidth(), audio.getframerate(), audio.getcomptype()) == (1, 2, 16000, 'NONE')
        samples = audio.getnframes()
        assert samples > 0 and len(audio.readframes(1)) == 2
        offset = raw.tell() - 2
        assert wav.stat().st_size >= offset + samples * 2
    shutil.copyfile(Path(__file__).with_name('WavPlayoutSource.kt'), n/'WavPlayoutSource.kt')
    (app/'assets').mkdir(exist_ok=True)
    shutil.copyfile(wav,app/'assets/speech.wav')
    rt=(app/'lib/hitel_offline_runtime.dart').read_text()
    assert "unawaited(_fileReply.reply(conn, pendingText, trace));" in rt
    assert "case 'conversation.item.create':" in rt and "case 'response.create':" in rt
    assert "HitelOfflineRuntime" in rt
    reply=app/'lib/hitel_file_reply.dart'
    assert 'class HitelFileReply' in reply.read_text()
    reply.write_text(DART)
    pluginfile=n/'BithumanPlugin.kt'
    s=pluginfile.read_text()
    s=one(s,'    private var fileAudio: HitelFileAudioSource? = null\n','','file-source field')
    s=one(s,'        fileAudio = HitelFileAudioSource(binding)\n','','file-source attach')
    s=one(s,'        fileAudio?.close(); fileAudio = null\n','','file-source detach')
    s=one(s,'    private lateinit var context: Context\n',
          '    private lateinit var context: Context\n    private lateinit var officialWavAsset: String\n',
          'vendor asset path field')
    s=one(s,'        context = binding.applicationContext\n',
          '        context = binding.applicationContext\n        officialWavAsset = binding.flutterAssets.getAssetFilePathByName("assets/speech.wav")\n',
          'vendor asset path')
    handler = '''            "playBundledWav" -> {
                val s = session(call) ?: return result.error("no_session", "Avatar is not loaded", null)
                val player = s.player ?: return result.error("no_player", "Avatar is off screen", null)
                stopWav(s)
                if (s.fedSamples > s.playedSamples) {
                    player.bargeIn("wav replay")
                    notePlayed(s, s.fedSamples)
                }
                val input = context.assets.open(officialWavAsset)
                try {
                    s.wav = WavPlayoutSource(input, WAV_OFFSET, WAV_SAMPLES)
                    s.wavBase = s.fedSamples
                    s.wavLogSecond = -1L
                    HitelE2Trace.event("wav.attach", "samples16" to WAV_SAMPLES, "texture" to s.entry.id(), "hardwareFrames" to s.avatar.hardwareFrames)
                    android.util.Log.i("bhwav", "WAV_ATTACH samples=WAV_SAMPLES")
                    refillWav(s)
                    result.success(null)
                } catch (e: Exception) {
                    input.close()
                    stopWav(s)
                    HitelE2Trace.event("wav.error", "message" to e.toString())
                    result.error("wav_failed", e.message, null)
                }
            }
'''.replace('WAV_OFFSET', str(offset)).replace('WAV_SAMPLES', str(samples))
    s=one(s,'            "playSpeakerPCM" -> {',handler+'            "playSpeakerPCM" -> {','WAV input')
    s=one(s,'        var held = false','        var wav: WavPlayoutSource? = null\n        var wavBase = 0L\n        var wavLogSecond = -1L\n        var wavEnd = -1L\n        var held = false','WAV session')
    helpers = '''    private fun stopWav(s: AvatarSession) {
        s.wavEnd = -1L
        val source = s.wav ?: return
        s.wav = null
        HitelE2Trace.event("wav.close", "read16" to source.readSamples, "samples16" to source.samples, "played24" to s.playedSamples - s.wavBase)
        source.close()
    }

    private fun refillWav(s: AvatarSession) {
        val source = s.wav ?: return
        source.refill(s.playedSamples - s.wavBase) { speak(s, it) }
        val played24 = s.playedSamples - s.wavBase
        if (played24 / 24000 != s.wavLogSecond) {
            s.wavLogSecond = played24 / 24000
            HitelE2Trace.event("wav.progress", "read16" to source.readSamples, "fed24" to s.fedSamples - s.wavBase,
                "played24" to played24, "drawn" to s.framesDrawn)
        }
        if (source.readSamples == source.samples) {
            HitelE2Trace.event("wav.eof", "read16" to source.readSamples, "played24" to played24)
            stopWav(s)
            s.wavEnd = s.fedSamples
            s.player?.endOfReply()
            android.util.Log.i("bhwav", "WAV_EOF samples=${source.samples} played24=${s.playedSamples - s.wavBase}")
        }
    }

'''
    s=one(s,'    private fun notePlayed(',helpers+'    private fun notePlayed(','refill')
    s=one(s,'        if (p > s.playedSamples) s.playedSamples = p','''        if (p > s.playedSamples) {
            s.playedSamples = p
            if (s.wavEnd >= 0 && p >= s.wavEnd) {
                HitelE2Trace.event("wav.drained", "played24" to p - s.wavBase, "drawn" to s.framesDrawn)
                Log.i("bhwav", "WAV_DRAINED played24=${p - s.wavBase}")
                s.wavEnd = -1L
            }
            try { refillWav(s) } catch (e: Exception) {
                stopWav(s)
                s.player?.endOfReply()
                HitelE2Trace.event("wav.error", "message" to e.toString())
                Log.e("bhwav", "WAV_ERROR", e)
            }
        }''','speaker credit')
    s=one(s,'                s?.upsampler?.reset()', '                s?.let { stopWav(it) }\n                s?.upsampler?.reset()', 'interrupt')
    s=one(s,'                if (hold) {', '                if (hold) {\n                    stopWav(s)', 'hold')
    s=one(s,'    private fun stopMic(s: AvatarSession) {','    private fun stopMic(s: AvatarSession) {\n        stopWav(s)', 'audio session changes')
    s=one(s,'    private fun closeSession(s: AvatarSession, done: (() -> Unit)?) {','    private fun closeSession(s: AvatarSession, done: (() -> Unit)?) {\n        stopWav(s)','dispose')
    pluginfile.write_text(s)
    trace_file = n/'HitelE2Trace.kt'
    trace_file.write_text(one(trace_file.read_text(),
        'row.contains(" stage=sdk.backend.") &&',
        '(row.contains(" stage=sdk.backend.") || row.contains(" stage=wav.")) &&', 'persistent WAV events'))
    pubspec=app/'pubspec.yaml'
    pubspec.write_text(one(pubspec.read_text(),
        '    - assets/hitel_file_reply.m4a\n',
        '    - assets/speech.wav\n','official wav pubspec'))
    (app/'assets/hitel_file_reply.m4a').unlink(missing_ok=True)
    (app/'assets/hitel_essence2_spoken_24k.pcm').unlink(missing_ok=True)
    gradle=app/'android/app/build.gradle.kts'
    gradle.write_text(one(gradle.read_text(),
        '\nandroid { androidResources { noCompress += "m4a" } }\n',
        '\n','remove custom M4A packaging'))
    assert (n/'HitelFileAudioSource.kt').exists()
    (n/'HitelFileAudioSource.kt').unlink()
    custom=plugin/'android/src/main/java/ai/bithuman/flutter/FilePcmStream.java'
    assert custom.exists()
    custom.unlink()
    ui=(app/'lib/main.dart').read_text()
    ui=one(ui,'  void _send() {','  Future<void> _send() async {','chat submit')
    ui=one(ui,'    _session!.sendText(t);', '''    final avatar = _avatar;
    if (avatar == null) return;
    try {
      await const MethodChannel('ai.bithuman.avatar').invokeMethod<void>(
          'playBundledWav', {'textureId': avatar.textureId});
    } on PlatformException catch (e) {
      if (mounted) setState(() => _status = e.message ?? e.code);
    }''','attach to active player')
    (app/'lib/main.dart').write_text(ui)
    native=(n/'AvatarEngine.kt').read_text()
    assert 'avatar.useHardwareBuffers(HW_SLOTS)' in native
    assert 'avatar.pullHardwareBuffer()' in native
    assert 'HitelSdkProbe.originalPulled' in native
    assert 'HitelSdkProbe.originalPresented()' in (n/'AvatarPlayer.kt').read_text()
    assert '"playSpeakerPCM" -> {' in s
    assert '"pushAudio" -> {' in s
    report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps({'base':'WG128 8ea184756eee',
      'trigger':'existing input -> playBundledWav',
      'audio':'speech.wav -> speaker-credit driven read -> original AvatarPlayer',
      'gpu':'original WG128 and HardwareBuffer unchanged',
      'new_button':False,'new_player':False,'custom_file_decoder':False},indent=2)+'\n')
    print('PASS_WG128_EXISTING_CHAT_LOCAL_SERVER_OFFICIAL_WAV_PCM_ONLY')

if __name__=='__main__':
    p=argparse.ArgumentParser()
    for arg in ('app','plugin','wavkt','wav','report'):
        p.add_argument('--'+arg,type=Path,required=True)
    a=p.parse_args()
    patch(a.app,a.plugin,a.wavkt,a.wav,a.report)
