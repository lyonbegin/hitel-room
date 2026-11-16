#!/usr/bin/env python3
"""Test-only HITEL session in a disposable Flutter app copy. Vendor SDK untouched."""
from pathlib import Path
import argparse, hashlib, json

def once(s, old, new):
    assert s.count(old)==1, (old,s.count(old))
    return s.replace(old,new,1)

method=r"""
  // Debug-only HITEL HTTPS session; not a bitHuman entitlement.
  Future<String> _hitelAcquireHttpsSampleSession() async {
    const base=String.fromEnvironment('HITEL_EXPR2_PUBLIC_AUTH_BASE',
        defaultValue:'https://hitel-expression2-auth-production.up.railway.app');
    if (!base.startsWith('https://')) throw const FormatException('HTTPS required');
    var installId=await _keychain.read(key:'hitel_expression2_install_id');
    if (installId==null || installId.length<16) {
      final r=Random.secure();
      installId=base64UrlEncode(List<int>.generate(24,(_)=>r.nextInt(256))).replaceAll('=','');
      await _keychain.write(key:'hitel_expression2_install_id',value:installId);
    }
    final client=HttpClient()..connectionTimeout=const Duration(seconds:15);
    try {
      final req=await client.postUrl(Uri.parse(base+'/v1/demo/session'));
      req.followRedirects=false;
      req.headers.contentType=ContentType.json;
      req.write(jsonEncode({'agent_code':'A23WJF0199','install_id':installId}));
      final res=await req.close();
      final body=await utf8.decoder.bind(res).join();
      if (res.statusCode!=200) throw StateError('HITEL HTTP '+res.statusCode.toString());
      final data=jsonDecode(body);
      if (data is! Map || data['token_type']!='bearer' ||
          data['access_token'] is! String ||
          !(data['access_token'] as String).startsWith('htdemo.v1.')) {
        throw const FormatException('Unexpected HITEL token');
      }
      await _mark('hitel:public_https_demo_session_issued');
      return data['access_token'] as String;
    } finally {
      client.close(force:true);
    }
  }
"""

def main():
    a=argparse.ArgumentParser()
    a.add_argument('--app',type=Path,required=True)
    a.add_argument('--report',type=Path,required=True)
    args=a.parse_args()
    path=args.app/'lib/main.dart'
    orig=path.read_text()
    s=once(orig,"import 'dart:async';\n","import 'dart:async';\nimport 'dart:convert';\nimport 'dart:math';\n")
    x="const _apiSecretDefine = String.fromEnvironment('BITHUMAN_API_SECRET');\n"
    s=once(s,x,x+"const _hitelSdk061AuthTest = bool.fromEnvironment('HITEL_SDK061_AUTH_TEST', defaultValue:false);\n")
    s=once(s,'  Future<void> _boot() async {\n',method+'\n  Future<void> _boot() async {\n')
    s=once(s,'      final secret = await _resolveSecret();\n',
      '      final secret = _hitelSdk061AuthTest && Platform.isAndroid\n'
      '          ? await _hitelAcquireHttpsSampleSession()\n'
      '          : await _resolveSecret();\n'
      "      if (_hitelSdk061AuthTest) await _mark('hitel:sdk061_app_secret_nonempty=' + secret.isNotEmpty.toString());\n")
    assert '      if (secret.isEmpty) {\n' in s
    # Preserve the ORIGINAL app's full post-load flow. In particular, never
    # short-circuit _openSession() or insert an early return after avatar.load.
    assert s.count('      await _openSession(avatar, secret);\\n') == 1
    assert 'BithumanAvatar.load(agentDir, engine: _engine, apiSecret: secret)' in s
    path.write_text(s)
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps({
      'original_app_main_dart_sha256':hashlib.sha256(orig.encode()).hexdigest(),
      'app_auth_only_sdk_061_vendor_credential_still_unverified':True,
      'plugin_2637_unmodified_by_this_app_preparer':True,
      'app_copy_only_debug_auth':True,
      'hitel_https_session_no_secret_embedded':True,
      'original_secret_is_empty_guard_preserved':True,
      'original_BithumanAvatar_load_preserved':True,
      'vendor_entitlement_not_modified':True,
      'original_openSession_call_preserved':True,
      'test_only_early_return_inserted':False,
      'face_frames_not_proven_by_build_only':True
    },indent=2)+'\n')
    print('HITEL_SDK061_APP_HTTPS_AUTH_TEST_PREPARED')

if __name__=='__main__':
    main()
