#!/usr/bin/env python3
"""Test-only repair of AppSealing static Context accessor in the already reconstructed recorder.

Changes ONLY the getContext(Object) Dalvik method of AppSealingApplication in
recorder classes.dex. The original recorder AIDL, PCM, CallRecordingService,
and STT-related dex classes stay untouched. The original protected APK is
NEVER written or modified.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import pathlib
import re

METHOD_PATTERN = re.compile(
    r"(?ms)^\.method[^\n]*\bgetContext\(Ljava/lang/Object;\)Landroid/content/Context;\s*\n"
    r".*?^\.end method\s*$"
)
DECL_PATTERN = re.compile(r"(?m)^\s*\.(registers|locals)\s+(\d+)\s*$")
BRIDGE = """
    # HITEL QA: framework ContentProvider knows its own Context at provider init.
    # The removed AppSealing Application wrapper leaves _base/appApplication
    # unpopulated; all original provider callers used this same helper.
    instance-of v0, p0, Landroid/content/ContentProvider;
    if-eqz v0, :hitel_original_appsealing_context
    check-cast p0, Landroid/content/ContentProvider;
    invoke-virtual {p0}, Landroid/content/ContentProvider;->getContext()Landroid/content/Context;
    move-result-object v0
    if-eqz v0, :hitel_original_appsealing_context
    return-object v0
    :hitel_original_appsealing_context
"""

def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--smali-root", type=pathlib.Path, required=True)
    p.add_argument("--report", type=pathlib.Path, required=True)
    a = p.parse_args()
    path = a.smali_root / "com/inka/appsealing/AppSealingApplication.smali"
    original = path.read_text(encoding="utf-8")
    matches = list(METHOD_PATTERN.finditer(original))
    if len(matches) != 1:
        raise SystemExit(f"Exactly one getContext(Object) expected, found {len(matches)}: {path}")
    m = matches[0]
    method = m.group(0)
    start = DECL_PATTERN.search(method)
    if start is None:
        raise SystemExit("No .locals / .registers found in original getContext(Object)")
    original_registers = int(start.group(2))
    if start.group(1) == "registers" and original_registers > 2:
        raise SystemExit("Unexpected original accessor register count")
    if start.group(1) == "locals" and original_registers > 1:
        raise SystemExit("Unexpected original accessor locals count")
    if "instance-of" in method or "ContentProvider;->getContext()" in method:
        raise SystemExit("Original method already contains provider bridging")
    # Method has one object parameter. Preserve v0 as the single local
    # register; moving p0 into the last register preserves existing p0 uses.
    count = 2 if start.group(1) == "registers" else 1
    patched_method = (
        method[:start.start()]
        + f"    .{start.group(1)} {count}"
        + BRIDGE
        + method[start.end():]
    )
    # No method signatures or AIDL/PCM/native code may change.
    patched = original[:m.start()] + patched_method + original[m.end():]
    if len(list(METHOD_PATTERN.finditer(patched))) != 1:
        raise SystemExit("Bridge changed method inventory")
    path.write_text(patched, encoding="utf-8")
    a.report.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "changed_file": str(path),
        "method": "AppSealingApplication.getContext(Object):Context",
        "original_file_sha256": hashlib.sha256(original.encode()).hexdigest(),
        "new_file_sha256": hashlib.sha256(patched.encode()).hexdigest(),
        "original_registers_or_locals": original_registers,
        "only_one_smali_class_modified": True,
        "intent": "Return original ContentProvider context before legacy AppSealing static fallback",
        "no_real_call_audio_or_stt_verified": True,
    }
    a.report.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print("IXIO_RECORDER_PROVIDER_CONTEXT_BRIDGE_APPLIED=YES", json.dumps(data))
if __name__ == "__main__":
    main()
