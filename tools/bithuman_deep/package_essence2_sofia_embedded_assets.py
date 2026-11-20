#!/usr/bin/env python3
"""Stage ONE original Android model into a *temporary* local APK build directory.

Use only when the builder has distribution rights for the model. This script
does not publish the model, an APK, or a GitHub artifact containing model bytes.
All file sizes and SHA-256 hashes are checked against the vendor Android catalog.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
import zipfile
from pathlib import Path

from reassemble_essence2_android_original_bundles import (
    download, public_grant, safe_member, verify_meta,
)

CODE = "A52DHS2219"
PREFIX = f"assets/hitel_essence2_embedded/{CODE}/"
ASSET_DIR = f"hitel_essence2_embedded/{CODE}"


def expected(catalog):
    if catalog.get("agent") != CODE or catalog.get("format") != "essence2_android_store.v1":
        raise ValueError("Wrong Sofia Android model catalog")
    if catalog.get("manifest") != "manifest.json":
        raise ValueError("Wrong Android model manifest")
    values = {
        "manifest.json": (int(catalog["manifest_bytes"]), catalog["manifest_sha256"])
    }
    for group in ("files", "optional"):
        for name, meta in (catalog.get(group) or {}).items():
            safe_member(name)
            if name in values:
                raise ValueError(f"Duplicate Android member: {name}")
            values[name] = verify_meta(meta, name)
    return values


def hash_stream(source):
    digest = hashlib.sha256()
    length = 0
    while True:
        chunk = source.read(1024 * 1024)
        if not chunk:
            break
        digest.update(chunk)
        length += len(chunk)
    return length, digest.hexdigest()


def verify_file(path, spec):
    with path.open("rb") as f:
        size, sha = hash_stream(f)
    if size != spec[0] or sha != spec[1]:
        raise ValueError(f"SIZE/SHA mismatch for {path}")
    return size, sha


def package(source, app, report):
    catalog_file = source / "android_store.v1.json"
    if not catalog_file.is_file():
        raise FileNotFoundError("Verified vendor Android catalog was not supplied")
    catalog_raw = catalog_file.read_bytes()
    if len(catalog_raw) > 1048576:
        raise ValueError("Catalog too large")
    catalog = json.loads(catalog_raw)
    files = expected(catalog)
    for name, spec in files.items():
        path = source / safe_member(name)
        if not path.is_file():
            # Android-specific optional GPU resources are not contained in the IMX.
            grant = public_grant(CODE, name)
            download(grant["url"], path, spec[0], spec[1])
        verify_file(path, spec)

    dest = app / "android/app/src/main/assets" / ASSET_DIR
    if dest.exists():
        raise FileExistsError(f"Refusing to overlay pre-existing APK asset directory: {dest}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, dest)
    checked = []
    for name, spec in files.items():
        size, sha = verify_file(dest / safe_member(name), spec)
        checked.append({"member": name, "bytes": size, "sha256": sha})
    total = sum(x["bytes"] for x in checked)
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({
        "code": CODE, "catalog_sha256": hashlib.sha256(catalog_raw).hexdigest(),
        "model_members": checked, "count": len(checked), "total_bytes": total,
        "apk_asset_prefix": PREFIX,
        "model_redistribution_permission_checked_by_builder": False,
    }, indent=2) + "\n")
    print(f"PASS_SOFIA_EMBEDDED_INPUT_FILES_SHA_VERIFIED members={len(checked)} bytes={total}", flush=True)


def check_apk(apk, report):
    data = json.loads(report.read_text())
    with zipfile.ZipFile(apk) as archive:
        listed = set(archive.namelist())
        catalog_name = PREFIX + "android_store.v1.json"
        if catalog_name not in listed:
            raise ValueError("ANDROID APK DOES NOT INCLUDE SOFIA CATALOG")
        with archive.open(catalog_name) as stream:
            _, actual = hash_stream(stream)
        if actual != data["catalog_sha256"]:
            raise ValueError("Embedded catalog SHA mismatch")
        for member in data["model_members"]:
            name = PREFIX + member["member"]
            if name not in listed:
                raise ValueError(f"Missing model asset from real APK: {name}")
            with archive.open(name) as stream:
                n, h = hash_stream(stream)
            if n != member["bytes"] or h != member["sha256"]:
                raise ValueError(f"ZIP entry size/SHA mismatch: {name}")
    print("PASS_SOFIA_ORIGINAL_MODEL_BYTES_REAL_APK_EMBEDDED_AND_VERIFIED", flush=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source", type=Path)
    p.add_argument("--app", type=Path)
    p.add_argument("--report", type=Path, required=True)
    p.add_argument("--apk", type=Path)
    args = p.parse_args()
    if args.apk:
        check_apk(args.apk, args.report)
    else:
        if not args.source or not args.app:
            p.error("--source and --app required when packaging")
        package(args.source, args.app, args.report)


if __name__ == "__main__":
    main()
