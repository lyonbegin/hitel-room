import 'dart:async';
import 'package:bithuman/bithuman.dart';
import 'package:flutter/services.dart';

/// Read the local file in chunks and use bitHuman's own speaker/lipsync API.
class HitelDirectFileReply {
  static const _source = MethodChannel('ai.hitel/file_audio');
  int _generation = 0;
  bool _hasReply = false;

  Future<void> play(BithumanAvatar avatar, void Function(String) trace) async {
    final turn = ++_generation;
    final interrupted = _hasReply;
    _hasReply = true;
    try {
      if (interrupted) await avatar.interrupt(reason: 'text');
      if (turn != _generation) return;

      trace('file.response.begin turn=$turn');
      await _source.invokeMethod<void>('start', {'turn': turn});
      var chunks = 0;
      while (turn == _generation) {
        final event = await _source.invokeMapMethod<String, dynamic>('next', {
          'turn': turn,
        });
        if (turn != _generation ||
            event == null ||
            event['cancelled'] == true) {
          return;
        }
        if (event['error'] != null) throw StateError('${event['error']}');

        final pcm = event['pcm'];
        if (pcm is Uint8List && pcm.isNotEmpty) {
          await avatar.playSpeakerPCM(pcm);
          if (turn != _generation) return;
          if (chunks++ == 0) trace('file.response.first_audio turn=$turn');
        }
        if (event['done'] == true) {
          await avatar.notifyTurnEnd();
          if (turn == _generation) {
            trace('file.response.end turn=$turn chunks=$chunks');
          }
          return;
        }
      }
    } catch (error) {
      if (turn != _generation) return;
      trace('file.response.error turn=$turn error=$error');
      cancel();
      await avatar.interrupt(reason: 'file_audio_error');
      rethrow;
    }
  }

  void cancel() {
    _generation++;
    _hasReply = false;
    unawaited(_source.invokeMethod<void>('cancel').catchError((Object _) {}));
  }
}
