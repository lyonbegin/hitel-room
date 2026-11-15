#!/usr/bin/env python3
"""Replace ONE original Expression2Metering JVM function body, not the SDK engine.

Original getApiBaseUrl(): getstatic #47; areturn (4 JVM code bytes).
Replacement: ldc_w <new constant-pool String>; areturn (4 JVM code bytes).

This is direct JVM classfile byte surgery: NO Kotlin/Java/C++ SDK rewrite.
Every other JVM method Code byte sequence, native .so, AAR resource and JNI
declaration is verified unchanged. This does NOT implement a server, bypass
validation, or assert that a custom server's response conforms to the SDK.
"""
import argparse
import hashlib
import io
import json
import struct
import zipfile
from pathlib import Path
from urllib.parse import urlsplit

ORIGINAL_AAR_SHA = "067868a16a4b160a8d149d1cba4637298937b86292c9a563f89e22d004f4d584"
ORIGINAL_JAR_SHA = "e3c2a4bbf4a0e7f8e610c061f4d26317a97f16949d805b03ea73444d0a3ff751"
NATIVE_SO_SHA = "ca589010eac4273dbb890b2353e16c4c3ef2bf97f629fd68fbf5444ae9a37d9c"
LITERT_SO_SHA = "97355a36cb8ac7628cf407773291e98da79f3ef184cc43cb0e57dedf5f0c0637"
TARGET = "ai/bithuman/expression2/Expression2Metering.class"
METHOD_NAME = "getApiBaseUrl"
METHOD_DESCRIPTOR = "()Ljava/lang/String;"
ORIGINAL_CODE = bytes.fromhex("b2002fb0")  # getstatic #47; areturn
TEST_ENDPOINT = "https://auth.example.invalid"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def u2(data, at):
    return struct.unpack_from(">H", data, at)[0]


def u4(data, at):
    return struct.unpack_from(">I", data, at)[0]


def cp_info(data):
    assert data[:4] == b"\xca\xfe\xba\xbe", "not JVM classfile"
    count = u2(data, 8)
    pos = 10
    names = {}
    idx = 1
    while idx < count:
        tag = data[pos]
        pos += 1
        if tag == 1:
            length = u2(data, pos)
            pos += 2
            names[idx] = data[pos:pos + length].decode("utf-8", "replace")
            pos += length
        elif tag in (3, 4):
            pos += 4
        elif tag in (5, 6):
            pos += 8
            idx += 1
        elif tag in (7, 8, 16, 19, 20):
            pos += 2
        elif tag in (9, 10, 11, 12, 17, 18):
            pos += 4
        elif tag == 15:
            pos += 3
        else:
            raise ValueError(f"Unsupported constant pool tag {tag} at #{idx}")
        idx += 1
    return count, pos, names


def scan_methods(data):
    _, cp_end, names = cp_info(data)
    pos = cp_end + 6
    interfaces = u2(data, pos)
    pos += 2 + 2 * interfaces

    def skip_member(pos):
        attr_n = u2(data, pos + 6)
        pos += 8
        for _ in range(attr_n):
            attr_len = u4(data, pos + 2)
            pos += 6 + attr_len
        return pos

    field_count = u2(data, pos)
    pos += 2
    for _ in range(field_count):
        pos = skip_member(pos)
    method_count = u2(data, pos)
    pos += 2
    methods = {}
    for _ in range(method_count):
        name = names[u2(data, pos + 2)]
        desc = names[u2(data, pos + 4)]
        attr_n = u2(data, pos + 6)
        pos += 8
        key = (name, desc)
        assert key not in methods, f"duplicate JVM method: {key}"
        codes = []
        for _ in range(attr_n):
            attr_name = names[u2(data, pos)]
            attr_len = u4(data, pos + 2)
            start = pos + 6
            if attr_name == "Code":
                code_len = u4(data, start + 4)
                code_start = start + 8
                assert code_start + code_len <= start + attr_len
                codes.append((code_start, data[code_start:code_start + code_len]))
            pos = start + attr_len
        methods[key] = codes
    return methods


def replace_getter(original, endpoint):
    count, cp_end, names = cp_info(original)
    methods = scan_methods(original)
    target_key = (METHOD_NAME, METHOD_DESCRIPTOR)
    assert target_key in methods
    assert len(methods[target_key]) == 1
    old_at, old_code = methods[target_key][0]
    assert old_code == ORIGINAL_CODE, f"Unexpected SDK getter bytes: {old_code.hex()}"
    assert count + 2 <= 65535
    endpoint_utf8 = endpoint.encode("utf-8")
    assert len(endpoint_utf8) <= 65535
    appended_cp = b"\x01" + struct.pack(">H", len(endpoint_utf8)) + endpoint_utf8
    appended_cp += b"\x08" + struct.pack(">H", count)
    new_string_index = count + 1
    # Replace original 4-byte Code body with the 4-byte new bytecode body.
    patched = bytearray(original[:8] + struct.pack(">H", count + 2)
                        + original[10:cp_end] + appended_cp + original[cp_end:])
    offset = old_at + len(appended_cp)
    new_code = b"\x13" + struct.pack(">H", new_string_index) + b"\xb0"
    assert bytes(patched[offset:offset+4]) == old_code
    patched[offset:offset+4] = new_code
    patched = bytes(patched)

    new_methods = scan_methods(patched)
    assert methods.keys() == new_methods.keys(), "JVM method inventory changed"
    changed = [f"{key[0]}{key[1]}" for key in methods if
               [code for _, code in methods[key]] != [code for _, code in new_methods[key]]]
    assert changed == [METHOD_NAME + METHOD_DESCRIPTOR], f"Unexpected method changes: {changed}"
    assert [c for _, c in new_methods[target_key]] == [new_code]

    # Undo the exact one-body edit and remove only the two appended CP entries.
    restored = bytearray(patched)
    restored[offset:offset+4] = old_code
    restored = bytes(restored[:8] + original[8:10] + restored[10:cp_end]
                     + restored[cp_end + len(appended_cp):])
    assert restored == original, "Patch affected bytes outside intended CP + function"
    return patched, {"method": METHOD_NAME + METHOD_DESCRIPTOR,
                     "original_jvm_code": old_code.hex(),
                     "replacement_jvm_code": new_code.hex(),
                     "new_string_constant_pool_index": new_string_index,
                     "new_cp_entries": 2,
                     "jvm_methods_changed": changed,
                     "other_method_code_bytes_unchanged": True,
                     "roundtrip_restores_original_exactly": True,
                     "original_class_sha256": sha(original),
                     "patched_class_sha256": sha(patched)}


def repack_zip(source, replacement_path, replacement):
    orig = zipfile.ZipFile(io.BytesIO(source))
    output = io.BytesIO()
    with orig, zipfile.ZipFile(output, "w") as dst:
        dst.comment = orig.comment
        for entry in orig.infolist():
            dst.writestr(entry, replacement if entry.filename == replacement_path
                         else orig.read(entry.filename))
    packed = output.getvalue()
    with zipfile.ZipFile(io.BytesIO(source)) as left, zipfile.ZipFile(io.BytesIO(packed)) as right:
        assert left.namelist() == right.namelist(), "ZIP entry names changed"
        assert right.testzip() is None
        changed = [p for p in left.namelist() if left.read(p) != right.read(p)]
        assert changed == [replacement_path], f"Unexpected ZIP entry changes: {changed}"
    return packed


def checked_endpoint(text, allow_test):
    assert text and text == text.strip()
    parts = urlsplit(text)
    assert parts.scheme == "https" and parts.hostname and parts.port in (None, 443)
    assert not parts.username and not parts.password and not parts.query and not parts.fragment
    assert not parts.path or parts.path == "/" or (parts.path.startswith("/") and ".." not in parts.path)
    assert "bithuman.ai" not in parts.hostname.lower(), "Refusing original vendor server"
    assert (text != TEST_ENDPOINT or allow_test), "Explicit --allow-test-endpoint required"
    return text.rstrip("/")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source-aar", type=Path, required=True)
    p.add_argument("--output-aar", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    p.add_argument("--base-url", required=True)
    p.add_argument("--allow-test-endpoint", action="store_true")
    args = p.parse_args()
    base_url = checked_endpoint(args.base_url, args.allow_test_endpoint)
    original = args.source_aar.read_bytes()
    # Accept only the original published AAR as input; reassembled AAR members
    # have identical uncompressed contents but a different whole-ZIP digest.
    with zipfile.ZipFile(io.BytesIO(original)) as src:
        original_jar = src.read("classes.jar")
        native = src.read("jni/arm64-v8a/libexpr2jni.so")
        litert = src.read("jni/arm64-v8a/libLiteRt.so")
        assert sha(original_jar) == ORIGINAL_JAR_SHA
        assert sha(native) == NATIVE_SO_SHA
        assert sha(litert) == LITERT_SO_SHA
        with zipfile.ZipFile(io.BytesIO(original_jar)) as jar:
            cls = jar.read(TARGET)
    new_cls, details = replace_getter(cls, base_url)
    new_jar = repack_zip(original_jar, TARGET, new_cls)
    patched = repack_zip(original, "classes.jar", new_jar)
    with zipfile.ZipFile(io.BytesIO(patched)) as dst:
        assert dst.read("jni/arm64-v8a/libexpr2jni.so") == native
        assert dst.read("jni/arm64-v8a/libLiteRt.so") == litert
    args.output_aar.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.output_aar.write_bytes(patched)
    proof = {
        "original_aar_sha256": sha(original),
        "original_published_aar_sha256_match": sha(original) == ORIGINAL_AAR_SHA,
        "patched_aar_sha256": sha(patched),
        "endpoint": base_url,
        "static_test_endpoint_only": base_url == TEST_ENDPOINT,
        "server_protocol_and_response_tested": False,
        "target_class": TARGET,
        "jvm_classfiles_changed": 1,
        "aar_entries_changed": 1,
        "arm64_native_changed_bytes": 0,
        "litert_native_changed_bytes": 0,
        "engine_reimplemented": False,
        **details
    }
    args.report.write_text(json.dumps(proof, indent=2, ensure_ascii=False) + "\n")
    print("ORIGINAL_JVM_GET_API_BASE_URL_SINGLE_METHOD_PATCH_AND_AAR_PASS")
    print("TARGET", TARGET, "ORIGINAL_CODE", details["original_jvm_code"],
          "REPLACEMENT_CODE", details["replacement_jvm_code"])
    print("ARM64_NATIVE_CHANGED_BYTES=0 LITERT_CHANGED_BYTES=0")
    print("BACKEND_URL", base_url,
          "STATIC_ONLY_NO_LIVE_SERVER" if base_url == TEST_ENDPOINT else "CUSTOM_BACKEND_CONFIGURED_BUT_NOT_TESTED")


if __name__ == "__main__":
    main()
