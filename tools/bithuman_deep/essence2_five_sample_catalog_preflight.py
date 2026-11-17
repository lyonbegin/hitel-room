#!/usr/bin/env python3
"""Public Essence 2 Android-model catalog preflight.

Checks all five BitHuman-owned sample download grants, not model payloads.
Never prints or persists signed URLs, tokens, cookies, or credentials.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

SAMPLES = (
    ("A52DHS2219", "Sofia Ramirez"),
    ("A21SKT4314", "Warm Clear Presenter"),
    ("A62SJB3901", "Kwame Museum Guide"),
    ("A23KSG5258", "Astrophysics Mentor"),
    ("A24EKJ8433", "Calm Product Advisor"),
)


def fetch_json(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "HITEL-Essence2-public-sample-preflight/1.0",
        "Accept": "application/json",
    })
    with urllib.request.urlopen(req, timeout=25) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status}")
        return json.load(response)


def check(code, label):
    quoted = urllib.parse.quote(code, safe="")
    base = f"https://api.bithuman.ai/v1/agent/{quoted}/model/download?model=essence-2"
    grant = fetch_json(base + "&redirect=false")
    data = grant.get("data") or {}
    if not grant.get("success") or data.get("code") != code or data.get("model") != "essence-2":
        raise ValueError(f"{code}: invalid official model grant response")
    if data.get("filename") != f"{code}.imx" or not data.get("size", 0) > 0:
        raise ValueError(f"{code}: invalid model file metadata")
    sha = data.get("sha256", "")
    if not isinstance(sha, str) or len(sha) != 64 or not all(c in "0123456789abcdef" for c in sha):
        raise ValueError(f"{code}: invalid sha256")
    if not str(data.get("url", "")).startswith("https://"):
        raise ValueError(f"{code}: missing signed-download HTTPS URL")
    android_url = base + "&member=android_store.v1.json&plane=android&redirect=false"
    android_grant = fetch_json(android_url)
    android = android_grant.get("data") or {}
    if (not android_grant.get("success") or android.get("code") != code or
            android.get("filename") != "android_store.v1.json" or
            not str(android.get("url", "")).startswith("https://")):
        raise ValueError(f"{code}: Android store manifest not publicly resolvable")
    return {
        "name": label, "code": code, "filename": data["filename"],
        "bytes": data["size"], "sha256": sha, "android_catalog_grant": True,
        "download_api": base, "complete_model_payload_downloaded": False,
    }


def main():
    destination = Path(sys.argv[1] if len(sys.argv) > 1 else "essence2-public-grants.json")
    ok = []
    for code, label in SAMPLES:
        result = check(code, label)
        ok.append(result)
        print(f"PASS_ESSENCE2_MODEL_AND_ANDROID_CATALOG_GRANT_{code}")
        time.sleep(0.15)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps({
        "samples": ok,
        "verified_grants": len(ok),
        "native_sdk_tested": False,
        "runtime_vendor_entitlement_verified": False,
        "model_files_downloaded": False,
    }, indent=2) + "\n", encoding="utf-8")
    print("PASS_ESSENCE2_FIVE_PUBLIC_MODEL_GRANTS_NO_SECRETS")


if __name__ == "__main__":
    main()
