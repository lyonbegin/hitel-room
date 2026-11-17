#!/usr/bin/env python3
"""Samsung RTL browser/RDB connection and original SDK061 real-device probe.

A remote operator signs in and reserves the device INSIDE the runner's own
Chrome desktop. The official Samsung RDB ZIP is downloaded within that Chrome.
This script neither authenticates Samsung nor automates account access.
It extracts only a Linux binary named 'rdb' from the downloaded ZIP, starts
it in the SAME Ubuntu runner, waits for the user to click RTL's RDB Connect,
then installs the already built SDK061 APK over the established ADB bridge.

Never saves Samsung cookies, passwords, session profiles, remote screenshots
or ADB serial numbers in GitHub Artifacts.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path

PKG = "ai.bithuman.example.avatar_chat"
STAGE_FILE=Path(os.environ.get("RTL_BROWSER_STAGE_FILE","/tmp/rtl-browser-stage.txt"))
def mark(stage):
    STAGE_FILE.parent.mkdir(parents=True,exist_ok=True)
    STAGE_FILE.write_text(stage)
    print("RTL_LINUX_STAGE_"+stage,flush=True)

EXPECTED_SHA256 = "dd08b098dee26477d12489f872482425d4a790766fa3cd2c56d6119253f39ba4"


def cmd(*args: str, timeout: int = 25, check: bool = False):
    return subprocess.run(args, text=True, capture_output=True, timeout=timeout,
                          check=check)


def write_summary(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def digest(file: Path) -> str:
    h = hashlib.sha256()
    with file.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def detect_rdb(downloads: Path, target: Path):
    """Safely unpack the official Linux RDB distribution, including its libraries.

    Some Samsung RDB ZIPs bundle support libraries next to their executable:
    extracting only the ELF executable can silently break RDB. No path escapes,
    symlinks, excessive sizes or unsupported architectures are permitted.
    Returns a verified ELF x86_64 executable path, not a claimed connection.
    """
    for archive in sorted(downloads.glob("*.zip"),
                          key=lambda p: p.stat().st_mtime, reverse=True):
        if not archive.is_file():
            continue
        try:
            with zipfile.ZipFile(archive) as z:
                items = [i for i in z.infolist() if not i.is_dir()]
                if not items or len(items) > 300 or sum(i.file_size for i in items) > 200_000_000:
                    continue
                dest_root = (target.parent / "official-samsung-rdb").resolve()
                entries = []
                unsafe = False
                for item in items:
                    name = item.filename.replace("\\", "/")
                    bits = name.split("/")
                    unix_mode = (item.external_attr >> 16)
                    if (name.startswith("/") or "\x00" in name or
                        ":" in bits[0] or ".." in bits or
                        (unix_mode & 0o170000) == 0o120000 or
                        item.file_size > 80_000_000):
                        unsafe = True
                        break
                    destination = (dest_root / name).resolve()
                    if destination == dest_root or not destination.is_relative_to(dest_root):
                        unsafe = True
                        break
                    entries.append((item,destination))
                if unsafe:
                    continue
                binaries = []
                for info,destination in entries:
                    if destination.name.lower() == "rdb":
                        data = z.read(info)
                        if (len(data) >= 20 and data[:4] == b"\x7fELF" and
                            data[4] == 2 and int.from_bytes(data[18:20],"little") == 62):
                            binaries.append((info,destination))
                if len(binaries)!=1:
                    continue
                for info,destination in entries:
                    destination.parent.mkdir(parents=True,exist_ok=True)
                    destination.write_bytes(z.read(info))
                    if info.filename == binaries[0][0].filename:
                        destination.chmod(0o700)
                    else:
                        destination.chmod(0o600)
                return binaries[0][1]
        except (zipfile.BadZipFile, OSError, RuntimeError, ValueError):
            continue
    return None


def connected_adb() -> list[str]:
    r = cmd("adb", "devices", timeout=20)
    if r.returncode != 0:
        return []
    return [a.strip().split()[0] for a in r.stdout.splitlines()[1:]
            if a.strip().endswith("\tdevice") and
            not a.strip().startswith("emulator-")]


def scrub(value: str) -> str:
    value = re.sub(r"htdemo\.v1\.[\w.\-]+", "[REDACTED_TOKEN]", value)
    value = re.sub(r"(?i)(authorization\s*[:=]\s*bearer\s+)\S+",
                   r"\1[REDACTED]", value)
    value = re.sub(r"(?i)(api[-_]?secret\s*[:=]\s*)\S+",
                   r"\1[REDACTED]", value)
    value = re.sub(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b",
                   "[REDACTED_EMAIL]", value)
    return value


def read_boot(serial: str) -> str:
    r = cmd("adb", "-s", serial, "shell", "run-as", PKG,
            "cat", "app_flutter/boot_status.txt")
    return scrub(r.stdout[:12000]) if r.returncode == 0 else ""


def collect_probe(serial: str, report: Path, seconds: int = 240) -> dict:
    cmd("adb", "-s", serial, "logcat", "-c")
    mark("RDB_ADB_DEVICE_CONNECTED")
    print("RTL_ADB_CONNECTED; original APK installation starting", flush=True)
    install = cmd("adb", "-s", serial, "install", "-r",
                  os.environ["RTL_APK"], timeout=180)
    if install.returncode != 0:
        raise RuntimeError("ADB install failed: " + scrub(install.stderr[-1500:]))
    mark("SDK061_APK_INSTALLED")
    print("RTL_APK_INSTALL_OK", flush=True)
    run = cmd("adb", "-s", serial, "shell", "monkey", "-p", PKG, "1", timeout=30)
    if run.returncode != 0:
        raise RuntimeError("App launch failed: " + scrub(run.stderr[-1000:]))
    mark("SDK061_APP_LAUNCHED")
    print("RTL_APP_LAUNCH_REQUESTED", flush=True)
    boot = ""
    last_stage = ""
    for i in range(seconds // 10):
        time.sleep(10)
        boot = read_boot(serial)
        states = [line for line in boot.splitlines() if
                  line.startswith(("boot:", "hitel:", "session:"))]
        if states:
            stage = states[-1]
            if stage != last_stage:
                print("APP_PROGRESS:", scrub(stage[:250]), flush=True)
                last_stage = stage
        if "boot:load:ok" in boot and ("boot:session:open" in boot or
                                      "session:refuse=" in boot):
            break
        if "boot:error=" in boot:
            break

    model = cmd("adb", "-s", serial, "shell", "getprop", "ro.product.model").stdout.strip()
    abis = cmd("adb", "-s", serial, "shell", "getprop", "ro.product.cpu.abilist").stdout.strip()
    logcat = cmd("adb", "-s", serial, "logcat", "-d", "-v", "brief", timeout=50)
    text = logcat.stdout
    selected = [scrub(line[:700]) for line in text.splitlines() if
                any(x in line.lower() for x in [
                  "bithumanavatar", "expression2", "librert", "litert",
                  "qnn", "hexagon", "xnnpack", "androidruntime",
                  "fatal exception", "unsatisfiedlinkerror"
                ])]
    selected = selected[-120:]
    boot_lines = scrub(boot).splitlines()[-80:]
    result = {
      "utc": datetime.now(timezone.utc).isoformat(),
      "device_model": model[:80],
      "device_abi": abis[:100],
      "device_is_actual_rdb": True,
      "no_local_emulator": True,
      "sdk": "Expression2 0.6.1 original native",
      "apk_sha256": EXPECTED_SHA256,
      "apk_install_success": "Success" in install.stdout,
      "app_monkey_start_rc": run.returncode,
      "original_sdk_load_success": "boot:load:ok" in boot,
      "original_openSession_entered": "boot:session:open" in boot or "session:refuse=" in boot,
      "original_session_open_success": "boot:session:open" in boot,
      "original_session_refusal_observed": "session:refuse=" in boot,
      "native_first_texture_frame": "first frame on the texture" in text,
      "npu_hexagon_failure_observed": "hexagon refused" in text.lower() or
                                      "graph rejected" in text.lower(),
      "android_fatal_exception": "FATAL EXCEPTION" in text,
      "boot_events": boot_lines,
      "sdk_specific_log_lines": selected,
      "limitations": [
         "Remote Samsung session connectivity and entitlement are measured only at runtime",
         "No independent animation frame-count measurement"
      ]
    }
    write_summary(report, result)
    mark("SDK061_REAL_GALAXY_PROBE_REPORTED")
    print("RTL_GALAXY_SDK061_PROBE_FINISHED summary=" + str(report), flush=True)
    print(json.dumps({k: v for k, v in result.items() if
                      k not in ("boot_events", "sdk_specific_log_lines")},
                     ensure_ascii=False, indent=2), flush=True)
    return result


def main() -> None:
    a = argparse.ArgumentParser()
    a.add_argument("--downloads", type=Path, required=True)
    a.add_argument("--runtime", type=Path, required=True)
    a.add_argument("--report", type=Path, required=True)
    a.add_argument("--minutes", type=int, default=80)
    args = a.parse_args()
    args.runtime.mkdir(parents=True, exist_ok=True)
    apk = Path(os.environ["RTL_APK"])
    assert apk.is_file(), f"APK not found: {apk}"
    assert digest(apk) == EXPECTED_SHA256, "Original SDK061 APK checksum changed"
    if connected_adb():
        raise RuntimeError("Existing ADB device detected before RDB connection; refuse ambiguity")
    rdb = args.runtime / "rdb"
    started = None
    deadline = time.monotonic() + args.minutes * 60
    print("SAMSUNG_RTL_WAIT_FOR_OPERATOR: login, reserve Fold, download official Linux RDB ZIP", flush=True)
    while time.monotonic() < deadline:
        if started is None:
            rdb_executable = detect_rdb(args.downloads, rdb)
            if rdb_executable:
                mark("OFFICIAL_LINUX_RDB_VERIFIED")
                print("SAMSUNG_RDB_LINUX_ELF_X86_64_AND_PACKAGE_VERIFIED", flush=True)
                with (args.runtime / "rdb-stderr.log").open("wb") as err:
                    # Keep accompanying Samsung RDB libraries next to the binary.
                    # Never export the RDB transport/session data to GitHub.
                    started = subprocess.Popen([str(rdb_executable)],
                                               cwd=rdb_executable.parent,
                                               stdout=err, stderr=subprocess.STDOUT,
                                               start_new_session=True)
                time.sleep(3)
                if started.poll() is not None:
                    raise RuntimeError("Samsung RDB executable exited immediately; see locally captured diagnostic")
                (args.runtime / "rdb-ready").write_text("local-RDB-listener-ready\\n")
                mark("OFFICIAL_LINUX_RDB_RUNNING")
                print("SAMSUNG_RDB_PROCESS_RUNNING: SAME CHROME Playwright will click RDB Connect", flush=True)
        if started is not None and started.poll() is not None:
            raise RuntimeError("Samsung RDB exited before ADB connection")
        devices = connected_adb() if started else []
        if devices:
            if len(devices) != 1:
                raise RuntimeError("Unexpected multiple RDB devices; refuse arbitrary install")
            collect_probe(devices[0], args.report)
            return
        time.sleep(8)
    mark("LINUX_RDB_ADB_CONNECT_TIMEOUT")
    raise TimeoutError("No Samsung RDB device connected within operator reservation window")


if __name__ == "__main__":
    main()
