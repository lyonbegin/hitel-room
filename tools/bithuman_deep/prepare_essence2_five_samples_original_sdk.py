#!/usr/bin/env python3
"""Build-time UI adapter for five public Essence 2 samples.

Input is a disposable clone of bitHuman's original avatar_chat app.
The plugin, Essence2 Android AAR, vendor authentication, and native renderer
are deliberately NOT edited. This stage is the vendor-authenticated baseline;
it must not be reported as independent/offline playback.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

SAMPLES = (
    ("A52DHS2219", "Sofia Ramirez"),
    ("A21SKT4314", "Warm Clear Presenter"),
    ("A62SJB3901", "Kwame Museum Guide"),
    ("A23KSG5258", "Astrophysics Mentor"),
    ("A24EKJ8433", "Calm Product Advisor"),
)

ORIGINAL_PLUGIN_KT = "android/src/main/kotlin/ai/bithuman/flutter/BithumanPlugin.kt"


def replace_one(text: str, old: str, new: str, what: str) -> str:
    count = text.count(old)
    if count != 1:
        raise AssertionError(f"{what}: expected one original anchor, got {count}")
    return text.replace(old, new, 1)


def patch_app(app: Path, plugin: Path, report: Path) -> None:
    kt = (plugin / ORIGINAL_PLUGIN_KT).read_bytes()
    gradle = (plugin / "android/build.gradle").read_bytes()
    assert b"implementation 'ai.bithuman:essence2-android:0.9.5'" in gradle
    assert b"Essence2Avatar.create(bundle.dir" in kt
    assert b'loadInOrder(code, "essence-2"' in kt
    assert b'private fun loadExpression2(' in kt
    dart_path = app / "lib/main.dart"
    original = dart_path.read_text(encoding="utf-8")
    text = original
    text = replace_one(
        text,
        "const _agentCode = String.fromEnvironment('AGENT_CODE', defaultValue: 'A02HCY0444');",
        "const _agentCode = String.fromEnvironment('AGENT_CODE', defaultValue: 'A52DHS2219');",
        "default Sofia sample",
    )
    text = replace_one(
        text,
        "const _engineSlug = String.fromEnvironment('BH_ENGINE', defaultValue: 'expression2');",
        "const _engineSlug = String.fromEnvironment('BH_ENGINE', defaultValue: 'essence2');",
        "Essence 2 as default engine",
    )
    text = replace_one(
        text,
        "  BithumanAvatar? _avatar;\n",
        "  BithumanAvatar? _avatar;\n"
        "  String _selectedSample = _agentCode;\n"
        "  bool _sampleStarted = false;\n",
        "five sample selector state",
    )
    text = replace_one(
        text,
        "    WidgetsBinding.instance.addObserver(this);\n    _boot();\n",
        "    WidgetsBinding.instance.addObserver(this);\n"
        "    // The user selects a sample before any model is fetched or billed.\n",
        "select model before boot",
    )
    text = replace_one(
        text,
        "      final agentDir = byCode\n          ? _agentCode\n",
        "      final agentDir = byCode\n          ? _selectedSample\n",
        "selected model code goes to original SDK",
    )
    text = replace_one(
        text,
        "  Future<void> _boot() async {\n    await _mark('boot:start');",
        "  Future<void> _boot() async {\n"
        "    if (mounted) setState(() { _sampleStarted = true; _status = 'Preparing Essence 2 model…'; });\n"
        "    await _mark('boot:start');",
        "boot progress",
    )
    choices = "\n".join(
        f"                  DropdownMenuItem<String>(value: '{code}', child: Text('{label} ({code})')),"
        for code, label in SAMPLES
    )
    selector = """
  // HITEL sample catalog. This UI changes only the agent code passed to the
  // unmodified vendor Essence2ModelStore, not its auth/meter or renderer.
  Widget _samplePicker() => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 24),
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Text('HITEL • Essence 2', style: TextStyle(
        color: Colors.white, fontWeight: FontWeight.bold, fontSize: 22)),
      const SizedBox(height: 12),
      const Text('Select one of five original public avatars',
          style: TextStyle(color: Colors.white70)),
      const SizedBox(height: 20),
      DropdownButton<String>(
        value: _selectedSample,
        isExpanded: true,
        dropdownColor: Colors.black87,
        style: const TextStyle(color: Colors.white),
        items: const [
""" + choices + """
        ],
        onChanged: (value) {
          if (value != null) setState(() => _selectedSample = value);
        },
      ),
      const SizedBox(height: 16),
      FilledButton(
        onPressed: _boot,
        child: const Text('Load Essence 2 avatar'),
      ),
      const SizedBox(height: 10),
      const Text('The original SDK requires a valid bitHuman API secret to render. '
          'No secret is embedded in this APK.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: Colors.white54)),
    ]),
  );

"""
    # Use the _ChatPageState.build method's original entry to ensure the
    # selection screen stays inside the original app, not a replacement player.
    marker = "  @override\n  Widget build(BuildContext context) {\n    final a = _avatar;\n"
    text = replace_one(text, marker, selector + marker, "original ChatPage build anchor")
    text = replace_one(
        text, ": LoadingState(stage: _status),",
        ": _sampleStarted ? LoadingState(stage: _status) : _samplePicker(),",
        "show chooser on first startup",
    )
    assert text.count("BithumanAvatar.load(agentDir, engine: _engine, apiSecret: secret)") == 1
    assert text.count("await _openSession(avatar, secret);") == 1
    assert "Essence2Avatar.create" not in text  # native still owned by original plugin
    # Confirm the engine selection and model code are the ONLY adapted
    # interfaces: the original audio, render, lifecycle & post-load flow stay.
    life_anchor = "  void didChangeAppLifecycleState(AppLifecycleState state) {"
    life_end = "  /// Measurement runs only:"
    assert life_anchor in original and life_end in original
    orig_life = original.split(life_anchor, 1)[1].split(life_end, 1)[0]
    new_life = text.split(life_anchor, 1)[1].split(life_end, 1)[0]
    assert orig_life == new_life, "Original lifecycle differs"
    dart_path.write_text(text, encoding="utf-8")
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({
        "mode": "ORIGINAL_ESSENCE2_SDK_VENDOR_AUTHENTICATED_BASELINE",
        "model": "essence-2",
        "vendor_engine_aar": "ai.bithuman:essence2-android:0.9.5",
        "sample_codes": [code for code, _ in SAMPLES],
        "sample_count": len(SAMPLES),
        "original_app_sha256": hashlib.sha256(original.encode()).hexdigest(),
        "plugin_native_source_sha256": hashlib.sha256(kt).hexdigest(),
        "original_plugin_modified": False,
        "original_native_renderer_modified": False,
        "original_vendor_entitlement_preserved": True,
        "original_credential_storage_preserved": True,
        "original_post_load_open_session_preserved": True,
        "original_app_lifecycle_identical": True,
        "vendor_secret_required_for_runtime": True,
        "HITEL_offline_meter_and_auth": False,
        "physical_device_tested": False,
    }, indent=2) + "\n")
    print("PASS_ESSENCE2_FIVE_SAMPLE_ORIGINAL_SDK_APP_PREPARED")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, required=True)
    parser.add_argument("--plugin", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    patch_app(args.app, args.plugin, args.report)
