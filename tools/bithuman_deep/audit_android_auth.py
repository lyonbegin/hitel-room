#!/usr/bin/env python3
"""Read-only authentication and metering bytecode audit of bitHuman Android SDK AAR.

Analyzes real classes.jar from official AAR using javap -p -c -s and scans
Java/Kotlin bytecode for credential flow, downloader, session/metering boundaries,
network targets and refusal paths. Does not create keys or change SDK binaries.

Generates JSON and condensed Markdown with method names and code references.
"""
import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path
from datetime import datetime, timezone

CLASS_MATCH = re.compile(r"Credential|Meter|Avatar|ModelStore|DoorResolver|MirrorResolver|UrlResolver|Exception|Refused|Native|License|Http|Client|Session|Request|Response|Usage|Auth|Billing|Engine", re.I)
SECURITY_MATCH = re.compile(r"credential|secret|auth|session|meter|licen[cs]|refus|invalid|401|403|offline|grace|api.bithuman|api-secret|http|fetch|baseUrl|bearer|validate|heartbeat|usage|create|pull|report", re.I)
NETWORK_MATCH = re.compile(r"https?://[^\s\"']+|api-secret|/v1/[A-Za-z/_-]+|api\.bithuman\.[a-z]+", re.I)
MAX_CLASS_BYTES=85000
MAX_MATCHES=200


def run(argv, timeout=25):
    try:
        p=subprocess.run(argv,capture_output=True,text=True,errors="replace",timeout=timeout,check=False)
        return {"exit":p.returncode,"stdout":p.stdout,"stderr":p.stderr[-1500:]}
    except (OSError,subprocess.TimeoutExpired) as error:
        return {"exit":None,"stdout":"","stderr":str(error)}


def safe(text):
    # Only public symbol names and references; never emit raw credential values.
    text=re.sub(r"(?i)(api-secret|authorization)(\\s*[:=]\\s*)[A-Za-z0-9._-]{12,}",r"\1\2[REDACTED]",text)
    return text[:600]


def one_aar(path):
    digest=hashlib.sha256(path.read_bytes()).hexdigest()
    with tempfile.TemporaryDirectory(prefix="android-credential-inspect-") as tmp,zipfile.ZipFile(path) as z:
        file=Path(tmp)/"classes.jar"
        file.write_bytes(z.read("classes.jar"))
        with zipfile.ZipFile(file) as j:
            classes=sorted(x[:-6].replace("/",".") for x in j.namelist()
                           if x.startswith("ai/bithuman/") and x.endswith(".class"))
        chosen=[cls for cls in classes if CLASS_MATCH.search(cls.rsplit(".",1)[-1])]
        records=[]
        for cls in chosen[:90]:
            output=run(["javap","-p","-c","-s","-classpath",str(file),cls])
            if output["exit"]!=0:continue
            body=output["stdout"][:MAX_CLASS_BYTES]
            lines=body.splitlines()
            focus=[]
            declarations=[]
            for n,line in enumerate(lines):
                stripped=line.strip()
                if stripped.endswith(";") and "(" in stripped and not stripped.startswith("//"):
                    if len(declarations)<80:declarations.append(safe(stripped))
                if SECURITY_MATCH.search(line):
                    if len(focus)<MAX_MATCHES:
                        focus.append({"line":n+1,"bytecode":safe(stripped)})
            records.append({
                "class":cls,
                "bytecode_characters":len(body),
                "method_declarations":declarations,
                "security_matching_lines":focus,
                "matching_line_count":len(focus),
            })
        literal_hits=[]
        for member in z.namelist():
            if not member.endswith((".jar",".properties",".xml",".json",".txt")):
                continue
            if member=="classes.jar":continue
            if z.getinfo(member).file_size>1_000_000:continue
            try:content=z.read(member).decode("utf-8","replace")
            except Exception:continue
            hits=[safe(s.strip()) for s in content.splitlines() if NETWORK_MATCH.search(s)]
            if hits:literal_hits.append({"resource":member,"hits":hits[:50]})
    return {
        "aar":path.name,
        "aar_bytes":path.stat().st_size,
        "sha256":digest,
        "all_classes":len(classes),
        "inspected_classes":len(records),
        "bytecode":records,
        "resource_network_hits":literal_hits,
    }


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--expression",type=Path,required=True)
    ap.add_argument("--essence",type=Path,required=True)
    ap.add_argument("--output",type=Path,required=True)
    args=ap.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    data={
        "analyzed_utc":datetime.now(timezone.utc).isoformat(),
        "scope":"Static bytecode review of official AARs. No keys, HTTP authentication attempts or binary modifications.",
        "expression2":one_aar(args.expression),
        "essence2":one_aar(args.essence),
    }
    target=args.output/"authentication_static_audit.json"
    target.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
    lines=["# bitHuman Android official SDK authentication / metering audit","",
           "This is a read-only method/bytecode reference inventory. It **does not prove** a server check can be omitted or bypassed.",
           "All findings describe published SDK bytecode, not a successful authenticated session.",""]
    for family in ("expression2","essence2"):
        row=data[family]
        lines+=["## "+family,"","- AAR: "+row["aar"],"- Bytes: "+str(row["aar_bytes"]),
                "- SHA256: "+row["sha256"],"- Inspected classes: "+str(row["inspected_classes"]),""]
        for c in row["bytecode"]:
            name=c["class"].split(".")[-1]
            if not (re.search(r"Credential|Meter|Avatar|ModelStore|DoorResolver|Refused|Exception",name,re.I)):continue
            lines+=["### "+c["class"],"",
                    "Methods and constructors:"] 
            lines+=["- "+item for item in c["method_declarations"][:45]]
            lines+=["","Authentication / metering / session bytecode references:"]
            for hit in c["security_matching_lines"][:85]:
                lines.append("- "+str(hit["line"])+": "+hit["bytecode"])
            lines.append("")
        if row["resource_network_hits"]:
            lines+=["## Resource references",""]
            for res in row["resource_network_hits"]:
                lines+=["- "+res["resource"]]
                lines+=["  - "+v for v in res["hits"][:25]]
    (args.output/"authentication_static_audit.md").write_text("\n".join(lines),encoding="utf-8")
    for family,row in ((x,data[x]) for x in ("expression2","essence2")):
        print("SDK_AAR",family,row["aar_bytes"],row["sha256"])
        for c in row["bytecode"]:
            name=c["class"].split(".")[-1]
            if re.search(r"Credential|Metering|MeteredDoorResolver|Expression2Avatar|Essence2Avatar",name,re.I):
                print("AUTH_CLASS",family,c["class"],"MATCHED_LINES",len(c["security_matching_lines"]))
                for hit in c["security_matching_lines"][:15]:
                    if any(t in hit["bytecode"].lower() for t in ("secret","http","valid","meter","refus","create")):
                        print(" AUTH_BC",hit["bytecode"][:250])
    assert any("Credential" in c["class"] for c in data["expression2"]["bytecode"])
    assert any("Credential" in c["class"] for c in data["essence2"]["bytecode"])
    print("AUTH_READ_ONLY_AUDIT_FINISHED")
if __name__=="__main__":
    main()
