// Expression 2's OS floor on iOS / macOS (2.6.39).
//
// Every Expression 2 CoreML model (the shared audio front end and each identity's decoder) is an ML Program of
// spec 9, opset CoreML8, which only iOS 18 / macOS 15 and later compile. Through 2.6.38 a load on macOS 14 (or
// iOS 16.4-17) returned a texture, started the session, and then ended in MODEL_REJECTED when the warm-up hit
// "Unknown opset 'CoreML8'". From 2.6.39 the native load handler refuses it by name, before the engine exists,
// exactly as it refuses Essence 2 below 26 (shared/Classes/EngineSelection.swift, EngineRegistry.unmetOS):
//
//   * the refusal reaches the caller as the same PlatformException Essence 2's does (code `unsupported`, the
//     message names the floor), never as BithumanModelRejected, and nothing else is asked of the native side;
//   * the native sources keep the check where it refuses before any CoreML compile, at iOS 18 / macOS 15.
//
// No device, no engine: the channel is mocked and the Swift sources are read. Apache-2.0; (c) bitHuman.

import 'dart:io';

import 'package:bithuman/bithuman.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

const _avatar = MethodChannel('ai.bithuman.avatar');
TestDefaultBinaryMessenger get _messenger => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

const _x2Mac14 = 'Expression 2 needs iOS 18 / macOS 15 or later; this device runs macOS 14.8';
const _e2Mac14 = 'Essence 2 needs macOS 26 or later; this device runs macOS 14.8';

/// The native side refuses `load` the way BithumanAvatarPlugin.swift does for an engine below its OS.
List<MethodCall> _refuseBelowFloor(String message) {
  final calls = <MethodCall>[];
  _messenger.setMockMethodCallHandler(_avatar, (call) async {
    calls.add(call);
    if (call.method == 'load') {
      throw PlatformException(code: 'unsupported', message: message, details: {'engine': call.arguments['engine']});
    }
    return null;
  });
  addTearDown(() => _messenger.setMockMethodCallHandler(_avatar, null));
  return calls;
}

Matcher _refusedWith(String message) => throwsA(isA<PlatformException>()
    .having((e) => e.code, 'code', 'unsupported')
    .having((e) => e.message, 'message', message));

String _code(String path) => File(path)
    .readAsStringSync()
    .split('\n')
    .where((l) => !l.trimLeft().startsWith('//'))
    .join('\n');

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('Expression 2 below iOS 18 / macOS 15: refused by name, as Essence 2 below 26 is', () async {
    final calls = _refuseBelowFloor(_x2Mac14);
    await expectLater(BithumanAvatar.load('/app/avatars/A23WJF0199', engine: 'expression2', apiSecret: 's'),
        _refusedWith(_x2Mac14));
    expect(calls.map((c) => c.method), ['load'],
        reason: 'a refused load asks nothing more of the native side (no frameSize, no isReady poll)');
    expect(calls.single.arguments['engine'], 'expression2');
  });

  test('the public id and the old slug get the same refusal', () async {
    for (final engine in ['expression-2', 'embody']) {
      _refuseBelowFloor(_x2Mac14);
      await expectLater(BithumanAvatar.load('/app/avatars/A23WJF0199', engine: engine, apiSecret: 's'),
          _refusedWith(_x2Mac14));
    }
  });

  test('the refusal is not a model rejection: the files are fine, the OS is too old', () async {
    _refuseBelowFloor(_x2Mac14);
    Object? got;
    try {
      await BithumanAvatar.load('/app/avatars/A23WJF0199', engine: 'expression2', apiSecret: 's');
    } catch (e) {
      got = e;
    }
    expect(got, isNot(isA<BithumanModelRejected>()));
    expect(got, isA<PlatformException>());
  });

  test('Essence 2 on the same OS: the same code, and it no longer offers Expression 2', () async {
    _refuseBelowFloor(_e2Mac14);
    await expectLater(BithumanAvatar.load('/app/avatars/A52DHS2219.imx', engine: 'essence2', apiSecret: 's'),
        _refusedWith(_e2Mac14));
  });

  group('the native check (shared/Classes)', () {
    final registry = _code('shared/Classes/EngineRegistry.swift');
    final selection = _code('shared/Classes/EngineSelection.swift');
    final plugin = _code('shared/Classes/BithumanAvatarPlugin.swift');

    test('Expression 2 is checked at iOS 18 / macOS 15, Essence 2 at 26', () {
      final x2 = RegExp(r'case "expression2":\s*\n\s*if #available\(iOS 18\.0, macOS 15\.0, \*\) \{ return nil \}');
      final e2 = RegExp(r'case "essence2":\s*\n\s*if #available\(iOS 26\.0, macOS 26\.0, \*\) \{ return nil \}');
      expect(x2.hasMatch(registry), isTrue, reason: 'EngineRegistry.unmetOS must refuse Expression 2 below iOS 18 / macOS 15');
      expect(e2.hasMatch(registry), isTrue, reason: 'EngineRegistry.unmetOS must refuse Essence 2 below 26');
      expect(selection.contains('static let expression2MinimumOS = "iOS 18 / macOS 15"'), isTrue);
      expect(selection.contains('static let errorCode = "unsupported"'), isTrue);
    });

    test('the load handler refuses before the texture and the engine exist', () {
      final load = plugin.indexOf('case "load":');
      final select = plugin.indexOf('EngineRegistry.select(engineArg)', load);
      final refuse = plugin.indexOf('FlutterError(code: EngineSelection.errorCode', load);
      final texture = plugin.indexOf('AvatarTexture(imxPath: path)', load);
      expect(load, greaterThan(0));
      expect(select, greaterThan(load));
      expect(refuse, greaterThan(select));
      expect(texture, greaterThan(refuse),
          reason: 'the refusal must come before AvatarTexture (whose engine compiles the CoreML models and meters)');
    });
  });
}
