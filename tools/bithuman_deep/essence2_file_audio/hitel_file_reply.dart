import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/services.dart';
import 'package:bithuman/bithuman_realtime.dart';
import 'package:mock_realtime/mock_realtime.dart';

/// Text is a trigger. The reply voice comes from the existing test audio file.
class HitelFileReply {
  static const _source = MethodChannel('ai.hitel/file_audio');
  int _generation = 0;
  bool _closed = false;

  void cancel() {
    _generation++;
    unawaited(_source.invokeMethod<void>('cancel'));
  }

  Future<void> reply(MockConnection conn, String input) async {
    final turn = ++_generation;
    bool live() => !_closed && !conn.isClosed && turn == _generation;
    conn.sendResponseCreated();
    // The automatic greeting is not a user request and must not play the file.
    if (input.trim().isEmpty) { conn.sendResponseDone(); return; }
    conn.sendTranscriptDelta('요청을 받았습니다. 지정된 시험 음성 파일을 스트리밍합니다.');
    BithumanRealtimeSession.hitelAiTrace('file.response.begin turn=$turn triggerChars=${input.length}');
    try {
      await _source.invokeMethod<void>('start', {'turn': turn});
      var chunks = 0;
      while (live()) {
        final event = await _source.invokeMapMethod<String, dynamic>('next', {'turn': turn});
        if (!live() || event == null || event['cancelled'] == true) return;
        if (event['error'] != null) throw StateError('${event['error']}');
        final pcm = event['pcm'];
        if (pcm is Uint8List && pcm.isNotEmpty) {
          conn.sendAudioDelta(pcm);
          if (chunks++ == 0) BithumanRealtimeSession.hitelAiTrace('file.response.first_audio turn=$turn');
        }
        if (event['done'] == true) break;
      }
      if (live()) {
        BithumanRealtimeSession.hitelAiTrace('file.response.end turn=$turn chunks=$chunks');
        conn.sendResponseDone(); // exactly once, after the decoder's PCM tail
      }
    } catch (error) {
      if (live()) {
        BithumanRealtimeSession.hitelAiTrace('file.response.error turn=$turn error=$error');
        conn.sendError('file_audio_failed', '$error');
        conn.sendResponseDone();
      }
    }
  }

  void close() { _closed = true; cancel(); }
}
