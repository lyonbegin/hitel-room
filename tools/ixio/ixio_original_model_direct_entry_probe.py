#!/usr/bin/env python3
"""QA-only single-shot entry to the ORIGINAL IXIO model downloader.

This does not bypass download availability, invent a model URL, mock app config
responses, grant carrier membership, or change recorder/STT/network code.
Patch is limited to the RecentCallsViewModel getter that observes the model
download UI state. Its original checkAndStartAiModelDownload() does the work.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re

TARGET = pathlib.Path("com/lguplus/aicallagent/recentcalls/ui/RecentCallsViewModel.smali")
METHOD = re.compile(
    r"(?ms)^\.method public final getUpdateAiModelData\(\)Lkotlinx/coroutines/flow/StateFlow;\s*\n"
    r".*?^\.end method$"
)
ENTRY = re.compile(
    r"(?m)^\.method public final checkAndStartAiModelDownload\(\)V$"
)
FIELD = ".field private static hitelModelDirectProbeInvoked:Z"
MARKER = "IXIO_ORIGINAL_MODEL_DIRECT_PROBE"
INJECT = """
    # QA-only single shot; keep original downloader's network/storage/model/auth checks
    sget-boolean v0, Lcom/lguplus/aicallagent/recentcalls/ui/RecentCallsViewModel;->hitelModelDirectProbeInvoked:Z
    if-nez v0, :hitel_model_probe_original_getter
    const/4 v0, 0x1
    sput-boolean v0, Lcom/lguplus/aicallagent/recentcalls/ui/RecentCallsViewModel;->hitelModelDirectProbeInvoked:Z
    const-string v0, "IXIO_ORIGINAL_MODEL_DIRECT_PROBE"
    const-string v1, "ENTER_ORIGINAL_CHECK_AND_START"
    invoke-static {v0, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I
    move-result v1
    invoke-virtual {p0}, Lcom/lguplus/aicallagent/recentcalls/ui/RecentCallsViewModel;->checkAndStartAiModelDownload()V
    const-string v0, "IXIO_ORIGINAL_MODEL_DIRECT_PROBE"
    const-string v1, "ORIGINAL_CHECK_AND_START_RETURNED_ASYNC"
    invoke-static {v0, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I
    move-result v1
    :hitel_model_probe_original_getter
"""
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--smali15",type=pathlib.Path,required=True)
    ap.add_argument("--report",type=pathlib.Path,required=True)
    args=ap.parse_args()
    p=args.smali15/TARGET
    src=p.read_text()
    if MARKER in src or FIELD in src:raise RuntimeError("Refuse repeated injection")
    if len(ENTRY.findall(src))!=1:raise RuntimeError("Original model-download entrypoint not found once")
    hits=list(METHOD.finditer(src))
    if len(hits)!=1:raise RuntimeError(f"Model UI getter mismatch {len(hits)}")
    m=hits[0]
    old=m.group()
    h=re.search(r"(?m)^\s*\.(registers|locals)\s+(\d+)\s*$",old)
    if not h:raise RuntimeError("No method locals/registers in model-state getter")
    kind,count=h.group(1),int(h.group(2))
    if kind=="locals":
        # reserve v0 and v1. When smali refers to p0 by name, new local regs are safe.
        newlocals=max(count,2)
        change=old[:h.start()]+"    .locals "+str(newlocals)+INJECT+old[h.end():]
    else:
        # Zero-argument instance method has one p0 parameter. A register count of
        # 3 permits two local scratch registers v0/v1 without p0 aliasing.
        newregs=max(count,3)
        change=old[:h.start()]+"    .registers "+str(newregs)+INJECT+old[h.end():]
    src2=src[:m.start()]+change+src[m.end():]
    c=re.search(r"(?m)^\.class[^\n]*$",src2)
    if not c:raise RuntimeError("Class declaration missing")
    src2=src2[:c.end()]+"\n"+FIELD+src2[c.end():]
    p.write_text(src2)
    report={
        "purpose":"Directly invoke original RecentCallsViewModel.checkAndStartAiModelDownload once",
        "only_modified_class":str(TARGET),"original_sha256":hashlib.sha256(src.encode()).hexdigest(),
        "patched_sha256":hashlib.sha256(src2.encode()).hexdigest(),
        "hook_method":"getUpdateAiModelData():StateFlow",
        "original_method":"checkAndStartAiModelDownload():void",
        "original_method_untouched":True,
        "old_registers_or_locals":count,"new_registers_or_locals":newlocals if kind=="locals" else newregs,
        "probe_runs_once":True,"logs":[MARKER],
        "no_other_models_stt_recorder_network_changes":True,
    }
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print("IXIO_MODEL_DIRECT_ENTRY_PATCH_APPLIED",json.dumps(report),flush=True)
if __name__=="__main__":main()
