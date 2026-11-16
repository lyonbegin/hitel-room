import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:bithuman/bithuman.dart';

// HITEL Galaxy phone probe for the REAL official bitHuman Flutter bridge.
// Original Expression2 SDK and original Flutter Texture renderer stay in use.
// The native hardware inventory does NOT prove that QNN can compile the model.
void main() => runApp(const GalaxyExpression2App());

class GalaxyExpression2App extends StatelessWidget {
  const GalaxyExpression2App({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'HITEL · Expression 2 GPU',
        theme: ThemeData(useMaterial3: true, brightness: Brightness.dark),
        home: const GalaxyExpression2Screen(),
      );
}

class GalaxyExpression2Screen extends StatefulWidget {
  const GalaxyExpression2Screen({super.key});
  @override
  State<GalaxyExpression2Screen> createState() =>
      _GalaxyExpression2ScreenState();
}

class _GalaxyExpression2ScreenState extends State<GalaxyExpression2Screen> {
  static const _diagnostics = MethodChannel('ai.hitel.expression2.hardware');
  final _agent = TextEditingController(text: 'A23WJF0199');
  final _secret = TextEditingController();
  BithumanAvatar? _avatar;
  String _status = '실제 Galaxy 하드웨어를 검사한 후 원본 SDK에 GPU·HTP·CPU 경로를 요청합니다.';
  String _hardware = '기기 검사 버튼을 눌러 주십시오.';
  String _logs = '';
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
      final text = (map ?? {}).entries
          .map((item) => '${item.key} = ${item.value}')
          .join('\n');
      setState(() {
        _hardware = text.isEmpty ? '장치 정보 없음' : text;
        _status = '하드웨어 검사 완료. 라이브러리 존재 여부는 모델 GPU 추론 성공과 다릅니다.';
      });
    } on PlatformException catch (error) {
      if (mounted) setState(() => _hardware = '장치 검사 실패: ${error.message}');
    }
  }

  Future<void> _getLogs() async {
    try {
      final result = await _diagnostics.invokeMethod<String>('readOwnLogs');
      if (!mounted) return;
      setState(() => _logs =
          result?.trim().isNotEmpty == true ? result! : '아직 가속기 실행 로그가 없습니다.');
    } catch (error) {
      if (mounted) setState(() => _logs = '로그 조회 실패: $error');
    }
  }

  Future<void> _copyLogs() async {
    await Clipboard.setData(
      ClipboardData(text: '$_hardware\n$_status\n$_logs'),
    );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('기기 정보와 SDK 로그를 복사했습니다.')),
      );
    }
  }

  Future<void> _runOriginalSdk() async {
    if (_busy) return;
    final secret = _secret.text.trim();
    final agent = _agent.text.trim();
    if (secret.isEmpty || agent.isEmpty) {
      setState(() {
        _status = '실제 모델 추론 시험에는 정식 bitHuman API Secret이 필요합니다. '
            '기기·GPU 라이브러리 검사는 인증 없이 가능합니다.';
      });
      return;
    }
    setState(() {
      _busy = true;
      _status = '원본 모델 다운로드·인증·가속기 경로 선택 중…';
    });
    try {
      final current = await BithumanAvatar.load(
        agent,
        engine: 'expression2',
        apiSecret: secret,
      );
      _secret.clear();
      if (!mounted) {
        await current.dispose();
        return;
      }
      final previous = _avatar;
      setState(() {
        _avatar = current;
        _status = '원본 Flutter Texture 연결 성공. '
            '실제 선택한 GPU·HTP·CPU 경로는 「SDK 진단 로그」에서 확인하십시오.';
      });
      if (previous != null) await previous.dispose();
      await _getLogs();
    } catch (error) {
      if (mounted) setState(() => _status = '원본 SDK 실행 실패: $error');
      await _getLogs();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _agent.dispose();
    _secret.dispose();
    final avatar = _avatar;
    if (avatar != null) unawaited(avatar.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('HITEL Expression 2 · Galaxy GPU')),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              SizedBox(
                height: 250,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: const Color(0xFF111827),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: _avatar == null
                      ? const Center(child: Text(
                          '원본 Flutter Texture 출력 대기\n'
                          '아바타 로딩에는 정식 API Secret이 필요합니다.',
                          textAlign: TextAlign.center,
                        ))
                      : Texture(textureId: _avatar!.textureId),
                ),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _inspect,
                icon: const Icon(Icons.memory),
                label: const Text('1. 갤럭시 GPU·NPU 환경 검사 (인증 불필요)'),
              ),
              const SizedBox(height: 8),
              SelectableText(_hardware),
              const Divider(height: 26),
              TextField(
                controller: _agent,
                decoration: const InputDecoration(
                  labelText: 'bitHuman 공개 에이전트 코드',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _secret,
                obscureText: true,
                enableSuggestions: false,
                autocorrect: false,
                decoration: const InputDecoration(
                  labelText: '본인 bitHuman API Secret (APK에 저장하지 않음)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              FilledButton.icon(
                onPressed: _busy ? null : _runOriginalSdk,
                icon: const Icon(Icons.play_arrow),
                label: Text(_busy
                    ? '원본 SDK 실행 중…'
                    : '2. 원본 SDK GPU → HTP → CPU 추론 시험'),
              ),
              const SizedBox(height: 12),
              SelectableText(_status),
              const Divider(height: 26),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _getLogs,
                      child: const Text('SDK 진단 로그 갱신'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _copyLogs,
                      child: const Text('로그 복사'),
                    ),
                  ),
                ],
              ),
              SelectableText(_logs),
              const SizedBox(height: 40),
            ],
          ),
        ),
      );
}
