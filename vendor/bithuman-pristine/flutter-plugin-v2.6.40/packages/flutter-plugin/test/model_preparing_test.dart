// "Still being prepared for this device" (2.6.40; lib/src/model_preparing.dart): bitHuman's door answers a character
// whose on-device model does not exist yet (an agent still training, or its device copy still being built) with 404
// MODEL_ARTIFACT_NOT_READY. Through 2.6.39 every path here worded that as a credential problem ("could not confirm
// that this credential may open this avatar") or a plain failure. Now it is BithumanModelPreparing, retried on
// 30 s, 60 s, 120 s, then every 300 s (with jitter), and every other 404 keeps exactly its 2.6.39 answer.
//
// Recognised as bitHuman's Swift and Android stores read the door: a 404 from the door that was asked whose FIRST
// `"code"` within the body's first 300 bytes is MODEL_ARTIFACT_NOT_READY. The message text is never parsed.
//
// Loopback servers stand in for the door and for storage (plain http, which only a test gate accepts). No real
// network. Apache-2.0; (c) bitHuman.

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:bithuman/bithuman.dart';
import 'package:bithuman/src/agent_imx.dart';
import 'package:bithuman/src/door_gate.dart';
import 'package:bithuman/src/model_preparing.dart' show doorEtaSeconds, doorHeadCode, doorReason;
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

const _owner = 'sk_test_owner';
const _other = 'sk_test_other';
const _code = 'A99LTC2401';

// The legacy shape (API contract 4a): an agent still training.
const _notReadyTraining = '{"error": {"code": "MODEL_ARTIFACT_NOT_READY", "message": "agent A99LTC2401\'s essence-2 '
    'model is still being prepared: training. Poll GET /v1/agent/A99LTC2401 - model_status[\'essence-2\'].state goes '
    '\'pending\' -> \'ready\', and this endpoint serves the artifact from the same moment. Do NOT re-add the model; it '
    'is already being built for this agent.", "httpStatus": 404}}';
// The device-bundle shape (API contract 4b): `reason` a flat string after `code`; an ETA only in the words.
const _notReadyDevice = '{"error": {"code": "MODEL_ARTIFACT_NOT_READY", "message": "agent A99LTC2401\'s essence-2 '
    'model is still being prepared: this model is being prepared for this device (on-device copy requested 12:00Z, '
    'typically ready within about 90 minutes). Poll GET /v1/agent/A99LTC2401 - model_status[\'essence-2\'].state goes '
    '\'pending\' -> \'ready\', and this endpoint serves the artifact from the same moment. Do NOT re-add the model; it '
    'is already being built for this agent.", "httpStatus": 404, "reason": "DEVICE_BUILD_PENDING"}}';
// What bitHuman's door answered another account's key on 2026-10-03.
const _notFound = '{"error": {"code": "NOT_FOUND", "message": "Agent not found for code: A99LTC2401", '
    '"httpStatus": 404}, "status": "error", "status_code": 404}';

const _avatar = MethodChannel('ai.bithuman.avatar');
TestDefaultBinaryMessenger get _messenger => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

/// A door answer as the door writes it (an http response), then the rest.
class _Door {
  _Door(this.server) {
    server.listen((req) async {
      keys.add(req.headers.value('api-secret'));
      paths.add(req.uri.toString());
      final member = req.uri.queryParameters.containsKey('member');
      final (int status, String body, Map<String, String> headers) = (member ? memberRule : null)?.call(req) ?? rule(req);
      req.response.statusCode = status;
      req.response.headers.contentType = ContentType.json;
      headers.forEach(req.response.headers.set);
      req.response.write(body);
      await req.response.close();
    });
  }
  final HttpServer server;
  final keys = <String?>[];
  final paths = <String>[];
  late (int, String, Map<String, String>) Function(HttpRequest req) rule;
  (int, String, Map<String, String>) Function(HttpRequest req)? memberRule;
  static Future<_Door> start() async => _Door(await HttpServer.bind(InternetAddress.loopbackIPv4, 0));
  Uri url(String path, [Map<String, String>? q]) =>
      Uri.parse('http://127.0.0.1:${server.port}$path').replace(queryParameters: q);
}

const _grant = (200, '{"success": true, "data": {"url": "https://example.invalid/x"}}', <String, String>{});

/// The 2.6.40 answer: a typed, retryable "preparing" that is still the 2.6.39 exception type (refused false, 404).
Matcher _preparing({String? reason, int? etaS}) => throwsA(isA<BithumanModelPreparing>()
    .having((e) => e.refused, 'refused', false)
    .having((e) => e.status, 'status', 404)
    .having((e) => e.code, 'code', 'MODEL_ARTIFACT_NOT_READY')
    .having((e) => e.reason, 'reason', reason)
    .having((e) => e.etaS, 'etaS', etaS)
    .having((e) => e, 'a BithumanEntitlementException (2.6.39 catch blocks still catch it)', isA<BithumanEntitlementException>())
    .having((e) => e.message, 'message', allOf(contains('HTTP 404 MODEL_ARTIFACT_NOT_READY'),
        contains('still being prepared for this device'), isNot(contains('credential')), isNot(contains('apiSecret')))));

/// Every other 404: exactly the 2.6.39 exception, never the preparing one.
Matcher _notPreparing(Matcher inner) => throwsA(allOf(isNot(isA<BithumanModelPreparing>()), inner));

Uint8List _imx(int size) {
  final b = Uint8List(size)..fillRange(0, size, 7);
  b.setRange(0, 3, 'IMX'.codeUnits);
  return b;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory tmp;
  late _Door door;
  late HttpServer storage;
  final now = DateTime.utc(2026, 10, 5, 12);

  setUpAll(() => HttpOverrides.global = null); // real loopback sockets (the test binding mocks HttpClient)

  setUp(() async {
    tmp = await Directory.systemTemp.createTemp('model_preparing_test');
    door = await _Door.start();
    door.rule = (_) => (404, _notReadyDevice, const {});
    storage = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    storage.listen((req) async {
      final b = _imx(1200000);
      req.response.headers.contentLength = b.length;
      req.response.add(b);
      await req.response.close();
    });
  });

  tearDown(() async {
    await door.server.close(force: true);
    await storage.close(force: true);
    await tmp.delete(recursive: true);
  });

  DoorGate gate({bool member = false}) => DoorGate(
      clock: () => now,
      allowInsecure: true,
      door: (code, model) => door.url('/v1/agent/$code/model/download', {if (model.isNotEmpty) 'model': model, 'redirect': 'false'}),
      publicDoor: member
          ? (code, family) => door.url('/v1/agent/$code/model/download', {'model': family, 'member': 'catalog', 'redirect': 'false'})
          : null);

  // ───────────────────────────────────────────── how the answer is recognised (the first 300 bytes, never the words)
  group('recognition', () {
    List<int> b(String s) => utf8.encode(s);

    test('404 + MODEL_ARTIFACT_NOT_READY as the first code in the first 300 bytes; reason flat; no ETA from the words', () {
      for (final body in [_notReadyTraining, _notReadyDevice]) {
        final a = DoorAnswer.fromBody(404, b(body));
        expect(a.preparing, isTrue, reason: body);
        expect(a.granted, isFalse);
        expect(a.denied, isFalse);
        expect(a.code, 'MODEL_ARTIFACT_NOT_READY');
        expect(a.etaS, isNull, reason: '"typically ready within about 90 minutes" is words: never parsed');
      }
      expect(DoorAnswer.fromBody(404, b(_notReadyTraining)).reason, isNull);
      expect(DoorAnswer.fromBody(404, b(_notReadyDevice)).reason, 'DEVICE_BUILD_PENDING');
      expect('${DoorAnswer.fromBody(404, b(_notReadyDevice))}', 'HTTP 404 MODEL_ARTIFACT_NOT_READY');
    });

    test('the code past the first 300 bytes, a NOT_FOUND first, another status, a redirected answer: not preparing', () {
      final late = '{"pad": "${'x' * 300}", "error": {"code": "MODEL_ARTIFACT_NOT_READY"}}';
      expect(doorHeadCode(b(late)), isNull);
      expect(DoorAnswer.fromBody(404, b(late)).preparing, isFalse);
      expect(DoorAnswer.fromBody(404, b(late)).code, 'MODEL_ARTIFACT_NOT_READY', reason: 'the 2.6.39 code read is unchanged');
      final first = '{"error": {"code": "NOT_FOUND", "detail": {"code": "MODEL_ARTIFACT_NOT_READY"}}}';
      expect(doorHeadCode(b(first)), 'NOT_FOUND');
      expect(DoorAnswer.fromBody(404, b(first)).preparing, isFalse);
      expect(DoorAnswer.fromBody(404, b(first)).denied, isTrue, reason: 'NOT_FOUND keeps its 2.6.39 meaning');
      for (final s in [409, 503, 401, 403, 200]) {
        expect(DoorAnswer.fromBody(s, b(_notReadyDevice)).preparing, isFalse, reason: 'HTTP $s');
      }
      expect(DoorAnswer.fromBody(404, b(_notReadyDevice), answeredByAskedHost: false).preparing, isFalse,
          reason: 'a storage host\'s answer behind the door\'s redirect is not the door');
      expect(DoorAnswer.fromBody(404, b(_notFound)).preparing, isFalse);
      expect(DoorAnswer.fromBody(404, const []).preparing, isFalse);
      // At the 300-byte edge: the code counts only when all of it (closing quote included) is inside.
      String padded(int n) => '{"pad": "${'x' * n}", "error": {"code": "MODEL_ARTIFACT_NOT_READY"}}';
      final straddles = padded(260), inside = padded(200);
      expect(straddles.indexOf('"code"'), lessThan(300));
      expect(straddles.indexOf('_READY"') + 7, greaterThan(300));
      expect(DoorAnswer.fromBody(404, b(straddles)).preparing, isFalse);
      expect(inside.indexOf('_READY"') + 7, lessThanOrEqualTo(300));
      expect(DoorAnswer.fromBody(404, b(inside)).preparing, isTrue);
    });

    test('an ETA only from a structured field: Retry-After (seconds) or error.eta_s', () {
      expect(doorEtaSeconds(_notReadyDevice), isNull);
      expect(doorEtaSeconds(_notReadyDevice, retryAfter: '120'), 120);
      expect(doorEtaSeconds(_notReadyDevice, retryAfter: 'Wed, 21 Oct 2026 07:28:00 GMT'), isNull);
      expect(doorEtaSeconds('{"error": {"code": "MODEL_ARTIFACT_NOT_READY", "eta_s": 900}}'), 900);
      expect(doorEtaSeconds('{"error": {"eta_s": 12.5}}'), isNull);
      expect(doorReason('{"error": {"code": "X", "reason": {"code": "Y"}}}'), isNull, reason: 'reason is a flat string');
      expect(DoorAnswer.fromBody(404, b(_notFound), retryAfter: '60').etaS, isNull, reason: 'only a preparing answer has one');
    });
  });

  // ───────────────────────────────────────────────── the gate every installer goes through
  group('DoorGate', () {
    test('admit: the door\'s NOT_READY is BithumanModelPreparing; nothing marked; the door\'s yes later opens', () async {
      final g = gate();
      await expectLater(g.admit(tmp.path, 'e', g.door(_code, 'essence-2'), _owner, what: 'essence-2:$_code'),
          _preparing(reason: 'DEVICE_BUILD_PENDING'));
      expect(g.markFile(tmp.path, 'e', _owner).existsSync(), isFalse);
      door.rule = (_) => (404, _notReadyTraining, const {'retry-after': '45'});
      await expectLater(g.admit(tmp.path, 'e', g.door(_code, 'essence-2'), _owner, what: 'w'), _preparing(etaS: 45));
      door.rule = (_) => _grant;
      await g.admit(tmp.path, 'e', g.door(_code, 'essence-2'), _owner, what: 'w');
      expect(await g.mayOpenWithoutDoor(tmp.path, 'e', _owner), isTrue);
    });

    test('a kept copy with no fresh mark: preparing, not "could not confirm"; a fresh mark still opens at once', () async {
      final g = gate();
      await expectLater(g.openKept(tmp.path, 'k', g.door(_code, 'expression-2'), _owner, what: 'expression-2:$_code'),
          _preparing(reason: 'DEVICE_BUILD_PENDING'));
      await g.noteGranted(tmp.path, 'k', _owner);
      await g.openKept(tmp.path, 'k', g.door(_code, 'expression-2'), _owner, what: 'w'); // at once
      await g.checking(tmp.path, 'k', _owner);
      expect(await g.mayOpenWithoutDoor(tmp.path, 'k', _owner), isTrue, reason: 'NOT_READY in the background moves no mark');
    });

    test('another account\'s public avatar still being prepared at the member door: preparing; the mark follows the container\'s no', () async {
      final g = gate(member: true);
      door.rule = (_) => (404, _notFound, const {});
      door.memberRule = (_) => _grant;
      await g.admit(tmp.path, 'p', g.door(_code, 'essence-2'), _other, what: 'w', publicDoor: g.publicDoor(_code, 'essence-2'));
      expect(g.markFile(tmp.path, 'p', _other).existsSync(), isTrue);
      door.memberRule = (_) => (404, _notReadyDevice, const {});
      await expectLater(
          g.admit(tmp.path, 'p', g.door(_code, 'essence-2'), _other, what: 'w', publicDoor: g.publicDoor(_code, 'essence-2')),
          _preparing(reason: 'DEVICE_BUILD_PENDING'));
      expect(g.markFile(tmp.path, 'p', _other).existsSync(), isFalse, reason: 'fail closed, as through 2.6.39');
    });

    test('every other 404 keeps its 2.6.39 answer', () async {
      final g = gate();
      door.rule = (_) => (404, _notFound, const {});
      await expectLater(g.admit(tmp.path, 'o', g.door(_code, 'essence-2'), _other, what: 'w'),
          _notPreparing(isA<BithumanEntitlementException>().having((e) => e.refused, 'refused', true)));
      for (final body in ['', '{"pad": "${'x' * 300}", "error": {"code": "MODEL_ARTIFACT_NOT_READY"}}']) {
        door.rule = (_) => (404, body, const {});
        await expectLater(g.admit(tmp.path, 'o', g.door(_code, 'essence-2'), _owner, what: 'w'),
            _notPreparing(isA<BithumanEntitlementException>()
                .having((e) => e.refused, 'refused', false)
                .having((e) => e.message, 'message', contains('could not confirm'))));
      }
      door.rule = (_) => (409, '{"error": {"code": "MODEL_UNAVAILABLE", "reason": "DEVICE_BUILD_FAILED"}}', const {});
      await expectLater(g.admit(tmp.path, 'o', g.door(_code, 'essence-2'), _owner, what: 'w'),
          _notPreparing(isA<BithumanEntitlementException>().having((e) => e.refused, 'refused', false)));
    });
  });

  // ───────────────────────────────────────────────── downloadAgentImx (the `.imx`)
  group('downloadAgentImx', () {
    AgentImxDownloader dl() => AgentImxDownloader(
        allowInsecure: true,
        clock: () => now,
        doorHosts: const {'127.0.0.1'},
        door: (code) => door.url('/v1/agent/$code/model/download'));
    BithumanAgent agent(String modelUrl) => BithumanAgent(
        id: _code, name: _code, description: '', category: '', imageUrl: '', modelUrl: modelUrl,
        systemPrompt: '', voiceId: '', modelType: 'essence-2');

    test('with a key: preparing; nothing written, nothing marked; once ready it downloads', () async {
      final d = dl();
      await expectLater(d.download(agent('unused'), tmp.path, apiSecret: _owner), _preparing(reason: 'DEVICE_BUILD_PENDING'));
      expect(File('${tmp.path}/$_code.imx').existsSync(), isFalse);
      expect(d.gate.markFile(tmp.path, AgentImxDownloader.markEntry(_code), _owner).existsSync(), isFalse);
      door.rule = (req) => (302, '', {'location': 'http://localhost:${storage.port}/signed/$_code.imx?t=x'});
      final p = await d.download(agent('unused'), tmp.path, apiSecret: _owner, allowedHosts: const {'localhost'});
      expect(File(p).lengthSync(), 1200000);
    });

    test('without a key, from a row whose model_url is the door: preparing', () async {
      await expectLater(dl().download(agent(door.url('/v1/agent/$_code/model/download').toString()), tmp.path),
          _preparing(reason: 'DEVICE_BUILD_PENDING'));
    });

    test('a NOT_READY body from a storage host behind the door\'s redirect is not the door: not preparing', () async {
      final store404 = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      store404.listen((req) async {
        req.response.statusCode = 404;
        req.response.write(_notReadyDevice);
        await req.response.close();
      });
      door.rule = (req) => (302, '', {'location': 'http://localhost:${store404.port}/signed/$_code.imx'});
      await expectLater(
          dl().download(agent('unused'), tmp.path, apiSecret: _owner, allowedHosts: const {'localhost'}),
          _notPreparing(isA<BithumanAvatarException>()));
      await store404.close(force: true);
    });

    test('another account\'s NOT_FOUND stays a refusal', () async {
      door.rule = (_) => (404, _notFound, const {});
      await expectLater(dl().download(agent('unused'), tmp.path, apiSecret: _other),
          _notPreparing(isA<BithumanEntitlementException>().having((e) => e.refused, 'refused', true)));
    });
  });

  // ───────────────────────────────────────────────── the top-level installers and load
  group('installers and load', () {
    late DoorGate saved;
    final calls = <MethodCall>[];
    Object? loadFails;
    setUp(() {
      saved = entitlementGate;
      entitlementGate = gate();
      calls.clear();
      loadFails = null;
      _messenger.setMockMethodCallHandler(_avatar, (call) async {
        calls.add(call);
        if (call.method == 'load') {
          final f = loadFails;
          if (f != null) throw f;
          return 7;
        }
        if (call.method == 'frameSize') return {'width': 416, 'height': 720};
        if (call.method == 'isReady') return true;
        return null;
      });
    });
    tearDown(() {
      entitlementGate = saved;
      _messenger.setMockMethodCallHandler(_avatar, null);
    });

    test('downloadExpression2Avatar / downloadExpression2Agent / downloadEssence2Bundle: preparing, nothing fetched', () async {
      await expectLater(downloadExpression2Avatar(_code, 'https://example.invalid/$_code.avatar', tmp.path, apiSecret: _owner),
          _preparing(reason: 'DEVICE_BUILD_PENDING'));
      await expectLater(downloadExpression2Agent(_code, 'https://example.invalid/$_code.tar.gz', tmp.path, apiSecret: _owner),
          _preparing(reason: 'DEVICE_BUILD_PENDING'));
      const entry = Essence2CatalogEntry(
          agentId: _code, url: 'https://example.invalid/b.tar.gz', sha256: '', size: 0, formatVersion: 'elevatedir-v3');
      await expectLater(downloadEssence2Bundle(entry, tmp.path, apiSecret: _owner), _preparing(reason: 'DEVICE_BUILD_PENDING'));
      expect(door.paths.every((p) => p.contains('/v1/agent/$_code/model/download')), isTrue, reason: 'only the door was asked');
      expect(tmp.listSync().where((e) => !e.path.endsWith('.door-auth')), isEmpty);
    });

    test('Android: load\'s model_preparing channel error is BithumanModelPreparing, with its reason and ETA', () async {
      loadFails = PlatformException(
          code: 'model_preparing',
          message: 'essence-2:$_code: this character is still being prepared for this device (HTTP 404 MODEL_ARTIFACT_NOT_READY, '
              'DEVICE_BUILD_PENDING); the same load succeeds once it is ready.',
          details: {'status': 404, 'code': 'MODEL_ARTIFACT_NOT_READY', 'reason': 'DEVICE_BUILD_PENDING', 'etaS': 600});
      await expectLater(BithumanAvatar.load(_code, engine: 'essence2', apiSecret: _owner),
          _preparing(reason: 'DEVICE_BUILD_PENDING', etaS: 600));
      loadFails = PlatformException(code: 'model_preparing', message: null, details: null);
      await expectLater(BithumanAvatar.load(_code, engine: 'essence2', apiSecret: _owner), _preparing());
    });

    test('Android: entitlement_unconfirmed / entitlement_refused keep their 2.6.39 mapping', () async {
      loadFails = PlatformException(code: 'entitlement_unconfirmed', message: 'could not confirm', details: 503);
      await expectLater(BithumanAvatar.load(_code, engine: 'essence2', apiSecret: _owner),
          _notPreparing(isA<BithumanEntitlementException>().having((e) => e.refused, 'refused', false).having((e) => e.status, 'status', 503)));
      loadFails = PlatformException(code: 'entitlement_refused', message: 'refused', details: 404);
      await expectLater(BithumanAvatar.load(_code, engine: 'essence2', apiSecret: _owner),
          _notPreparing(isA<BithumanEntitlementException>().having((e) => e.refused, 'refused', true)));
    });
  });

  // ───────────────────────────────────────────────── the retry schedule
  group('retry', () {
    test('30 s, 60 s, 120 s, then every 300 s, plus at most 10% jitter: never under 30 s, never over 330 s', () {
      final zero = _FixedRandom(0);
      expect([for (var i = 1; i <= 7; i++) BithumanModelPreparing.retryDelay(i, random: zero).inSeconds],
          [30, 60, 120, 300, 300, 300, 300]);
      final top = _FixedRandom(0.999999);
      expect([for (var i = 1; i <= 5; i++) BithumanModelPreparing.retryDelay(i, random: top).inMilliseconds],
          [33000, 66000, 132000, 330000, 330000]);
      final r = math.Random(7);
      for (var i = 0; i < 500; i++) {
        final d = BithumanModelPreparing.retryDelay(1 + i % 6, random: r);
        expect(d, greaterThanOrEqualTo(const Duration(seconds: 30)));
        expect(d, lessThanOrEqualTo(const Duration(seconds: 330)));
      }
      expect(BithumanModelPreparing.retryDelay(0, random: zero), const Duration(seconds: 30));
      expect(BithumanModelPreparing.userMessage, 'Preparing this character for your device…');
    });

    test('retryWhileModelPreparing: retries only "preparing", on the schedule, and stops when cancelled', () async {
      final waits = <Duration>[];
      final heard = <String?>[];
      var n = 0;
      final v = await retryWhileModelPreparing(() async {
        if (++n < 4) throw BithumanModelPreparing('p$n', reason: 'DEVICE_BUILD_PENDING');
        return 'ready';
      }, sleep: (d) async => waits.add(d), onPreparing: (p, _) => heard.add(p.message), random: _FixedRandom(0));
      expect(v, 'ready');
      expect(waits, const [Duration(seconds: 30), Duration(seconds: 60), Duration(seconds: 120)]);
      expect(heard, ['p1', 'p2', 'p3']);
      // Anything else is rethrown at once, without a wait.
      waits.clear();
      await expectLater(
          retryWhileModelPreparing<void>(() async => throw const BithumanEntitlementException('no', refused: true),
              sleep: (d) async => waits.add(d)),
          throwsA(isA<BithumanEntitlementException>()));
      expect(waits, isEmpty);
      // Cancelled: the last "preparing" is rethrown.
      var cancel = false;
      await expectLater(
          retryWhileModelPreparing<void>(() async => throw const BithumanModelPreparing('still'),
              sleep: (d) async => cancel = true, cancelled: () => cancel),
          throwsA(isA<BithumanModelPreparing>()));
      // [cancel] completing ends a wait under way at once (no 30 s to 330 s left to run), and nothing is tried after.
      final stop = Completer<void>();
      var tries = 0;
      final run = retryWhileModelPreparing<void>(() async {
        tries++;
        throw const BithumanModelPreparing('still');
      }, cancel: stop.future, sleep: (d) => Completer<void>().future); // a wait that never ends by itself
      await Future<void>.delayed(Duration.zero);
      stop.complete();
      await expectLater(run.timeout(const Duration(seconds: 5)), throwsA(isA<BithumanModelPreparing>()));
      expect(tries, 1);
    });
  });
}

class _FixedRandom implements math.Random {
  _FixedRandom(this.v);
  final double v;
  @override
  double nextDouble() => v;
  @override
  int nextInt(int max) => (v * max).floor();
  @override
  bool nextBool() => v >= 0.5;
}
