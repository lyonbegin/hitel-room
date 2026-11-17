// HITEL public WebSocket gateway for the ORIGINAL bitHuman Dart mock-realtime.
// The bitHuman package stays byte-identical. Public clients are authenticated
// by the existing HITEL Expression 2 HTTPS service BEFORE WebSocket upgrade.
// Audio is deterministic test PCM, NOT speech TTS or commercial bitHuman relay.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:mock_realtime/mock_realtime.dart';

const _agentCode = 'A23WJF0199';
const _maxActive = 12;
const _maxHandshakes = 24;
const _maxEvents = 6000;
const _maxEventBytes = 65536;
const _sessionLimit = Duration(minutes: 15);
int _active = 0;
int _handshakes = 0;

Future<void> main(List<String> args) async {
  final port = int.tryParse(Platform.environment['PORT'] ?? '') ?? 8080;
  if (port < 1 || port > 65535) throw StateError('Invalid PORT');
  final authBase = Uri.parse(
    Platform.environment['HITEL_EXPR2_AUTH_URL'] ??
        'https://hitel-expression2-auth-production.up.railway.app',
  );
  if (authBase.scheme != 'https' || authBase.host.isEmpty ||
      authBase.userInfo.isNotEmpty || authBase.hasQuery || authBase.hasFragment) {
    throw StateError('HITEL_EXPR2_AUTH_URL must be HTTPS without credentials');
  }
  final authEndpoint = authBase.resolve('/v1/auth/validate');

  // Only the original unmodified mock-realtime package generates events and PCM.
  // Its original start() binds to loopback, never to the public interface.
  final mock = await MockRealtimeServer.start(port: 0);
  unawaited(_runOriginalProtocol(mock));

  final validator = HttpClient()..connectionTimeout = const Duration(seconds: 6);
  final server = await HttpServer.bind(InternetAddress.anyIPv4, port);
  stdout.writeln('[hitel-dart-realtime] listening 0.0.0.0:$port; '
      'original_mock=127.0.0.1; bearer_validation=HITEL');
  server.listen(
    (request) => unawaited(_handle(request, mock.url, validator, authEndpoint)),
    onError: (Object error) => stderr.writeln('[hitel-dart-realtime] listener error'),
  );
}

Future<void> _runOriginalProtocol(MockRealtimeServer mock) async {
  while (true) {
    final connection =
        await mock.nextConnection(timeout: const Duration(days: 365));
    unawaited(_driveOriginalMock(connection));
  }
}

Future<void> _driveOriginalMock(MockConnection conn) async {
  try {
    conn.sendSessionCreated();
    while (!conn.isClosed) {
      final event =
          await conn.nextEvent(timeout: const Duration(days: 1));
      switch (event.type) {
        case 'session.update':
          break;
        case 'response.create':
          // The source library has its own generation guard; do not block
          // reading response.cancel while sending a test audio response.
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
            transcript: 'Reply to your committed turn.',
          ));
          break;
        default:
          break;
      }
    }
  } catch (_) {
    // One client disconnect must not terminate the public listener.
  }
}

Future<int> _validateBearer(
    HttpClient client, Uri endpoint, String? auth) async {
  if (auth == null || !auth.startsWith('Bearer ') ||
      auth.length > 8192 || auth.length < 28) {
    return HttpStatus.unauthorized;
  }
  try {
    final request = await client.postUrl(endpoint)
        .timeout(const Duration(seconds: 8));
    request.followRedirects = false;
    request.headers.set(HttpHeaders.authorizationHeader, auth);
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode({
      'product': 'expression-2',
      'agent_code': _agentCode,
    }));
    final response = await request.close().timeout(
      const Duration(seconds: 8),
    );
    final code = response.statusCode;
    await response.drain<void>();
    if (code == HttpStatus.ok) return HttpStatus.ok;
    if (code == HttpStatus.tooManyRequests) {
      return HttpStatus.tooManyRequests;
    }
    if (code == HttpStatus.unauthorized || code == HttpStatus.forbidden) {
      return HttpStatus.unauthorized;
    }
    return HttpStatus.serviceUnavailable;
  } catch (_) {
    return HttpStatus.serviceUnavailable; // fail closed
  }
}

Future<void> _json(HttpRequest request, int status,
    Map<String, Object> payload) async {
  request.response
    ..statusCode = status
    ..headers.contentType = ContentType.json
    ..headers.set('cache-control', 'no-store')
    ..write(jsonEncode(payload));
  await request.response.close();
}

Future<void> _handle(HttpRequest request, String upstreamUrl,
    HttpClient validator, Uri authEndpoint) async {
  final path = request.uri.path;
  if (request.method == 'GET' && path == '/healthz') {
    await _json(request, HttpStatus.ok, {
      'ok': true,
      'service': 'hitel-expression2-dart-realtime',
      'protocol': 'original-bitHuman-mock-realtime',
      'model_rendering': false,
    });
    return;
  }
  if (request.method == 'GET' && path == '/') {
    await _json(request, HttpStatus.ok, {
      'service': 'hitel-expression2-dart-realtime',
      'websocket_path': '/v1/realtime',
      'authentication': 'HITEL bearer required',
      'audio': 'deterministic test PCM 24kHz',
    });
    return;
  }
  if (request.method != 'GET' || path != '/v1/realtime') {
    await _json(request, HttpStatus.notFound, {'error': 'NOT_FOUND'});
    return;
  }
  if (!WebSocketTransformer.isUpgradeRequest(request)) {
    await _json(request, HttpStatus.upgradeRequired, {
      'error': 'WEBSOCKET_UPGRADE_REQUIRED',
    });
    return;
  }
  if (_active >= _maxActive || _handshakes >= _maxHandshakes) {
    await _json(request, HttpStatus.tooManyRequests, {
      'error': 'CONNECTION_LIMIT',
    });
    return;
  }

  _handshakes++;
  WebSocket? frontend;
  var active = false;
  try {
    final status = await _validateBearer(
      validator, authEndpoint,
      request.headers.value(HttpHeaders.authorizationHeader),
    );
    if (status != HttpStatus.ok) {
      await _json(request, status, {
        'error': status == HttpStatus.unauthorized
            ? 'HITEL_SESSION_REQUIRED'
            : 'HITEL_AUTH_UNAVAILABLE_OR_LIMITED',
      });
      return;
    }
    if (_active >= _maxActive) {
      await _json(request, HttpStatus.tooManyRequests, {
        'error': 'CONNECTION_LIMIT',
      });
      return;
    }
    frontend = await WebSocketTransformer.upgrade(request);
    _active++;
    active = true;
    await _relay(frontend, upstreamUrl);
  } catch (_) {
    // Avoid exposing credentials, private endpoint details, or stack traces.
    if (frontend == null) {
      try {
        await _json(request, HttpStatus.serviceUnavailable, {
          'error': 'UPGRADE_UNAVAILABLE',
        });
      } catch (_) {}
    } else {
      try {
        await frontend.close();
      } catch (_) {}
    }
  } finally {
    _handshakes--;
    if (active) _active--;
  }
}

Future<void> _relay(WebSocket frontend, String localMockUrl) async {
  WebSocket? local;
  try {
    local = await WebSocket.connect(localMockUrl);
    frontend.pingInterval = const Duration(seconds: 30);
    local.pingInterval = const Duration(seconds: 30);
    final ended = Completer<void>();
    var count = 0;
    void stop() {
      if (!ended.isCompleted) ended.complete();
    }
    frontend.listen((dynamic message) {
      if (message is! String ||
          message.length > _maxEventBytes ||
          ++count > _maxEvents) {
        stop();
        return;
      }
      if (local!.readyState == WebSocket.open) local.add(message);
    }, onDone: stop, onError: (Object _) => stop(), cancelOnError: true);
    local.listen((dynamic message) {
      if (frontend.readyState == WebSocket.open) frontend.add(message);
    }, onDone: stop, onError: (Object _) => stop(), cancelOnError: true);
    await ended.future.timeout(_sessionLimit, onTimeout: () {});
  } finally {
    try {
      await frontend.close();
    } catch (_) {}
    if (local != null) {
      try {
        await local.close();
      } catch (_) {}
    }
  }
}
