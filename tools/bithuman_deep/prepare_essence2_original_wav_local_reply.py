#!/usr/bin/env python3
"""Replace only the local server's M4A source; original chat/UI/SDK/GPU retained."""
from pathlib import Path
import argparse,shutil,json

def one(s,a,b,where):
    if s.count(a)!=1: raise AssertionError(f"{where} source anchor {s.count(a)}")
    return s.replace(a,b,1)

# The existing local server already instantiates HitelFileReply and invokes it
# after conversation.item.create -> response.create. Do not change that flow.
DART = r"""import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/services.dart';
import 'package:mock_realtime/mock_realtime.dart';

class HitelFileReply {
  static const _pcm = MethodChannel('ai.bithuman.avatar');
  int _epoch = 0;
  bool _closed = false;
  Future<void> reply(MockConnection conn, String input,
      void Function(String)? trace) async {
    final turn = ++_epoch;
    bool live() => !_closed && !conn.isClosed && turn == _epoch;
    conn.sendResponseCreated();
    if (input.trim().isEmpty) { conn.sendResponseDone(); return; }
    trace?.call('official.wav.begin turn=__DLR__turn chars=__DLR__{input.length}');
    try {
      // Vendor Wav.kt -> vendor Pcm16kTo24k. Original Flutter
      // BithumanRealtimeSession forwards these unchanged PCM bytes to
      // avatar.playSpeakerPCM(). No new player or audio scheduler.
      final data = await _pcm.invokeMethod<Uint8List>(
          'officialOriginalWavPcm24', {'turn': turn});
      if (!live()) return;
      if (data == null || data.isEmpty || data.length.isOdd) {
        throw StateError('Official WAV PCM missing');
      }
      conn.sendTranscriptDelta('공식 음성 샘플을 재생합니다.');
      const transportPacketBytes = 48000;
      var packets = 0;
      for (var i=0; i<data.length; i+=transportPacketBytes) {
        if (!live()) return;
        final end=(i+transportPacketBytes).clamp(0,data.length);
        conn.sendAudioDelta(Uint8List.sublistView(data,i,end));
        if (packets++==0) trace?.call(
            'official.wav.first_pcm turn=__DLR__turn bytes=__DLR__{end-i}');
        await Future<void>.delayed(Duration.zero);
      }
      if (!live()) return;
      trace?.call('official.wav.done turn=__DLR__turn pcmBytes=__DLR__{data.length}');
      conn.sendResponseDone();
    } catch (e) {
      if (!live()) return;
      trace?.call('official.wav.error turn=__DLR__turn reason=__DLR__{e.runtimeType}');
      conn.sendError('official_wav_failed', e.toString());
      conn.sendResponseDone();
    }
  }
  void cancel() { _epoch++; }
  void close() { _closed=true; cancel(); }
}
""".replace('__DLR__','$')

def patch(app,plugin,wavkt,wav,report):
    n=plugin/'android/src/main/kotlin/ai/bithuman/flutter'
    original=wavkt.read_text()
    assert original.count('package com.example.e2hello')==1
    (n/'Wav.kt').write_text(original.replace('package com.example.e2hello','package ai.bithuman.flutter',1))
    assert wav.read_bytes().startswith(b'RIFF')
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
    handler=r'''            "officialOriginalWavPcm24" -> {
                try {
                    val turn = call.argument<Int>("turn") ?: 0
                    HitelSdkProbe.setTurn(turn)
                    val wav = context.assets.open(officialWavAsset).use { it.readBytes() }
                    val source = Wav.read16kMono(wav, "speech.wav")
                    val pcm16 = source.toLittleEndianBytes()
                    val converter = Pcm16kTo24k()
                    val pcm24 = converter.process(pcm16) + converter.flush()
                    HitelSdkProbe.input(turn, pcm16.size.toLong() / 2)
                    HitelE2Trace.event("official.wav.pcm",
                        "turn" to turn, "pcm16Bytes" to pcm16.size,
                        "pcm24Bytes" to pcm24.size)
                    android.util.Log.i("bhwav", "OFFICIAL_WAV_PCM_READY turn=__DLR__turn pcm16Bytes=__DLR__{pcm16.size} pcm24Bytes=__DLR__{pcm24.size}")
                    result.success(pcm24)
                } catch (e: Throwable) {
                    android.util.Log.e("bhwav", "OFFICIAL_WAV_PCM_FAILED", e)
                    result.error("official_wav_failed", e.message, null)
                }
            }
'''.replace('__DLR__','$')
    s=one(s,'            "playSpeakerPCM" -> {\n',
          handler+'            "playSpeakerPCM" -> {\n','vendor WAV bridge')
    pluginfile.write_text(s)
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
    assert '    _session!.sendText(t);\n' in ui
    assert '_playOfficialWav' not in ui
    assert 'FloatingActionButton.small' in ui # existing log buttons only
    native=(n/'AvatarEngine.kt').read_text()
    assert 'avatar.useHardwareBuffers(HW_SLOTS)' in native
    assert 'avatar.pullHardwareBuffer()' in native
    assert 'HitelSdkProbe.originalPulled' in native
    assert 'HitelSdkProbe.originalPresented()' in (n/'AvatarPlayer.kt').read_text()
    assert '"playSpeakerPCM" -> {' in s
    assert '"pushAudio" -> {' in s
    report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps({'base':'WG128 8ea184756eee',
      'trigger':'existing input -> local response.create',
      'audio':'original speech.wav -> vendor Wav.kt -> vendor Pcm16kTo24k -> existing response.output_audio.delta -> playSpeakerPCM',
      'gpu':'original WG128 and HardwareBuffer unchanged',
      'new_button':False,'new_player':False,'custom_file_decoder':False},indent=2)+'\n')
    print('PASS_WG128_EXISTING_CHAT_LOCAL_SERVER_OFFICIAL_WAV_PCM_ONLY')

if __name__=='__main__':
    p=argparse.ArgumentParser()
    for arg in ('app','plugin','wavkt','wav','report'):
        p.add_argument('--'+arg,type=Path,required=True)
    a=p.parse_args()
    patch(a.app,a.plugin,a.wavkt,a.wav,a.report)
