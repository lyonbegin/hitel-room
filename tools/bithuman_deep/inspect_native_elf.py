#!/usr/bin/env python3
"""Analyze bitHuman Expression2's published ARM64 JNI boundary, read-only.

Only metadata, symbol names, strings and call references are retained. The AAR
is downloaded at build time; no vendor binaries or pseudocode are committed.
"""
import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path

FOCUS = re.compile(r"(canon|dec8|dec16|dec_p2|tok14|step|history|idle|pump|frame|feat|motion|latent|overlap|segment|sample|conditioning|tensor|signature|stride|push|float|callback|yuv)", re.I)
NATIVE_PREFIX = "Java_ai_bithuman_expression2_Native_"

def cmd(args, timeout=60):
    try:
        x=subprocess.run(args, capture_output=True, text=True, errors="replace", timeout=timeout)
        return {"exit":x.returncode,"stdout":x.stdout,"stderr":x.stderr[-1500:]}
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError) as exc:
        return {"exit":None,"stdout":"","stderr":str(exc)}

def analyze(aar):
    with tempfile.TemporaryDirectory() as tmp, zipfile.ZipFile(aar) as zipf:
        so=next(x for x in zipf.namelist() if x.endswith("/libexpr2jni.so"))
        target=Path(tmp)/"libexpr2jni.so"
        target.write_bytes(zipf.read(so))
        elf=cmd(["readelf","-h",str(target)])
        dynamic=cmd(["readelf","-d",str(target)])
        dyn=cmd(["nm","-D","--defined-only",str(target)])
        literal=cmd(["strings","-a","-t","x","-n","5",str(target)],timeout=120)
        symbols=[]
        for line in dyn["stdout"].splitlines():
            cols=line.split()
            if len(cols)>=3 and cols[0].isalnum():
                addr,klass,name=cols[0],cols[1],cols[-1]
                if name.startswith(NATIVE_PREFIX):
                    symbols.append({"address_hex":addr,"type":klass,"name":name})
        hits=[]
        for line in literal["stdout"].splitlines():
            fragments=line.strip().split(maxsplit=1)
            if len(fragments)<2:continue
            offset, string=fragments
            if FOCUS.search(string):
                hits.append({"offset_hex":offset,"text":string[:200]})
        functions=[]
        for nm in ("Native_create","Native_pump","Native_pumpForPull","Native_feed","Native_stepHistoryInputIndex","Native_pullToBuffer","Native_splitSignatures","Native_memberName","Native_initMs"):
            symbol=next((v for v in symbols if v["name"].endswith(nm)),None)
            if symbol:
                functions.append(symbol)
        return {
            "source":"published Expression2 Android SDK 0.6.2 AAR",
            "lib":so,
            "file_size_bytes":target.stat().st_size,
            "sha256":hashlib.sha256(target.read_bytes()).hexdigest(),
            "elf_machine":next((line.strip() for line in elf["stdout"].splitlines() if "Machine:" in line),None),
            "needed":re.findall(r"\(NEEDED\).*?\[([^\]]+)\]",dynamic["stdout"]),
            "jni_exports_count":len(symbols),
            "jni_exports":symbols,
            "focus_symbols":functions,
            "matching_printable_strings":hits[:600],
            "interesting_string_count":len(hits),
        }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--aar",required=True,type=Path)
    p.add_argument("--out",required=True,type=Path)
    args=p.parse_args()
    args.out.mkdir(parents=True,exist_ok=True)
    data=analyze(args.aar)
    (args.out/"native_symbol_inventory.json").write_text(json.dumps(data,indent=2),encoding="utf-8")
    lines=["# Expression2 ARM64 JNI metadata", "",
           "- ELF machine: "+str(data["elf_machine"]),
           "- Dependency libraries: "+", ".join(data["needed"]),
           "- JNI exports: "+str(data["jni_exports_count"]),
           "- Matching code/data strings: "+str(data["interesting_string_count"]),"",
           "## JNI symbols and addresses",""]
    lines+=["- "+sym["address_hex"]+" "+sym["name"] for sym in data["jni_exports"]]
    lines+=["","## Relevant strings in ELF",""]
    lines+=["- "+hit["offset_hex"]+" "+hit["text"][:130] for hit in data["matching_printable_strings"][:200]]
    (args.out/"native_symbol_inventory.md").write_text("\n".join(lines),encoding="utf-8")
    print("ELF_MACHINE",data["elf_machine"],"JNI_EXPORTS",data["jni_exports_count"],
          "FOCUS_STRINGS",data["interesting_string_count"],flush=True)
    for hit in data["matching_printable_strings"]:
        if any(token in hit["text"].lower() for token in ("canon","dec8","dec16","step_history","tok14","overlap","pump","signature")):
            print("INTERESTING_STRING",hit["offset_hex"],hit["text"][:150],flush=True)
    assert data["jni_exports_count"]>=20
    assert any(x["name"].endswith("Native_pump") for x in data["jni_exports"])
    assert any(x["name"].endswith("Native_stepHistoryInputIndex") for x in data["jni_exports"])

if __name__=="__main__":
    main()
