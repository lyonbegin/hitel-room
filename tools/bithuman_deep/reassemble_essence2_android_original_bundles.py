#!/usr/bin/env python3
"""Reconstruct an ORIGINAL Essence2 Android store payload from the public IMX.

Uses the vendor's published Android manifest and member hashes as the oracle.
A portable IMX is NOT assumed to be an Android-ready model bundle.
Only unchanged bytes are extracted; absent Android-specific members are fetched
via the public official per-member API and verified against the official catalog.

This is an INTERNAL CI / debugging acquisition step. Vendor models are not
rehosted in artifacts/releases. It does not grant a runtime license.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import time
import urllib.parse
import urllib.request
from pathlib import Path

from imx_v2 import parse, member_sha256, member_by_name, extract, verify_member_hashes

SAMPLES = (
    ("A52DHS2219", "Sofia Ramirez"),
    ("A21SKT4314", "Warm Clear Presenter"),
    ("A62SJB3901", "Kwame Museum Guide"),
    ("A23KSG5258", "Astrophysics Mentor"),
    ("A24EKJ8433", "Calm Product Advisor"),
)
HEX = re.compile(r"^[0-9a-f]{64}$")
MAX_JSON_BYTES = 1024 * 1024


def verify_meta(meta, name):
    size = int(meta.get("bytes", 0))
    digest = str(meta.get("sha256", "")).lower()
    if size < 1 or not HEX.fullmatch(digest):
        raise ValueError(f"Bad official catalog size/hash for {name}")
    return size, digest


def public_grant(code, member=None):
    params = {"model": "essence-2", "redirect": "false"}
    if member is not None:
        params.update({"member": member, "plane": "android"})
    api = "https://api.bithuman.ai/v1/agent/" + urllib.parse.quote(code, safe="") + "/model/download"
    url = api + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=40) as res:
        data = res.read(MAX_JSON_BYTES + 1)
    if len(data) > MAX_JSON_BYTES:
        raise ValueError("Oversized vendor grant response")
    obj = json.loads(data)
    grant = obj.get("data") or {}
    if not obj.get("success") or grant.get("code") != code or grant.get("model") != "essence-2":
        raise ValueError(f"{code}: vendor refused official public sample/member grant")
    signed = str(grant.get("url", ""))
    if not signed.startswith("https://"):
        raise ValueError(f"{code}: no valid signed HTTPS member URL")
    if member is not None and grant.get("filename") != member:
        raise ValueError(f"{code}: wrong member grant for {member}")
    if member is None and grant.get("filename") != code + ".imx":
        raise ValueError(f"{code}: wrong IMX filename")
    return grant


def small_json(signed_url):
    req = urllib.request.Request(signed_url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=40) as res:
        payload = res.read(MAX_JSON_BYTES + 1)
    if len(payload) > MAX_JSON_BYTES:
        raise ValueError("Oversized vendor catalog JSON")
    return json.loads(payload), payload


def download(signed_url, target, size, sha256, *, block=1024 * 1024):
    if target.exists():
        raise FileExistsError(str(target))
    target.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    digest = hashlib.sha256()
    try:
        with urllib.request.urlopen(signed_url, timeout=150) as res, target.open("xb") as dst:
            while True:
                b = res.read(block)
                if not b:
                    break
                count += len(b)
                if count > size:
                    raise ValueError("File exceeds expected size")
                dst.write(b)
                digest.update(b)
        if count != size or digest.hexdigest() != sha256:
            raise ValueError(f"Actual payload size/SHA differs: {target.name}")
    except Exception:
        target.unlink(missing_ok=True)
        raise


def safe_member(name):
    p = Path(name)
    if not name or name.startswith("/") or "\\" in name or ":" in name or any(x in ("..", ".") for x in name.split("/")):
        raise ValueError(f"Unsafe member name: {name}")
    if str(p) != name:
        raise ValueError(f"Noncanonical member name: {name}")
    return p


def build(code, label, work, retain):
    sample = work / code
    sample.mkdir(parents=True, exist_ok=True)
    imx_path = sample / (code + ".imx")
    bundle = sample / "android"
    bundle.mkdir(parents=True, exist_ok=True)
    main = public_grant(code)
    expected_imx_bytes = int(main["size"])
    expected_imx_sha = str(main["sha256"]).lower()
    if not HEX.fullmatch(expected_imx_sha):
        raise ValueError("Invalid official IMX SHA")
    download(main["url"], imx_path, expected_imx_bytes, expected_imx_sha)
    table = parse(imx_path)
    members = {x["name"]: x for x in table["members"]}
    verification = verify_member_hashes(imx_path, table)
    if verification["mismatches"] or not verification["checked"]:
        raise AssertionError(f"{code}: original IMX member hash failure")

    grant = public_grant(code, "android_store.v1.json")
    catalog, raw_catalog = small_json(grant["url"])
    if catalog.get("agent") != code or catalog.get("format") != "essence2_android_store.v1":
        raise ValueError(f"{code}: invalid Android store catalog")
    files = catalog.get("files")
    if not isinstance(files, dict) or not files:
        raise ValueError("Empty Android member contract")
    (bundle / "android_store.v1.json").write_bytes(raw_catalog)
    manifest_name = catalog.get("manifest")
    if manifest_name != "manifest.json":
        raise ValueError("Unexpected original Android manifest filename")
    mbytes = int(catalog["manifest_bytes"])
    mhash = str(catalog["manifest_sha256"])
    if not HEX.fullmatch(mhash):
        raise ValueError("Android manifest digest invalid")
    manifest_grant = public_grant(code, manifest_name)
    download(manifest_grant["url"], bundle / manifest_name, mbytes, mhash)

    copied = []
    fetched = []
    for name, meta in sorted(files.items()):
        path = safe_member(name)
        n, h = verify_meta(meta, name)
        original = members.get(name)
        source_kind = "vendor-IMX-byte-identical"
        if original is not None and int(original["size_bytes"]) == n and member_sha256(imx_path, original) == h:
            output = extract(imx_path, table, name, bundle)
        else:
            source_kind = "original-Android-member-download"
            member_grant = public_grant(code, name)
            output = bundle / path
            download(member_grant["url"], output, n, h)
        digest = hashlib.sha256(output.read_bytes()).hexdigest() if n < 1024 * 1024 else None
        if digest is not None and digest != h:
            raise AssertionError(f"{code}/{name}: file content not SHA verified")
        (copied if source_kind == "vendor-IMX-byte-identical" else fetched).append(name)

    report = {
        "code": code, "label": label, "imx_sha256": expected_imx_sha,
        "imx_downloaded_and_verified": True, "android_store_catalog_verified": True,
        "android_manifest_sha256": mhash,
        "original_android_member_count": len(files),
        "members_identical_to_imx": copied,
        "members_fetched_from_android_store": fetched,
        "all_android_members_have_catalog_sha256": True,
        "android_bundle_dir": str(bundle) if retain else None,
        "vendor_sdk_runtime_license_validated": False,
        "android_native_engine_initialized": False,
        "model_data_distributed": False,
    }
    print(f"PASS_ESSENCE2_ANDROID_BUNDLE_ORIGINAL_BYTES_{code}_MEMBERS_{len(files)}_IMX_{len(copied)}_EXTRA_{len(fetched)}", flush=True)
    if not retain:
        shutil.rmtree(sample)
    else:
        imx_path.unlink()
    return report


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--code", choices=[c for c, _ in SAMPLES], help="One sample; omitted checks all five")
    p.add_argument("--work", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    p.add_argument("--retain-bundle", action="store_true")
    a = p.parse_args()
    a.work.mkdir(parents=True, exist_ok=True)
    chosen = [(code, name) for code, name in SAMPLES if not a.code or a.code == code]
    reports = [build(code, name, a.work, a.retain_bundle) for code, name in chosen]
    a.report.parent.mkdir(parents=True, exist_ok=True)
    a.report.write_text(json.dumps({
        "requested": len(chosen), "verified_complete_android_bundles": len(reports),
        "vendor_license_granted": False, "galaxy_rendering_tested": False,
        "models": reports,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"PASS_ESSENCE2_ANDROID_COMPLETE_VERIFIED_BUNDLES_{len(reports)}", flush=True)


if __name__ == "__main__":
    main()
