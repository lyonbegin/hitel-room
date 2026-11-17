#!/usr/bin/env python3
"""IXIO authentication-only QA patch.

Input: unmodified, already reconstructed original IXIO classes16 DEX (baksmali).
Change exactly the two authentication BaseServer subclasses and synthetic QA
CTN proof. Preserve the original service URL selectors, AES implementation,
application config, model download, recorder settings, and all other methods.

This is a synthetic emulator/temporary-tunnel test, not carrier authorization.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re

DEFAULT = "http://10.0.2.2:8000/"
AUTH_SERVERS = (
    "network/client/ixio/IxIOSetupWizardServer.smali",
    "network/client/ixio/IxIOAuthServer.smali",
)
CTN = "util/EncryptCtnUtil.smali"
PROTECTED = (
    "network/client/BaseServer.smali",
    "network/client/RetrofitServiceFactory.smali",
    "network/IXIBuildConfig$Api.smali",
    "network/NetworkUrlConfigImpl.smali",
    "util/AES256Util.smali",
    "datastore/extension/DataStoreExtensionKt.smali",
)


def replace_exact_method(path: pathlib.Path, descriptor: str, replacement: str) -> dict:
    data = path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"(?ms)^\\.method[^\\n]*[ \\t]" + re.escape(descriptor)
        + r"\\n.*?^\\.end method$"
    )
    matches = list(pattern.finditer(data))
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one {descriptor} in {path}, got {len(matches)}")
    old = matches[0].group()
    if "HITEL_CI_BACKEND_URL_ONLY" in old:
        raise ValueError(f"Input is already modified, not original: {path}")
    updated = data[:matches[0].start()] + replacement + data[matches[0].end():]
    path.write_text(updated, encoding="utf-8")
    return {
        "file": str(path),
        "method": descriptor,
        "original_sha256": hashlib.sha256(old.encode()).hexdigest(),
        "patched_sha256": hashlib.sha256(replacement.encode()).hexdigest(),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=pathlib.Path)
    parser.add_argument("--qa-assertion", required=True)
    parser.add_argument("--base-url", default=DEFAULT)
    parser.add_argument("--report", required=True, type=pathlib.Path)
    args = parser.parse_args()

    if args.base_url != DEFAULT:
        raise ValueError("CI build supports only emulator host 10.0.2.2")
    if len(args.qa_assertion) < 32 or not args.qa_assertion.isascii():
        raise ValueError("Invalid synthetic QA assertion")

    root = args.root / "com/lguplus/aicallagent"
    for rel in (*AUTH_SERVERS, CTN, *PROTECTED):
        if not (root / rel).is_file():
            raise FileNotFoundError(root / rel)

    # Guard all generic IXIO systems before and after changes.
    original = {
        rel: hashlib.sha256((root / rel).read_bytes()).hexdigest()
        for rel in PROTECTED
    }

    modified = []
    for rel in AUTH_SERVERS:
        # BaseServer.getUrl() still performs the original AES decrypt.
        # Return the target URL encrypted using the ORIGINAL AES256Util.encrypt().
        # This changes ONLY this auth subclass, never global URL selection.
        method = (
            ".method public getBaseUrl()Ljava/lang/String;\n"
            "    .registers 3\n"
            "    sget-object v0, Lcom/lguplus/aicallagent/util/AES256Util;->INSTANCE:Lcom/lguplus/aicallagent/util/AES256Util;\n"
            "    const-string v1, " + json.dumps(args.base_url) + "\n"
            "    invoke-virtual {v0, v1}, Lcom/lguplus/aicallagent/util/AES256Util;->encrypt(Ljava/lang/String;)Ljava/lang/String;\n"
            "    move-result-object v0\n"
            "    return-object v0\n"
            ".end method"
        )
        modified.append(replace_exact_method(root / rel, "getBaseUrl()Ljava/lang/String;", method))

    # Preserve the existing synthetic member enrollment proof, auth-only.
    method = (
        ".method public final encrypt(Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;\n"
        "    .registers 3\n"
        "    const-string v0, " + json.dumps(args.qa_assertion) + "\n"
        "    return-object v0\n"
        ".end method"
    )
    modified.append(replace_exact_method(
        root / CTN,
        "encrypt(Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;",
        method,
    ))

    after = {
        rel: hashlib.sha256((root / rel).read_bytes()).hexdigest()
        for rel in PROTECTED
    }
    if original != after:
        raise AssertionError("An original non-authentication service was modified")

    report = {
        "scope": "local emulator CI QA; synthetic proof only",
        "patched_method_count": len(modified),
        "patched_smali_methods": modified,
        "authentication_only": True,
        "original_generic_network_url_selection_preserved": True,
        "original_url_getters_preserved": True,
        "original_aes256_methods_preserved": True,
        "original_model_download_and_stt_preserved": True,
        "original_recorder_datastore_preserved": True,
        "protected_original_sha256": original,
        "protected_after_sha256": after,
        "base_url": args.base_url,
        "warning": "This only scopes routing; signing, real account login and device STT require separate verification.",
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print("AUTH_ONLY_PATCHED_METHOD_COUNT", len(modified))
    print("NON_AUTH_SERVICES_UNMODIFIED", original == after)


if __name__ == "__main__":
    main()
