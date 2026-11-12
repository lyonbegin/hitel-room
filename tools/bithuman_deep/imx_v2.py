#!/usr/bin/env python3
"""Read-only, vendor-independent bitHuman IMX v2 member table inspector.

Observed format from two publicly downloadable showcase samples:
  4 bytes magic b'IMX\\x00'
  uint16 little-endian version (2)
  uint16 little-endian member count
  repeat count times:
      uint16 little-endian UTF-8 name length
      UTF-8 member name
      uint64 little-endian absolute byte offset
      uint64 little-endian payload size
  following the index: raw member data at the specified offsets

This reconstructs the *container layout*, not avatar model training or inference.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import struct
from pathlib import Path, PurePosixPath
from typing import BinaryIO

MAGIC = bytes((73, 77, 88, 0))
MAX_MEMBERS = 5000
MAX_NAME = 8192


class IMXFormatError(ValueError):
    pass


def read_exact(stream: BinaryIO, count: int) -> bytes:
    block = stream.read(count)
    if len(block) != count:
        raise IMXFormatError("Truncated IMX container")
    return block


def safe_name(name: str) -> bool:
    if not name or "\x00" in name or "\\" in name or ":" in name:
        return False
    parts = PurePosixPath(name).parts
    return name[0] != "/" and bool(parts) and all(p not in ("..", ".", "") for p in name.split("/"))


def parse(path: Path) -> dict:
    path = Path(path)
    file_size = path.stat().st_size
    with path.open("rb") as stream:
        preamble = read_exact(stream, 8)
        if preamble[:4] != MAGIC:
            raise IMXFormatError("IMX v2 magic not found")
        version, count = struct.unpack("<HH", preamble[4:])
        if version != 2:
            raise IMXFormatError("Unsupported IMX format version: " + str(version))
        if count < 1 or count > MAX_MEMBERS:
            raise IMXFormatError("Invalid member count: " + str(count))
        members = []
        seen_names = set()
        for i in range(count):
            name_len = struct.unpack("<H", read_exact(stream, 2))[0]
            if name_len < 1 or name_len > MAX_NAME:
                raise IMXFormatError("Invalid member name length at index " + str(i))
            try:
                name = read_exact(stream, name_len).decode("utf-8")
            except UnicodeDecodeError as error:
                raise IMXFormatError("Non-UTF8 member name") from error
            offset, length = struct.unpack("<QQ", read_exact(stream, 16))
            if not safe_name(name):
                raise IMXFormatError("Unsafe member name: " + repr(name))
            if name in seen_names:
                raise IMXFormatError("Duplicate member name: " + name)
            seen_names.add(name)
            members.append({"name": name, "offset": offset, "size_bytes": length})
        table_bytes = stream.tell()
    prev_end = table_bytes
    gap_count = 0
    ordered = sorted(members, key=lambda entry: entry["offset"])
    for m in ordered:
        if m["offset"] < prev_end:
            raise IMXFormatError("Invalid/overlapping payload position: " + m["name"])
        if m["offset"] + m["size_bytes"] > file_size:
            raise IMXFormatError("Payload extends beyond the file: " + m["name"])
        gap_count += int(m["offset"] > prev_end)
        prev_end = m["offset"] + m["size_bytes"]
    return {
        "format": "IMX v2",
        "version": version,
        "member_count": count,
        "table_bytes": table_bytes,
        "file_size_bytes": file_size,
        "payload_bytes": sum(m["size_bytes"] for m in members),
        "index_gaps": gap_count,
        "trailing_bytes": file_size - prev_end,
        "members": members,
    }


def member_by_name(table: dict, name: str) -> dict:
    return next((m for m in table["members"] if m["name"] == name),
                None) or _raise_missing(name)


def _raise_missing(name):
    raise KeyError("IMX member not found: " + name)


def iter_chunks(path: Path, member: dict, chunk_size: int = 1024 * 1024):
    with Path(path).open("rb") as stream:
        stream.seek(member["offset"])
        remaining = member["size_bytes"]
        while remaining:
            block = read_exact(stream, min(remaining, chunk_size))
            remaining -= len(block)
            yield block


def member_sha256(path: Path, member: dict) -> str:
    sha = hashlib.sha256()
    for block in iter_chunks(path, member):
        sha.update(block)
    return sha.hexdigest()


def extract(path: Path, table: dict, name: str, directory: Path) -> Path:
    member = member_by_name(table, name)
    target_root = Path(directory).resolve()
    target_root.mkdir(parents=True, exist_ok=True)
    target = (target_root / name).resolve()
    if not target.is_relative_to(target_root):
        raise IMXFormatError("Extraction target escaped output directory")
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        raise FileExistsError("Refusing to overwrite: " + str(target))
    try:
        with target.open("xb") as output:
            for block in iter_chunks(path, member):
                output.write(block)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return target


def read_json_member(path: Path, table: dict, name: str):
    member = member_by_name(table, name)
    if member["size_bytes"] > 8 * 1024 * 1024:
        raise IMXFormatError("Refusing to read oversized JSON payload")
    raw = b"".join(iter_chunks(path, member))
    return json.loads(raw.decode("utf-8"))


def verify_member_hashes(path: Path, table: dict) -> dict:
    try:
        manifest = read_json_member(path, table, "manifest.json")
    except (KeyError, ValueError, UnicodeDecodeError):
        return {"available": False, "checked": 0, "ok": 0, "mismatches": [], "skipped": []}
    # Essence2 has complete members_sha256. Expression2 has per-file hashes under files.
    hashes = dict(manifest.get("members_sha256", {}))
    for value in manifest.get("files", {}).values():
        if isinstance(value, dict) and "path" in value and "sha256" in value:
            hashes.setdefault(value["path"], value["sha256"])
    names = {m["name"]: m for m in table["members"]}
    result = {"available": True, "checked": 0, "ok": 0, "mismatches": [], "skipped": []}
    for name, expected in hashes.items():
        if name not in names:
            result["skipped"].append(name)
            continue
        result["checked"] += 1
        if member_sha256(path, names[name]).lower() == str(expected).lower():
            result["ok"] += 1
        else:
            result["mismatches"].append(name)
    return result


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("imx", type=Path)
    p.add_argument("--list-json", action="store_true")
    p.add_argument("--verify", action="store_true")
    p.add_argument("--extract", action="append", default=[])
    p.add_argument("--output-dir", type=Path, default=Path("extracted-imx"))
    args = p.parse_args()
    table = parse(args.imx)
    if args.list_json:
        print(json.dumps(table, ensure_ascii=False, indent=2))
    else:
        print("IMX_VERSION=", table["version"], "FILES=", table["member_count"],
              "HEADER=", table["table_bytes"], "BYTES=", table["file_size_bytes"])
        for member in table["members"]:
            print(member["name"], member["offset"], member["size_bytes"])
    if args.verify:
        result = verify_member_hashes(args.imx, table)
        print("HASH_VERIFICATION", json.dumps(result, ensure_ascii=False))
        if result["mismatches"] or result["checked"] == 0:
            raise SystemExit(2)
    for name in args.extract:
        print("EXTRACTED", extract(args.imx, table, name, args.output_dir))


if __name__ == "__main__":
    main()
