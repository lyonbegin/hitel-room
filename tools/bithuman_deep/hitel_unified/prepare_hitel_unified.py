"""Add the new shared Flutter page after existing pinned Essence2 assembly."""
from pathlib import Path
import argparse
import shutil

p = argparse.ArgumentParser()
p.add_argument("--app", type=Path, required=True)
a = p.parse_args()
root = Path(__file__).parent
for dart in (root / "lib").glob("*.dart"):
    shutil.copyfile(dart, a.app / "lib" / dart.name)
main = a.app / "lib/main.dart"
s = main.read_text()
anchor = "              FloatingActionButton.small(heroTag: 'clear-logs',"
assert s.count(anchor) == 1, "pinned UI anchor changed"
def replace(s,old,new,count=1):
    assert s.count(old)==count, (old,s.count(old))
    return s.replace(old,new)
s = "import 'hitel_communication_page.dart';\nimport 'hitel_main_rtc.dart';\n" + s
s = replace(s, '  BithumanAvatar? _avatar;\n', '''  BithumanAvatar? _avatar;
  final _rtcPlayback = HitelRtcPlayback();
  Future<void> _sendExistingPcm() async {
    final avatar = _avatar;
    if (avatar == null || !_rtcHost.ready) return;
    try {
      await const MethodChannel('ai.bithuman.avatar').invokeMethod<void>(
          'hitelPlayRtcPcm', {'textureId': avatar.textureId});
    } catch (e) {
      if (mounted) setState(() => _status = 'PCM 송신 실패 · $e');
    }
  }
  bool _rtcStarting = false;
  bool _rtcManualRetry = false;
  void _rtcTrace(String event) {
    debugPrint('[HITEL_RTC] $event');
    _hitelAppendAiTrace(event);
  }
  late final _rtcHost = HitelLocalRtcHost(_rtcPlayback, _rtcTrace);
  void _rtcChanged() { if (mounted) setState(() {}); }
  Future<void> _startHitelRtc(BithumanAvatar avatar) async {
    _rtcStarting = true;
    try {
      await _rtcHost.start(avatar.frameWidth > 0 ? avatar.frameWidth : 720,
                           avatar.frameHeight > 0 ? avatar.frameHeight : 1280);
      _rtcManualRetry = false;
    } catch (e) {
      _rtcManualRetry = true;
      if (mounted) setState(() => _status = 'WebRTC 연결 실패 · 권한 확인 후 연결 버튼을 누르세요: $e');
      rethrow;
    } finally {
      _rtcStarting = false;
    }
  }
  Future<void> _stopHitelRtc() async {
    await _rtcHost.stop();
    await _avatar?.interrupt(reason: 'rtc_transport_stopped');
  }
''')
s = replace(s, '    WidgetsBinding.instance.addObserver(this);\n','    WidgetsBinding.instance.addObserver(this);\n    _rtcPlayback.addListener(_rtcChanged);\n')
s = replace(s, "    if (!avatar.isReady) throw StateError('Avatar display did not become ready.');\n",
'''    if (!avatar.isReady) throw StateError('Avatar engine not ready.');
    await _startHitelRtc(avatar);
    if (!mounted || _avatar != avatar) return;
''')
# A permission dialog is itself a lifecycle interruption. Do not open a new
# session while its first permission request is running or after a denial.
s = replace(s, 'if (_session == null && _secret.isNotEmpty) {',
               'if (_session == null && _secret.isNotEmpty && !_rtcStarting && !_rtcManualRetry) {')
# Both former local texture paths now use the identical receive-only renderer.
s = replace(s,'Texture(textureId: a.textureId)','_rtcPlayback.view()',count=2)
s = replace(s,'    if (t.isEmpty || _session == null) return;', '''    if (t.isEmpty || _session == null) return;
    if (!_rtcHost.ready) {
      setState(() => _status = 'WebRTC 연결 필요 · 직접 출력하지 않습니다.');
      _hitelAppendAiTrace('RTC_TEXT_BLOCKED no_connected_receiver');
      return;
    }''')
s = replace(s,'          _session!.sendText(p);','          if (_rtcHost.ready) unawaited(_sendExistingPcm());')
s = replace(s, '    _session!.sendText(t);', '    unawaited(_sendExistingPcm());')
s = replace(s,'    WidgetsBinding.instance.removeObserver(this);\n',
'''    WidgetsBinding.instance.removeObserver(this);
    _rtcPlayback.removeListener(_rtcChanged);
    unawaited(_rtcHost.shutdown());
''')
s = replace(s,'        _session?.stop(); _session = null;\n',
'''        unawaited(_stopHitelRtc());
        _session?.stop(); _session = null;
''')
# Change only the main video's status badge, not the user's existing input/controls.
s = replace(s,"label: 'R7 Trace · $_status'","label: 'RTC · ${_rtcPlayback.status} · $_status'")
s = replace(s, "'mode=text_trigger_file_stream\\nSTT=false\\nTTS=false\\n'",
''' 'mode=rtc_receiver_only\\nSTT=false\\nTTS=false\\n'
          'rtcConnected=${_rtcHost.ready}\\nrtcEvidence=${_rtcPlayback.evidence}\\n' ''')
s = replace(s, anchor, """              FloatingActionButton.small(heroTag: 'hitel-rtc-toggle',
                tooltip: 'WebRTC 연결 중단 / 재연결',
                onPressed: () async {
                  final avatar = _avatar;
                  if (avatar == null) return;
                  try {
                    if (_rtcHost.ready) {
                      _rtcManualRetry = true;
                      await _stopHitelRtc();
                    } else {
                      _rtcManualRetry = false;
                      await _startHitelRtc(avatar);
                      if (_session == null && mounted) await _openSession(avatar, _secret);
                    }
                  } catch (e) {
                    _hitelAppendAiTrace('RTC_TOGGLE_FAIL $e');
                    if (mounted) setState(() => _status = 'WebRTC 연결 오류: $e');
                  }
                }, child: Icon(_rtcHost.ready ? Icons.link_off : Icons.link)),
              const SizedBox(width: 8),
              FloatingActionButton.small(heroTag: 'hitel-communication',
                tooltip: 'HITEL 통신 및 공개방',
                onPressed: () async {
                  await _stopHitelRtc();
                  if (!mounted) return;
                  await Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => const HitelCommunicationPage()));
                  if (mounted && _avatar != null) {
                    try { await _startHitelRtc(_avatar!); }
                    catch (e) { _hitelAppendAiTrace('RTC_RESTART_FAIL $e'); }
                  }
                },
                child: const Icon(Icons.video_call_rounded)),
              const SizedBox(width: 8),
""" + anchor)
assert 'Texture(textureId: a.textureId)' not in s
assert s.count('_rtcPlayback.view()') == 2
assert 'RTC_TEXT_BLOCKED' in s
main.write_text(s)
# A unique diagnostic marker gives the emulator a real decoded/rendered-frame signal.
rtc = a.app / "lib/hitel_main_rtc.dart"
s = rtc.read_text()
s = replace(s, "      firstFrame = true;", "      firstFrame = true;\n      debugPrint('HITEL_RTC_FIRST_FRAME');")
rtc.write_text(s)
# The fixture is packaged as raw PCM. No file decoder or socket audio messages in the APK.
runtime = a.app / 'lib/hitel_offline_runtime.dart'
code = runtime.read_text()
code = replace(code, "import 'hitel_file_reply.dart';\n", '')
code = replace(code, '  final _fileReply = HitelFileReply();\n', '')
start = code.index("          case 'conversation.item.create':")
end = code.index('        }\n      }\n    } catch', start)
code = code[:start] + """          case 'response.create':
            conn.sendResponseCreated();
            conn.sendResponseDone();
            break;
          case 'response.cancel':
            conn.sendResponseCancelled();
            break;
""" + code[end:]
code = replace(code, "      var pendingText = '';\n", '')
code = replace(code, ' finally { _fileReply.cancel(); }', '')
code = replace(code, '    _fileReply.close();\n', '')
runtime.write_text(code)
(a.app / 'lib/hitel_file_reply.dart').unlink()
spec=a.app / "pubspec.yaml"
s=replace(spec.read_text(), '    - assets/hitel_file_reply.m4a\n', '')
if "flutter_secure_storage:" not in s:
    assert s.count("\ndependencies:\n")==1
    s=s.replace("\ndependencies:\n","\ndependencies:\n  flutter_secure_storage: 9.2.4\n")
spec.write_text(s)
print("PASS_HITEL_FLUTTER_COMMUNICATION_PAGE_WIRED")
