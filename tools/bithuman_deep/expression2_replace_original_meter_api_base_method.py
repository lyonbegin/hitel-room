#!/usr/bin/env python3
"""Replace ONE method in ORIGINAL Expression2 SDK JVM classfile.

Target: SelfHostMeter$Companion.apiBase$expression2_release()Ljava/lang/String;
All other original JVM method bytecode and ARM64 .so files remain unchanged.
No Java/Kotlin/C++ reimplementation of original SDK functions.
"""
import argparse
import io
import json
import struct
import zipfile
from pathlib import Path
from expression2_replace_original_api_base_getter import (
    cp_info, scan_methods, repack_zip, sha, checked_endpoint, u2, u4,
    ORIGINAL_AAR_SHA, REASSEMBLED_AAR_SHA, NATIVE_SO_SHA, LITERT_SO_SHA
)

TARGET = "ai/bithuman/expression2/SelfHostMeter$Companion.class"
METHOD = "apiBase$expression2_release"
DESC = "()Ljava/lang/String;"


def method_code_attribute(data):
    cp_count, pos, names = cp_info(data)
    assert cp_count < 65533
    pos += 6  # access flags, this_class, super_class
    n_interfaces = u2(data, pos)
    pos += 2 + 2 * n_interfaces

    def past_member(p):
        n = u2(data, p + 6)
        p += 8
        for _ in range(n):
            p += 6 + u4(data, p + 2)
        return p

    n_fields = u2(data, pos)
    pos += 2
    for _ in range(n_fields):
        pos = past_member(pos)

    n_methods = u2(data, pos)
    pos += 2
    found = []
    for _ in range(n_methods):
        name = names[u2(data, pos + 2)]
        desc = names[u2(data, pos + 4)]
        n_attrs = u2(data, pos + 6)
        pos += 8
        for _ in range(n_attrs):
            attr_name = names[u2(data, pos)]
            attr_size = u4(data, pos + 2)
            end = pos + 6 + attr_size
            if name == METHOD and desc == DESC and attr_name == "Code":
                codeinfo = pos + 6
                code_length = u4(data, codeinfo + 4)
                assert codeinfo + 8 + code_length <= end
                found.append({
                    "attr_header_offset": pos,
                    "attr_end_offset": end,
                    "original_code_bytes": data[codeinfo + 8:codeinfo + 8 + code_length],
                    "original_max_stack": u2(data, codeinfo),
                    "original_max_locals": u2(data, codeinfo + 2)
                })
            pos = end
    assert len(found) == 1, f"Expected exactly one original {METHOD}{DESC} Code attribute"
    assert len(found[0]["original_code_bytes"]) >= 100, "Unexpected original auth routing method size"
    return found[0]


def replace_one_original_method(source_class, endpoint):
    count, cp_end, names = cp_info(source_class)
    before = scan_methods(source_class)
    key = (METHOD, DESC)
    assert key in before and len(before[key]) == 1
    loc = method_code_attribute(source_class)
    assert loc["original_code_bytes"] == before[key][0][1]

    utf8 = endpoint.encode("utf-8")
    assert len(utf8) < 65536
    cp_extra = b"\x01" + struct.pack(">H", len(utf8)) + utf8
    cp_extra += b"\x08" + struct.pack(">H", count)
    # Code body contains exactly two JVM instructions: ldc_w <URL>, areturn.
    new_code = b"\x13" + struct.pack(">H", count + 1) + b"\xb0"
    max_locals = loc["original_max_locals"]
    assert max_locals >= 1
    new_codeinfo = (struct.pack(">HHI", 1, max_locals, 4) + new_code
                    + struct.pack(">HH", 0, 0))
    assert len(new_codeinfo) == 16

    h = loc["attr_header_offset"]
    end = loc["attr_end_offset"]
    # Only rewrite the target method Code attribute length/body.
    with_one_method = (source_class[:h + 2] +
                       struct.pack(">I", len(new_codeinfo)) +
                       new_codeinfo + source_class[end:])
    patched = (with_one_method[:8] + struct.pack(">H", count + 2) +
               with_one_method[10:cp_end] + cp_extra +
               with_one_method[cp_end:])

    after = scan_methods(patched)
    assert before.keys() == after.keys()
    changed = [n for n in before if [code for _, code in before[n]]
               != [code for _, code in after[n]]]
    assert changed == [key], f"Unexpected JVM method Code changes: {changed}"
    assert [v for _, v in after[key]] == [new_code]

    # Roundtrip proof: restore the original Code attribute and remove only
    # the two appended constant-pool members, exactly reproducing class bytes.
    without_cp = (patched[:8] + source_class[8:10] +
                  patched[10:cp_end] + patched[cp_end + len(cp_extra):])
    restored = (without_cp[:h + 2] + source_class[h + 2:end] +
                without_cp[h + 6 + len(new_codeinfo):])
    assert restored == source_class, "Roundtrip failed: another JVM byte changed"

    return patched, {
        "target_class": TARGET,
        "target_method": METHOD + DESC,
        "original_method_code_length": len(loc["original_code_bytes"]),
        "replacement_method_code_length": 4,
        "original_code_sha256": sha(loc["original_code_bytes"]),
        "replacement_code_hex": new_code.hex(),
        "constant_pool_entries_appended": 2,
        "modified_jvm_methods": [METHOD + DESC],
        "all_other_jvm_method_bodies_unchanged": True,
        "original_jvm_classfile_roundtrip_exact": True,
        "original_class_sha256": sha(source_class),
        "patched_class_sha256": sha(patched)
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source-aar", type=Path, required=True)
    p.add_argument("--output-aar", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    p.add_argument("--base-url", required=True)
    p.add_argument("--allow-test-endpoint", action="store_true")
    args = p.parse_args()

    endpoint = checked_endpoint(args.base_url, args.allow_test_endpoint)
    original = args.source_aar.read_bytes()
    assert sha(original) in (ORIGINAL_AAR_SHA, REASSEMBLED_AAR_SHA)
    with zipfile.ZipFile(io.BytesIO(original)) as z:
        original_jar = z.read("classes.jar")
        native = z.read("jni/arm64-v8a/libexpr2jni.so")
        litert = z.read("jni/arm64-v8a/libLiteRt.so")
        assert sha(native) == NATIVE_SO_SHA
        assert sha(litert) == LITERT_SO_SHA
        with zipfile.ZipFile(io.BytesIO(original_jar)) as j:
            original_cls = j.read(TARGET)

    patched_cls, proof = replace_one_original_method(original_cls, endpoint)
    patched_jar = repack_zip(original_jar, TARGET, patched_cls)
    patched_aar = repack_zip(original, "classes.jar", patched_jar)

    with zipfile.ZipFile(io.BytesIO(patched_aar)) as z:
        assert z.read("jni/arm64-v8a/libexpr2jni.so") == native
        assert z.read("jni/arm64-v8a/libLiteRt.so") == litert
        with zipfile.ZipFile(io.BytesIO(z.read("classes.jar"))) as j:
            assert j.read(TARGET) == patched_cls

    report = {
        **proof,
        "original_aar_sha256": sha(original),
        "patched_aar_sha256": sha(patched_aar),
        "url_replacement": endpoint,
        "ci_only_url": endpoint in ("https://auth.example.invalid",
                                   "http://127.0.0.1:18762"),
        "other_aar_entries_changed": 0,
        "other_jar_entries_changed": 0,
        "original_arm64_changed_bytes": 0,
        "original_litert_changed_bytes": 0,
        "original_sdk_engine_rebuilt": False,
        "real_backend_response_contract_verified": False
    }
    args.output_aar.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.output_aar.write_bytes(patched_aar)
    args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
    print("EXPR2_ORIGINAL_ACTUAL_METER_API_BASE_ONLY_ONE_METHOD_REPLACED_PASS")
    print("TARGET", proof["target_method"])
    print("OLD_CODE_BYTES",proof["original_method_code_length"],"NEW_CODE_BYTES",4)
    print("AUTH_ROUTE_URL",endpoint,"ARM64_BYTES_CHANGED=0")
    print("NO_VENDOR_AUTHORIZATION_OR_REAL_RENDER_SUCCESS_CLAIM")


if __name__ == "__main__":
    main()
