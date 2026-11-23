#!/usr/bin/env python3
"""Preserve first working dual APK and replace only WG128 JNI from actual 2026-11-22 GPU release.

Called after SelectEssence2NativeLibrary transforms NativeBridge and before
Flutter/Gradle build. The two processes choose which library to load.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parent))

BASE="3eed089467f5ffeab88715c0d126f09e87734e84190e6e4899494db6b67657cf"
WG="a96a8892807e432719d9c58814257d03a85cee8eee297803473d9d8153618c14"
NATIVE="jni/arm64-v8a/lible_jni.so"

def digest(v): return hashlib.sha256(v).hexdigest()

def main(app,sdk,report,historical_apk):
    src=sdk/"hitel-dual-loader-0.9.5.aar"
    base=sdk/"vendor-original-0.9.5.aar"
    dest=app/"android/local-sdk-maven/ai/hitel/reassembled/essence2-android/0.9.5/essence2-android-0.9.5.aar"
    with ZipFile(src) as z, ZipFile(base) as org:
        native=z.read(NATIVE)
        assert native == org.read(NATIVE) and digest(native)==BASE
        assert z.read("classes.jar") != org.read("classes.jar")
    with ZipFile(historical_apk) as historical:
        changed=historical.read("lib/arm64-v8a/lible_jni.so")
        old_probe=historical.read("lib/arm64-v8a/libhitel_e2_probe.so")
    assert len(changed)==len(native), "Historical GPU SDK native size mismatch"
    assert digest(changed)==WG, "Historical GPU SDK native hash not the pinned WG128 release"
    assert len(old_probe)>10000, "Historical GPU probe missing"
    (sdk/"historical-20261122-gpu-probe.so").write_bytes(old_probe)
    differ=[i for i,(x,y) in enumerate(zip(native,changed)) if x!=y]
    assert set(i//4*4 for i in differ)=={0x20906c,0x20b5f0,0x215f44,0x215f88},differ
    dest.write_bytes(src.read_bytes())
    libs=app/"android/app/src/main/jniLibs/arm64-v8a"
    libs.mkdir(parents=True,exist_ok=True)
    alt=libs/"lible_jni_wg128.so"
    alt.write_bytes(changed)
    assert alt.stat().st_size==len(native)
    report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps({
      "single_apk":True,
      "original_jni":"lib/arm64-v8a/lible_jni.so",
      "wg128_jni":"lib/arm64-v8a/lible_jni_wg128.so",
      "source_sha256":BASE,"wg128_sha256":WG,
      "changed_arm64_instruction_addresses":["0x20906c","0x20b5f0","0x215f44","0x215f88"],
      "byte_differences":len(differ),
      "gpu_source_release":"hitel-essence2-wg128-wav-pull-bf7290b661",
      "gpu_source_verified_release_apk":str(historical_apk),
      "gpu_native_from_actual_historical_apk":True,
      "historical_native_sha256":digest(changed),
      "historical_native_probe_sha256":digest(old_probe),
      "historical_native_equals_earlier_four_instruction_variant":digest(changed)==WG,
      "baseline_native_byte_identical_to_vendor":True,
      "baseline_player_source_changed":False,
      "classes_aar_loader_patched":True,
      "same_sdk_java_api":True,
      "separate_android_processes":True
    },indent=2)+"\n")
    print("PASS_ONE_APK_ORIGINAL_AND_WG128_NATIVE_ELF_READY",len(differ))

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--app",required=True,type=Path)
    p.add_argument("--sdk",required=True,type=Path)
    p.add_argument("--report",required=True,type=Path)
    p.add_argument("--historical-wg128-apk",required=True,type=Path)
    a=p.parse_args()
    main(a.app,a.sdk,a.report,a.historical_wg128_apk)
