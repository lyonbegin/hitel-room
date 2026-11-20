#!/usr/bin/env python3
"""Restore the real vendor path in a fresh official app, without editing the SDK.

The old offline build is a historical test fixture. Never run its local meter,
entitlement, mock, model-loader or AAR patches in this build.
"""
import argparse
import hashlib
import json
from pathlib import Path

from prepare_essence2_five_samples_original_sdk import patch_app, replace_one


def tree_hashes(root):
    return {str(p.relative_to(root)).replace('\\', '/'):
            hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(root.rglob('*')) if p.is_file()}


def prepare(app, plugin, report):
    before = tree_hashes(plugin)
    patch_app(app, plugin, report)
    path = app / 'lib/main.dart'
    text = path.read_text(encoding='utf-8')
    # A previously installed HITEL edition can leave a demo token in the same
    # application's secure storage. Do not send that token to the vendor.
    text = replace_one(text, "import 'dev_levers.dart';",
                       "import 'dev_levers.dart';\nimport 'hitel_vendor_credential.dart';",
                       'vendor credential discriminator')
    text = replace_one(text, "      final secret = await _resolveSecret();\n",
        """      final secret = await _resolveSecret();
      if (isHitelDemoCredential(secret)) {
        await _mark('boot:refuse=hitel_demo_credential');
        if (mounted) setState(() {
          _needsKey = true;
          _refusal = const _Refusal('hitel_demo_credential',
              'A previous local test credential cannot start a bitHuman session.',
              'Enter your bitHuman API secret below.');
        });
        return;
      }
""", 'reject stored local fixture before model download')
    text = replace_one(text, "    final k = _keyInput.text.trim();\n",
        """    final k = _keyInput.text.trim();
    if (isHitelDemoCredential(k)) {
      setState(() => _keyError = 'Please enter a bitHuman API secret.');
      return;
    }
""", 'reject demo input before storing or connecting')
    # The public SDK exposes exactly this readiness future. In the former app,
    # the initial reply could arrive while the avatar was still warming up.
    text = replace_one(text, "      avatar: avatar,\n",
                       "      avatar: avatar,\n      speechReady: avatar.ready,\n",
                       'wait for native speech readiness before realtime')
    # The SDK's optional speechReady wait continues after its 60-second timeout.
    # Gate in the app too: no relay is opened until readiness is actually true.
    # Disposing the original avatar completes ready; check identity/isReady again
    # so a background/dispose cannot open a stale realtime session.
    text = replace_one(text,
        '  Future<void> _openSession(BithumanAvatar avatar, String secret) async {\n',
        """  Future<void> _openSession(BithumanAvatar avatar, String secret) async {
    if (mounted) setState(() => _status = 'Preparing avatar speech…');
    await avatar.ready;
    if (!mounted || _avatar != avatar) return;
    if (!avatar.isReady) throw StateError('Avatar speech path did not become ready.');
""", 'require actual readiness without timeout fall-through')
    for forbidden in ('hitel_offline_runtime', 'debugEndpointOverride',
                      '_hitelAcquireLocalSampleSession', 'mock_realtime'):
        if forbidden in text:
            raise AssertionError('Local fixture leaked into authenticated app: ' + forbidden)
    assert text.count('final secret = await _resolveSecret();') == 1
    assert text.count('apiSecret: secret)') == 1
    assert text.count('apiKey: secret,') == 1
    assert before == tree_hashes(plugin), 'Original plugin must remain byte-identical'
    path.write_text(text, encoding='utf-8')
    (app / 'lib/hitel_vendor_credential.dart').write_text(
        "// Only the documented HITEL fixture namespace is rejected locally.\n"
        "// The vendor remains the authority on all real API secrets.\n"
        "bool isHitelDemoCredential(String value) =>\n"
        "    value.trim().startsWith('htdemo.v1.');\n", encoding='utf-8')
    tests = app / 'test'
    tests.mkdir(exist_ok=True)
    (tests / 'hitel_vendor_credential_test.dart').write_text("""import 'package:flutter_test/flutter_test.dart';
import '../lib/hitel_vendor_credential.dart';

void main() {
  test('old offline token must not reach the vendor', () {
    expect(isHitelDemoCredential('htdemo.v1.offline.example'), isTrue);
    expect(isHitelDemoCredential('  htdemo.v1.account.example  '), isTrue);
  });
  test('real credential validity is decided by the vendor', () {
    expect(isHitelDemoCredential('example-user-supplied-secret'), isFalse);
    expect(isHitelDemoCredential(''), isFalse);
    expect(isHitelDemoCredential('htdemo.v2.future-format'), isFalse);
  });
}
""", encoding='utf-8')
    result = json.loads(report.read_text(encoding='utf-8'))
    result.update({
        'mode': 'VENDOR_AUTHENTICATED_BASELINE_NOT_OFFLINE_MOCK',
        'realtime_endpoint': 'wss://api.bithuman.ai/v1/realtime',
        'local_demo_credential_rejected_before_network': True,
        'waits_for_avatar_speech_readiness': True,
        'all_plugin_files_byte_identical': before == tree_hashes(plugin),
        'plugin_file_count': len(before),
        'native_meter_or_entitlement_redirected': False,
        'runtime_secret_is_embedded': False,
        'physical_device_tested': False,
        'audible_output_verified': False,
        'lipsync_verified': False,
    })
    report.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print('PASS_AUTHENTICATED_APP_PREPARED_ORIGINAL_SDK_UNCHANGED')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--app', required=True, type=Path)
    p.add_argument('--plugin', required=True, type=Path)
    p.add_argument('--report', required=True, type=Path)
    a = p.parse_args()
    prepare(a.app, a.plugin, a.report)
