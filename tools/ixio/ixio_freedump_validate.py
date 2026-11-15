#!/usr/bin/env python3
"""Post-process upstream Freedump output; this program does NOT dump memory."""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import mmap
from pathlib import Path
import struct
import zipfile
import zlib


def original_dex_hashes(input_dir: Path) -> set[str]:
    found = set()
    sources = []
    main = input_dir / "main.xapk"
    recorder = input_dir / "recorder.apk"
    if main.exists():
        with zipfile.ZipFile(main) as outer:
            for entry in outer.namelist():
                if entry.endswith(".apk"):
                    sources.append(outer.read(entry))
    if recorder.exists():
        sources.append(recorder.read_bytes())
    for data in sources:
        with zipfile.ZipFile(io.BytesIO(data)) as apk:
            for name in apk.namelist():
                if Path(name).name.startswith("classes") and name.endswith(".dex"):
                    found.add(hashlib.sha256(apk.read(name)).hexdigest())
    return found


def scan_dex(mapped: mmap.mmap, existing: set[str], max_hits: int = 200) -> list[dict]:
    hits = []
    pos = 0
    length = len(mapped)
    while len(hits) < max_hits:
        pos = mapped.find(b"dex\n0", pos)
        if pos < 0:
            break
        if pos + 0x70 > length:
            break
        version = bytes(mapped[pos+4:pos+8])
        size = struct.unpack_from("<I", mapped, pos + 0x20)[0]
        header_size = struct.unpack_from("<I", mapped, pos + 0x24)[0]
        endian_tag = struct.unpack_from("<I", mapped, pos + 0x28)[0]
        class_count = struct.unpack_from("<I", mapped, pos + 0x60)[0]
        class_off = struct.unpack_from("<I", mapped, pos + 0x64)[0]
        plausible = (
            version[:3].isdigit() and version[3:4] == b"\x00"
            and header_size == 0x70 and endian_tag == 0x12345678
            and 0x70 <= size < 512 * 1024 * 1024
            and 0 <= class_count < 250000 and class_off <= size
            and (class_count == 0 or class_off + 32 * class_count <= size)
        )
        if plausible:
            complete = pos + size <= length
            hit = {
                "offset": pos,
                "dex_version": version[:3].decode("ascii", "replace"),
                "claimed_size": size,
                "class_defs_count": class_count,
                "complete_in_memory_region": complete,
            }
            if complete:
                blob = mapped[pos:pos + size]
                digest = hashlib.sha256(blob).hexdigest()
                hit["sha256"] = digest
                hit["matches_original_unprotected_dex"] = digest in existing
                hit["sha1_signature_matches"] = hashlib.sha1(blob[32:]).digest() == blob[12:32]
                hit["adler32_checksum_matches"] = (
                    zlib.adler32(blob[12:]) & 0xffffffff
                ) == struct.unpack_from("<I", blob, 8)[0]
                hit["contains_ixio_package_descriptor"] = (
                    b"Lcom/lguplus/aicallagent/" in blob
                    or b"Lcom/lguplus/callrecorder/" in blob
                )
            hits.append(hit)
        pos += 1
    return hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--directory", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--originals", default=".ixio-inputs")
    args = ap.parse_args()
    root = Path(args.directory)
    existing = original_dex_hashes(Path(args.originals))
    report = {
        "tool": "androguard/freedump (upstream, only API compatibility fixes)",
        "tool_is_source_of_memory_dump": True,
        "original_dex_hash_count": len(existing),
        "region_files": [],
        "dex_candidate_count": 0,
        "complete_candidate_count": 0,
        "complete_candidate_not_identical_to_original_count": 0,
        "verified_checksum_candidate_count": 0,
        "note": "A DEX header/namespace string is not proof of app-owned executable class definitions or STT path.",
    }
    for f in sorted(root.rglob("*.dump")):
        if f.stat().st_size == 0:
            continue
        with f.open("rb") as src, mmap.mmap(src.fileno(), 0, access=mmap.ACCESS_READ) as m:
            hits = scan_dex(m, existing)
        report["region_files"].append({"file": str(f.relative_to(root)), "bytes": f.stat().st_size, "dex_candidates": hits})
        report["dex_candidate_count"] += len(hits)
        report["complete_candidate_count"] += sum(x["complete_in_memory_region"] for x in hits)
        report["complete_candidate_not_identical_to_original_count"] += sum(
            x["complete_in_memory_region"] and not x.get("matches_original_unprotected_dex", False)
            for x in hits
        )
        report["verified_checksum_candidate_count"] += sum(
            x.get("sha1_signature_matches", False) and x.get("adler32_checksum_matches", False)
            for x in hits
        )
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k!="region_files"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
