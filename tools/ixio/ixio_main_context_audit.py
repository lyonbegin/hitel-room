#!/usr/bin/env python3
"""Read *restored original* IXIO startup sources in CI, emit structural audit only.

Do not publish the original app Java source or APK. This checks whether the app
has custom context/attach/onCreate methods and which lifecycle calls they make.
"""
from __future__ import annotations
import argparse
import json
import pathlib
import re

PATTERNS={
    "super_attachBaseContext":r"super\.attachBaseContext\s*\(",
    "super_onCreate":r"super\.onCreate\s*\(",
    "FirebaseApp_initializeApp":r"FirebaseApp\.initializeApp\s*\(",
    "FirebaseCrashlytics_getInstance":r"FirebaseCrashlytics\.getInstance\s*\(",
    "getApplicationContext":r"\bgetApplicationContext\s*\(",
    "AppSealing":r"AppSealing|appsealing|com\.inka\.",
    "MultiDex":r"MultiDex|multidex",
    "System_loadLibrary":r"System\.loadLibrary\s*\(",
    "ContentProvider":r"ContentProvider",
    "Hilt":r"Hilt_|hilt",
}
METHODS=["attachBaseContext", "onCreate", "getApplicationContext", "getBaseContext"]
def extract(s,name):
    # Only method bodies with an opening brace. Avoid using source as executable truth.
    m=re.search(r"\b(?:void|Context|Application|ContextWrapper|final\s+void|public\s+void)"
                r"\s+"+re.escape(name)+r"\s*\([^)]*\)\s*(?:throws [^{]+)?\{",s)
    if not m:
        m=re.search(r"\b"+re.escape(name)+r"\s*\([^)]*\)\s*\{",s)
    if not m:
        return None
    i=s.find("{",m.start())
    depth=0
    for j in range(i,min(len(s),i+160000)):
        if s[j]=="{":depth+=1
        elif s[j]=="}":
            depth-=1
            if depth==0:return s[i+1:j]
    return None

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--source-dir",required=True,type=pathlib.Path)
    p.add_argument("--out",required=True,type=pathlib.Path)
    args=p.parse_args()
    results=[]
    for cls in ("IXIApplication","Hilt_IXIApplication"):
        matching=list(args.source_dir.rglob(cls+".java"))
        for file in matching[:2]:
            s=file.read_text(encoding="utf8",errors="replace")
            decl=re.search(r"\bclass\s+"+re.escape(cls)+r"\s+extends\s+([\w.$]+)",s)
            methods={}
            for method in METHODS:
                body=extract(s,method)
                methods[method]={
                    "declared_method_found":body is not None,
                    "has_jadx_incomplete":bool(body and "Method not decompiled" in body),
                    "referenced_lifecycle_apis":sorted(k for k,v in PATTERNS.items() if body and re.search(v,body)),
                    "body_char_count":len(body) if body is not None else None,
                }
            results.append({
                "class":cls,
                "superclass":decl.group(1) if decl else "NOT_PARSED",
                "method_report":methods,
                "source_java_bytes":file.stat().st_size,
            })
    output={"subject":"main startup: IXIApplication vs Hilt_IXIApplication",
            "classes":results,
            "limitations":"Static JADX interpretation only; Firebase provider lifecycle must also be verified by install/launch."}
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(output,indent=2,ensure_ascii=False))
    print(json.dumps(output,ensure_ascii=False))
if __name__=="__main__":main()
