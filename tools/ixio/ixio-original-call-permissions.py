#!/usr/bin/env python3
"""Grant only declared Android runtime permissions on a disposable emulator."""
import json
import re
import subprocess
from pathlib import Path

PKG = "com.lguplus.aicallagent"
PERMISSIONS = (
    "READ_PHONE_STATE", "READ_PHONE_NUMBERS", "CALL_PHONE", "ANSWER_PHONE_CALLS",
    "READ_CALL_LOG", "WRITE_CALL_LOG", "READ_CONTACTS", "READ_MEDIA_AUDIO",
    "RECORD_AUDIO", "POST_NOTIFICATIONS", "BLUETOOTH_CONNECT", "READ_SMS", "CAMERA",
)


def adb(*args):
    return subprocess.run(["adb", *args], text=True, capture_output=True, timeout=25)


def main():
    if adb("shell", "getprop", "ro.kernel.qemu").stdout.strip() != "1":
        raise RuntimeError("Call permission setup is restricted to an emulator")
    before = adb("shell", "dumpsys", "package", PKG).stdout
    results = []
    for short in PERMISSIONS:
        permission = "android.permission." + short
        if not re.search(r"(?m)^\s*"+re.escape(permission)+r"(?:\s|:|$)", before):
            continue
        r = adb("shell", "pm", "grant", PKG, permission)
        after = adb("shell", "dumpsys", "package", PKG).stdout
        granted = bool(re.search(re.escape(permission)+r": granted=true\b", after))
        results.append({"permission": permission, "command_ok": r.returncode == 0, "granted": granted})
    out = Path("ixio-pages-qa-results/original-call-runtime-permissions.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(results, indent=2))
    print("ORIGINAL_CALL_DECLARED_RUNTIME_PERMISSION_RESULTS", json.dumps(results), flush=True)
    assert all(x["granted"] for x in results), "A declared call runtime permission remains denied"


if __name__ == "__main__":
    main()
