#!/usr/bin/env python3
"""Keep the existing HITEL local test session; never add a vendor-key flow."""
import argparse
import json
from pathlib import Path


def once(text, old, new, label):
    if text.count(old) != 1:
        raise AssertionError(f'{label}: expected one existing source anchor')
    return text.replace(old, new, 1)


def prepare(app, report):
    main = app / 'lib/main.dart'
    runtime = app / 'lib/hitel_offline_runtime.dart'
    text = main.read_text(encoding='utf-8')
    local = runtime.read_text(encoding='utf-8')
    assert 'final secret = await _hitelAcquireLocalSampleSession();' in text
    assert 'debugEndpointOverride = _offline.websocketUrl;' in text
    assert 'final token = await _offline.start();' in text
    assert 'final secret = await _resolveSecret();' not in text
    assert 'isHitelDemoCredential' not in text
    assert "final token = 'htdemo.v1.offline." in local
    assert 'HttpServer.bind(InternetAddress.loopbackIPv4, 18762)' in local
    text = once(text,
        '  Future<void> _openSession(BithumanAvatar avatar, String secret) async {\n',
        """  Future<void> _openSession(BithumanAvatar avatar, String secret) async {
    if (mounted) setState(() => _status = 'Preparing avatar…');
    await avatar.ready;
    if (!mounted || _avatar != avatar) return;
    if (!avatar.isReady) throw StateError('Avatar display did not become ready.');
""", 'existing HITEL session waits for the original first-frame signal')
    # The existing local mode obtains its own session token. A renderer or
    # local-service failure must not send the person to a vendor-key entry form.
    text = once(text, 'needsKey: _needsKey, controller: _keyInput,',
                'needsKey: false, controller: _keyInput,',
                'HITEL mode has no vendor credential input')
    assert text.count('final secret = await _hitelAcquireLocalSampleSession();') == 1
    assert text.count('apiKey: secret,') == 1
    assert text.count('apiSecret: secret)') == 1
    main.write_text(text, encoding='utf-8')
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({
        'mode': 'EXISTING_HITEL_LOCAL_SESSION_RESTORED',
        'vendor_api_secret_input_required': False,
        'uses_original_vendor_key_resolver': False,
        'existing_local_token_generation_preserved': True,
        'existing_loopback_auth_and_websocket_preserved': True,
        'waits_for_original_first_texture_frame': True,
        'native_inference_changed_by_this_adapter': False,
        'vendor_licensed_service': False,
        'real_ai_service': False,
        'physical_lipsync_verified': False,
    }, indent=2) + '\n', encoding='utf-8')
    print('PASS_EXISTING_HITEL_SESSION_NO_VENDOR_KEY_INPUT')


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--app', required=True, type=Path)
    p.add_argument('--report', required=True, type=Path)
    a = p.parse_args()
    prepare(a.app, a.report)
