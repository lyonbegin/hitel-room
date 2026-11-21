#!/usr/bin/env python3
"""Verify the pinned native DEK asset's source binding without exporting a key.

Requires Python cryptography. The fixed asset address and final four bytes
come from the recorded original AArch64 JNI function at 0x16d4c.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import struct
from pathlib import Path

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from ixio_original_dek_asset_binding import NATIVE_SHA, SOURCE_SIGNER


def verify(blob: bytes) -> dict:
    if hashlib.sha256(blob).hexdigest() != NATIVE_SHA:
        raise RuntimeError("Native binary differs from the audited original")
    if blob[:6] != b"\x7fELF\x02\x01":
        raise RuntimeError("Expected original ELF64 little-endian binary")
    header = struct.unpack_from("<HHIQQQIHHHHHH", blob, 16)
    if header[1] != 183:
        raise RuntimeError("Expected audited AArch64 binary")
    addr = 0x8A67
    data = None
    for index in range(header[9]):
        segment = struct.unpack_from("<IIQQQQQQ", blob, header[4] + index * header[8])
        kind, _, offset, vaddr, _, filesz, _, _ = segment
        if kind == 1 and vaddr <= addr and addr + 80 <= vaddr + filesz:
            start = offset + addr - vaddr
            data = blob[start:start+80] + bytes.fromhex("4c413d3d")
            break
    if data is None:
        raise RuntimeError("Audited asset address is not backed by a load segment")
    encrypted = base64.b64decode(data, validate=True)
    assert len(encrypted) == 61 and encrypted[0] == 1
    verification = {}
    for label, signer in (("original", SOURCE_SIGNER),
                          ("previous_qa", "5e6b7dc2aa26124569e91d29ab1b2cb285db7a9cd20bf194678fa862fed4b50d")):
        binding = b"com.lguplus.aicallagent\0" + bytes.fromhex(signer)
        key = hashlib.sha256(b"ctn_dek_provisioning_v1\0" + binding).digest()
        try:
            plain = AESGCM(key).decrypt(encrypted[1:13], encrypted[13:], None)
            verification[label] = {"authenticated_decryption": True, "dek_length": len(plain)}
            del plain
        except InvalidTag:
            verification[label] = {"authenticated_decryption": False, "failure": "InvalidTag"}
        del key
    assert verification["original"] == {"authenticated_decryption": True, "dek_length": 32}
    assert verification["previous_qa"]["authenticated_decryption"] is False
    return {
        "native_library_sha256": NATIVE_SHA,
        "jni_function": "Java_com_lguplus_encryptor_NativeKeyProvider_getCtnEncryptKeyProdRelease",
        "jni_address": "0x16d4c", "encoded_asset_address": "0x8a67",
        "encrypted_asset_bytes": len(encrypted),
        "binding_format": "UTF8(package) + ZERO_BYTE + SHA256(source signer certificate)",
        "derivation_format": "SHA256(UTF8(ctn_dek_provisioning_v1) + ZERO_BYTE + binding)",
        "verification": verification, "plaintext_key_written_or_printed": False,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--native-library", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    report = verify(args.native_library.read_bytes())
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n")
    print("ORIGINAL_NATIVE_DEK_AUTHENTICATED_SOURCE_BINDING_VERIFIED=YES")


if __name__ == "__main__":
    main()
