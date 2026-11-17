#!/usr/bin/env python3
"""IXIO login-only URL patch against the ORIGINAL classes16 DEX.

This edits exactly IxIOAuthServer.getBaseUrl(). It does not edit the shared
IXIBuildConfig URL getter, IxIOSetupWizardServer, member services, CTN encrypt,
AES helpers, models, STT, recorder, preferences, or app UI.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re

AUTH_CLASS = "com/lguplus/aicallagent/network/client/ixio/IxIOAuthServer.smali"
METHOD = "getBaseUrl()Ljava/lang/String;"


def digest(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    if not re.fullmatch(r"https://[a-z0-9-]+\\.trycloudflare\\.com/", args.base_url):
        raise ValueError("Public HTTPS QA address expected")
    root = args.root
    files = sorted(root.rglob("*.smali"))
    if len(files) < 500:
        raise ValueError(f"Unexpected original DEX class count: {len(files)}")
    target = root / AUTH_CLASS
    if target not in files:
        raise FileNotFoundError(target)
    original_hash = {str(p.relative_to(root)): digest(p) for p in files}
    original_source = target.read_text(encoding="utf-8")
    pattern = re.compile(r"(?ms)^\\.method[^\\n]*[ \\t]" + re.escape(METHOD) + r"\\n.*?^\\.end method$")
    matches = list(pattern.finditer(original_source))
    if len(matches) != 1:
        raise AssertionError(f"Expected one exact auth getBaseUrl(), got {len(matches)}")
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
    before_method = matches[0].group()
    target.write_text(
        original_source[:matches[0].start()] + method + original_source[matches[0].end():],
        encoding="utf-8",
    )
    after_hash = {str(p.relative_to(root)): digest(p) for p in files}
    changed = sorted(k for k in original_hash if original_hash[k] != after_hash[k])
    if changed != [AUTH_CLASS]:
        raise AssertionError(f"Non-login classes modified: {changed}")
    updated_source = target.read_text(encoding="utf-8")
    if updated_source.replace(method, before_method, 1) != original_source:
        raise AssertionError("Unexpected changes outside exact auth method")
    report = {
        "original_smali_file_count": len(files),
        "changed_class_count": len(changed),
        "changed_classes": changed,
        "changed_method": METHOD,
        "original_crypto_ctn_unchanged": original_hash["com/lguplus/aicallagent/util/EncryptCtnUtil.smali"] == after_hash["com/lguplus/aicallagent/util/EncryptCtnUtil.smali"],
        "original_global_urls_unchanged": original_hash["com/lguplus/aicallagent/network/IXIBuildConfig$Api.smali"] == after_hash["com/lguplus/aicallagent/network/IXIBuildConfig$Api.smali"],
        "original_setup_wizard_unchanged": original_hash["com/lguplus/aicallagent/network/client/ixio/IxIOSetupWizardServer.smali"] == after_hash["com/lguplus/aicallagent/network/client/ixio/IxIOSetupWizardServer.smali"],
        "original_member_service_unchanged": original_hash["com/lguplus/aicallagent/network/client/ixio/IxIOMemberServiceServer.smali"] == after_hash["com/lguplus/aicallagent/network/client/ixio/IxIOMemberServiceServer.smali"],
        "original_Aes256_unchanged": original_hash["com/lguplus/aicallagent/util/AES256Util.smali"] == after_hash["com/lguplus/aicallagent/util/AES256Util.smali"],
        "base_url": args.base_url,
    }
    assert all(report[k] is True for k in report if k.startswith("original_") and k.endswith("_unchanged"))
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print("EXACT_LOGIN_SERVER_ONLY=YES")
    print("CHANGED_CLASS_COUNT=1")
    print("ALL_OTHER_ORIGINAL_SMALI_PRESERVED=YES")


if __name__ == "__main__":
    main()
