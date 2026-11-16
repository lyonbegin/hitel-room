#!/usr/bin/env python3
"""Prepare original Flutter avatar_chat with HITEL PUBLIC HTTPS demo sessions.

Only temporary copy of vendor source is adapted for original public Wise Pup
assets. SDK authenticates on Railway HTTPS; NO localhost or embedded token.
The engine's DEFAULT hardware AUTO options and original JNI remain untouched.
"""
import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path

APP_MAIN_IMPORT = "import 'dart:io';\n"
LOCAL_TEST_DEFINE = "const _hitelOriginalLocalTest = bool.fromEnvironment('HITEL_ORIGINAL_LOCAL_TEST', defaultValue: false);\n"

SAMPLE_HELPER = r"""
  // HITEL DEBUG-only: deliver the published bitHuman sample PCM through the
  // ORIGINAL Flutter plugin. Never select CPU/NPU/GPU or override SDK options.
  Future<void> _hitelRunOriginalSpeech(BithumanAvatar avatar) async {
    try {
      await _mark('hitel:original-pcm-start');
      await avatar.audioStart(enableMic: false);
      final d = await rootBundle.load('assets/speech.wav');
      final b = d.buffer.asUint8List(d.offsetInBytes, d.lengthInBytes);
      final view = ByteData.sublistView(b);
      if (b.length < 44 ||
          String.fromCharCodes(b.sublist(0, 4)) != 'RIFF' ||
          String.fromCharCodes(b.sublist(8, 12)) != 'WAVE') {
        throw const FormatException('Invalid original speech.wav RIFF header');
      }
      int? dataOffset;
      int? dataLength;
      int? sampleRate;
      int? channels;
      int? bits;
      int? encoding;
      var offset = 12;
      while (offset + 8 <= b.length) {
        final tag = String.fromCharCodes(b.sublist(offset, offset + 4));
        final length = view.getUint32(offset + 4, Endian.little);
        final start = offset + 8;
        if (start + length > b.length) break;
        if (tag == 'fmt ' && length >= 16) {
          encoding = view.getUint16(start, Endian.little);
          channels = view.getUint16(start + 2, Endian.little);
          sampleRate = view.getUint32(start + 4, Endian.little);
          bits = view.getUint16(start + 14, Endian.little);
        }
        if (tag == 'data') {
          dataOffset = start;
          dataLength = length;
        }
        offset = start + length + (length & 1);
      }
      if (encoding != 1 || channels != 1 ||
          sampleRate != 16000 || bits != 16 ||
          dataOffset == null || dataLength == null) {
        throw const FormatException('Invalid original PCM 16k mono format');
      }
      final samples = (dataLength ~/ 2).clamp(0, 32000);
      for (var start = 0; start < samples; start += 640) {
        final count = (samples - start).clamp(0, 640);
        final chunk = Int16List(count);
        for (var i = 0; i < count; i++) {
          chunk[i] = view.getInt16(dataOffset + 2 * (start + i), Endian.little);
        }
        await avatar.pushAudio(chunk);
        await Future<void>.delayed(const Duration(milliseconds: 40));
      }
      await avatar.notifyTurnEnd();
      await _mark('hitel:original-pcm-fed samples=$samples');
    } catch (error) {
      await _mark('hitel:original-pcm-error=$error');
      if (mounted) setState(() => _status = 'HITEL local sample error: $error');
    }
  }

"""

def replace_once(original: str, before: str, after: str, what: str) -> str:
    assert original.count(before) == 1, f"{what}: wanted one exact anchor, got {original.count(before)}"
    return original.replace(before, after, 1)

def digest(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    a = argparse.ArgumentParser()
    for name in ("app", "plugin", "model", "canon", "sample", "public_helper"):
        a.add_argument("--" + name.replace("_", "-"), type=Path, required=True)
    a.add_argument("--report", type=Path, required=True)
    args = a.parse_args()
    app = args.app
    plugin = args.plugin
    main_file = app / "lib/main.dart"
    plugin_dir = plugin / "android/src/main/kotlin/ai/bithuman/flutter"
    bridge = plugin_dir / "BithumanPlugin.kt"
    app_source_sha = digest(main_file)
    plugin_source_sha = digest(bridge)
    assert "Expression2RouteSelector" not in bridge.read_text(), "Not the PRISTINE Flutter plugin"
    assert "HITEL_LOCAL_TEST" not in bridge.read_text(), "Unexpected prior test patch"

    kotlin = bridge.read_text()
    start = "    private fun loadExpression2(code: String, secret: String?, t0: Long, handle: LoadHandle, gen: Long): AvatarEngine {\n"
    entry = start + """        // HITEL standalone DEBUG test only. The original SDK and its automatic
        // hardware routing are unchanged; the original store/credential is used
        // for all non-test identities or when an API secret is provided.
        if (!secret.isNullOrBlank() && code == "A23WJF0199") {
            handle.throwIfCancelled()
            loadEvents.stage(handle, LoadHandle.STAGE_PREPARE)
            val avatar = Expression2LocalTest.create(context, code, secret)
            handle.throwIfCancelled()
            loadEvents.fetched(handle)
            loadEvents.stage(handle, LoadHandle.STAGE_PREPARED)
            android.util.Log.i("BH_EXPR2_LOCAL_TEST",
                "ORIGINAL_AUTO_HARDWARE_MODEL_CREATED_BY_FLUTTER")
            return Expression2Engine(avatar)
        }
"""
    bridge.write_text(replace_once(kotlin, start, entry, "plugin loadExpression2"))

    # Original SDK model copied exactly; only auth input is a short-lived
    # HITEL-signed scoped HTTPS session. No native or routing modifications.
    helper = args.public_helper.read_text()
    assert "Expression2Avatar.create(context, combined)" in helper
    assert "Expression2Credential.set(hitelCredential)" in helper
    assert "LoopbackAuthFixture" not in helper
    assert "127.0.0.1" not in helper
    assert "Expression2RouteSelector" not in helper
    assert "Accelerator.CPU" not in helper and "Routing.ALL_CPU" not in helper
    (plugin_dir / "Expression2LocalTest.kt").write_text(helper)

    dart = main_file.read_text()
    dart = replace_once(dart, APP_MAIN_IMPORT, APP_MAIN_IMPORT + "import 'dart:typed_data';\nimport 'dart:convert';\nimport 'dart:math';\n", "dart demo session imports")
    anchor = "const _apiSecretDefine = String.fromEnvironment('BITHUMAN_API_SECRET');\n"
    dart = replace_once(dart, anchor, anchor + LOCAL_TEST_DEFINE, "debug-only define")
    dart = replace_once(dart, "  Future<void> _boot() async {\n", SAMPLE_HELPER + "\n  // Public HTTPS HITEL demo session: scoped to the ORIGINAL published Wise Pup\n  // sample only. This is NOT a bitHuman vendor credential/entitlement.\n  Future<String> _hitelAcquireHttpsSampleSession() async {\n    const base = String.fromEnvironment('HITEL_EXPR2_PUBLIC_AUTH_BASE',\n        defaultValue: 'https://hitel-expression2-auth-production.up.railway.app');\n    if (!base.startsWith('https://')) {\n      throw const FormatException('HITEL auth URL must use HTTPS');\n    }\n    var installId = await _keychain.read(key: 'hitel_expression2_install_id');\n    if (installId == null || installId.length < 16) {\n      final generator = Random.secure();\n      final bytes = List<int>.generate(24, (_) => generator.nextInt(256));\n      installId = base64UrlEncode(bytes).replaceAll('=', '');\n      await _keychain.write(\n          key: 'hitel_expression2_install_id', value: installId);\n    }\n    final client = HttpClient()\n      ..connectionTimeout = const Duration(seconds: 15);\n    try {\n      final uri = Uri.parse(base + '/v1/demo/session');\n      final req = await client.postUrl(uri);\n      req.followRedirects = false;\n      req.headers.contentType = ContentType.json;\n      req.write(jsonEncode({\n        'agent_code': 'A23WJF0199',\n        'install_id': installId,\n      }));\n      final response = await req.close();\n      final reply = await utf8.decoder.bind(response).join();\n      if (response.statusCode != 200) {\n        throw StateError('HITEL public HTTPS session HTTP ' +\n            response.statusCode.toString() + ': ' +\n            reply.substring(0, reply.length < 160 ? reply.length : 160));\n      }\n      final data = jsonDecode(reply);\n      if (data is! Map || data['token_type'] != 'bearer' ||\n          data['access_token'] is! String ||\n          !(data['access_token'] as String).startsWith('htdemo.v1.')) {\n        throw const FormatException('HITEL HTTPS session response invalid');\n      }\n      await _mark('hitel:public_https_demo_session_issued');\n      return data['access_token'] as String;\n    } finally {\n      client.close(force: true);\n    }\n  }\n\n" + "  Future<void> _boot() async {\n", "sample and HTTPS token method")
    dart = replace_once(
        dart, "      final secret = await _resolveSecret();\n",
        """      final secret = _hitelOriginalLocalTest && Platform.isAndroid
          ? await _hitelAcquireHttpsSampleSession()
          : await _resolveSecret();\n""",
        "debug-only credential path"
    )
    dart = replace_once(
        dart, "      if (secret.isEmpty) {\n",
        "      if (secret.isEmpty && !_hitelOriginalLocalTest) {\n",
        "avoid original key prompt for explicit local test"
    )
    dart = replace_once(
        dart, "      await _openSession(avatar, secret);\n",
        """      if (_hitelOriginalLocalTest && Platform.isAndroid) {
        setState(() => _status = 'HITEL HTTPS sample session — original SDK hardware AUTO');
        unawaited(_hitelRunOriginalSpeech(avatar));
        return; // No production Realtime session in this test-only app.
      }
      await _openSession(avatar, secret);
""",
        "local sample playback without paid chat session"
    )
    main_file.write_text(dart)

    # Make the ORIGINAL PUBLIC model local; no network model door, no other avatar
    # or inference engine. Keep vendor samples' exact hashes.
    model_hash = "f809722b65e933aacf2c577725e45aaba576fae84b4d17658d67d6d018a512ba"
    canon_hash = "cac1c9aeb8c80de4b46661784ffd3fa5f601bf0113fa543db00f1fa8ec2d94d5"
    assert digest(args.model) == model_hash
    assert digest(args.canon) == canon_hash
    assert args.model.stat().st_size == 158524428
    assert args.canon.stat().st_size == 299520
    asset_dir = app / "android/app/src/main/assets"
    asset_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(args.model, asset_dir / "combined_litert.tflite")
    shutil.copyfile(args.canon, asset_dir / "canon.bin")
    flutter_assets = app / "assets"
    flutter_assets.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(args.sample, flutter_assets / "speech.wav")
    pub = app / "pubspec.yaml"
    pub_data = pub.read_text()
    pub_data = replace_once(
        pub_data, "  uses-material-design: true\n",
        "  uses-material-design: true\n  assets:\n    - assets/speech.wav\n",
        "register original sample WAV"
    )
    pub.write_text(pub_data)
    proof = {
        "public_https_auth": "https://hitel-expression2-auth-production.up.railway.app",
        "session_token_in_apk": False,
        "localhost_auth_used": False,
        "original_flutter_main_sha256": app_source_sha,
        "original_flutter_plugin_kotlin_sha256": plugin_source_sha,
        "app_main_changed_only_in_disposable_build": True,
        "plugin_load_changed_only_in_disposable_build": True,
        "test_backend": "public HTTPS server; server-issued short-lived scoped token for public sample",
        "original_model_sha256": model_hash,
        "original_canon_sha256": canon_hash,
        "vendor_sdk_create_call": "Expression2Avatar.create(context, combined)",
        "custom_cpu_route_injected": False,
        "custom_gpu_npu_route_injected": False,
        "real_device_gpu_tested": False,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(proof, indent=2) + "\n")
    print("HITEL_AVATAR_CHAT_PUBLIC_HTTPS_AUTO_PREPARED_NO_FORCED_HARDWARE")

if __name__ == "__main__":
    main()
