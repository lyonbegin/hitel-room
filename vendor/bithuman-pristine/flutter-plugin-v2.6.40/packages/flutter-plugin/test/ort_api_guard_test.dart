// scripts/bootstrap.sh refuses a staged library that asks ONNX Runtime for a C API version the staged runtime does
// not serve (2.6.40; scripts/check-ort-api-version.py, bootstrap.sh guard_ort_api).
//
// The app links ONE static ONNX Runtime (1.26.0: ORT_API_VERSION 26) on iOS and macOS. `GetApi(N)` above 26 returns
// NULL, and a library compiled against newer headers crashes the app on its first ONNX Runtime call: libconverse
// converse-apple-v2.5.1's macOS slice asked for 27 (a crash when the voice loaded). The pinned 2.5.2 asks for 26; this
// keeps an override (LIBCONVERSE_RELEASE / LIBCONVERSE_SHA256 / LIBCONVERSE_XCF_ZIP / BITHUMAN_SDK_DIR) from building
// that crash again.
//
// The fixtures are real Mach-O objects compiled here (clang, arm64-apple-macos) that call
// `OrtGetApiBase()->GetApi(26)` or `GetApi(27)`, in archives and .xcframeworks shaped like the staged ones. The
// bootstrap half runs the `guard_ort_api` function out of bootstrap.sh itself on a throwaway plugin tree. A host
// without clang or an objdump that reads Mach-O skips those (macOS, where the Apple build runs, never does).
// Apache-2.0; (c) bitHuman.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

const _api = '''
typedef struct OrtApi OrtApi;
typedef struct OrtApiBase { const OrtApi* (*GetApi)(unsigned int); const char* (*GetVersionString)(void); } OrtApiBase;
extern const OrtApiBase* OrtGetApiBase(void);
const OrtApi* fixture_api(void) { return OrtGetApiBase()->GetApi(VERSION); }
int fixture_twice(void) {
  const OrtApi* a = OrtGetApiBase()->GetApi(VERSION);
  const OrtApi* b = OrtGetApiBase()->GetApi(VERSION);
  return a == b;
}
''';

// GetVersionString only (the pointer at offset 8 of the table: asks for no version), and a GetApi whose version is not a
// constant (it cannot be read: never a pass).
const _ver = '''
typedef struct OrtApi OrtApi;
typedef struct OrtApiBase { const OrtApi* (*GetApi)(unsigned int); const char* (*GetVersionString)(void); } OrtApiBase;
extern const OrtApiBase* OrtGetApiBase(void);
const char* fixture_version(void) { return OrtGetApiBase()->GetVersionString(); }
''';
const _var = '''
typedef struct OrtApi OrtApi;
typedef struct OrtApiBase { const OrtApi* (*GetApi)(unsigned int); const char* (*GetVersionString)(void); } OrtApiBase;
extern const OrtApiBase* OrtGetApiBase(void);
const OrtApi* fixture_var(unsigned int v) { return OrtGetApiBase()->GetApi(v); }
''';

String _plist(List<String> slices, String lib) => '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>AvailableLibraries</key><array>
${slices.map((s) => '<dict><key>LibraryIdentifier</key><string>$s</string><key>LibraryPath</key><string>$lib</string>'
        '<key>SupportedArchitectures</key><array><string>arm64</string></array><key>SupportedPlatform</key>'
        '<string>${s.startsWith('ios') ? 'ios' : 'macos'}</string></dict>').join('\n')}
</array><key>CFBundlePackageType</key><string>XFWK</string><key>XCFrameworkFormatVersion</key><string>1.0</string></dict></plist>
''';

void main() {
  final boot = File('scripts/bootstrap.sh').readAsStringSync();
  final checker = File('scripts/check-ort-api-version.py').absolute.path;

  test('bootstrap.sh runs the guard after everything is staged, in both modes, before it says Done', () {
    final dev = boot.indexOf('log "Done (dev mode).');
    final self = boot.indexOf('log "Done. Self-contained');
    expect(dev, greaterThan(0));
    expect(self, greaterThan(dev));
    final devGuard = boot.lastIndexOf(RegExp(r'^\s*guard_ort_api\b', multiLine: true), dev);
    final selfGuard = boot.lastIndexOf(RegExp(r'^guard_ort_api$', multiLine: true), self);
    expect(devGuard, greaterThan(boot.lastIndexOf('stage_essence2', dev)), reason: 'DEV mode: after the last staging');
    expect(selfGuard, greaterThan(boot.lastIndexOf('stage_essence2', self)), reason: 'self-contained: after the last');
    expect(selfGuard, greaterThan(dev), reason: 'the self-contained call is its own, after the DEV block');
    // It checks libconverse and every engine library, against the staged runtime (both copies), and un-stages what
    // it refuses before it dies.
    final fn = _guardFunction(boot);
    for (final s in [
      r'"$MAC_FW/libconverse.xcframework"',
      r'"$PLUGIN_ROOT"/macos/Engines/*/Vendor/*.a',
      r'"$PLUGIN_ROOT"/ios/Engines/*/Vendor/*.a',
      r'--ort "$ort" --ort "$MAC_FW/onnxruntime.xcframework"',
      r'rm -rf "$MAC_FW/libconverse.xcframework" "$IOS_FW/libconverse.xcframework"',
      'die "REFUSED:',
    ]) {
      expect(fn.contains(s), isTrue, reason: 'guard_ort_api: $s');
    }
    expect(File(checker).statSync().modeString().contains('x'), isTrue, reason: 'the checker is executable');
  });

  group('with Mach-O fixtures', () {
    late Directory tmp;
    String? skip;
    final env = <String, String>{...Platform.environment, 'PYTHONDONTWRITEBYTECODE': '1'};

    setUpAll(() async {
      tmp = await Directory.systemTemp.createTemp('ort_api_guard_test');
      File('${tmp.path}/api.c').writeAsStringSync(_api);
      File('${tmp.path}/other.c').writeAsStringSync('int other(int x) { return x * 3; }\n');
      File('${tmp.path}/ver.c').writeAsStringSync(_ver);
      File('${tmp.path}/var.c').writeAsStringSync(_var);
      const arm = 'arm64-apple-macos14.0', x86 = 'x86_64-apple-macos14.0';
      for (final (out, target, args) in [
        ('api26.o', arm, ['-DVERSION=26', 'api.c']),
        ('api27.o', arm, ['-DVERSION=27', 'api.c']),
        ('other.o', arm, ['other.c']),
        ('apiver.o', arm, ['ver.c']),
        ('apivar.o', arm, ['var.c']),
        ('apilto.o', arm, ['-flto', '-DVERSION=27', 'api.c']),
        ('api26_x86.o', x86, ['-DVERSION=26', 'api.c']),
        ('api27_x86.o', x86, ['-DVERSION=27', 'api.c']),
        ('apiver_x86.o', x86, ['ver.c']),
      ]) {
        ProcessResult r;
        try {
          r = await Process.run('clang', ['-target', target, '-O2', '-c', ...args, '-o', out],
              workingDirectory: tmp.path);
        } on ProcessException catch (e) {
          skip = 'no clang here ($e)';
          return;
        }
        if (r.exitCode != 0) {
          skip = 'clang cannot build an arm64-apple-macos object here: ${r.stderr}';
          return;
        }
      }
      // The ONNX Runtime 1.26 headers, as the static xcframework carries them.
      final h = Directory('${tmp.path}/ort.xcframework/macos-arm64_x86_64/onnxruntime.framework/Versions/A/Headers')
        ..createSync(recursive: true);
      File('${h.path}/onnxruntime_c_api.h').writeAsStringSync('// fixture\n#define ORT_API_VERSION 26\n');
      final probe = await _xcf(tmp, 'probe', macos: 'api26.o');
      final r = await Process.run('python3', [checker, '--ort', '${tmp.path}/ort.xcframework', probe], environment: env);
      if (r.exitCode == 2 && !Platform.isMacOS) skip = 'no objdump that reads Mach-O here: ${r.stderr}';
    });

    tearDownAll(() async {
      if (await tmp.exists()) await tmp.delete(recursive: true);
    });

    test('the checker refuses GetApi(27) against a 1.26 runtime, names it, and accepts GetApi(26)', () async {
      if (skip != null) {
        markTestSkipped(skip!);
        return;
      }
      final good = await _xcf(tmp, 'good', macos: 'api26.o');
      final bad = await _xcf(tmp, 'bad', macos: 'api27.o');
      final list = '${tmp.path}/refused.txt';
      var r = await Process.run('python3', [checker, '--ort', '${tmp.path}/ort.xcframework', good], environment: env);
      expect(r.exitCode, 0, reason: '${r.stdout}${r.stderr}');
      expect('${r.stdout}', contains('GetApi(26): 3'));
      r = await Process.run('python3', [checker, '--ort', '${tmp.path}/ort.xcframework', '--refused-list', list, good, bad],
          environment: env);
      expect(r.exitCode, 3, reason: '${r.stdout}${r.stderr}');
      expect('${r.stdout}', allOf(contains('REFUSED'), contains('bad.xcframework/macos-arm64'), contains('C API version 27'),
          contains('converse-apple-v2.5.2')));
      expect(File(list).readAsLinesSync(), [bad], reason: 'only the library that asks for 27');
      // A runtime whose headers say nothing is no answer: the check cannot pass.
      r = await Process.run('python3', [checker, '--ort', '${tmp.path}/nowhere', good], environment: env);
      expect(r.exitCode, 2);
    });

    test('fail closed: bitcode (-flto) and a GetApi whose version is not a constant cannot be checked, never pass; '
        'GetVersionString asks for no version; x86_64 is read too', () async {
      if (skip != null) {
        markTestSkipped(skip!);
        return;
      }
      final ort = '${tmp.path}/ort.xcframework', list = '${tmp.path}/unreadable.txt';
      final ver = await _xcf(tmp, 'ver', macos: 'apiver.o');
      var r = await Process.run('python3', [checker, '--ort', ort, ver], environment: env);
      expect(r.exitCode, 0, reason: '${r.stdout}${r.stderr}');
      expect('${r.stdout}', contains('GetVersionString: 1'));
      for (final (name, obj, why) in [
        ('lto', 'apilto.o', 'LLVM bitcode'),
        ('var', 'apivar.o', 'not a constant'),
      ]) {
        final x = await _xcf(tmp, name, macos: obj);
        r = await Process.run('python3', [checker, '--ort', ort, '--refused-list', list, ver, x], environment: env);
        expect(r.exitCode, 2, reason: '$name: ${r.stdout}${r.stderr}');
        expect('${r.stdout}', allOf(contains('CANNOT CHECK'), contains(why), contains('$name.xcframework/macos-arm64')));
        expect(File(list).readAsLinesSync(), [x], reason: '$name: listed (un-staged by bootstrap.sh), the good one not');
      }
      // x86_64 (an Intel slice): 27 refused, 26 and GetVersionString pass.
      await _ar(tmp, '${tmp.path}/x86_bad.a', ['api27_x86.o']);
      await _ar(tmp, '${tmp.path}/x86_good.a', ['api26_x86.o', 'apiver_x86.o']);
      r = await Process.run('python3', [checker, '--ort', ort, '${tmp.path}/x86_good.a'], environment: env);
      expect(r.exitCode, 0, reason: '${r.stdout}${r.stderr}');
      expect('${r.stdout}', allOf(contains('[x86_64]'), contains('GetApi(26): 3'), contains('GetVersionString: 1')));
      r = await Process.run('python3', [checker, '--ort', ort, '${tmp.path}/x86_bad.a'], environment: env);
      expect(r.exitCode, 3, reason: '${r.stdout}${r.stderr}');
      expect('${r.stdout}', allOf(contains('[x86_64]'), contains('C API version 27')));
    });

    test('bootstrap.sh guard_ort_api un-stages a refused libconverse (both platforms) or engine, and fails by name',
        () async {
      if (skip != null) {
        markTestSkipped(skip!);
        return;
      }
      Future<(ProcessResult, Directory)> run(String converse, String essence2) async {
        final p = Directory('${tmp.path}/plugin_${converse}_$essence2');
        if (p.existsSync()) p.deleteSync(recursive: true);
        Directory('${p.path}/scripts').createSync(recursive: true);
        File(checker).copySync('${p.path}/scripts/check-ort-api-version.py');
        final mac = '${p.path}/macos/Frameworks', ios = '${p.path}/ios/Frameworks';
        Directory(ios).createSync(recursive: true);
        await _xcf(tmp, 'conv_$converse', macos: converse, into: '$mac/libconverse.xcframework');
        Link('$ios/libconverse.xcframework').createSync('../../macos/Frameworks/libconverse.xcframework');
        for (final f in [mac, ios]) {
          await Process.run('cp', ['-R', '${tmp.path}/ort.xcframework', '$f/onnxruntime.xcframework']);
        }
        for (final (plat, obj) in [('macos', essence2), ('ios', 'api26.o')]) {
          final v = Directory('${p.path}/$plat/Engines/essence2/Vendor')..createSync(recursive: true);
          await _ar(tmp, '${v.path}/libessence2.a', [obj]);
        }
        final script = 'set -euo pipefail\n'
            'log() { echo "LOG: \$*"; }\nwarn() { echo "WARN: \$*" >&2; }\ndie() { echo "DIE: \$*" >&2; exit 1; }\n'
            'PLUGIN_ROOT="${p.path}"\nMAC_FW="\$PLUGIN_ROOT/macos/Frameworks"\nIOS_FW="\$PLUGIN_ROOT/ios/Frameworks"\n'
            '${_guardFunction(boot)}\nguard_ort_api\n';
        return (await Process.run('bash', ['-c', script], environment: env), p);
      }

      bool there(Directory p, String rel) => FileSystemEntity.typeSync('${p.path}/$rel', followLinks: false) !=
          FileSystemEntityType.notFound;

      var (r, p) = await run('api26.o', 'api26.o');
      expect(r.exitCode, 0, reason: '${r.stdout}${r.stderr}');
      for (final rel in ['macos/Frameworks/libconverse.xcframework', 'ios/Frameworks/libconverse.xcframework',
          'macos/Engines/essence2', 'ios/Engines/essence2']) {
        expect(there(p, rel), isTrue, reason: rel);
      }

      (r, p) = await run('api27.o', 'api26.o');
      expect(r.exitCode, 1, reason: '${r.stdout}${r.stderr}');
      expect('${r.stderr}', contains('DIE: REFUSED'));
      expect('${r.stdout}', contains('C API version 27'));
      expect(there(p, 'macos/Frameworks/libconverse.xcframework'), isFalse, reason: 'un-staged: pod install cannot link it');
      expect(there(p, 'ios/Frameworks/libconverse.xcframework'), isFalse);
      expect(there(p, 'macos/Engines/essence2'), isTrue, reason: 'what passed stays');

      (r, p) = await run('api26.o', 'api27.o');
      expect(r.exitCode, 1, reason: '${r.stdout}${r.stderr}');
      expect(there(p, 'macos/Engines/essence2'), isFalse);
      expect(there(p, 'ios/Engines/essence2'), isFalse);
      expect(there(p, 'macos/Frameworks/libconverse.xcframework'), isTrue);

      // A libconverse built with -flto (bitcode): its version cannot be read, so it is un-staged and the bootstrap fails.
      (r, p) = await run('apilto.o', 'api26.o');
      expect(r.exitCode, 1, reason: '${r.stdout}${r.stderr}');
      expect('${r.stderr}', contains('DIE: CANNOT CHECK'));
      expect(there(p, 'macos/Frameworks/libconverse.xcframework'), isFalse);
      expect(there(p, 'ios/Frameworks/libconverse.xcframework'), isFalse);
      expect(there(p, 'macos/Engines/essence2'), isTrue, reason: 'what passed stays');
    });
  });
}

/// The `guard_ort_api() { … }` function of bootstrap.sh, as written there.
String _guardFunction(String boot) {
  final m = RegExp(r'^guard_ort_api\(\) \{\n[\s\S]*?\n\}\n', multiLine: true).firstMatch(boot);
  if (m == null) throw StateError('bootstrap.sh has no guard_ort_api() function');
  return m.group(0)!;
}

/// A static archive of [objs] (in [tmp]) at [out].
Future<void> _ar(Directory tmp, String out, List<String> objs) async {
  final r = await Process.run('ar', ['rc', out, ...objs], workingDirectory: tmp.path);
  if (r.exitCode != 0) throw StateError('ar: ${r.stderr}');
}

/// An .xcframework `libconverse.a` (macos-arm64: [macos] + other.o; ios-arm64: GetApi(26) + other.o).
Future<String> _xcf(Directory tmp, String name, {required String macos, String? into}) async {
  final x = into ?? '${tmp.path}/$name.xcframework';
  for (final (slice, obj) in [('macos-arm64', macos), ('ios-arm64', 'api26.o')]) {
    Directory('$x/$slice').createSync(recursive: true);
    await _ar(tmp, '$x/$slice/libconverse.a', ['other.o', obj]);
  }
  File('$x/Info.plist').writeAsStringSync(_plist(['macos-arm64', 'ios-arm64'], 'libconverse.a'));
  return x;
}
