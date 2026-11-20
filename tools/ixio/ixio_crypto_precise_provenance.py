#!/usr/bin/env python3
"""Original vs QA APK exact crypto class, JNI, app signing and provisioning bytecode provenance.
Read-only. Redacts all string values except a strict nonsecret allowlist.
"""
from __future__ import annotations
import argparse, collections, hashlib, json, pathlib, re, shutil, subprocess, tempfile, zipfile

METHOD_RE=re.compile(r"(?ms)^\.method[^\n]*\n.*?^\.end method$")
TARGETS=re.compile(r"(?:^|/)(?:ProvisioningManager(?:\$[^/]*)?|DekProviderLib(?:Impl)?|"
                   r"DekWrapper|EncryptedDekCrypto|ProvisioningKeyDeriver|KeystoreKekManager|"
                   r"AppBindingDataProvider|AES256Util|EncryptCtnUtil|NativeKeyProvider|"
                   r"IxIAuthenticator|IxITokenInterceptor(?:\$[^/]*)?|"
                   r"AuthCodeUseCase|DatastoreHandler|"
                   r"IXIApplication\$onCreate\$2)\.smali$",re.I)
SECURE_TERMS=re.compile(r"(?i)dek|crypt|keystore|key|aes|wrap|provision|binding|sign|auth|token|data.?store|native")
STRICT_STRINGS={"AndroidKeyStore","AES","AES/GCM/NoPadding","AES/CBC/PKCS5Padding",
                "device_wrapped_dek","encrypted_dek","keystore_alias","device_wrapped_dek not found"}
def sha(data:bytes)->str:return hashlib.sha256(data).hexdigest()
def dex_names(z):
    return sorted((s for s in z.namelist() if re.fullmatch(r"classes(?:\d+)?\.dex",s)),
                  key=lambda s:int(s[7:-4] or "1"))
def safe_lines(body:str,limit:int=400):
    out=[]
    for x in body.splitlines():
        x=x.strip()
        if not x:continue
        if x.startswith("const-string"):
            m=re.search(r'"([^"]*)"',x)
            out.append(re.sub(r'"[^"]*"','"'+(m.group(1) if m and m.group(1) in STRICT_STRINGS else "[REDACTED]")+'"',x)[:350])
        elif x.startswith(("invoke-","iget","iput","sget","sput",".method",".end method",".registers",".locals",
                           "if-","goto","throw","return","new-instance","move-result","check-cast",
                           "const/","const ",".catch",":")):
            out.append(x[:350])
        if len(out)==limit:
            out.append("TRUNCATED_IN_LOG_ONLY")
            break
    return out
def selected_method(src):
    a=[]
    for m in METHOD_RE.finditer(src):
        body=m.group()
        header=body.splitlines()[0]
        if re.search(r"native\b|loadLibrary",header,re.I):
            pass
        a.append({"signature":header,"sha256":sha(body.encode()),"asm":safe_lines(body)})
    return a
def unpack(z:zipfile.ZipFile,name:str,jar:pathlib.Path,parent:pathlib.Path)->dict[str,pathlib.Path]:
    dex=parent/name
    dex.write_bytes(z.read(name))
    out=parent/(name+".decoded")
    cp=subprocess.run(["java","-Xmx2400m","-jar",str(jar),"d","--api","34","--jobs","3",
                       "-o",str(out),str(dex)],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,
                      text=True,timeout=240)
    if cp.returncode:raise RuntimeError(name+" "+cp.stdout[-1200:])
    return {str(p.relative_to(out)):p for p in out.rglob("*.smali")}
def main():
    parser=argparse.ArgumentParser()
    for n in ("original","qa","jar","output"):parser.add_argument("--"+n,type=pathlib.Path,required=True)
    args=parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    data={"selected_original_classes":[],"original_qa_diff":[],"jni_source":[],"native_libraries":[]}
    with zipfile.ZipFile(args.original) as o,zipfile.ZipFile(args.qa) as q, tempfile.TemporaryDirectory() as t:
        tmp=pathlib.Path(t)
        names=dex_names(o)
        TARGET_DICES=[]
        for name in names:
            buf=o.read(name)
            if any(x in buf for x in (b"ProvisioningManager",b"NativeKeyProvider",b"DekProviderLib",
                                      b"KeystoreKekManager",b"EncryptCtnUtil",b"IXIApplication$onCreate$2")):
                TARGET_DICES.append(name)
        print("EXACT_CRYPTO_DEX_CANDIDATES",TARGET_DICES,flush=True)
        for name in TARGET_DICES:
            orig=unpack(o,name,args.jar,tmp)
            candidates=[p for p in orig if TARGETS.search(p) or p.startswith("com/lguplus/encryptor/")]
            print("ORIGINAL_DEX",name,"targeted_classes",len(candidates),flush=True)
            for path in sorted(candidates):
                raw=orig[path].read_text(errors="replace")
                methods=selected_method(raw)
                data["selected_original_classes"].append({
                    "dex":name,"class":path,"class_sha256":sha(raw.encode()),
                    "method_count":len(methods),"methods":methods})
                print("EXACT_CLASS",name,path,"method_count",len(methods),flush=True)
                for m in methods:
                    if SECURE_TERMS.search(m["signature"]) or any(z in path for z in
                        ("ProvisioningManager","DekProvider","Keystore","DekWrapper",
                         "AppBinding","NativeKeyProvider","ProvisioningKey","EncryptedDek")):
                        print("EXACT_METHOD",name,path,m["signature"][:250],flush=True)
                        for instruction in m["asm"]:
                            if instruction.startswith(("invoke-","iget","iput","sget","sput","const-string")):
                                print("  INSTRUCTION",instruction[:300],flush=True)
            if name not in {"classes15.dex","classes16.dex","classes18.dex"}:
                shutil.rmtree(tmp/(name+".decoded"));(tmp/name).unlink()
        # Exactly which bytecode class/methods changed between the original recovered and QA DEX:
        for name in ("classes15.dex","classes16.dex","classes18.dex"):
            if name not in names:raise RuntimeError("Missing base DEX "+name)
            p=tmp/(name+".decoded")
            if not p.exists():orig=unpack(o,name,args.jar,tmp)
            else:orig={str(x.relative_to(p)):x for x in p.rglob("*.smali")}
            qa=unpack(q,name,args.jar,tmp/"qa")
            different=[]
            for path in sorted(set(orig)|set(qa)):
                if path not in orig:
                    different.append({"class":path,"type":"ADDED","methods":[m["signature"] for m in selected_method(qa[path].read_text(errors="replace"))]})
                elif path not in qa:
                    different.append({"class":path,"type":"REMOVED"})
                else:
                    a=orig[path].read_text(errors="replace")
                    b=qa[path].read_text(errors="replace")
                    if a==b:continue
                    ma={m["signature"]:m["sha256"] for m in selected_method(a)}
                    mb={m["signature"]:m["sha256"] for m in selected_method(b)}
                    diff=[{"method":m,"original_sha256":ma.get(m),"qa_sha256":mb.get(m)}
                          for m in sorted(set(ma)|set(mb)) if ma.get(m)!=mb.get(m)]
                    different.append({"class":path,"type":"MODIFIED","method_differences":diff,
                                      "outside_method_bytes_changed":bool(not diff)})
            data["original_qa_diff"].append({"dex":name,"original_classes":len(orig),
                                            "qa_classes":len(qa),"changes":different})
            print("EXACT_QA_DEX_DIFF",name,"modified_classes",len(different),flush=True)
            for entry in different:
                print("EXACT_QA_CLASS_DIFF",entry["type"],entry["class"],
                      "methods",[x["method"] for x in entry.get("method_differences",[])],flush=True)
            shutil.rmtree(tmp/"qa"/(name+".decoded"))
        # Compare native libraries by entry checksum, without extracting library contents.
        for name in sorted(set(o.namelist())|set(q.namelist())):
            if not name.startswith("lib/") or not name.endswith(".so"):continue
            a=sha(o.read(name)) if name in o.namelist() else None
            b=sha(q.read(name)) if name in q.namelist() else None
            row={"name":name,"original_sha256":a,"qa_sha256":b,
                 "identical":a is not None and a==b}
            data["native_libraries"].append(row)
        print("NATIVE_SO_COUNT",len(data["native_libraries"]),flush=True)
        print("NATIVE_SO_DIFFERENCES",sum(not x["identical"] for x in data["native_libraries"]),flush=True)
        for row in data["native_libraries"]:
            if SECURE_TERMS.search(row["name"]):print("NATIVE_CRYPTO_LIB",row["name"],flush=True)
    path=args.output/"exact-crypto-provisioning-jni-original-vs-qa.json"
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2))
    print("EXACT_CODE_AUDIT_COMPLETE=YES",flush=True)

if __name__=="__main__":main()
