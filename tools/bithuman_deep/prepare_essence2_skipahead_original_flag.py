#!/usr/bin/env python3
"""Opt in to bitHuman's ORIGINAL Essence2 skip-ahead playout clock.

Only swaps one Flutter application-level optional argument. Never edits native
AAR/JNI/ONNX model, the SDK itself, vendor entitlement or realtime transport.
The control comparison is otherwise the same 14.44 s eSpeak speech input.
"""
from pathlib import Path
import argparse
import json

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--app",type=Path,required=True)
    p.add_argument("--report",type=Path,required=True)
    a=p.parse_args()
    main=a.app/"lib/main.dart"
    original=main.read_text()
    anchor="      final avatar = await BithumanAvatar.load(agentDir, engine: _engine, apiSecret: secret);\n"
    assert original.count(anchor)==1, "Expected exact one unmodified load call from original app"
    test="""      // Original BitHuman SDK knob: move the render walk to the speaker's
      // playout position if the CPU/GPU is not rendering at nominal 25 fps.
      await _mark('hitel:essence2:original_skipAhead=true');
      final avatar = await BithumanAvatar.load(
          agentDir, engine: _engine, apiSecret: secret, skipAhead: true);
"""
    text=original.replace(anchor,test,1)
    assert text.count("skipAhead: true")==1
    assert text.count("await _openSession(avatar, secret);")==1
    main.write_text(text)
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps({
        "test":"ORIGINAL_BIT_HUMAN_ESSENCE2_SKIPAHEAD_AB_CONTROL",
        "only_changed_call":"BithumanAvatar.load(skipAhead: true)",
        "original_flutter_plugin_modified":False,
        "native_sdk_modified":False,
        "original_sdk_essence2_095_modified":False,
        "original_input_audio_or_pcm_modified":False,
        "expected_comparison":"speechCoverage uniqueShown/due and total frozen",
        "Android_Galaxy_Z_Flip3_verified":False,
    },indent=2)+"\n")
    print("PASS_ORIGINAL_ESSENCE2_SKIP_AHEAD_FLAG_OPT_IN_APP_ONLY")

if __name__=="__main__":
    main()
