#!/usr/bin/env python3
"""Verify complete original BitHuman public Essence 2 IMX files (not just URL grants).

All five public models are read from the official HTTPS download door and
checked against server metadata. Signed one-hour URLs never enter the report.
The model bytes are kept only on the ephemeral CI runner and are NOT rehosted.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path
from imx_v2 import parse, read_json_member, verify_member_hashes

SAMPLES = (
    ("A52DHS2219", "Sofia Ramirez"),
    ("A21SKT4314", "Warm Clear Presenter"),
    ("A62SJB3901", "Kwame Museum Guide"),
    ("A23KSG5258", "Astrophysics Mentor"),
    ("A24EKJ8433", "Calm Product Advisor"),
)


def grant(code):
    base = "https://api.bithuman.ai/v1/agent/" + urllib.parse.quote(code, safe="") + "/model/download"
    url = base + "?model=essence-2&redirect=false"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as response:
        obj = json.load(response)
    data = obj.get("data") or {}
    if not obj.get("success") or data.get("code") != code or data.get("model") != "essence-2":
        raise ValueError(f"{code}: invalid official grant")
    if data.get("filename") != code + ".imx" or int(data.get("size", 0)) <= 0:
        raise ValueError(f"{code}: bad model file metadata")
    if len(str(data.get("sha256", ""))) != 64:
        raise ValueError(f"{code}: missing SHA-256")
    if not str(data.get("url", "")).startswith("https://"):
        raise ValueError(f"{code}: signed HTTPS model URL missing")
    return data


def download_and_prove(code, label, root):
    data = grant(code)
    target = root / (code + ".imx")
    expected_size = int(data["size"])
    expected_sha = str(data["sha256"]).lower()
    sha = hashlib.sha256()
    n = 0
    try:
        with urllib.request.urlopen(data["url"], timeout=120) as response, target.open("xb") as dst:
            while True:
                block = response.read(1024 * 1024)
                if not block:
                    break
                sha.update(block)
                dst.write(block)
                n += len(block)
        if n != expected_size or sha.hexdigest() != expected_sha:
            raise ValueError(f"{code}: full downloaded file failed size/SHA-256")
        table = parse(target)
        validation = verify_member_hashes(target, table)
        if validation["mismatches"] or validation["checked"] == 0:
            raise ValueError(f"{code}: IMX manifest member SHA-256 failed/absent: {validation}")
        try:
            manifest = read_json_member(target, table, "manifest.json")
        except KeyError:
            raise ValueError(f"{code}: Essence 2 IMX has no manifest.json")
        names = [m["name"] for m in table["members"]]
        result = {
            "code": code,
            "name": label,
            "source": "https://api.bithuman.ai/v1/agent/" + code + "/model/download?model=essence-2",
            "filename": target.name,
            "bytes": n,
            "sha256": sha.hexdigest(),
            "imx_version": table["version"],
            "imx_member_count": table["member_count"],
            "manifest_keys": sorted(manifest.keys()),
            "members": [{ "name": m["name"], "bytes": m["size_bytes"] } for m in table["members"]],
            "hashed_members": validation["checked"],
            "verified_members": validation["ok"],
            "rehosted": False,
        }
        print(f"PASS_ESSENCE2_COMPLETE_IMX_{code}_BYTES_{n}_HASHES_{validation['ok']}", flush=True)
        return result
    finally:
        # This inventory does not distribute vendor model files in Actions artifacts.
        target.unlink(missing_ok=True)


def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--report", type=Path, required=True)
    args = p.parse_args()
    args.report.parent.mkdir(parents=True, exist_ok=True)
    results = []
    for code, label in SAMPLES:
        results.append(download_and_prove(code, label, args.report.parent))
        time.sleep(0.1)
    args.report.write_text(json.dumps({
        "source": "official BitHuman public showcase",
        "model": "essence-2",
        "verified_full_downloads": len(results),
        "models": results,
        "licensed_rendering_verified": False,
        "physical_Galaxy_Flip3_rendering_verified": False,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("PASS_ESSENCE2_FIVE_COMPLETE_ORIGINAL_IMX_AND_MANIFEST_HASHES", flush=True)


if __name__ == "__main__":
    main()
