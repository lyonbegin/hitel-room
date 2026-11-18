#!/usr/bin/env python3
"""Add copyable startup diagnostics to a disposable HITEL Essence2 Flutter app.

This edits only the app UI. Original native SDK, model, entitlement and
audio/video rendering code remain byte-identical.
"""
from pathlib import Path
import argparse
import json


def one(text, old, new, name):
    if text.count(old) != 1:
        raise AssertionError(f"{name}: expected 1 anchor, got {text.count(old)}")
    return text.replace(old, new, 1)


def patch(app, report):
    main = app / "lib/main.dart"
    before = main.read_text(encoding="utf-8")
    assert "String _selectedSample = _agentCode;" in before
    text = before
    method = """  // Local startup crumbs only; system logcat is not available from a normal app.
  Future<void> _hitelCopyDiagnostics() async {
    try {
      final dir = await _appFilesDir();
      final file = File('__DOLLAR__{dir.path}/boot_status.txt');
      final original = await file.exists() ? await file.readAsString() : '(no local logs yet)';
      final clipped = original.length > 40000
          ? original.substring(original.length - 40000) : original;
      final safe = clipped
          .replaceAll(RegExp(r'Bearer__SPACE__\\s+\\S+', caseSensitive: false),
              'Bearer [REDACTED]')
          .replaceAll(RegExp(r'api-secret\\s*[:=]\\s*\\S+', caseSensitive: false),
              'api-secret=[REDACTED]')
          .replaceAll(RegExp(r'https://\\S+\\?\\S+', caseSensitive: false),
              '[signed URL redacted]');
      final detail = 'HITEL Essence 2 Android diagnostics\\n'
          'engine=__DOLLAR___engine\\nsample=__DOLLAR___selectedSample\\n'
          'status=__DOLLAR___status\\nloaded=__DOLLAR__{_avatar != null}\\n'
          'at=__DOLLAR__{DateTime.now().toIso8601String()}\\n'
          '--- boot_status.txt ---\\n__DOLLAR__safe';
      await Clipboard.setData(ClipboardData(text: detail));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Essence 2 진단 로그를 복사했습니다.')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('진단 로그 복사 실패: __DOLLAR__e')));
      }
    }
  }

"""
    method = method.replace("__DOLLAR__", "$").replace("Bearer__SPACE__", "Bearer")
    text = one(text, "  Future<void> _boot() async {\n",
               method + "  Future<void> _boot() async {\n", "diagnostic method")
    anchor = "    return Scaffold(\n      backgroundColor: Colors.black,\n"
    button = """    return Scaffold(
      backgroundColor: Colors.black,
      floatingActionButtonLocation: FloatingActionButtonLocation.endTop,
      floatingActionButton: Platform.isAndroid
          ? FloatingActionButton.small(
              tooltip: 'Essence 2 진단 로그 복사',
              onPressed: _hitelCopyDiagnostics,
              child: const Icon(Icons.copy_all_rounded),
            )
          : null,
"""
    text = one(text, anchor, button, "copy logs button")
    life = "  void didChangeAppLifecycleState(AppLifecycleState state) {"
    end = "  /// Measurement runs only:"
    assert before.split(life)[1].split(end)[0] == text.split(life)[1].split(end)[0]
    assert before.count("BithumanAvatar.load(agentDir, engine: _engine, apiSecret: secret)") == text.count("BithumanAvatar.load(agentDir, engine: _engine, apiSecret: secret)") == 1
    assert before.count("await _openSession(avatar, secret);") == text.count("await _openSession(avatar, secret);") == 1
    main.write_text(text, encoding="utf-8")
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({
        "UI_diagnostic_copy_button": True,
        "copies": ["engine", "sample code", "status", "avatar loaded", "app boot breadcrumbs"],
        "native_logcat_captured": False,
        "max_breadcrumb_chars": 40000,
        "vendor_credential_modified": False,
        "vendor_native_inference_modified": False,
        "physical_Galaxy_Flip3_tested": False,
    }, indent=2) + "\n", encoding="utf-8")
    print("PASS_ESSENCE2_DIAGNOSTIC_COPY_CONTROL_APP_ONLY")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--app", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    a = p.parse_args()
    patch(a.app, a.report)
