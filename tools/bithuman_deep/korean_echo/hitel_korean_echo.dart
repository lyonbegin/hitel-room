import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/services.dart';
import 'package:bithuman/bithuman_realtime.dart';
import 'package:mock_realtime/mock_realtime.dart';

/// Text returned by the existing local WebSocket server is the synthesis source.
/// The future AI adapter replaces that text provider; the PCM/avatar leg stays identical.
class HitelKoreanEcho {
  static const _tts = MethodChannel('ai.hitel/korean_tts');
  int _generation = 0;
  bool _closed = false;

  void cancel() {
    _generation++;
    unawaited(_tts.invokeMethod<void>('cancel'));
  }

  Future<void> reply(MockConnection conn, String input) async {
    final generation = ++_generation;
    bool live() => !_closed && !conn.isClosed && generation == _generation;
    conn.sendResponseCreated();
    if (input.trim().isEmpty) {
      conn.sendResponseDone(); // startup greeting request has no user input
      return;
    }
    final answer = input; // exact echo, including whitespace and punctuation
    conn.sendTranscriptDelta(answer);
    BithumanRealtimeSession.hitelAiTrace('echo.begin turn=$generation chars=${answer.length}');
    try {
      await _tts.invokeMethod<void>('start', {'turn': generation, 'text': answer});
      var chunks = 0;
      while (live()) {
        final event = await _tts.invokeMapMethod<String, dynamic>('next', {'turn': generation});
        if (!live() || event == null || event['cancelled'] == true) return;
        if (event['error'] != null) throw StateError('${event['error']}');
        final pcm = event['pcm'];
        if (pcm is Uint8List && pcm.isNotEmpty) {
          conn.sendAudioDelta(pcm);
          if (chunks++ == 0) BithumanRealtimeSession.hitelAiTrace('echo.first_audio turn=$generation');
        }
        if (event['done'] == true) break;
      }
      if (live()) {
        BithumanRealtimeSession.hitelAiTrace('echo.done turn=$generation chunks=$chunks');
        conn.sendResponseDone(); // native endOfAudio only after the final PCM chunk
      }
    } catch (error) {
      if (live()) {
        BithumanRealtimeSession.hitelAiTrace('echo.error turn=$generation error=$error');
        conn.sendError('korean_tts_failed', '$error');
        conn.sendResponseDone();
      }
    }
  }

  void close() { _closed = true; cancel(); }
}
