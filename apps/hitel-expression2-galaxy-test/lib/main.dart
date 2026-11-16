import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:bithuman/bithuman.dart';

// Original bitHuman Flutter SDK + original Expression2 0.6.2 local TEST fixture.
// User inputs ZERO API secrets. APK ships original published public Wise Pup model
// and bitHuman's own sample WAV, not a substitute or recreated SDK engine.
void main() => runApp(const HitelLocalExpression2App());

class HitelLocalExpression2App extends StatelessWidget {
  const HitelLocalExpression2App({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'HITEL Expression 2 · GPU 원본 시험',
        theme: ThemeData(useMaterial3: true, brightness: Brightness.dark),
        home: const HitelLocalExpression2Screen(),
      );
}

class HitelLocalExpression2Screen extends StatefulWidget {
  const HitelLocalExpression2Screen({super.key});
  @override
  State<HitelLocalExpression2Screen> createState() =>
      _HitelLocalExpression2ScreenState();
}

class _HitelLocalExpression2ScreenState
    extends State<HitelLocalExpression2Screen> {
  static const _diagnostics = MethodChannel('ai.hitel.expression2.hardware');
  BithumanAvatar? _avatar;
  String _hardware = '기기 환경 검사 중';
  String _logs = '';
  String _status = 'API Secret 입력 없이 공개 원본 모델을 시험합니다.';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _inspect());
  }

  Future<void> _inspect() async {
    try {
      final map = await _diagnostics.invokeMapMethod<String, dynamic>(
        'inspectHardware',
      );
      if (!mounted) return;
      final detail = (map ?? {}).entries
          .map((entry) => '${entry.key}: ${entry.value}')
          .join('\n');
      setState(() => _hardware = detail);
    } catch (error) {
      if (mounted) setState(() => _hardware = '기기 검사 오류: $error');
    }
  }

  Future<void> _readLogs() async {
    try {
      final result = await _diagnostics.invokeMethod<String>('readOwnLogs');
      if (!mounted) return;
      setState(() => _logs =
          result?.trim().isNotEmpty == true ? result! : '기록된 시험 로그가 없습니다.');
    } catch (error) {
      if (mounted) setState(() => _logs = '로그 조회 오류: $error');
    }
  }

  Future<void> _copy() async {
    await _readLogs();
    await Clipboard.setData(ClipboardData(text:
      '$_status\n---기기---\n$_hardware\n---SDK---\n$_logs'));
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('진단 로그를 복사했습니다.')),
      );
    }
  }

  // Original vendor sample WAV is 16 kHz mono little-endian PCM16.
  // Parse actual RIFF chunks rather than assuming a fixed 44-byte header.
  Future<Int16List> _readOriginalSpeech() async {
    final asset = await rootBundle.load('assets/speech.wav');
    final bytes = asset.buffer.asUint8List(
        asset.offsetInBytes, asset.lengthInBytes);
    final bd = ByteData.sublistView(bytes);
    if (bytes.length < 44 ||
        String.fromCharCodes(bytes.sublist(0, 4)) != 'RIFF' ||
        String.fromCharCodes(bytes.sublist(8, 12)) != 'WAVE') {
      throw const FormatException('원본 speech.wav 헤더가 WAV 형식이 아닙니다.');
    }
    int? dataStart, dataLength, sampleRate, channels, format, bits;
    var off = 12;
    while (off + 8 <= bytes.length) {
      final tag = String.fromCharCodes(bytes.sublist(off, off + 4));
      final size = bd.getUint32(off + 4, Endian.little);
      final start = off + 8;
      if (start + size > bytes.length) break;
      if (tag == 'fmt ' && size >= 16) {
        format = bd.getUint16(start, Endian.little);
        channels = bd.getUint16(start + 2, Endian.little);
        sampleRate = bd.getUint32(start + 4, Endian.little);
        bits = bd.getUint16(start + 14, Endian.little);
      } else if (tag == 'data') {
        dataStart = start;
        dataLength = size;
      }
      off = start + size + (size & 1);
    }
    if (format != 1 || channels != 1 || sampleRate != 16000 ||
        bits != 16 || dataStart == null || dataLength == null) {
      throw FormatException('원본 음성 형식 오류: format=$format '
          'channels=$channels rate=$sampleRate bits=$bits');
    }
    final count = (dataLength ~/ 2).clamp(0, 32000);
    final pcm = Int16List(count);
    for (var i = 0; i < count; i++) {
      pcm[i] = bd.getInt16(dataStart + i * 2, Endian.little);
    }
    return pcm;
  }

  Future<void> _test() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _status = '테스트 서버·원본 모델 준비 중 (첫 실행 시 모델 약 159MB 복사)';
    });
    try {
      // The Android Flutter plugin has an explicit test-only branch for
      // A23WJF0199. No API secret is passed or requested.
      final avatar = await BithumanAvatar.load(
        'A23WJF0199', engine: 'expression2',
      );
      if (!mounted) {
        await avatar.dispose();
        return;
      }
      final old = _avatar;
      setState(() {
        _avatar = avatar;
        _status = '원본 SDK 생성 성공. 공개 원본 음성으로 2초간 추론 시험 중…';
      });
      if (old != null) await old.dispose();
      await avatar.audioStart(enableMic: false);
      final pcm = await _readOriginalSpeech();
      for (var start = 0; start < pcm.length; start += 640) {
        final end = start + 640 < pcm.length ? start + 640 : pcm.length;
        await avatar.pushAudio(Int16List.fromList(pcm.sublist(start, end)));
        await Future<void>.delayed(const Duration(milliseconds: 40));
      }
      await avatar.notifyTurnEnd();
      if (mounted) {
        setState(() => _status =
          '원본 음성 입력 완료. GPU·HTP·CPU 경로 및 프레임 출력 결과를 확인합니다.');
      }
      await Future<void>.delayed(const Duration(seconds: 3));
      await _readLogs();
    } catch (error) {
      if (mounted) setState(() => _status = '시험 실패: $error');
      await _readLogs();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    final avatar = _avatar;
    if (avatar != null) unawaited(avatar.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('HITEL · 원본 SDK GPU 시험')),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              SizedBox(
                height: 280,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: const Color(0xFF111827),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: _avatar == null
                      ? const Center(
                          child: Text('bitHuman 공개 Wise Pup\n원본 Flutter Texture 대기',
                            textAlign: TextAlign.center))
                      : Texture(textureId: _avatar!.textureId),
                ),
              ),
              const SizedBox(height: 10),
              FilledButton.icon(
                onPressed: _busy ? null : _test,
                icon: const Icon(Icons.play_arrow),
                label: Text(_busy ? '원본 SDK 시험 진행 중' :
                    '원본 SDK 시험 시작 (API Secret 불필요)'),
              ),
              const SizedBox(height: 8),
              SelectableText(_status),
              const Divider(height: 22),
              const Text('갤럭시 GPU·NPU 환경',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              SelectableText(_hardware),
              const Divider(height: 22),
              Row(children: [
                Expanded(child: OutlinedButton(
                  onPressed: _readLogs, child: const Text('로그 갱신'))),
                const SizedBox(width: 8),
                Expanded(child: OutlinedButton(
                  onPressed: _copy, child: const Text('전체 로그 복사'))),
              ]),
              SelectableText(_logs),
            ],
          ),
        ),
      );
}
