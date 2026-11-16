#!/usr/bin/env python3
"""Add ONLY existing original bitHuman sample PCM feed to disposable SDK 0.6.1 avatar_chat.

Reuses the proven Dart SAMPLE_HELPER from the 0.6.2 test verbatim except:
full original WAV rather than first 2 seconds; a 3-second idle screenshot window;
one log marker per second. Does NOT touch SDK, Kotlin plugin, model loader or
authentication. No paid realtime API is opened.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import shutil
import wave
from pathlib import Path
from prepare_original_avatar_chat_public_https import SAMPLE_HELPER, replace_once


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", type=Path, required=True)
    parser.add_argument("--sample", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    main_file = args.app / "lib/main.dart"
    original = main_file.read_text(encoding="utf-8")
    assert "_hitelSdk061AuthTest" in original, "Apply the working 0.6.1 HITEL authorization test first"
    assert "_hitelRunOriginalSpeech" not in original, "The 0.6.1 speech probe must be added once only"
    assert "BithumanAvatar.load(agentDir, engine: _engine, apiSecret: secret)" in original
    with wave.open(str(args.sample), "rb") as wav:
        channels = wav.getnchannels()
        framerate = wav.getframerate()
        sample_width = wav.getsampwidth()
        frames = wav.getnframes()
        assert wav.getcomptype() == "NONE"
    assert (channels, framerate, sample_width) == (1, 16000, 2), (
        "Unexpected upstream sample WAV format", channels, framerate, sample_width
    )
    assert frames > 160000, f"Expected original 13.87-second sample; got {frames} frames"

    helper = SAMPLE_HELPER
    helper = replace_once(
        helper,
        "      await avatar.audioStart(enableMic: false);",
        "      await Future<void>.delayed(const Duration(seconds: 3));\n"
        "      await avatar.audioStart(enableMic: false);\n"
        "      await _mark('hitel:original-pcm-audio-start-ok');",
        "separate idle screenshot phase from speech",
    )
    helper = replace_once(
        helper,
        "      final samples = (dataLength ~/ 2).clamp(0, 32000);",
        "      final samples = dataLength ~/ 2;\n"
        "      await _mark('hitel:original-pcm-feed-start samples=$samples');",
        "play complete original WAV, not only the first 2 seconds",
    )
    helper = replace_once(
        helper,
        "        await avatar.pushAudio(chunk);",
        "        await avatar.pushAudio(chunk);\n"
        "        if ((start + count) % 16000 == 0) {\n"
        "          await _mark('hitel:original-pcm-fed-progress samples=${start + count}');\n"
        "        }",
        "record feed progress every second",
    )
    s = replace_once(
        original,
        "import 'dart:io';\n",
        "import 'dart:io';\nimport 'dart:typed_data';\n",
        "typed PCM chunk import",
    )
    s = replace_once(
        s,
        "  Future<void> _boot() async {\n",
        helper + "\n  Future<void> _boot() async {\n",
        "reuse original PCM playback helper without replacing original model loader",
    )
    sentinel = (
        "      if (_hitelSdk061AuthTest && Platform.isAndroid) {\n"
        "        await _mark('hitel:sdk061_avatar_load_succeeded_no_paid_realtime');\n"
        "        return;\n"
        "      }\n"
    )
    replacement = (
        "      if (_hitelSdk061AuthTest && Platform.isAndroid) {\n"
        "        await _mark('hitel:sdk061_avatar_load_succeeded_no_paid_realtime');\n"
        "        unawaited(_hitelRunOriginalSpeech(avatar));\n"
        "        return; // Keep paid realtime disabled; use original PCM and SDK only.\n"
        "      }\n"
    )
    s = replace_once(s, sentinel, replacement, "schedule original PCM after SDK avatar load")
    assert "BithumanAvatar.load(agentDir, engine: _engine, apiSecret: secret)" in s
    assert "_hitelOriginalLocalTest" not in s
    assert "Expression2LocalTest" not in s
    assert "unawaited(_hitelRunOriginalSpeech(avatar));" in s
    assert "      await _openSession(avatar, secret);" in s
    main_file.write_text(s, encoding="utf-8")
    flutter_assets = args.app / "assets"
    flutter_assets.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(args.sample, flutter_assets / "speech.wav")
    pub = args.app / "pubspec.yaml"
    pub_text = pub.read_text(encoding="utf-8")
    pub_text = replace_once(
        pub_text,
        "flutter:\n  uses-material-design: true\n",
        "flutter:\n  uses-material-design: true\n  assets:\n    - assets/speech.wav\n",
        "register exact original public sample WAV",
    )
    pub.write_text(pub_text, encoding="utf-8")
    result = {
        "sdk": "expression2-android 0.6.1 original",
        "app_main_before_sha256": digest(original.encode()),
        "app_main_after_sha256": digest(s.encode()),
        "original_sample_sha256": digest(args.sample.read_bytes()),
        "sample_frames": frames,
        "sample_rate_hz": framerate,
        "sample_channels": channels,
        "sample_seconds": frames / framerate,
        "model_loader_replaced": False,
        "plugin_kotlin_changed_by_this_step": False,
        "SDK_native_changed_by_this_step": False,
        "original_audio_calls": ["audioStart(enableMic: false)", "pushAudio(Int16List)", "notifyTurnEnd()"],
        "full_sample_instead_of_062_two_second_probe": True,
        "paid_realtime_disabled": True,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("SDK061_ORIGINAL_SPEECH_PCM_FLUTTER_PROBE_READY")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
