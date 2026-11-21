#!/usr/bin/env python3
"""Wire local Korean text echo into the maker's ORIGINAL streaming AvatarPlayer.

Run after existing trace/local-session assembly, INSTEAD OF vendor_speech_player.
No replacement native avatar inference, model, entitlement, or screen layout.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil


def once(s, old, new):
    if s.count(old) != 1:
        raise AssertionError(f'Korean echo anchor count={s.count(old)}: {old[:90]}')
    return s.replace(old, new, 1)


def prepare(app, plugin, sources, report):
    folder = plugin / 'android/src/main/kotlin/ai/bithuman/flutter'
    for name in ('HitelKoreanTts.kt', 'KoreanSpeechAudio.kt'):
        shutil.copyfile(sources / name, folder / name)
    shutil.copyfile(sources / 'hitel_korean_echo.dart', app / 'lib/hitel_korean_echo.dart')
    runtime = app / 'lib/hitel_offline_runtime.dart'
    s = runtime.read_text(encoding='utf-8')
    s = once(s, "import 'package:flutter/services.dart' show rootBundle;\n",
             "import 'hitel_korean_echo.dart';\n")
    s = once(s, '  Uint8List? _voicedPcm24k;\n  int _spokenEpoch=0;\n',
             '  final _echo = HitelKoreanEcho();\n')
    start = s.index("    final voiceAsset = await rootBundle.load(")
    end = s.index('    final auth = await HttpServer.bind(', start)
    s = s[:start] + s[end:]
    start = s.index('  /// Debug-only REAL PHONEMES')
    end = s.index('  Future<void> _handleClient(', start)
    s = s[:start] + s[end:]
    s = once(s, '      conn.sendSessionCreated();\n',
             "      var pendingText = '';\n      conn.sendSessionCreated();\n")
    s = once(s, "          case 'response.create':\n",
        """          case 'conversation.item.create':
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
                  'unawaited(_echo.reply(conn, pendingText));\n            pendingText = \'\';')
    s = once(s, '            _spokenEpoch++;\n', '            _echo.cancel();\n')
    s = once(s, '    _closed = true;\n', '    _closed = true;\n    _echo.close();\n')
    s = once(s, '    } catch (_) {}\n  }\n\n  Future<void> close()',
             '    } catch (_) {} finally { _echo.cancel(); }\n  }\n\n  Future<void> close()')
    s = s.replace("import 'dart:typed_data';\n", '')
    runtime.write_text(s, encoding='utf-8')
    transport = plugin / 'lib/bithuman_realtime.dart'
    s = transport.read_text(encoding='utf-8')
    s = once(s, '    final t = text.trim();\n    if (t.isEmpty || !_open) return;',
             '    final t = text;\n    if (t.trim().isEmpty || !_open) return;')
    transport.write_text(s, encoding='utf-8')
    fixture = app / 'assets/hitel_essence2_spoken_24k.pcm'
    fixture.unlink(missing_ok=True)
    spec = app / 'pubspec.yaml'
    spec.write_text(once(spec.read_text(encoding='utf-8'),
        '    - assets/hitel_essence2_spoken_24k.pcm\n',
        '    - assets/hitel_ko_tts.zip\n'), encoding='utf-8')

    target = folder / 'BithumanPlugin.kt'
    s = target.read_text(encoding='utf-8')
    s = once(s, '    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {\n',
        '    private var koreanTts: HitelKoreanTts? = null\n\n'
        '    override fun onAttachedToEngine(binding: FlutterPlugin.FlutterPluginBinding) {\n'
        '        koreanTts = HitelKoreanTts(binding)\n')
    s = once(s, '    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {\n',
        '    override fun onDetachedFromEngine(binding: FlutterPlugin.FlutterPluginBinding) {\n'
        '        koreanTts?.close(); koreanTts = null\n')
    s = once(s, 'PlayoutClock.enabled(clockLever, skipAhead, Essence2Engine.SKIP_AHEAD_DEFAULT)',
             'PlayoutClock.enabled(clockLever, skipAhead, true)')
    s = once(s, '                entry.setSize(avatar.width, avatar.height)',
             '                entry.setSize(maxOf(1, avatar.width / 2), maxOf(1, avatar.height / 2))\n'
             '                HitelE2Trace.event("display.texture.config", "width" to maxOf(1, avatar.width / 2),\n'
             '                    "height" to maxOf(1, avatar.height / 2), "build" to "KO_ECHO_R3")')
    # The half-size Texture remains; fit the original bitmap into that Texture.
    s = once(s, 'try { canvas.drawBitmap(bmp, 0f, 0f, null) } finally {',
        'try { canvas.drawBitmap(bmp, null, android.graphics.Rect(0, 0, canvas.width, canvas.height), null) } finally {')
    assert 'return AvatarPlayer(' in s and 'Essence2SpeechPlayer(' not in s
    target.write_text(s, encoding='utf-8')

    engine = folder / 'AvatarEngine.kt'
    s = engine.read_text(encoding='utf-8')
    s = once(s, '    private var delivered = 0L\n',
             '    private var delivered = 0L\n    private var lastFrameNs = 0L\n')
    s = once(s, '        utterances++\n',
             '        utterances++\n        lastFrameNs = System.nanoTime()\n')
    s = once(s, 'delivered = PlayoutClock.nextDelivered(k, delivered); framesTotal++',
             'delivered = PlayoutClock.nextDelivered(k, delivered); framesTotal++\n'
             '                        lastFrameNs = System.nanoTime()')
    s = once(s, '        if (!closed) return\n        open = false\n',
        '''        if (!closed) return
        val expected = (uttFed + HOP - 1) / HOP
        // available()==0/one refused pull does not mean the inference worker finished.
        val quietMs = (System.nanoTime() - lastFrameNs) / 1000000
        if (delivered < expected && (delivered == 0L || queued > 0 || quietMs < 5000L)) return
        HitelE2Trace.event("sdk.utterance.drained", "utterance" to utterances,
            "framesThrough" to delivered, "expectedFrames" to expected,
            "complete" to (delivered >= expected), "quietMs" to quietMs)
        open = false
''')
    # The original bh-feed worker already serialises feed/tail/reset. Keep only
    # metadata under the adapter monitor: the native feed can wait for the
    # renderer to drain its bounded queue. Holding this monitor across it
    # prevented the renderer from publishing the frame that would free it.
    start = s.index('    @Synchronized override fun feed(f16k: FloatArray) {',
                    s.index('class Essence2Engine('))
    end = s.index('    @Synchronized override fun reset() {', start)
    s = s[:start] + '''    override fun feed(f16k: FloatArray) {
        if (f16k.isEmpty()) return
        val generation = synchronized(this) {
            if (closed && open) { pending.add(f16k); pendingN = pending.size; return }
            if (!open || closed) startUtterance()
            uttFed += f16k.size
            open = true
            gen
        }
        val feedAt = System.nanoTime()
        HitelE2Trace.event("sdk.feed.begin", "samples16k" to f16k.size)
        avatar.feed(f16k)
        val available = avatar.available()
        synchronized(this) { if (generation == gen) queued = available }
        HitelE2Trace.event("sdk.feed.end", "durationUs" to (System.nanoTime() - feedAt) / 1000,
            "sdkQueued" to available, "adapterMonitorHeld" to false)
        renderSpot.wake()
    }

    override fun flushTail() {
        val generation = synchronized(this) {
            if (pending.isNotEmpty()) { pendingClose = true; return }
            if (!open || closed) return
            gen
        }
        // While native tail processing runs, closed remains false. A refused
        // pull during this call is not an utterance boundary.
        val tailAt = System.nanoTime()
        avatar.endOfAudio()
        val available = avatar.available()
        synchronized(this) {
            if (generation == gen) {
                closed = true; queued = available; lastFrameNs = System.nanoTime()
            }
        }
        HitelE2Trace.event("sdk.endOfAudio.end", "durationUs" to (System.nanoTime() - tailAt) / 1000,
            "adapterMonitorHeld" to false)
        renderSpot.wake()
    }

''' + s[end:]
    s = once(s, '            val monitorWantedAt = System.nanoTime()\n',
             '            val availableAfterPull = avatar.available()\n'
             '            val monitorWantedAt = System.nanoTime()\n')
    s = once(s, '                queued = avatar.available()\n                when {',
             '                queued = availableAfterPull\n                when {')
    s = once(s, '                        "sdkQueued" to avatar.available())',
             '                        "sdkQueued" to availableAfterPull)')
    s = once(s, '            val monitorWantedAt = System.nanoTime()\n',
             '            var idleStepCount = 0\n            val monitorWantedAt = System.nanoTime()\n')
    s = once(s, '                        repeat(PlayoutClock.idleSteps(k, delivered, nt)) { stepIdle() }',
             '                        idleStepCount = PlayoutClock.idleSteps(k, delivered, nt)')
    s = once(s, '            if (at < 0) {\n',
             '            repeat(idleStepCount) { if (g == gen) stepIdle() }\n            if (at < 0) {\n')
    s = once(s, '    private var closed = false\n', '    @Volatile private var closed = false\n')
    engine.write_text(s, encoding='utf-8')
    # Local Maven avoids AGP's unsupported direct local-AAR dependency in a library.
    gradle = plugin / 'android/build.gradle'
    gradle.write_text(gradle.read_text(encoding='utf-8') +
        '\ndependencies { implementation "ai.hitel.local:sherpa-onnx:1.12.26" }\n', encoding='utf-8')
    manifest = app / 'android/app/src/main/AndroidManifest.xml'
    manifest.write_text(once(manifest.read_text(encoding='utf-8'),
        'android:label="${appLabel}"', 'android:label="HITEL KO Echo R3"'), encoding='utf-8')

    ui = app / 'lib/main.dart'
    s = ui.read_text(encoding='utf-8')
    s = once(s, '    final t = _input.text.trim();\n    if (t.isEmpty || _session == null) return;',
             '    final t = _input.text;\n    if (t.trim().isEmpty || _session == null) return;')
    s = once(s, '    WidgetsBinding.instance.addObserver(this);\n',
        '''    WidgetsBinding.instance.addObserver(this);
    const MethodChannel('ai.hitel/korean_tts').setMethodCallHandler((call) async {
      if (!mounted || const bool.fromEnvironment('dart.vm.product')) return null;
      if (call.method == 'probeInput') {
        _input.text = call.arguments as String;
        _showChrome();
      } else if (call.method == 'probeUnfocus') {
        FocusManager.instance.primaryFocus?.unfocus();
      }
      return null;
    });
''')
    s = once(s, "_status = 'Speaking…';", "_status = '한국어 음성을 합성하고 있습니다…';")
    # Display follows the original device clock, not the early transcript event.
    s = once(s, '  final HitelOfflineRuntime _offline = HitelOfflineRuntime();\n',
        '  final HitelOfflineRuntime _offline = HitelOfflineRuntime();\n'
        '  StreamSubscription<dynamic>? _echoPlayout;\n'
        '  bool _echoHasAudio = false;\n'
        '  int _echoFirstPlayed = 0;\n')
    s = once(s, '    final session = BithumanRealtimeSession(\n',
        '''    await _echoPlayout?.cancel();
    _echoHasAudio = false;
    _echoPlayout = avatar.speechPlayout.listen((p) {
      if (!mounted) return;
      if (p.fed > p.played) {
        if (!_echoHasAudio) _echoFirstPlayed = p.played;
        _echoHasAudio = true;
        setState(() => _status = p.played > _echoFirstPlayed
            ? '한국어 음성을 재생하고 있습니다…' : '음성·립싱크를 준비하고 있습니다…');
      } else if (_echoHasAudio) {
        _echoHasAudio = false;
        setState(() => _status = '문장을 입력해 주십시오. 입력하신 그대로 읽어 드립니다.');
      }
    });
    final session = BithumanRealtimeSession(
''')
    s = once(s, '      if (mounted) setState(() => _status = _describe(s));',
             '      if (mounted && !_echoHasAudio) setState(() => _status = _describe(s));')
    s = once(s, '    _avatar?.dispose();\n',
             '    unawaited(_echoPlayout?.cancel());\n    _avatar?.dispose();\n')
    s = s.replace("'Connected — say something, or type.'", "'문장을 입력해 주십시오. 입력하신 그대로 읽어 드립니다.'")
    s = s.replace("'Thinking…'", "'한국어 음성을 합성하고 있습니다…'")
    s = once(s, 'StatusPill(state: _state, label: _status)',
             "StatusPill(state: _state, label: 'R3 · $_status')")
    s = once(s, "'HITEL Essence 2 Android diagnostics\\n'",
             "'HITEL Essence 2 Android diagnostics\\nbuild=KO_ECHO_R3\\n'")
    s = s.replace('ui.status=speakingProxy reason=botTranscript',
                  'ui.status=synthesizing reason=echoTranscript')
    ui.write_text(s, encoding='utf-8')
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({
        'language': 'ko-KR', 'model': 'vits-mimic3-ko_KO-kss_low',
        'tts_engine': 'sherpa-onnx-1.12.26', 'tts_rate': 22050, 'wire_rate': 24000,
        'text_provider': 'exact user-text echo via existing loopback WebSocket',
        'speech_player': 'original archived AvatarPlayer with separate feed/render/write/present',
        'whole_reply_prerender': False, 'fixture_removed': not fixture.exists(),
        'native_avatar_inference_modified': False, 'real_ai': False,
        'tts_sources_sha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                               for p in sources.glob('*') if p.is_file()},
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('PASS_KOREAN_EXACT_ECHO_LOCAL_TTS_ORIGINAL_STREAMING_AVATAR')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    for name in ('app', 'plugin', 'sources', 'report'):
        p.add_argument('--' + name, type=Path, required=True)
    a = p.parse_args()
    prepare(a.app, a.plugin, a.sources, a.report)
