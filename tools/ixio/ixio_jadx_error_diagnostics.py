#!/usr/bin/env python3
"""Classify JADX errors from its debug output and generated comments. No source disclosure."""
from __future__ import annotations
import argparse
import collections
import json
import pathlib
import re
import sys

def inspect_log(log: pathlib.Path):
    s=log.read_text(encoding="utf-8",errors="replace") if log.is_file() else ""
    counts=collections.Counter()
    classes=collections.Counter()
    for line in s.splitlines():
        t=line.strip()
        # Console output is mostly progress and debug. Keep only types and class names.
        if re.search(r"finished with errors, count:\s*(\d+)",t):
            counts["reported_total"]=int(re.search(r"count:\s*(\d+)",t).group(1))
        if re.search(r"\b(?:ERROR|WARN)\b",t):
            if "Failed to generate code" in t:counts["codegen_failed"]+=1
            elif "Inconsistent code" in t:counts["inconsistent_code"]+=1
            elif "Method not decompiled" in t:counts["method_not_decompiled"]+=1
            elif "Exception" in t:counts["exception_log_lines"]+=1
            else:counts["other_error_warn_lines"]+=1
        for exception in re.findall(r"\b([\w.]+(?:Exception|Error))(?::|\s|$)",t):
            counts["exception:"+exception.split(".")[-1]]+=1
        m=re.search(r"(?:in class|class|for class|in method)\s+([a-zA-Z][\w.$/]+)",t)
        if m and ("ERROR" in t or "WARN" in t):
            classes[m.group(1)]+=1
    return counts,classes

def inspect_java(root: pathlib.Path):
    counts=collections.Counter()
    files=[]
    for p in root.rglob("*.java") if root.exists() else ():
        src=p.read_text(encoding="utf-8",errors="replace")
        bad=len(re.findall(r"JADX ERROR",src,re.IGNORECASE))
        warn=len(re.findall(r"JADX WARNING",src,re.IGNORECASE))
        missing=len(re.findall(r"Method not decompiled",src,re.IGNORECASE))
        unsupported=len(re.findall(r"UnsupportedOperationException\s*\(\s*\"Method not decompiled",src,re.IGNORECASE))
        if any((bad,warn,missing,unsupported)):
            counts["files_with_decompilation_diagnostics"]+=1
            counts["java_jadx_error_markers"]+=bad
            counts["java_jadx_warning_markers"]+=warn
            counts["java_method_not_decompiled_markers"]+=missing
            counts["java_method_not_decompiled_throw_sites"]+=unsupported
            files.append({"class_file":str(p.relative_to(root)),
                          "jadx_error_markers":bad,"jadx_warning_markers":warn,
                          "method_not_decompiled_markers":missing,
                          "method_not_decompiled_throw_sites":unsupported})
        counts["java_files_total"]+=1
    return counts,files

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--log",required=True)
    parser.add_argument("--sources",required=True)
    parser.add_argument("--output",required=True)
    parser.add_argument("--mode",default="auto")
    a=parser.parse_args()
    logs,classes=inspect_log(pathlib.Path(a.log))
    java,files=inspect_java(pathlib.Path(a.sources))
    result={"mode":a.mode,"jadx_log":dict(logs),"java_summary":dict(java),
       "error_classes_from_log":dict(classes.most_common(120)),
       "affected_java_files":files[:160],
       "interpretation":"These are source generation diagnostics, not DEX checksum verification."}
    pathlib.Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({k:v for k,v in result.items() if k!="affected_java_files" and k!="error_classes_from_log"},ensure_ascii=False))
if __name__=="__main__":main()
