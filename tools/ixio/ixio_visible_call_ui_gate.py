#!/usr/bin/env python3
"""IXIO QA: continue the existing Visible Call UI path past local restriction gates.

Apply to the pinned *pre-instrumentation* IXIO APK only. This patch changes
CallViewModel.toggleVisibleCall() in classes18.dex and NOTHING in model, recorder,
STT, server, authentication, or other UI methods. It is a UI-path experiment;
it does not make a carrier service or AI engine work.
"""
import argparse
import copy
import hashlib
import json
import os
import struct
import tempfile
import zipfile
import zlib
from pathlib import Path

DEX_NAME = "classes18.dex"
SOURCE_DEX_SHA256 = "2cf7258dd1f5baa08898477dde3f05d0defb41231fc8ddda5567515325131805"
CODE_ITEM_OFFSET = 0xA02798
PATCH_START_CODE_UNITS = 169
OLD = bytes.fromhex(
    "390518006002c1296201a5276e10363401000c036205c33d130609001207"
    "1201120407e0770876740000620026891100"
)
NEW = bytes.fromhex(
    "29000200012102050f0029009200000000000000000000000000000000000000"
    "00000000000000000000000000000000"
)
# The original code at 169 is a conditional branch to the blocked snackbar.
# Instead jump into the rewritten, previously blocked region (171), initialize
# the two booleans required by the unchanged continuation, and jump to 320:
# 169: goto/16 +2
# 171: move v1,v2             (current visible-call state)
# 172: move/from16 v5,v15     (requested enable/disable state)
# 174: goto/16 +146          (original normal continuation at 320)
# 176..192: nop              (formerly restricted snackbar / early return)

def sha256(data):
    return hashlib.sha256(data).hexdigest()

def patch_dex(raw):
    actual = sha256(raw)
    if actual != SOURCE_DEX_SHA256:
        raise RuntimeError(f"Refusing unknown classes18.dex: {actual}")
    if raw[:8] not in (b"dex\\n035\\0", b"dex\\n037\\0", b"dex\\n038\\0", b"dex\\n039\\0", b"dex\\n040\\0", b"dex\\n041\\0"):
        raise RuntimeError("Unknown DEX format")
    if len(OLD) != len(NEW) or len(OLD) != 48:
        raise RuntimeError("Expected exactly 24 code units at original gate")
    if struct.unpack_from("<H", raw, CODE_ITEM_OFFSET)[0] != 17:
        raise RuntimeError("Unexpected register count; method layout changed")
    if struct.unpack_from("<H", raw, CODE_ITEM_OFFSET + 2)[0] != 3:
        raise RuntimeError("Unexpected parameter count")
    if struct.unpack_from("<H", raw, CODE_ITEM_OFFSET + 6)[0] != 0:
        raise RuntimeError("Unexpected try/catch range")
    if struct.unpack_from("<I", raw, CODE_ITEM_OFFSET + 12)[0] != 361:
        raise RuntimeError("Unexpected method size")
    offset = CODE_ITEM_OFFSET + 16 + PATCH_START_CODE_UNITS * 2
    if raw[offset:offset + len(OLD)] != OLD:
        raise RuntimeError("Original gate instructions do not match")
    if struct.unpack_from("<H", NEW, 0)[0] != 0x0029:
        raise RuntimeError("Expected goto/16 at code unit 169")
    if struct.unpack_from("<H", NEW, 4)[0] != 0x2101:
        raise RuntimeError("Expected move v1,v2 at code unit 171")
    if struct.unpack_from("<H", NEW, 6)[0] != 0x0502:
        raise RuntimeError("Expected move/from16 v5,v15 at code unit 172")
    if struct.unpack_from("<H", NEW, 10)[0] != 0x0029:
        raise RuntimeError("Expected jump into original continuation")
    if struct.unpack_from("<h", NEW, 12)[0] + 174 != 320:
        raise RuntimeError("Normal continuation offset changed")
    updated = bytearray(raw)
    updated[offset:offset + len(OLD)] = NEW
    updated[12:32] = hashlib.sha1(updated[32:]).digest()
    struct.pack_into("<I", updated, 8, zlib.adler32(updated[12:]) & 0xffffffff)
    touched = {i for i, (a, b) in enumerate(zip(raw, updated)) if a != b}
    assert touched.issubset(set(range(8, 32)) | set(range(offset, offset + len(OLD))))
    return bytes(updated), {"source_dex_sha256": actual, "patched_dex_sha256": sha256(updated),
                            "code_item_offset": CODE_ITEM_OFFSET, "patch_start_code_units": PATCH_START_CODE_UNITS,
                            "normal_continuation_code_units": 320, "changeStateAndNotify_code_units": 351,
                            "changed_code_bytes": len(OLD), "scope": "CallViewModel.toggleVisibleCall only"}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    apk = args.apk
    with zipfile.ZipFile(apk) as z:
        if DEX_NAME not in z.namelist():
            raise RuntimeError("Missing " + DEX_NAME)
        patched_dex, report = patch_dex(z.read(DEX_NAME))
        original_entries = [(copy.copy(info), z.read(info.filename)) for info in z.infolist()]
    fd, tmp = tempfile.mkstemp(prefix=".ixio-visible-", suffix=".apk", dir=str(apk.parent))
    os.close(fd)
    try:
        with zipfile.ZipFile(tmp, "w", allowZip64=True) as out:
            for info, data in original_entries:
                out.writestr(info, patched_dex if info.filename == DEX_NAME else data)
        with zipfile.ZipFile(tmp) as z:
            assert z.read(DEX_NAME) == patched_dex
            assert all(z.read(info.filename) == data for info, data in original_entries if info.filename != DEX_NAME)
        os.replace(tmp, apk)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    report.update({
        "mode": "LOCAL_VISIBLE_CALL_QA_GATE_CONTINUE",
        "only_changed_apk_entry": DEX_NAME,
        "original_models_stt_recorder_untouched": True,
        "actual_visible_call_stt_success": "NOT_VERIFIED",
        "requires_full_reassembly_and_QA_signature": True,
    })
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\\n")
    print("IXIO_VISIBLE_CALL_QA_PATCH_APPLIED", json.dumps(report, ensure_ascii=False))

if __name__ == "__main__":
    main()
