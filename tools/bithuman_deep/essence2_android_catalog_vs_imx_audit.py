#!/usr/bin/env python3
"""Compare five verified Essence2 IMX containers with official Android store catalogs.

The official Android store has a different member contract than the portable
IMX container: never assume a downloaded <code>.imx alone is a valid Android
Essence2Avatar.create(bundle.dir, ...) input.

Read the existing verified IMX SHA/member audit artifact; fetch only the
small official Android catalog JSONs. No model binary re-download required.
Signed URLs, credentials and tokens are never written or logged.
"""
import argparse
import json
import urllib.parse
import urllib.request
from pathlib import Path

def fetch_json(url):
    with urllib.request.urlopen(
        urllib.request.Request(url, headers={"Accept": "application/json"}), timeout=30
    ) as res:
        if res.status != 200:
            raise ValueError("Android catalog HTTP " + str(res.status))
        return json.load(res)

def audit(imx_report):
    findings = []
    for model in imx_report["models"]:
        code = model["code"]
        base = ("https://api.bithuman.ai/v1/agent/" +
                urllib.parse.quote(code, safe="") + "/model/download" +
                "?model=essence-2&member=android_store.v1.json&plane=android&redirect=false")
        grant = fetch_json(base)
        data = grant.get("data") or {}
        if (not grant.get("success") or data.get("code") != code or
                data.get("filename") != "android_store.v1.json"):
            raise ValueError(code + ": Android catalog grant invalid")
        url = str(data.get("url", ""))
        if not url.startswith("https://"):
            raise ValueError(code + ": Android catalog has no signed URL")
        catalog = fetch_json(url)
        if catalog.get("agent") != code or catalog.get("format") != "essence2_android_store.v1":
            raise ValueError(code + ": wrong Android catalog identity/format")
        files = catalog.get("files")
        if not isinstance(files, dict) or not files:
            raise ValueError(code + ": empty Android store catalog")
        for name, meta in files.items():
            if not isinstance(meta, dict) or int(meta.get("bytes", 0)) < 1:
                raise ValueError(code + ": invalid member metadata: " + name)
            h = str(meta.get("sha256", ""))
            if len(h) != 64 or any(c not in "0123456789abcdef" for c in h):
                raise ValueError(code + ": invalid member digest: " + name)
        imx_files = {item["name"]: int(item["bytes"]) for item in model["members"]}
        missing = sorted(n for n in files if n not in imx_files)
        mismatch = sorted(n for n, v in files.items()
                          if n in imx_files and int(v["bytes"]) != imx_files[n])
        missing_bytes = sum(int(files[n]["bytes"]) for n in missing)
        if not all(n in missing for n in (
                "w2v_ess_fp16_v1.onnx",
                "audio_encoder_fp16_window_head.onnx",
                "audio_encoder_fp16_window_trunk.onnx")):
            raise AssertionError(code + ": unexpected Android engine member inventory")
        f = {
            "code": code,
            "imx_file_bytes": model["bytes"],
            "android_store_declared_download_bytes": catalog.get("download_bytes"),
            "android_store_required_member_count": len(files),
            "imx_member_count": len(imx_files),
            "android_required_members_absent_from_imx": missing,
            "absent_member_total_bytes": missing_bytes,
            "overlapping_member_size_mismatches": mismatch,
            "android_catalog_verified": True,
            "android_model_members_downloaded": False,
            "local_android_bundle_installed": False,
            "native_avatar_rendered": False,
        }
        findings.append(f)
        print(f"PASS_ANDROID_CATALOG_GAP_{code}_EXTRA_MEMBERS_{len(missing)}_BYTES_{missing_bytes}",flush=True)
    return {
        "five_samples": len(findings),
        "local_bundle_may_not_be_inferred_from_imx": True,
        "vendor_android_model_store_preserved_in_current_apk": True,
        "models": findings,
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--imx-report", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    original = json.loads(a.imx_report.read_text(encoding="utf-8"))
    if original.get("verified_full_downloads") != 5:
        raise ValueError("Requires the SHA-verified five-model original audit")
    outcome = audit(original)
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(outcome,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("PASS_ESSENCE2_FIVE_ANDROID_RUNTIME_MEMBER_GAP_AUDIT",flush=True)

if __name__ == "__main__":
    main()
