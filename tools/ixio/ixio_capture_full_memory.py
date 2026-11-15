#!/usr/bin/env python3
"""Capture *all readable VMAs* of every live target PID, no DEX selection.

Raw binary is streamed from /proc/PID/mem into a temporary gzip and encrypted
before leaving the runner. The plaintext is never uploaded. Failed pages and
VMAs without read permission are explicitly recorded as NOT captured.

This is one point-in-time memory snapshot, not proof of historical completeness.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import sys
import tempfile
from datetime import datetime, timezone

PACKAGES = ("com.lguplus.aicallagent", "com.lguplus.callrecorder")
MAGIC = b"IXIOMEM1"


def cmd(*argv: str, check: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(argv, capture_output=True, text=True, check=check)


def target_pids() -> dict[str, list[int]]:
    # Start observing BEFORE we conclude no PID exists: monkey launch can return
    # before the Android zygote has forked the application process.
    import time
    found: dict[str, set[int]] = {k: set() for k in PACKAGES}
    first_observed = None
    deadline = time.monotonic() + 8.0
    last_error = ""
    while time.monotonic() < deadline:
        p = cmd("adb", "shell", "ps", "-A", "-o", "PID,NAME")
        if p.returncode:
            last_error = p.stderr[-500:]
        else:
            for line in p.stdout.splitlines():
                cols = line.strip().split()
                if len(cols) < 2 or not cols[0].isdigit():
                    continue
                pid, name = int(cols[0]), cols[-1]
                for package in PACKAGES:
                    if name == package or name.startswith(package + ":"):
                        found[package].add(pid)
        # Android toybox ps implementations can truncate NAME. Cross-check pidof.
        for package in PACKAGES:
            check = cmd("adb", "shell", "pidof", package)
            for val in check.stdout.split():
                if val.isdigit():
                    found[package].add(int(val))
        if any(found.values()):
            if first_observed is None:
                first_observed = time.monotonic()
            # Observe briefly for remote/service PIDs spawned after main PID.
            if time.monotonic() - first_observed >= 1.0:
                break
        time.sleep(0.12)
    if not any(found.values()) and last_error:
        raise RuntimeError("Neither ps nor pidof found an app process: " + last_error)
    return {k: sorted(v) for k, v in found.items()}


def originals(base: Path, package: str) -> dict[str, Path]:
    if package == "com.lguplus.aicallagent":
        folder = base / "main-splits"
        return {p.name: p for p in folder.glob("*.apk") if p.is_file()}
    src = base / "recorder.apk"
    return {"base.apk": src} if src.exists() else {}


def read_exact(stream, length: int) -> bytes:
    chunks: list[bytes] = []
    needed = length
    while needed:
        data = stream.read(needed)
        if not data:
            raise EOFError(f"Stream truncated: missing {needed} of {length} bytes")
        chunks.append(data)
        needed -= len(data)
    return b"".join(chunks)


def merge_ranges(ranges: list[tuple[int, int]]) -> int:
    if not ranges:
        return 0
    merged = []
    for lo, hi in sorted(ranges):
        if merged and lo <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], hi))
        else:
            merged.append((lo, hi))
    return sum(b - a for a, b in merged)


def capture_one(package: str, pid: int, stage: str, dest: Path, base: Path,
                cert: Path) -> dict:
    dest.mkdir(parents=True, exist_ok=True)
    prefix = f"{package}-{stage}-{pid}"
    # Temporary plaintext is kept outside artifact folders, removed in finally.
    with tempfile.TemporaryDirectory(prefix="ixio-vma-private-") as tmpname:
        tmp = Path(tmpname)
        plaintext = tmp / "memory.stream.gz"
        files = originals(base, package)
        file_infos = {name: {"bytes": p.stat().st_size,
                              "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                              "mapped_file_ranges": [],
                              "copied_file_ranges": [],
                              "exact_bytes": 0,
                              "different_bytes": 0}
                      for name, p in files.items()}
        handles = {name: p.open("rb") for name, p in files.items()}
        report = {
            "package": package, "stage": stage, "pid": pid,
            "captured_at_utc": datetime.now(timezone.utc).isoformat(),
            "originals": file_infos, "vma_count": 0,
            "readable_vma_count": 0, "unreadable_vma_count": 0,
            "readable_virtual_bytes": 0, "nonreadable_virtual_bytes": 0,
            "read_success_bytes": 0, "read_failed_bytes": 0,
            "read_error_count": 0, "all_readable_bytes_captured": False,
            "stream_completed": False, "encrypted_dump_file": None,
            "capture_error": None, "vmas": [],
        }
        proc = None
        current = None
        try:
            proc = subprocess.Popen(
                ["adb", "exec-out", "su", "-c",
                 f"/data/local/tmp/ixio_vma_dump {pid}"],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0)
            assert proc.stdout is not None
            with plaintext.open("wb") as target:
                with gzip.GzipFile(fileobj=target, mode="wb", compresslevel=3) as zipped:
                    def take(n: int) -> bytes:
                        blob = read_exact(proc.stdout, n)
                        zipped.write(blob)
                        return blob

                    if take(8) != MAGIC:
                        raise ValueError("Missing expected IXIOMEM1 stream header")

                    while True:
                        tag = take(1)
                        if tag == b"Z":
                            report["stream_completed"] = True
                            break
                        if tag == b"M":
                            lo, hi, offset = struct.unpack("<QQQ", take(24))
                            perms = take(4).decode("ascii", errors="replace")
                            (plen,) = struct.unpack("<H", take(2))
                            path = take(plen).decode("utf-8", errors="replace")
                            if hi < lo:
                                raise ValueError("invalid VMA bounds")
                            cur = {"start": f"0x{lo:x}", "end": f"0x{hi:x}",
                                   "file_offset": offset, "permissions": perms,
                                   "path": path, "bytes": hi - lo,
                                   "dumped_bytes": 0, "failed_bytes": 0}
                            report["vmas"].append(cur)
                            report["vma_count"] += 1
                            current = (lo, hi, offset, perms, path, cur)
                            if perms.startswith("r"):
                                report["readable_vma_count"] += 1
                                report["readable_virtual_bytes"] += hi - lo
                            else:
                                report["unreadable_vma_count"] += 1
                                report["nonreadable_virtual_bytes"] += hi - lo
                            basename = Path(path.split(" (deleted)")[0]).name
                            # Only match installed app APK paths, not system APKs.
                            if basename in file_infos and "/data/app/" in path:
                                file_size = file_infos[basename]["bytes"]
                                top = min(file_size, offset + (hi - lo))
                                if top > offset:
                                    file_infos[basename]["mapped_file_ranges"].append((offset, top))
                            continue
                        if tag == b"D":
                            addr, size = struct.unpack("<QI", take(12))
                            if size > 65536:
                                raise ValueError("chunk too large")
                            data = take(size)
                            if current is None or not (current[0] <= addr and addr + size <= current[1]):
                                raise ValueError("data outside current VMA")
                            report["read_success_bytes"] += size
                            current[5]["dumped_bytes"] += size
                            lo, hi, offset, perms, path, cur = current
                            basename = Path(path.split(" (deleted)")[0]).name
                            if basename in handles and "/data/app/" in path:
                                file_offset = offset + addr - lo
                                f = handles[basename]
                                if file_offset < file_infos[basename]["bytes"]:
                                    f.seek(file_offset)
                                    expected = f.read(size)
                                    n = len(expected)
                                    file_infos[basename]["exact_bytes"] += sum(a == b for a, b in zip(data[:n], expected))
                                    file_infos[basename]["different_bytes"] += sum(a != b for a, b in zip(data[:n], expected))
                                    file_infos[basename]["copied_file_ranges"].append((file_offset, file_offset + n))
                            continue
                        if tag == b"X":
                            addr, size, errno = struct.unpack("<QII", take(16))
                            if current is None or not (current[0] <= addr and addr + size <= current[1]):
                                raise ValueError("failure outside current VMA")
                            report["read_failed_bytes"] += size
                            report["read_error_count"] += 1
                            current[5]["failed_bytes"] += size
                            cur = current[5]
                            errors = cur.setdefault("errno_histogram", {})
                            errors[str(errno)] = errors.get(str(errno), 0) + 1
                            continue
                        raise ValueError("Unknown stream record: " + repr(tag))
            code = proc.wait(timeout=30)
            if code:
                stderr = (proc.stderr.read(1024) if proc.stderr else b"").decode(errors="replace")
                raise RuntimeError(f"collector exited {code}: {stderr[:500]}")
        except Exception as exc:
            report["capture_error"] = f"{type(exc).__name__}: {exc}"
            if proc and proc.poll() is None:
                proc.kill()
                proc.wait()
        finally:
            for handle in handles.values():
                handle.close()

        report["all_readable_bytes_captured"] = bool(
            report["stream_completed"] and report["capture_error"] is None
            and report["read_failed_bytes"] == 0
            and report["read_success_bytes"] == report["readable_virtual_bytes"])
        for item in file_infos.values():
            ranges = item.pop("mapped_file_ranges")
            copied = item.pop("copied_file_ranges")
            item["mapped_source_bytes"] = merge_ranges(ranges)
            item["dumped_comparable_source_bytes"] = merge_ranges(copied)
            item["source_bytes_not_observed_in_file_mapping"] = (
                item["bytes"] - item["mapped_source_bytes"])
        # Encrypt *every* captured byte in source stream. Never publish plaintext.
        if plaintext.exists() and plaintext.stat().st_size and cert.exists():
            encrypted = dest / f"{prefix}.cms"
            r = cmd("openssl", "cms", "-encrypt", "-binary", "-aes256",
                    "-in", str(plaintext), "-out", str(encrypted),
                    "-outform", "DER", "-recip", str(cert))
            if r.returncode == 0:
                report["encrypted_dump_file"] = encrypted.name
                report["encrypted_dump_sha256"] = hashlib.sha256(encrypted.read_bytes()).hexdigest()
            else:
                encrypted.unlink(missing_ok=True)
                report["encryption_error"] = r.stderr[-600:]
        (dest / f"{prefix}.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print("IXIO_MEM_CAPTURE", package, stage, pid,
              "VMAS", report["vma_count"],
              "READ", report["read_success_bytes"],
              "FAILED", report["read_failed_bytes"],
              "COMPLETE", report["all_readable_bytes_captured"],
              "ENCRYPTED", bool(report["encrypted_dump_file"]), flush=True)
        return report


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", required=True)
    ap.add_argument("--out", default="ixio-lab-results/full-memory")
    ap.add_argument("--originals", default=".ixio-inputs")
    ap.add_argument("--cert", default="tools/ixio/dump-public-20261115.crt")
    args = ap.parse_args()
    dest = Path(args.out)
    dest.mkdir(parents=True, exist_ok=True)
    try:
        found = target_pids()
    except Exception as e:
        (dest / f"process-discovery-{args.stage}.json").write_text(
            json.dumps({"stage": args.stage, "error": str(e)}))
        return 2
    result = {"stage": args.stage, "pids": found, "captures": []}
    for package, pids in found.items():
        for pid in pids:
            result["captures"].append(
                capture_one(package, pid, args.stage, dest, Path(args.originals), Path(args.cert)))
    (dest / f"process-discovery-{args.stage}.json").write_text(
        json.dumps({"stage": args.stage, "pids": found,
                    "results": [{"pid": x["pid"], "package": x["package"],
                                 "readable": x["readable_virtual_bytes"],
                                 "dumped": x["read_success_bytes"],
                                 "failed": x["read_failed_bytes"],
                                 "complete": x["all_readable_bytes_captured"]}
                                for x in result["captures"]]}, ensure_ascii=False, indent=2))
    if not result["captures"]:
        print("IXIO_NO_LIVE_PROCESS", args.stage, flush=True)
        return 3
    return 0 if all(c["all_readable_bytes_captured"] and c["encrypted_dump_file"]
                    for c in result["captures"]) else 4


if __name__ == "__main__":
    sys.exit(main())
