#!/usr/bin/env python3
"""Summarize *actual* recorder InCallService.isCallerAllowed method from JADX.
Reads the proprietary original only inside CI; publishes narrowly scoped logic evidence.
No modifications to the third-party APK or caller identity.
"""
from __future__ import annotations
import argparse,hashlib,json,re
from pathlib import Path

CHECKS=[
 "Binder.getCallingUid", "getCallingUid", "Binder.getCallingPid",
 "getPackagesForUid", "getNameForUid", "getPackageName", "getCallingPackage",
 "checkSignatures", "checkSignature", "hasSigningCertificate", "GET_SIGNATURES",
 "getPackageInfo", "getApplicationInfo", "myUid", "SYSTEM_UID",
 "checkCallingPermission", "checkCallingOrSelfPermission", "checkPermission",
 "checkSelfPermission", "getUid", "getPackageManager", "checkCallingUriPermission",
 "getCallingUserHandle","getPackagesForUid","Arrays.equals",
 "TextUtils.equals","Objects.equals","equals","equalsIgnoreCase",
 "verify","signature","isCallerAllowed",
]

def extract_method(content,name):
    matches=list(re.finditer(r"\b"+re.escape(name)+r"\s*\(\s*\)\s*(?:throws [^{;]+)?\{",content))
    if not matches: return None
    m=matches[-1]
    start=m.end()-1
    depth=0
    # Search only bounded method to avoid accidental full-source exposure
    for j in range(start,min(len(content),start+20000)):
        if content[j]=="{":depth+=1
        if content[j]=="}":
            depth-=1
            if depth==0:
                return content[start+1:j]
    return None

def normalize(s):
    return re.sub(r"\s+"," ",s.strip())

def limit_lines(body):
    picked=[]
    for i,line in enumerate(body.splitlines(),1):
        l=line.strip()
        if any(key in l for key in ("return ","if (","getCallingUid","getPackagesForUid",
                 "getNameForUid","checkSignatures","checkSignature","getApplicationInfo",
                 "getPackageManager","myUid","getPackageName","getCallingPackage",
                 "SecurityException","signature","SYSTEM_UID","checkPermission",
                 "getPackageInfo","throw ")):
            if l and len(picked)<30:picked.append({"line_in_method":i,"code":normalize(l)[:240]})
    return picked

def run(args):
    roots=list(Path(args.sources).rglob("InCallService.java"))
    hits=[]
    for f in roots:
        s=f.read_text(encoding="utf-8",errors="replace")
        body=extract_method(s,"isCallerAllowed")
        if body is None:continue
        methods=[x for x in CHECKS if x in body]
        uid_line=[normalize(l) for l in body.splitlines() if "getCallingUid" in l]
        pkgs=sorted(set(re.findall(r'"((?:com|android)\.[A-Za-z0-9_.]+)"',body)))
        results={
          "class":str(f.relative_to(Path(args.sources))),
          "source_sha256":hashlib.sha256(s.encode()).hexdigest(),
          "method_body_sha256":hashlib.sha256(body.encode()).hexdigest(),
          "method_length":len(body),
          "methods_and_checks":methods,
          "calling_uid_lines":[x[:220] for x in uid_line[:8]],
          "literal_package_names":pkgs,
          "decision_statements":limit_lines(body),
        }
        hits.append(results)
    output={"analysis":"Actual recovered recorder InCallService.isCallerAllowed, static conditional code only",
       "checked_method":"isCallerAllowed","method_found":bool(hits),"methods":hits,
       "disclaimer":"This establishes the exact static caller check, not runtime permission or AIDL binding success."}
    p=Path(args.output)
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(output,indent=2,ensure_ascii=False))
    print(json.dumps({"method_found":bool(hits),"check_types":[x["methods_and_checks"] for x in hits]},ensure_ascii=False))
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--sources",required=True)
    ap.add_argument("--output",required=True)
    run(ap.parse_args())
if __name__=="__main__":main()
