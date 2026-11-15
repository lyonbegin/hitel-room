#!/usr/bin/env python3
"""Package reusable binary DEX payload captures and SHA-256 manifest.

Store only encrypted dump archive in public CI artifacts. Plaintext capture
is removed by the caller after this command completes.
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import subprocess
import sys
import tarfile

def main() -> int:
    package, source_name, destination_name = sys.argv[1:4]
    source = pathlib.Path(source_name)
    destination = pathlib.Path(destination_name)
    destination.mkdir(parents=True, exist_ok=True)
    records = []
    for file in sorted(source.rglob("*")):
        if not file.is_file():
            continue
        rel = str(file.relative_to(source))
        if len(rel) > 400 or file.stat().st_size > 150_000_000:
            continue
        head = file.open("rb").read(44)
        is_dex = len(head) >= 40 and head[:4] == b"dex\n" and head[7] == 0
        is_cdex = head[:4] == b"cdex"
        is_zip = head[:4] == b"PK\x03\x04"
        raw = file.read_bytes()
        records.append({
            "relative_path": rel,
            "source": "AppPealing" if "apppeal_dump/" in rel else "Frida/clsdumper",
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "magic": head[:12].hex(),
            "dex_header": is_dex,
            "cdex_header": is_cdex,
            "zip_header": is_zip
        })
    has_dex = any(e["dex_header"] or e["cdex_header"] for e in records)
    report = {
        "package": package,
        "dump_file_count": len(records),
        "valid_dex_or_cdex_count": sum(1 for e in records if e["dex_header"] or e["cdex_header"]),
        "capture_files": records,
        "claim": "runtime files observed" if records else "no runtime files observed"
    }
    (destination / "dump-manifest.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
    if not records:
        with (destination / "dump-status.txt").open("w") as out:
            out.write("NO_RUNTIME_FILES_FOUND; no reusable memory dump was created.\n")
        print(f"DEX_DUMP_{package}=NO_RUNTIME_FILES_FOUND")
        return 2
    temp_tar = destination / "runtime-dex-plaintext.tar.gz"
    with tarfile.open(temp_tar, "w:gz") as tar:
        for entry in records:
            tar.add(source / entry["relative_path"], arcname=entry["relative_path"])
    encrypted = destination / "DEX_ENCRYPTED.cms"
    cmd = ["openssl", "cms", "-encrypt", "-binary", "-aes256",
           "-in", str(temp_tar), "-out", str(encrypted),
           "-outform", "DER", "-recip", "tools/ixio/dump-public-20261115.crt"]
    p = subprocess.run(cmd, text=True, capture_output=True)
    temp_tar.unlink(missing_ok=True)
    if p.returncode:
        encrypted.unlink(missing_ok=True)
        print("ENCRYPTION_FAILED", p.stderr[-600:])
        return 3
    (destination / "encrypted-sha256.txt").write_text(
        hashlib.sha256(encrypted.read_bytes()).hexdigest()
        + "  DEX_ENCRYPTED.cms\n"
    )
    print(f"DEX_DUMP_{package}=ENCRYPTED_FILES={len(records)} VALID_DEX={report['valid_dex_or_cdex_count']}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
