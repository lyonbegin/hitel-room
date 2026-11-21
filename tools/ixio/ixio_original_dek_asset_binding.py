#!/usr/bin/env python3
"""Use the source signer only for decrypting the pinned original DEK asset.

The native asset was authenticated offline against this public source-signer
binding. Device KEK creation, wrapping/unwrapping AAD and reported APK signer
continue to use the running APK's real identity. No plaintext DEK is embedded.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

NATIVE_SHA = "eee000433ca92347981a70b30effa6afa8c004c1b86478701e7fc2b3fb2dcff4"
SOURCE_SIGNER = "78cc8f145957291408bbfaec1c94ef1e761ac4a84b960def2983b0818d5d05f0"
MANAGER = "com/lguplus/aicallagent/util/crypto/ProvisioningManager.smali"
PROBE = "com/lguplus/aicallagent/util/crypto/HitelOriginalDekAssetBinding.smali"
DESC = "L" + PROBE[:-6] + ";"


def source() -> str:
    binding = b"com.lguplus.aicallagent\0" + bytes.fromhex(SOURCE_SIGNER)
    values = "\n".join("        " + hex(v if v < 128 else v-256) + "t" for v in binding)
    return f'''.class public final {DESC}
.super Ljava/lang/Object;

.method public static sourceBinding()[B
    .registers 1
    const/16 v0, {hex(len(binding))}
    new-array v0, v0, [B
    fill-array-data v0, :source_binding
    return-object v0
    :source_binding
    .array-data 1
{values}
    .end array-data
.end method
'''


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--smali16", type=Path, required=True)
    p.add_argument("--native-library", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    a = p.parse_args()
    if hashlib.sha256(a.native_library.read_bytes()).hexdigest() != NATIVE_SHA:
        raise RuntimeError("Unverified native asset library; source binding must be audited again")
    target = a.smali16 / MANAGER
    old = target.read_text()
    hits = list(re.finditer(r"(?ms)^\.method private final getDekFromEncryptedDek\(\)\[B\n.*?^\.end method$", old))
    if len(hits) != 1 or (a.smali16 / PROBE).exists():
        raise RuntimeError("Expected one unchanged original asset decryption method")
    body = hits[0].group()
    call = "    invoke-virtual {v1, p0}, Lcom/lguplus/aicallagent/util/crypto/AppBindingDataProvider;->getAppBindingData(Landroid/content/Context;)[B"
    if body.count(call) != 1:
        raise RuntimeError("Unexpected original asset binding call")
    changed = body.replace(call, f"    invoke-static {{}}, {DESC}->sourceBinding()[B", 1)
    target.write_text(old[:hits[0].start()] + changed + old[hits[0].end():])
    (a.smali16 / PROBE).write_text(source())
    a.report.parent.mkdir(parents=True, exist_ok=True)
    a.report.write_text(json.dumps({
        "mode": "SOURCE_ASSET_DECRYPTION_CONTEXT_ONLY",
        "native_library_sha256": NATIVE_SHA,
        "public_source_signer_sha256": SOURCE_SIGNER,
        "changed_method": "ProvisioningManager.getDekFromEncryptedDek",
        "original_method_sha256": hashlib.sha256(body.encode()).hexdigest(),
        "adapted_method_sha256": hashlib.sha256(changed.encode()).hexdigest(),
        "native_ciphertext_and_decrypt_algorithm_unchanged": True,
        "device_keystore_and_current_signer_wrapping_aad_unchanged": True,
        "apk_signer_queries_and_server_authentication_unchanged": True,
        "plaintext_dek_embedded_or_exported": False,
        "test_only": True,
    }, indent=2))
    print("ORIGINAL_DEK_ASSET_SOURCE_BINDING_ADAPTED_WITH_CURRENT_DEVICE_WRAPPING_PRESERVED=YES")


if __name__ == "__main__":
    main()
