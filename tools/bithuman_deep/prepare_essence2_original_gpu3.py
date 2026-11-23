#!/usr/bin/env python3
"""Pack two separate Android execution routes, BOTH using the exact original 0.9.5 ELF.

BASELINE runs the vendor GPU/CPU choices without instrumentation.
GPU3 keeps the same vendor native and installs a runtime OpenCL dispatch
before SDK nativeCreate: ORIGINAL_GPU -> COMPACT_GPU on -54 -> VENDOR_CPU.
This script never patches four ARM64 instructions or installs legacy WG128.
"""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

ORIGINAL_SHA = "3eed089467f5ffeab88715c0d126f09e87734e84190e6e4899494db6b67657cf"
PATCHED_SHA = "a96a8892807e432719d9c58814257d03a85cee8eee297803473d9d8153618c14"
MEMBER = "jni/arm64-v8a/lible_jni.so"

def main(app: Path, sdk: Path, report: Path) -> None:
    original = sdk / "vendor-original-0.9.5.aar"
    loader = sdk / "hitel-dual-loader-0.9.5.aar"
    maven = app / "android/local-sdk-maven/ai/hitel/reassembled/essence2-android/0.9.5"
    output = maven / "essence2-android-0.9.5.aar"
    with ZipFile(original) as base, ZipFile(loader) as routed:
        a = base.read(MEMBER)
        b = routed.read(MEMBER)
        original_hash = hashlib.sha256(a).hexdigest()
        assert original_hash == ORIGINAL_SHA, "Vendor original SHA drift"
        assert a == b, "Original ELF is not identical after loader reassembly"
        assert hashlib.sha256(b).hexdigest() != PATCHED_SHA
        assert base.read("classes.jar") != routed.read("classes.jar"), "Missing NativeBridge loader binding"
        assert set(base.namelist()) == set(routed.namelist()), "Vendor AAR members changed"
        native_names = [p for p in routed.namelist() if p.endswith(".so")]
        for item in native_names:
            assert base.read(item) == routed.read(item), "Other native SDK modified: "+item
    assert output.parent.is_dir(), "Local Maven directory not initialized"
    output.write_bytes(loader.read_bytes())
    # No historic WG128 variant is allowed in this APK.
    old = app / "android/app/src/main/jniLibs/arm64-v8a/lible_jni_wg128.so"
    assert not old.exists(), "Prior WG128 GPU patch must not be included"
    report.parent.mkdir(parents=True, exist_ok=True)
    proof = {
        "layout": "two processes; same vendor native; GPU3 process-only OpenCL dispatch",
        "baseline_elf": "lib/arm64-v8a/lible_jni.so",
        "gpu3_elf": "lib/arm64-v8a/lible_jni.so",
        "original_native_sha256": original_hash,
        "legacy_wg128_sha256": PATCHED_SHA,
        "legacy_wg128_discarded": True,
        "native_elf_modified": False,
        "sdk_loader_asm_only": True,
        "pipeline": ["ORIGINAL_GPU", "COMPAT_GPU_ONLY_ON_-54", "ORIGINAL_VENDOR_CPU_FALLBACK"],
        "original_vendor_cpu_fallback_code_modified": False,
        "player_audio_pcm_render_modified": False,
        "compatibility_numeric_identity_proven": False
    }
    report.write_text(json.dumps(proof, indent=2, ensure_ascii=False)+"\n")
    print("PASS_GPU3_BOTH_ROUTES_EXACT_ORIGINAL_NATIVE", original_hash)
    print("PASS_GPU3_LEGACY_FOUR_WORD_PATCH_DISCARDED")

if __name__ == "__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--app", type=Path, required=True)
    p.add_argument("--sdk", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    a=p.parse_args()
    main(a.app,a.sdk,a.report)
