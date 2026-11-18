#!/usr/bin/env python3
"""Wire five-sample Essence2 *debug-only* APK to a local HITEL mock server.

The mock supplies only synthetic auth/meter and realtime responses. It does
NOT provide real vendor licensing, usage entitlement, or production billing.
Model bytes are fetched from BitHuman's public showcase individually and
SHA-verified by HitelEssence2PublicAndroidBundle. Native SDK code unchanged.
"""
from pathlib import Path
import argparse
import json

# Reuse the exact tested Dart mock source used by the Expression2 CI. It is an
# application-owned mock, not a vendor native reimplementation.
from prepare_expression2_sdk061_offline_loopback import RUNTIME as ORIGINAL_RUNTIME


def once(src, old, new, label):
    count = src.count(old)
    if count != 1:
        raise AssertionError(f"{label}: expected 1 anchor, found {count}")
    return src.replace(old, new, 1)


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--app", type=Path, required=True)
    p.add_argument("--plugin", type=Path, required=True)
    p.add_argument("--archive", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    a=p.parse_args()

    app=a.app
    package=app/"offline_mock_pkg"
    for rel in ("pubspec.yaml","lib/mock_realtime.dart"):
        source=a.archive/"e2e/mock_realtime"/rel
        dest=package/rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(source.read_bytes())
        assert dest.read_bytes()==source.read_bytes()

    runtime=ORIGINAL_RUNTIME
    door_start = "      final door = req.method == 'GET' &&\n"
    door_end = "      final meter = req.method == 'POST' && req.uri.path == '/v1/meter/beats';\n"
    if runtime.count(door_start)!=1 or runtime.count(door_end)!=1:
        raise AssertionError("Local mock auth handler source drifted")
    pos=runtime.index(door_start)
    stop=runtime.index(door_end,pos)
    new_door="""      final allowedCodes = <String>{
        'A52DHS2219', 'A21SKT4314', 'A62SJB3901',
        'A23KSG5258', 'A24EKJ8433'
      };
      final match = RegExp(r'^/v1/agent/(A[0-9A-Z]+)/model/download$')
          .firstMatch(req.uri.path);
      final door = req.method == 'GET' &&
          match != null && allowedCodes.contains(match.group(1)) &&
          req.uri.queryParameters['model'] == 'essence-2' &&
          req.uri.queryParameters['redirect'] == 'false';
"""
    runtime=runtime[:pos]+new_door+runtime[stop:]
    runtime=once(runtime,
        "'valid': true, 'product': 'expression-2',",
        "'valid': true, 'meter_tail': true, 'product': 'essence-2',",
        "Essence2 test meter JSON")
    runtime=once(runtime,
        "'mode': 'HITEL_OFFLINE_MEASUREMENT_ONLY',",
        "'mode': 'HITEL_ESSENCE2_DEBUG_LOCAL_MOCK',",
        "Essence2 mock mode")
    (app/"lib/hitel_offline_runtime.dart").write_text(runtime)

    pubspec=app/"pubspec.yaml"
    pubspec.write_text(once(pubspec.read_text(), "\ndependencies:\n",
        "\ndependencies:\n  mock_realtime:\n    path: offline_mock_pkg\n",
        "local realtime fixture dependency"))

    path=app/"lib/main.dart"
    dart=path.read_text()
    dart=once(dart, "import 'dart:async';\n",
        "import 'dart:async';\nimport 'hitel_offline_runtime.dart';\n",
        "import localhost mock")
    dart=once(dart, "  BithumanAvatar? _avatar;\n",
        "  BithumanAvatar? _avatar;\n"
        "  final HitelOfflineRuntime _offline = HitelOfflineRuntime();\n",
        "local mock lifecycle")
    method="""  // Debug fixture: synthetic, not vendor-authorized, not for production.
  Future<String> _hitelAcquireLocalSampleSession() async {
    final token = await _offline.start();
    BithumanRealtimeSession.debugEndpointOverride = _offline.websocketUrl;
    await _mark('hitel:essence2:local_test_session_started');
    return token;
  }

"""
    dart=once(dart, "  Future<void> _boot() async {\n",
        method+"  Future<void> _boot() async {\n", "local test session")
    # The mock edition must not claim a vendor secret is required on its chooser.
    dart=once(dart,
        "'The original SDK requires a valid bitHuman API secret to render. '",
        "'Local synthetic test: no vendor API key is used. '",
        "honest mock-mode UI description")
    dart=once(dart,
        "'No secret is embedded in this APK.'",
        "'The vendor license and real face output still need verification.'",
        "separate synthetic test from licensed playback")
    dart=once(dart, "      final secret = await _resolveSecret();\n",
        "      final secret = await _hitelAcquireLocalSampleSession();\n",
        "replace only app supplied session token for mock APK")
    dart=once(dart, "    _avatar?.dispose();\n",
        "    _avatar?.dispose();\n"
        "    unawaited(_offline.close());\n"
        "    BithumanRealtimeSession.debugEndpointOverride = null;\n",
        "cleanup original app")
    assert dart.count("BithumanAvatar.load(agentDir, engine: _engine, apiSecret: secret)") == 1
    assert dart.count("await _openSession(avatar, secret);") == 1
    path.write_text(dart)

    ent=a.plugin/"android/src/main/kotlin/ai/bithuman/flutter/EntitlementWindow.kt"
    original=ent.read_text()
    target='fun platformDoor(code: String, model: String): URL =\n            URL("https://api.bithuman.ai/v1/agent/'
    new='fun platformDoor(code: String, model: String): URL =\n            URL("http://127.0.0.1:18762/v1/agent/'
    ent.write_text(once(original,target,new,"debug-only entitlement test endpoint"))
    assert 'fun storeDoor(code: String, model: String): URL?' in ent.read_text()
    manifest=app/"android/app/src/main/AndroidManifest.xml"
    manifest.write_text(once(manifest.read_text(), "<application\n",
        '<application\n        android:usesCleartextTraffic="true"\n',
        "cleartext for localhost 127.0.0.1 only; debug fixture"))
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps({
        "mode":"ESSENCE2_DEBUG_SYNTHETIC_AUTH_AND_REALTIME",
        "public_model_source":"official vendor showcase member download API",
        "model_hash_verified_by":"HitelEssence2PublicAndroidBundle",
        "real_vendor_license_verified":False,
        "licensed_production_session":False,
        "realtime_ai":False,
        "self_hosted_vendor_replacement_service":False,
        "synthetic_test_localhost_port":18762,
        "native_essence2_rendering_modified":False,
        "original_flutter_playback_modified":False,
        "real_galaxy_3_tested":False,
    },indent=2)+"\n")
    print("PASS_ESSENCE2_LOCAL_DEBUG_MOCK_ORIGINAL_NATIVE_INFERENCE_PRESERVED")


if __name__=="__main__":
    main()
