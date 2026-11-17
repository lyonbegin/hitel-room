#!/usr/bin/env python3
"""Turn the HITEL Android 0.6.1 measurement app into a local-only mock.
Keep original vendor native and audio/face pipeline, no Railway cloud use.
"""
from pathlib import Path
import argparse, json

RUNTIME = "import 'dart:async';\nimport 'dart:convert';\nimport 'dart:io';\nimport 'dart:math';\nimport 'package:mock_realtime/mock_realtime.dart';\n\n// In-process 127.0.0.1 measurement server. NO Railway / external traffic.\n// This is a HITEL test handler, NOT vendor bitHuman entitlement or metering.\nclass HitelOfflineRuntime {\n  MockRealtimeServer? _mock;\n  HttpServer? _auth;\n  Future<String>? _starting;\n  String? _token;\n  bool _closed = false;\n\n  String get websocketUrl {\n    final m = _mock;\n    if (m == null) throw StateError('offline mock not started');\n    return m.url + '/v1/realtime?model=gpt-realtime-mini';\n  }\n\n  Future<String> start() => _starting ??= _start();\n  Future<String> _start() async {\n    if (_closed) throw StateError('offline runtime already closed');\n    final auth = await HttpServer.bind(InternetAddress.loopbackIPv4, 18762);\n    _auth = auth;\n    final secure = Random.secure();\n    final nonce = base64UrlEncode(List<int>.generate(32, (_) => secure.nextInt(256)));\n    final token = 'htdemo.v1.offline.$nonce';\n    _token = token;\n    auth.listen((req) => unawaited(_handleAuth(req)));\n    final mock = await MockRealtimeServer.start(port: 0);\n    _mock = mock;\n    unawaited(_driveMock(mock));\n    return token;\n  }\n\n  Future<void> _handleAuth(HttpRequest req) async {\n    try {\n      if (req.connectionInfo?.remoteAddress.isLoopback != true) {\n        req.response.statusCode = 403;\n        await req.response.close();\n        return;\n      }\n      final bearer = req.headers.value('authorization');\n      final secret = req.headers.value('api-secret');\n      if (_token == null || (bearer != 'Bearer $_token' && secret != _token)) {\n        req.response.statusCode = 401;\n        await req.response.close();\n        return;\n      }\n      final door = req.method == 'GET' &&\n          req.uri.path == '/v1/agent/A23WJF0199/model/download' &&\n          req.uri.queryParameters['model'] == 'expression-2' &&\n          req.uri.queryParameters['redirect'] == 'false';\n      final meter = req.method == 'POST' && req.uri.path == '/v1/meter/beats';\n      final validation = req.method == 'POST' && req.uri.path == '/v1/auth/validate';\n      if (!door && !meter && !validation) {\n        req.response.statusCode = 404;\n        await req.response.close();\n        return;\n      }\n      req.response.headers.contentType = ContentType.json;\n      req.response.headers.set('cache-control', 'no-store');\n      req.response.write(jsonEncode({\n        'valid': true, 'product': 'expression-2',\n        'mode': 'HITEL_OFFLINE_MEASUREMENT_ONLY',\n        'licensed_vendor_entitlement': false,\n      }));\n      await req.response.close();\n    } catch (_) {\n      try {\n        req.response.statusCode = 503;\n        await req.response.close();\n      } catch (_) {}\n    }\n  }\n\n  Future<void> _driveMock(MockRealtimeServer server) async {\n    while (!_closed) {\n      MockConnection conn;\n      try {\n        conn = await server.nextConnection(timeout: const Duration(days: 365));\n      } catch (_) { break; }\n      unawaited(_handleClient(conn));\n    }\n  }\n\n  Future<void> _handleClient(MockConnection conn) async {\n    try {\n      if (conn.authorization != 'Bearer $_token') {\n        await conn.close();\n        return;\n      }\n      conn.sendSessionCreated();\n      while (!_closed && !conn.isClosed) {\n        final event = await conn.nextEvent(timeout: const Duration(days: 1));\n        switch (event.type) {\n          case 'session.update':\n            break;\n          case 'response.create':\n            unawaited(conn.sendResponse(\n              transcript: 'This is the mock agent speaking.',\n              chunks: 10,\n              interDelta: const Duration(milliseconds: 60),\n            ));\n            break;\n          case 'response.cancel':\n            conn.sendResponseCancelled();\n            break;\n          case 'input_audio_buffer.commit':\n            unawaited(conn.sendResponse(\n                transcript: 'Reply to your committed turn.'));\n            break;\n        }\n      }\n    } catch (_) {}\n  }\n\n  Future<void> close() async {\n    _closed = true;\n    _token = null;\n    final mock = _mock;\n    final auth = _auth;\n    _mock = null;\n    _auth = null;\n    if (mock != null) await mock.close();\n    if (auth != null) await auth.close(force: true);\n  }\n}\n"

def once(src, old, new, what):
    assert src.count(old) == 1, (what, src.count(old))
    return src.replace(old, new, 1)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--app',type=Path,required=True)
    ap.add_argument('--archive',type=Path,required=True)
    ap.add_argument('--plugin',type=Path,required=True)
    ap.add_argument('--report',type=Path,required=True)
    args=ap.parse_args()
    app=args.app
    package=app/'offline_mock_pkg'
    for rel in ('pubspec.yaml','lib/mock_realtime.dart'):
        source=args.archive/'e2e/mock_realtime'/rel
        target=package/rel
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(source.read_bytes())
    assert (package/'lib/mock_realtime.dart').read_bytes()==(args.archive/'e2e/mock_realtime/lib/mock_realtime.dart').read_bytes()
    (app/'lib/hitel_offline_runtime.dart').write_text(RUNTIME)
    spec=app/'pubspec.yaml'
    spec.write_text(once(spec.read_text(),'\ndependencies:\n',
      '\ndependencies:\n  mock_realtime:\n    path: offline_mock_pkg\n','local pub dependency'))
    dart=app/'lib/main.dart'
    text=dart.read_text()
    text=once(text,"import 'dart:async';\n","import 'dart:async';\nimport 'hitel_offline_runtime.dart';\n",'local runtime import')
    begin=text.index('  // Debug-only HITEL HTTPS session; not a bitHuman entitlement.')
    end=text.index('  Future<void> _boot() async {',begin)
    replacement="""  // HITEL first-party localhost measurement mode; no remote cloud.
  Future<String> _hitelAcquireHttpsSampleSession() async {
    final token = await _offline.start();
    BithumanRealtimeSession.debugEndpointOverride = _offline.websocketUrl;
    await _mark('hitel:offline:mock_realtime_127001');
    return token;
  }

"""
    text=text[:begin]+replacement+text[end:]
    text=once(text,'  BithumanAvatar? _avatar;\n',
      '  BithumanAvatar? _avatar;\n'
      '  final HitelOfflineRuntime _offline = HitelOfflineRuntime();\n'
      '  bool _resumingOffline = false;\n'
      '  int _lifecycleSerial = 0;\n',
      'offline app state')
    begin=text.index('  void didChangeAppLifecycleState(AppLifecycleState state) {')
    end=text.index('  /// Measurement runs only:',begin)
    replacement="""  void didChangeAppLifecycleState(AppLifecycleState state) {
    final avatar = _avatar;
    if (avatar == null) return;
    final serial = ++_lifecycleSerial;
    if (state == AppLifecycleState.paused || state == AppLifecycleState.hidden) {
      final session = _session;
      _session = null;
      if (session != null) unawaited(session.stop());
      unawaited(avatar.setIdleHold(true));
      _mark('lifecycle:offline-background');
    } else if (state == AppLifecycleState.resumed) {
      if (_session != null || _secret.isEmpty || _resumingOffline) return;
      _resumingOffline = true;
      unawaited(() async {
        try {
          await avatar.setIdleHold(false);
          if (!mounted || serial != _lifecycleSerial) return;
          await _mark('lifecycle:offline-player-ready');
          await _openSession(avatar, _secret);
        } catch (e) {
          await _mark('lifecycle:offline-resume-failed=$e');
        } finally { _resumingOffline = false; }
      }());
    }
  }

"""
    text=text[:begin]+replacement+text[end:]
    text=once(text,'    _avatar?.dispose();\n',
      '    _avatar?.dispose();\n'
      '    unawaited(_offline.close());\n'
      '    BithumanRealtimeSession.debugEndpointOverride = null;\n',
      'offline app cleanup')
    assert 'BithumanAvatar.load(agentDir, engine: _engine, apiSecret: secret)' in text
    assert '      await _openSession(avatar, secret);' in text
    assert 'hitel-expression2-auth-production.up.railway.app' not in text
    assert 'hitel-expression2-dart-realtime-production.up.railway.app' not in text
    dart.write_text(text)

    # Existing HITEL gateway route becomes same-device test listener.
    ent=args.plugin/'android/src/main/kotlin/ai/bithuman/flutter/EntitlementWindow.kt'
    ent.write_text(once(ent.read_text(),
        'https://hitel-expression2-auth-production.up.railway.app/v1/agent/',
        'http://127.0.0.1:18762/v1/agent/',
        'offline entitlement test endpoint'))
    manifest=app/'android/app/src/main/AndroidManifest.xml'
    manifest.write_text(once(manifest.read_text(),
        '<application\n','<application\n        android:usesCleartextTraffic="true"\n',
        'localhost-only Android debug network policy'))
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps({
      'mode':'HITEL_OFFLINE_MEASUREMENT_ONLY',
      'railway_services_required':0,'model_download_over_network':False,
      'local_mock_original_source_byte_identical':True,
      'local_mock_websocket':'127.0.0.1:ephemeral',
      'local_meter_and_auth':'127.0.0.1:18762',
      'github_pages':'static info only',
      'original_ARM64_inference_changed':False,
      'real_AI':False,
      'vendor_entitlement_verified':False,
      'on_device_tested':False
    },indent=2)+'\n')
    print('PASS_HITEL_OFFLINE_ANDROID_ONLY_NO_RAILWAY')
if __name__=='__main__': main()
