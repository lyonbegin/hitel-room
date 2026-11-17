#!/usr/bin/env python3
"""IXIO ORIGINAL APK -> HITEL login route only.

No other vendor endpoint host, storage, CTN/DEK cryptography, AI/STT, or recorder
method is modified. Only Retrofit annotations for named login methods are
redirected to the HITEL public QA endpoint. The enrollment decision can be
routed to HITEL login (not marked as verified); actual browser OAuth must follow.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re

BASE = "com/lguplus/aicallagent/"
LOGIN_API = BASE + "network/api/ixio/IxIOMemberServiceApi.smali"
AUTH_API = BASE + "network/api/ixio/IxIOAuthApi.smali"
ENTRY = BASE + "domain/init/usecase/ResolveOnboardingLoginEntryUseCase.smali"
LOGIN_ENTRY = BASE + "domain/init/usecase/OnboardingLoginEntry$Login.smali"
TARGETS = {
    LOGIN_API: {
        "getLoginData": ("GET", "login"),
        "getLoginDataV2": ("POST", "v2/login"),
        "getTokenData": ("POST", "auth-code"),
    },
    AUTH_API: {
        "postAutoLogin": ("POST", "autologin"),
    },
}
AUTH_GATE_METHOD = "invoke(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def exact_method(source: str, name: str) -> re.Match[str]:
    p = re.compile(r"(?ms)^\.method[^\n]*[ \t]" + re.escape(name)
                   + r"\([^)]*\)[^\n]*\n.*?^\.end method$")
    found = list(p.finditer(source))
    if len(found) != 1:
        raise AssertionError(f"Exactly one method {name} required, found {len(found)}")
    return found[0]


def patch_annotation(source: str, name: str, verb: str,
                     old: str, url: str) -> str:
    m = exact_method(source, name)
    section = m.group()
    pattern = re.compile(
        r"(?ms)(\.annotation runtime Lretrofit2/http/"
        + verb + r";\n\s+value = )" + re.escape(json.dumps(old))
        + r"(\n\s+\.end annotation)"
    )
    result, count = pattern.subn(lambda x: x.group(1) + json.dumps(url) + x.group(2),
                                 section)
    if count != 1:
        raise AssertionError(f"{name}: original {verb} {old} annotation not found exactly once: {count}")
    if result.replace(json.dumps(url), json.dumps(old), 1) != section:
        raise AssertionError(f"{name}: unexpected annotation side effect")
    return source[:m.start()] + result + source[m.end():]


def patch_entry(source: str) -> str:
    found = list(re.finditer(
        r"(?ms)^\.method[^\n]*[ \t]" + re.escape(AUTH_GATE_METHOD)
        + r"\n.*?^\.end method$", source,
    ))
    if len(found) != 1:
        raise AssertionError(f"Original login enrollment gate absent or ambiguous: {len(found)}")
    m = found[0]
    header = m.group().splitlines()[0]
    # Original invoke() first checks setup-wizard terms and default-SIM number,
    # and without a usable SIM returns OnboardingLoginEntry.Blocked before OAuth.
    # Route straight to the ORIGINAL browser Login entry; never claim verified
    # membership, never issue a token, and leave the original DEK/CTN crypto intact.
    new_method = (
        header + "\n"
        "    .registers 2\n"
        "    sget-object v0, Lcom/lguplus/aicallagent/domain/init/usecase/OnboardingLoginEntry$Login;->INSTANCE:"
        "Lcom/lguplus/aicallagent/domain/init/usecase/OnboardingLoginEntry$Login;\n"
        "    return-object v0\n"
        ".end method"
    )
    return source[:m.start()] + new_method + source[m.end():]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--smali16", type=Path, required=True)
    ap.add_argument("--smali15", type=Path, required=True)
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--report", type=Path, required=True)
    args = ap.parse_args()
    if not re.fullmatch(r"https://[a-z0-9-]+\.trycloudflare\.com/", args.base_url):
        raise ValueError("Expected one verified HTTPS QA URL (with trailing slash)")
    files16 = sorted(args.smali16.rglob("*.smali"))
    files15 = sorted(args.smali15.rglob("*.smali"))
    if len(files16) < 1000 or len(files15) < 1000:
        raise ValueError("Incomplete original DEX extraction")
    expected_paths = [(args.smali16 / p) for p in TARGETS]
    expected_paths.extend([args.smali15 / ENTRY, args.smali15 / LOGIN_ENTRY])
    if not all(p.is_file() for p in expected_paths):
        raise FileNotFoundError([str(p) for p in expected_paths if not p.is_file()])
    watched = files15 + files16
    original = {p: sha(p.read_bytes()) for p in watched}
    records = []
    for rel, methods in TARGETS.items():
        p = args.smali16 / rel
        src = p.read_text(encoding="utf8")
        for method, (verb, endpoint) in methods.items():
            src = patch_annotation(src, method, verb, endpoint, args.base_url + endpoint)
            records.append({"file": rel, "method": method, "old_path": endpoint,
                            "new_path": args.base_url + endpoint})
        p.write_text(src, encoding="utf8")
    gate = args.smali15 / ENTRY
    before_gate = gate.read_text(encoding="utf8")
    after_gate = patch_entry(before_gate)
    gate.write_text(after_gate, encoding="utf8")
    records.append({"file": ENTRY, "method": AUTH_GATE_METHOD,
                    "effect": "route pre-login invoke() to the original browser Login entry; preserve registration verifier unchanged"})

    current = {p: sha(p.read_bytes()) for p in watched}
    modified = {str(p.relative_to(args.smali16 if p in files16 else args.smali15))
                for p in watched if original[p] != current[p]}
    expected = set(TARGETS) | {ENTRY}
    if modified != expected:
        raise AssertionError({"unexpected_changes": sorted(modified ^ expected),
                              "modified": sorted(modified)})
    protected = [
        BASE + "util/EncryptCtnUtil.smali",
        BASE + "util/AES256Util.smali",
        BASE + "network/IXIBuildConfig$Api.smali",
        BASE + "network/client/RetrofitServiceFactory.smali",
        BASE + "network/client/BaseServer.smali",
        BASE + "network/client/ixio/IxIOAuthServer.smali",
        BASE + "network/client/ixio/IxIOSetupWizardServer.smali",
        BASE + "network/client/ixio/IxIOMemberServiceServer.smali",
        BASE + "datastore/extension/DataStoreExtensionKt.smali",
    ]
    for rel in protected:
        p = args.smali16 / rel
        if p not in original or original[p] != current[p]:
            raise AssertionError(f"Original protected implementation changed: {rel}")
    entry_code = (args.smali15 / LOGIN_ENTRY).read_text(errors="replace")
    if "INSTANCE:" not in entry_code:
        raise AssertionError("OnboardingLoginEntry.Login.INSTANCE not present in original class")
    report = {
        "scope": "LOGIN_ENDPOINT_ANNOTATIONS_AND_ONBOARDING_TO_HITEL_LOGIN_ONLY",
        "method_changes": records, "modified_files": sorted(modified),
        "modified_files_count": len(modified),
        "total_original_smali": len(watched),
        "original_encryption_and_ctn_unchanged": True,
        "original_recorder_stt_model_and_other_servers_unchanged": True,
        "original_membership_or_carrier_validity_not_asserted": True,
        "oauth_pkce_required": True,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print("LOGIN_ENDPOINTS_ONLY=YES")
    print("ORIGINAL_ALL_OTHER_SMALI_UNCHANGED=YES")
    print("MODIFIED_CLASSES=", sorted(modified))
    print("ORIGINAL_CTN_DEK_AES_MODEL_RECORDER_PRESERVED=YES")


if __name__ == "__main__":
    main()
