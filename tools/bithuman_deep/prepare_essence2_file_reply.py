#!/usr/bin/env python3
"""Text trigger -> HITEL14 MediaCodec file decoder -> original avatar PCM stream.

Apply after the existing local runtime, diagnostics and PCM playback patches.
No STT, local TTS, replacement renderer or native model changes.
"""
import argparse
import json
from pathlib import Path
import re
import shutil
from patch_essence2_streaming_engine import patch_streaming_engine


def once(s, old, new):
    if s.count(old) != 1:
        raise AssertionError(f'File reply anchor count={s.count(old)}: {old[:100]}')
    return s.replace(old, new, 1)


DIAGNOSTICS = r'''  Future<String> _hitelLogTail(Directory dir, String name, int bytes) async {
    final file = File('${dir.path}/$name');
    if (!await file.exists()) return '(no log)';
    final handle = await file.open();
    try {
      final length = await handle.length();
      await handle.setPosition(length > bytes ? length - bytes : 0);
      return utf8.decode(await handle.read(bytes), allowMalformed: true);
    } finally { await handle.close(); }
  }

  Future<void> _hitelClearDiagnostics() async {
    try {
      // Append the clear to the SAME Dart write chain. New events follow it.
      _hitelAiTraceWrites = _hitelAiTraceWrites.then((_) async {
        await const MethodChannel('ai.hitel/diagnostics').invokeMethod<void>('clearNative');
        final dir = await _appFilesDir();
        for (final name in ['boot_status.txt', 'hitel_ai_e2e.log']) {
          await File('${dir.path}/$name').writeAsString('', flush: true);
        }
      });
      await _hitelAiTraceWrites;
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('기존 진단 로그를 지웠습니다.')));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('로그 지우기 실패: $error')));
    }
  }

  Future<void> _hitelCopyDiagnostics() async {
    try {
      await _hitelAiTraceWrites;
      final dir = await _appFilesDir();
      final boot = await _hitelLogTail(dir, 'boot_status.txt', 2000);
      final native = await _hitelLogTail(dir, 'hitel_e2_trace.log', 12000);
      final protocol = await _hitelLogTail(dir, 'hitel_ai_e2e.log', 4000);
      var detail = 'HITEL Essence 2 Android diagnostics\nbuild=PCM_FILE_R5\n'
          'mode=text_trigger_file_stream\nSTT=false\nTTS=false\n'
          'engine=$_engine\nsample=$_selectedSample\nstatus=$_status\n'
          'loaded=${_avatar != null}\nat=${DateTime.now().toIso8601String()}\n'
          '--- current boot ---\n$boot\n--- current native ---\n$native\n'
          '--- current protocol ---\n$protocol';
      detail = detail.replaceAll(RegExp(r'Bearer\s+\S+', caseSensitive: false), 'Bearer [REDACTED]')
          .replaceAll(RegExp(r'api-secret\s*[:=]\s*\S+', caseSensitive: false), 'api-secret=[REDACTED]')
          .replaceAll(RegExp(r'https://\S+\?\S+', caseSensitive: false), '[signed URL redacted]');
      await Clipboard.setData(ClipboardData(text: detail));
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('현재 실행의 최근 진단 로그를 복사했습니다.')));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('로그 복사 실패: $error')));
    }
  }

'''


def prepare(app, plugin, sources, report, original_playback=False):
    revision = 'R6' if original_playback else 'R5'
    folder = plugin / 'android/src/main/kotlin/ai/bithuman/flutter'
    for name in ('HitelFileAudioSource.kt', 'HitelDiagnostics.kt', 'DiagnosticFiles.kt',
                 'HitelLogResetReceiver.kt', 'HitelE2Trace.kt'):
        shutil.copyfile(sources / name, folder / name)
    java = plugin / 'android/src/main/java/ai/bithuman/flutter/FilePcmStream.java'
    java.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(sources / 'FilePcmStream.java', java)
    reply_source = 'hitel_direct_file_reply.dart' if original_playback else 'hitel_file_reply.dart'
    shutil.copyfile(sources / reply_source, app / 'lib' / reply_source)

    target = folder / 'BithumanPlugin.kt'
    s = target.read_text(encoding='utf-8')
    s = once(s, '    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {\n',
        '    private var fileAudio: HitelFileAudioSource? = null\n'
        '    private var hitelDiagnostics: HitelDiagnostics? = null\n\n'
        '    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {\n'
        '        HitelDiagnostics.prepareForInstall(binding.applicationContext)\n'
        '        hitelDiagnostics = HitelDiagnostics(binding)\n'
        '        fileAudio = HitelFileAudioSource(binding)\n')
    s = once(s, '    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {\n',
        '    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {\n'
        '        fileAudio?.close(); fileAudio = null\n'
        '        hitelDiagnostics?.close(); hitelDiagnostics = null\n')
    assert 'Essence2Engine(avatar, zeroCopy = !forceCopy, playoutClock = clockOn)' in s
    assert 'val forceCopy = true' not in s and 'return AvatarPlayer(' in s
    target.write_text(s, encoding='utf-8')
    if not original_playback:
        patch_streaming_engine(folder / 'AvatarEngine.kt')

    runtime = app / 'lib/hitel_offline_runtime.dart'
    s = runtime.read_text(encoding='utf-8')
    s = once(s, "import 'package:flutter/services.dart' show rootBundle;\n", "import 'hitel_file_reply.dart';\n")
    s = once(s, '  Uint8List? _voicedPcm24k;\n  int _spokenEpoch=0;\n',
             '  final _fileReply = HitelFileReply();\n')
    a = s.index('    final voiceAsset = await rootBundle.load(')
    b = s.index('    final auth = await HttpServer.bind(', a)
    s = s[:a] + s[b:]
    a = s.index('  /// Debug-only REAL PHONEMES')
    b = s.index('  Future<void> _handleClient(', a)
    s = s[:a] + s[b:]
    s = once(s, '      conn.sendSessionCreated();\n', "      var pendingText = '';\n      conn.sendSessionCreated();\n")
    s = once(s, "          case 'response.create':\n", """          case 'conversation.item.create':
            final item = event.json['item'];
            if (item is Map && item['role'] == 'user') {
              final content = item['content'];
              if (content is List) {
                pendingText = content.whereType<Map>()
                    .where((part) => part['type'] == 'input_text')
                    .map((part) => part['text'] as String? ?? '').join();
              }
            }
            break;
          case 'response.create':
""")
    s = s.replace('unawaited(_sendVoicedOriginalSdkTestReply(conn));',
                  "unawaited(_fileReply.reply(conn, pendingText));\n            pendingText = '';")
    s = once(s, '            _spokenEpoch++;\n', '            _fileReply.cancel();\n')
    s = once(s, '    _closed = true;\n', '    _closed = true;\n    _fileReply.close();\n')
    s = once(s, '    } catch (_) {}\n  }\n\n  Future<void> close()',
             '    } catch (_) {} finally { _fileReply.cancel(); }\n  }\n\n  Future<void> close()')
    s = s.replace("import 'dart:typed_data';\n", '')
    if original_playback:
        s = once(s, "import 'hitel_file_reply.dart';\n", '')
        s = once(s, '  final _fileReply = HitelFileReply();\n', '')
        s = once(s, "      var pendingText = '';\n", '')
        a = s.index("          case 'conversation.item.create':")
        b = s.index('        }\n      }\n    } catch', a)
        s = s[:a] + """          case 'response.create':
            conn.sendResponseCreated();
            conn.sendResponseDone();
            break;
          case 'response.cancel':
            conn.sendResponseCancelled();
            break;
""" + s[b:]
        s = once(s, '    } catch (_) {} finally { _fileReply.cancel(); }\n',
                 '    } catch (_) {}\n')
        s = once(s, '    _fileReply.close();\n', '')
    assert 'rootBundle.load' not in s and '_voicedPcm24k' not in s
    runtime.write_text(s, encoding='utf-8')

    spec = app / 'pubspec.yaml'
    spec.write_text(once(spec.read_text(encoding='utf-8'),
        '    - assets/hitel_essence2_spoken_24k.pcm\n',
        '    - assets/hitel_file_reply.m4a\n'), encoding='utf-8')
    (app / 'assets/hitel_essence2_spoken_24k.pcm').unlink(missing_ok=True)
    gradle = app / 'android/app/build.gradle.kts'
    gradle.write_text(gradle.read_text(encoding='utf-8') +
        '\nandroid { androidResources { noCompress += "m4a" } }\n', encoding='utf-8')
    manifest = app / 'android/app/src/main/AndroidManifest.xml'
    s = once(manifest.read_text(encoding='utf-8'), 'android:label="${appLabel}"',
             f'android:label="HITEL PCM File {revision}"')
    s = once(s, '    </application>', '''        <receiver android:name="ai.bithuman.flutter.HitelLogResetReceiver" android:exported="false">
            <intent-filter><action android:name="android.intent.action.MY_PACKAGE_REPLACED"/></intent-filter>
        </receiver>
    </application>''')
    manifest.write_text(s, encoding='utf-8')

    ui = app / 'lib/main.dart'
    s = ui.read_text(encoding='utf-8')
    if "import 'dart:convert';" not in s:
        s = once(s, "import 'dart:io';\n", "import 'dart:io';\nimport 'dart:convert';\n")
    a = s.index('  Future<void> _hitelCopyDiagnostics() async {')
    b = re.search(r'\n  (?:Future<|void |Widget )', s[a + 1:])
    assert b
    b = a + 1 + b.start() + 1
    s = s[:a] + DIAGNOSTICS.replace('PCM_FILE_R5', f'PCM_FILE_{revision}') + s[b:]
    old = """      floatingActionButton: Platform.isAndroid
          ? FloatingActionButton.small(
              tooltip: 'Essence 2 진단 로그 복사',
              onPressed: _hitelCopyDiagnostics,
              child: const Icon(Icons.copy_all_rounded),
            )
          : null,
"""
    new = """      floatingActionButton: Platform.isAndroid
          ? Row(mainAxisSize: MainAxisSize.min, children: [
              FloatingActionButton.small(heroTag: 'clear-logs', tooltip: '로그 지우기',
                  onPressed: _hitelClearDiagnostics, child: const Icon(Icons.delete_sweep_rounded)),
              const SizedBox(width: 8),
              FloatingActionButton.small(heroTag: 'copy-logs', tooltip: '현재 로그 복사',
                  onPressed: _hitelCopyDiagnostics, child: const Icon(Icons.copy_all_rounded)),
            ])
          : null,
"""
    s = once(s, old, new)
    s = once(s, '    await session.start(enableMic: _useMic);', '    await session.start(enableMic: false);')
    s = s.replace("_status = 'Speaking…';", "_status = '음성 파일을 준비하고 있습니다…';")
    s = s.replace('ui.status=speakingProxy reason=botTranscript', 'ui.status=filePreparing reason=fileTranscript')
    s = once(s, '  final HitelOfflineRuntime _offline = HitelOfflineRuntime();\n',
        '  final HitelOfflineRuntime _offline = HitelOfflineRuntime();\n'
        '  StreamSubscription<dynamic>? _filePlayout;\n'
        '  bool _filePending = false;\n'
        '  int _fileFirstPlayed = 0;\n')
    s = once(s, '    final session = BithumanRealtimeSession(\n', '''    await _filePlayout?.cancel();
    _filePending = false;
    _filePlayout = avatar.speechPlayout.listen((p) {
      if (!mounted) return;
      if (p.fed > p.played) {
        if (!_filePending) _fileFirstPlayed = p.played;
        _filePending = true;
        setState(() => _status = p.played > _fileFirstPlayed
            ? '파일 음성을 재생하고 있습니다…' : '음성·립싱크를 준비하고 있습니다…');
      } else if (_filePending) {
        _filePending = false;
        setState(() => _status = '텍스트를 보내시면 같은 음성 파일을 스트리밍합니다.');
      }
    });
    final session = BithumanRealtimeSession(
''')
    s = once(s, '      if (mounted) setState(() => _status = _describe(s));',
             '      if (mounted && !_filePending) setState(() => _status = _describe(s));')
    s = once(s, '    _avatar?.dispose();\n',
             '    unawaited(_filePlayout?.cancel());\n    _avatar?.dispose();\n')
    s = once(s, 'StatusPill(state: _state, label: _status)',
             f"StatusPill(state: _state, label: '{revision} · $_status')")
    s = s.replace('> 524288', '> 131072')
    if original_playback:
        s = once(s, "import 'hitel_offline_runtime.dart';\n",
                 "import 'hitel_offline_runtime.dart';\nimport 'hitel_direct_file_reply.dart';\n")
        s = once(s, '  final HitelOfflineRuntime _offline = HitelOfflineRuntime();\n',
                 '  final HitelOfflineRuntime _offline = HitelOfflineRuntime();\n'
                 '  final _directFileReply = HitelDirectFileReply();\n')
        s = once(s, '          _session!.sendText(p);\n', '          unawaited(_playFileReply());\n')
        s = once(s, '    _session!.sendText(t);\n', '    unawaited(_playFileReply());\n')
        s = once(s, '  /// A typed turn is the same turn a spoken one is: same units back, same barge-in.\n',
                 """  Future<void> _playFileReply() async {
    final avatar = _avatar;
    if (avatar == null || !avatar.isReady) return;
    setState(() => _status = '음성 파일을 준비하고 있습니다…');
    try {
      await _directFileReply.play(avatar, _hitelAppendAiTrace);
    } catch (_) {
      if (mounted) setState(() => _status = '음성 파일을 재생하지 못했습니다.');
    }
  }

""")
        s = once(s, '        _session?.stop(); _session = null;\n',
                 '        _directFileReply.cancel();\n        _session?.stop(); _session = null;\n')
        s = once(s, '    _session?.stop();\n    unawaited(_filePlayout?.cancel());\n',
                 '    _directFileReply.cancel();\n    _session?.stop();\n    unawaited(_filePlayout?.cancel());\n')
    ui.write_text(s, encoding='utf-8')
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({
        'mode': 'user-text-triggered-file-response', 'file_decoder_reused_from':
            'HITEL14 FilePcmStream.java c85110ed5624d023da9178cdfca5e3ee03038030',
        'file_chunk_ms': 100, 'decode_rate': 16000, 'wire_rate': 24000,
        'whole_file_read': False, 'whole_file_pcm_conversion': False,
        'decoded_queue_packets': 8, 'file_paced_by_playout': False,
        'direct_vendor_pcm_api': original_playback, 'pristine_native_playback': original_playback,
        'source': 'existing public test voice encoded as M4A at build time',
        'STT': False, 'TTS': False, 'renderer': 'original AvatarPlayer and original automatic GPU routing',
        'clear_on_package_update_and_first_launch': True, 'manual_clear_button': True,
        'copies_rotated_previous_log': False, 'clipboard_log_tail_bytes': 18000,
        'physical_playback_verified': False,
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('PASS_TEXT_TRIGGER_FILE_DECODE_STREAM_ORIGINAL_AVATAR_AND_LOG_RESET')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    for name in ('app', 'plugin', 'sources', 'report'):
        p.add_argument('--' + name, type=Path, required=True)
    p.add_argument('--original-playback', action='store_true')
    a = p.parse_args()
    prepare(a.app, a.plugin, a.sources, a.report, a.original_playback)
