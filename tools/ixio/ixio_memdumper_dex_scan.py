#!/usr/bin/env python3
"""Analyze plaintext from upstream MemDumper BEFORE encryption; never uploads DEX."""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from ixio_freedump_validate import original_dex_hashes, scan_dex


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--directory", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--originals", default=".ixio-inputs")
    args = parser.parse_args()

    manifest = json.loads(Path(args.manifest).read_text())
    root = Path(args.directory)
    originals = original_dex_hashes(Path(args.originals))
    planned = sorted(manifest["planned_chunks"], key=lambda x:int(x["start"],16))
    # Rejoin only consecutive, fully read address chunks. Missing bytes are
    # never filled or declared recovered.
    segments = []
    current = None
    for part in planned:
        fn = root / part["name"]
        data = fn.read_bytes() if fn.is_file() else b""
        if len(data) != part["bytes"]:
            if current:
                segments.append(current)
            current = None
            continue
        start = int(part["start"],16)
        stop = int(part["end"],16)
        same = current and current["end"]==start and current["kind"]==part["kind"] and current["source_path"]==part["source_path"]
        if not same:
            if current:
                segments.append(current)
            current = {"start":start,"end":stop,"kind":part["kind"],"source_path":part["source_path"],"data":bytearray()}
        current["data"].extend(data)
        current["end"] = stop
    if current:
        segments.append(current)

    report = {
        "package": manifest["package"],
        "upstream_dumper": "kp7742/MemDumper",
        "analyzer_only": True,
        "planned_chunks": len(planned),
        "complete_contiguous_segments": len(segments),
        "source_original_dex_sha256_count": len(originals),
        "potential_dex_headers":0,
        "complete_dex_images":0,
        "new_complete_dex_images":0,
        "valid_full_dex_checksums":0,
        "new_complete_with_app_descriptor":0,
        "segmented_memory":[],
        "note": "A detected DEX header or class name is not proof of executable method recovery or telephony audio access.",
    }
    for region in segments:
        buf = bytes(region.pop("data"))
        hits = scan_dex(buf, originals, max_hits=200)
        record = {"start":hex(region["start"]),"end":hex(region["end"]),
                  "kind":region["kind"],"source_path":region["source_path"],
                  "read_bytes":len(buf),"dex_candidates":hits}
        report["segmented_memory"].append(record)
        report["potential_dex_headers"] += len(hits)
        report["complete_dex_images"] += sum(x["complete_in_memory_region"] for x in hits)
        report["new_complete_dex_images"] += sum(x["complete_in_memory_region"] and not x.get("matches_original_unprotected_dex",False) for x in hits)
        report["valid_full_dex_checksums"] += sum(x.get("sha1_signature_matches",False) and x.get("adler32_checksum_matches",False) for x in hits)
        report["new_complete_with_app_descriptor"] += sum(
            x["complete_in_memory_region"]
            and not x.get("matches_original_unprotected_dex",False)
            and x.get("contains_ixio_package_descriptor",False)
            for x in hits)
    Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({k:v for k,v in report.items() if k!="segmented_memory"},ensure_ascii=False))


if __name__=="__main__":
    main()
