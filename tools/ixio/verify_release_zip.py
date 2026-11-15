#!/usr/bin/env python3
"""Verify user-provided GitHub Release ZIP and extract only exact known APK originals."""
import hashlib
import json
import pathlib
import shutil
import sys
import zipfile

EXPECTED = {
    "main.xapk": ("4ec4793327930e72589c1d47e552e1e77f97ccf77db71c63c701934f2337a3fc", 99164559),
    "recorder.apk": ("3cf822dda33eeef28ec3b85cb5872182371c92d07ed100e3a0fab71fbf1a37d7", 30313857),
}

def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: verify_release_zip.py ARCHIVE.zip OUTPUT_DIRECTORY")
    src = pathlib.Path(sys.argv[1])
    out = pathlib.Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    found = set()
    manifest = []
    with zipfile.ZipFile(src) as zf:
        for n, info in enumerate(zf.infolist()):
            if info.is_dir():
                continue
            if n > 1000:
                raise RuntimeError("Unreasonable archive entry count")
            if info.file_size > 200_000_000:
                raise RuntimeError("Oversized entry")
            dest = out / f".ixio_entry_{n}.tmp"
            h = hashlib.sha256()
            copied = 0
            with zf.open(info) as i, open(dest, "wb") as o:
                while True:
                    chunk = i.read(1024 * 1024)
                    if not chunk:
                        break
                    copied += len(chunk)
                    h.update(chunk)
                    o.write(chunk)
            digest = h.hexdigest()
            match = None
            for label, (expected_hash, expected_size) in EXPECTED.items():
                if digest == expected_hash and copied == expected_size:
                    match = label
                    break
            manifest.append({"zip_entry": info.filename, "bytes": copied, "sha256": digest, "matches_expected": match})
            if match:
                shutil.move(dest, out / match)
                found.add(match)
            else:
                dest.unlink()
    print(json.dumps({"entry_manifest": manifest, "exact_hash_matches": sorted(found)}, ensure_ascii=False, indent=2))
    if set(EXPECTED) != found:
        raise SystemExit("Missing expected exact-hash original(s): " + repr(set(EXPECTED) - found))
    print("IXIO_BOTH_ORIGINALS_VERIFIED=YES")

if __name__ == "__main__":
    main()
