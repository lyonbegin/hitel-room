#!/usr/bin/env python3
"""Run the ORIGINAL missing-model download entry during clean initialization.

Keep original token validation, the original choice of model API, availability
checks, catalog parsing and WorkManager scheduling. This supplies no model URL,
model data, fake authentication or downloaded-state flag.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

import ixio_original_provisioning_entry_probe as runner

TARGET = "com/lguplus/aicallagent/dip/domain/ai/usecase/UpdateAiModelUseCaseImpl.smali"
PROBE = "com/lguplus/aicallagent/dip/domain/ai/usecase/HitelOriginalPreloginModelProbe.smali"
DESC = "L" + PROBE[:-6] + ";"
TDESC = "L" + TARGET[:-6] + ";"


def source() -> str:
    # A tail-call Function2 adapter invokes one existing suspend method, using
    # the same small diagnostic-thread harness as the local initialization test.
    s = runner.source().replace(runner.DESC, DESC).replace(runner.MDESC, TDESC)
    s = s.replace("IXIO_ORIGINAL_PROVISIONING", "IXIO_ORIGINAL_PRELOGIN_MODEL")
    s = s.replace("ORIGINAL_ENSURE_PROVISIONED_START", "ORIGINAL_PRELOGIN_DOWNLOAD_REQUEST_START")
    s = s.replace("ORIGINAL_ENSURE_PROVISIONED_SUCCESS", "ORIGINAL_PRELOGIN_DOWNLOAD_REQUEST_RETURNED_SUCCESS")
    s = s.replace("ORIGINAL_ENSURE_PROVISIONED_FAILED", "ORIGINAL_PRELOGIN_DOWNLOAD_REQUEST_FAILED")
    s = s.replace("ensureProvisioned-IoAF18A", "downloadMissingModels-IoAF18A")
    # Let the original NetworkMonitor receive Android's initial connectivity
    # callback. Onboarding is untouched; token state is never forced to empty.
    s = s.replace("    :try_start\n    const/4 v0, 0x0\n",
                  "    :try_start\n    const-wide/16 v0, 0xbb8\n"
                  "    invoke-static {v0, v1}, Ljava/lang/Thread;->sleep(J)V\n"
                  "    const/4 v0, 0x0\n", 1)
    return s


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--smali16", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    a = p.parse_args()
    target = a.smali16 / TARGET
    probe = a.smali16 / PROBE
    old = target.read_text()
    hits = list(re.finditer(r"(?ms)^\.method public constructor <init>\([^\n]*\n.*?^\.end method$", old))
    if len(hits) != 1 or probe.exists():
        raise RuntimeError("Expected one original fully initialized model use case")
    m = hits[0]
    body = m.group()
    if body.count("    return-void") != 1:
        raise RuntimeError("Unexpected original model constructor return layout")
    changed = body.replace("    return-void",
                           f"    invoke-static/range {{p0 .. p0}}, {DESC}->start({TDESC})V\n"
                           "    return-void", 1)
    target.write_text(old[:m.start()] + changed + old[m.end():])
    probe.write_text(source())
    a.report.parent.mkdir(parents=True, exist_ok=True)
    a.report.write_text(json.dumps({
        "mode": "INVOKE_ORIGINAL_DOWNLOAD_MISSING_MODELS_DURING_CLEAN_INITIALIZATION",
        "original_constructor_sha256": hashlib.sha256(body.encode()).hexdigest(),
        "test_constructor_sha256": hashlib.sha256(changed.encode()).hexdigest(),
        "original_token_validation_api_selection_availability_and_download_code_unchanged": True,
        "no_model_urls_or_contents_supplied": True,
        "api_choice_must_be_verified_from_runtime_markers": True,
        "successful_return_does_not_prove_file_download_or_stt": True,
        "test_only": True,
    }, indent=2))
    print("ORIGINAL_PRELOGIN_MISSING_MODEL_DOWNLOAD_ENTRY_CALL_INSTALLED=YES")


if __name__ == "__main__":
    main()
