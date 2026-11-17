#!/usr/bin/env python3
"""Isolated HITEL Essence2 Android 0.9.5 meter-route reassembly experiment.

Makes EXACTLY ONE JVM Code attribute edit in published Essence2 AAR:
ai.bithuman.elevate.SelfHostMeter$Companion.apiBase$essence2_android_release()
The original native lible_jni.so, Kotlin interfaces, model algorithms, GPU/CPU
paths, all other JVM methods and all other AAR entries are byte-identical.

This redirects the TEST METER URL ONLY. This does not itself license any vendor
model, implement the entitlement protocol, or establish that playback works.
"""
from __future__ import annotations

import argparse
import io
import json
import zipfile
from pathlib import Path

# Import exactly the already-proven original classfile editor used for 0.6.1.
# Its parser and bytecode roundtrip checks are not reimplemented/approximated.
import expression2_replace_original_meter_api_base_method as bytecode
from expression2_replace_original_api_base_getter import (
    checked_endpoint, repack_zip, sha, CI_LOOPBACK_ENDPOINT,
)

TARGET = "ai/bithuman/elevate/SelfHostMeter$Companion.class"
METHOD = "apiBase$essence2_android_release"
DESC = "()Ljava/lang/String;"
NATIVE = "jni/arm64-v8a/lible_jni.so"


def build(original: bytes, endpoint: str):
    # The original helper identifies methods via its module-level exact target.
    # No wildcard method matching and no guessing the original method body.
    bytecode.TARGET = TARGET
    bytecode.METHOD = METHOD
    bytecode.DESC = DESC
    with zipfile.ZipFile(io.BytesIO(original)) as aar:
        source_names = aar.namelist()
        jar = aar.read("classes.jar")
        native = aar.read(NATIVE)
        with zipfile.ZipFile(io.BytesIO(jar)) as j:
            class_names = j.namelist()
            source_class = j.read(TARGET)
    patched_class, details = bytecode.replace_one_original_method(source_class, endpoint)
    patched_jar = repack_zip(jar, TARGET, patched_class)
    patched_aar = repack_zip(original, "classes.jar", patched_jar)
    with zipfile.ZipFile(io.BytesIO(original)) as before, zipfile.ZipFile(io.BytesIO(patched_aar)) as after:
        assert before.namelist() == after.namelist()
        assert after.read(NATIVE) == native
        for name in source_names:
            if name != "classes.jar":
                assert before.read(name) == after.read(name), name
        with zipfile.ZipFile(io.BytesIO(jar)) as j0, zipfile.ZipFile(io.BytesIO(patched_jar)) as j1:
            assert j0.namelist() == j1.namelist() == class_names
            for name in class_names:
                if name != TARGET:
                    assert j0.read(name) == j1.read(name), name
            assert j1.read(TARGET) == patched_class
    proof = {
        "vendor_coordinate": "ai.bithuman:essence2-android:0.9.5",
        "original_aar_sha256": sha(original),
        "patched_aar_sha256": sha(patched_aar),
        "original_native_sha256": sha(native),
        "native_bytes_changed": 0,
        "other_aar_entries_changed": 0,
        "other_jar_classes_changed": 0,
        "test_meter_base": endpoint,
        "patched_jvm_method": METHOD + DESC,
        "original_sdk_license_verification_not_claimed": True,
        "original_model_store_not_reimplemented": True,
        "real_device_rendering_not_verified": True,
        "bytecode_roundtrip": details,
    }
    return patched_aar, proof


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source-aar", type=Path, required=True)
    p.add_argument("--output-aar", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    p.add_argument("--base-url", default=CI_LOOPBACK_ENDPOINT)
    p.add_argument("--allow-offline-loopback", action="store_true")
    a = p.parse_args()
    endpoint = checked_endpoint(a.base_url, a.allow_offline_loopback)
    if a.allow_offline_loopback:
        assert endpoint == CI_LOOPBACK_ENDPOINT, "Only pinned local mock endpoint allowed in debug"
    modified, proof = build(a.source_aar.read_bytes(), endpoint)
    a.output_aar.parent.mkdir(parents=True, exist_ok=True)
    a.report.parent.mkdir(parents=True, exist_ok=True)
    a.output_aar.write_bytes(modified)
    a.report.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    print("PASS_ESSENCE2_ORIGINAL_METER_ROUTE_SINGLE_JVM_METHOD")
    print("ORIGINAL_NATIVE_BYTES_CHANGED=0")
    print("VENDOR_ENTITLEMENT_AND_PLAYBACK_NOT_VERIFIED")


if __name__ == "__main__":
    main()
