#!/usr/bin/env python3
"""Convert the existing HITEL Essence2 LOCAL DEBUG MOCK to a VOICED fixture.

This changes ONLY an app-owned test server. It never edits original BitHuman
Flutter engine, native Essence2 SDK, entitlement, or per-member model store.
The voice is built offline via eSpeak as 24 kHz s16le PCM. No TTS API or key.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def once(s: str, a: str, b: str, label: str) -> str:
    count=s.count(a)
    if count!=1:
        raise AssertionError(f"{label}: expected one anchor, observed {count}")
    return s.replace(a,b,1)


def prepare(app: Path, pcm: Path, report: Path) -> None:
    raw=pcm.read_bytes()
    if len(raw)%2 or not 5*24000*2 <= len(raw) <= 30*24000*2:
        raise AssertionError("Voice fixture must be mono PCM16 24 kHz lasting 5-30 s")
    destination=app/"assets/hitel_essence2_spoken_24k.pcm"
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_bytes(raw)
    assert destination.read_bytes()==raw
    runtime_path=app/"lib/hitel_offline_runtime.dart"
    text=runtime_path.read_text()
    text=once(text,"import 'dart:io';\n","import 'dart:io';\nimport 'dart:typed_data';\nimport 'package:flutter/services.dart' show rootBundle;\n","PCM and Flutter asset import")
    text=once(text,"  String? _token;\n","  String? _token;\n  Uint8List? _voicedPcm24k;\n  int _spokenEpoch=0;\n","mock voice fixture state")
    text=once(text,"    final auth = await HttpServer.bind(InternetAddress.loopbackIPv4, 18762);\n",
        """    final voiceAsset = await rootBundle.load('assets/hitel_essence2_spoken_24k.pcm');
    final voiceBytes = voiceAsset.buffer.asUint8List(
        voiceAsset.offsetInBytes, voiceAsset.lengthInBytes);
    if (voiceBytes.length < 24000 * 2 * 5 || voiceBytes.length.isOdd) {
      throw StateError('Invalid offline phonetic voice fixture');
    }
    _voicedPcm24k = voiceBytes;
    final auth = await HttpServer.bind(InternetAddress.loopbackIPv4, 18762);
""","load voice fixture at mock server startup")
    method="""  /// Debug-only REAL PHONEMES from offline eSpeak, not vendor-licensed speech.
  /// Direct mock PCM24k -> original plugin realtime -> original native Essence2.
  Future<void> _sendVoicedOriginalSdkTestReply(MockConnection conn) async {
    final data=_voicedPcm24k;
    if (data == null) throw StateError('Missing offline eSpeak speech bytes');
    final generation=++_spokenEpoch;
    conn.sendResponseCreated();
    conn.sendTranscriptDelta('Hello, this is a spoken language test.');
    const bytesPer100ms=24000 * 2 ~/ 10;
    for (var i=0; i<data.length; i+=bytesPer100ms) {
      if (_closed || conn.isClosed || generation!=_spokenEpoch) return;
      final end=(i+bytesPer100ms).clamp(0,data.length);
      conn.sendAudioDelta(Uint8List.sublistView(data,i,end));
      // Every 4800 bytes represents 100ms of AUDIO, not a wall-clock delay.
      // Preserve transport order; the player starts preparing only after
      // response.done arrives, after this loop has supplied all PCM bytes.
    }
    if (_closed || conn.isClosed || generation!=_spokenEpoch) return;
    stdout.writeln('[hitel-audio] input.sent bytes=${data.length} samples24k=${data.length ~/ 2}');
    conn.sendResponseDone();
  }

"""
    text=once(text,"  Future<void> _handleClient(MockConnection conn) async {\n",
        method+"  Future<void> _handleClient(MockConnection conn) async {\n",
        "voiced mock reply function")
    old="""          case 'response.create':
            unawaited(conn.sendResponse(
              transcript: 'This is the mock agent speaking.',
              chunks: 10,
              interDelta: const Duration(milliseconds: 60),
            ));
            break;
          case 'response.cancel':
            conn.sendResponseCancelled();
            break;
          case 'input_audio_buffer.commit':
            unawaited(conn.sendResponse(
                transcript: 'Reply to your committed turn.'));
            break;
"""
    new="""          case 'response.create':
            unawaited(_sendVoicedOriginalSdkTestReply(conn));
            break;
          case 'response.cancel':
            _spokenEpoch++;
            conn.sendResponseCancelled();
            break;
          case 'input_audio_buffer.commit':
            unawaited(_sendVoicedOriginalSdkTestReply(conn));
            break;
"""
    text=once(text,old,new,"replace test-only sine with realistic phonetic PCM")
    runtime_path.write_text(text)
    spec=app/"pubspec.yaml"
    spec.write_text(once(spec.read_text(),"flutter:\n  uses-material-design: true\n",
        "flutter:\n  uses-material-design: true\n  assets:\n    - assets/hitel_essence2_spoken_24k.pcm\n","Flutter offline phonetic fixture bundle"))
    report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps({
        "kind":"HITEL_LOCAL_TEST_SPOKEN_E2E_PCM_FIXTURE",
        "voice_source":"offline eSpeak spoken phonetic English",
        "sample_rate":24000,
        "channels":1,
        "format":"PCM16LE",
        "duration_seconds":len(raw)/48000,
        "voice_sha256":hashlib.sha256(raw).hexdigest(),
        "original_essence2_sdk_modified":False,
        "original_flutter_audio_pipeline_modified":False,
        "official_android_model_bytes_modified":False,
        "licensed_vendor_service":False,
        "actual_audible_hardware_output_verified":False,
        "native_speech_frames_verified":False,
    },indent=2)+"\n")
    print("PASS_ESSENCE2_DEBUG_SPOKEN_PHONEME_INPUT_VIA_ORIGINAL_AUDIO_PATH")


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--app",type=Path,required=True)
    p.add_argument("--pcm",type=Path,required=True)
    p.add_argument("--report",type=Path,required=True)
    a=p.parse_args()
    prepare(a.app,a.pcm,a.report)
