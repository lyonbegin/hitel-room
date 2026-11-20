#!/usr/bin/env python3
"""Full *read-only* IXIO DEX crypto/provisioning callsite inventory.
Source: original recovered/reassembled IXIO APK, NOT HITEL QA APK.
Never print key material, account identifiers, tokens, ciphertext, or raw string literals.
Produces method signatures, invoke targets, branch opcodes, storage API usage,
class/DEX locations and a comparison against the QA test build.
"""
from __future__ import annotations
import argparse, collections, hashlib, json, pathlib, re, subprocess, tempfile, zipfile
from typing import Any

OWN = "com/lguplus/aicallagent/"
METHOD_RE = re.compile(r"(?ms)^\.method[^\n]*\n.*?^\.end method$")
CALL_RE = re.compile(r"(?m)^\s*(invoke-[\w/-]+)\s+\{[^}]*\},\s+(L[^;\s]+;->[^\s]+)")
FIELD_RE = re.compile(r"(?m)^\s*((?:[is](?:get|put)(?:-object|-wide|-boolean)?))\s+[^,\n]*,\s+(L[^;\s]+;->[^\s]+)")
STRING_RE = re.compile(r'(?m)^\s*const-string(?:/jumbo)?\s+[^,]+,\s+"([^"]*)"')
METHOD_HEADER_RE = re.compile(r"^\.method\s+(.+)$")
INVOKE_RE = re.compile(r"^\s*(?:invoke-|new-instance|sget|iget|iput|sput)")
BRANCH_RE = re.compile(r"^\s*(?:if-|goto|throw|return|move-result|check-cast|\.catch|:)")

FAMILY = {
 "PROVISIONING": r"ProvisioningManager|Provisioning|device_wrapped_dek|wrapped_dek|(?:^|[/;$])Dek|dekForLogin|unwrapDek",
 "KEYSTORE": r"AndroidKeyStore|KeyStore|KeyGenParameterSpec|KeyGenerator|KeyPairGenerator|KeyProtection|KeyInfo|KeyPermanentlyInvalidatedException|KeyStoreException",
 "CRYPTO_PRIMITIVE": r"javax/crypto|java/security/(?:MessageDigest|SecureRandom|KeyFactory|Signature|KeyPair|KeyStore)|Cipher;|SecretKey|IvParameterSpec|GCMParameterSpec|AES256|RSA/|EC/|Hmac|Mac;->",
 "CTN": r"EncryptCtnUtil|CtnRepository|GetEncryptedCtnUseCase|VerifyCtn|verifyCtn|authorizeCtn",
 "CREDENTIAL_STORE": r"EncryptedSharedPreferences|EncryptedFile|MasterKey|SecurePreferences|DataStore|TokenStore|TokenRepository|TokenStorage|tokenPreference|(?:^|[/;$])Session",
 "AUTH_TRANSPORT": r"IxITokenInterceptor|IxIOAuth|IxIOMemberService|LoginUseCase|LogInUseCase|LoginUrl|auth-code|refreshToken|accessToken",
 "MODEL_CRYPTO": r"ModelCrypt|ModelDecrypt|ModelEncrypt|\.enc\b|IxiModel|AiModelFileRepository|DecryptModel|decryptModel|CryptoModel",
 "RECORDER_CRYPTO": r"CallRecorder|callrecorder|RecordingEncrypt|RecorderEncrypt|AudioEncrypt",
}
compiled = {name: re.compile(regex,re.I) for name,regex in FAMILY.items()}
ROOTS = [OWN, "com/lguplus/callrecorder/"]

def sha(b:bytes)->str:return hashlib.sha256(b).hexdigest()
def dex_files(z:zipfile.ZipFile)->list[str]:
    return sorted((n for n in z.namelist() if re.fullmatch(r"classes(?:[0-9]+)?\.dex",n)),
                  key=lambda x:int(x.removeprefix("classes").removesuffix(".dex") or 1))

def inventory_apks(a:pathlib.Path,b:pathlib.Path)->dict:
    with zipfile.ZipFile(a) as orig,zipfile.ZipFile(b) as qa:
        A=dex_files(orig);B=dex_files(qa)
        D=[{"dex":n,"original_sha256":sha(orig.read(n)),
            "qa_sha256":sha(qa.read(n)) if n in B else None,
            "identical":sha(orig.read(n))==sha(qa.read(n)) if n in B else False,
            "original_bytes":orig.getinfo(n).file_size} for n in A]
        all_names=set(orig.namelist())|set(qa.namelist())
        different=[n for n in sorted(all_names) if n in orig.namelist() and
                   n in qa.namelist() and sha(orig.read(n))!=sha(qa.read(n))]
        return {"main_dexes":D,"main_dex_count":len(A),"qa_dex_count":len(B),
                "changed_dexes":[x["dex"] for x in D if not x["identical"]],
                "changed_entries":different[:200],
                "source_apk_sha256":sha(a.read_bytes()),"qa_apk_sha256":sha(b.read_bytes())}

def redacted_asm(block:str,max_lines:int=240)->list[str]:
    lines=[]
    for line in block.splitlines():
        x=line.strip()
        if not x:continue
        if x.startswith("const-string"):
            value=STRING_RE.match(x)
            lit=value.group(1) if value else None
            if lit in {"device_wrapped_dek","device_wrapped_dek_not_found",
                       "AndroidKeyStore","AES","AES/GCM/NoPadding"}:
                lines.append(re.sub(r'"[^"]*"','"'+lit+'"',x)[:360])
            else:lines.append("const-string [REDACTED]")
        elif (x.startswith((".method",".registers",".locals",".end method")) or
            INVOKE_RE.match(x) or BRANCH_RE.match(x) or x.startswith(("const/","const ", "instance-of"))):
            lines.append(x[:360])
        if len(lines)>=max_lines:
            lines.append("...TRUNCATED_FOR_REPORT...")
            break
    return lines

def classify(path:str,head:str,block:str)->list[str]:
    # Security sensitive literal values are *never* copied into reports.
    data=path+"\n"+head+"\n"+block
    return [k for k,rex in compiled.items() if rex.search(data)]

def analyze(original:pathlib.Path,jar:pathlib.Path,report:pathlib.Path,label:str='main',allowed_roots:tuple[str,...]=tuple(ROOTS))->dict:
    summary=collections.Counter()
    by_family=collections.Counter()
    methods=[]
    all_callers=collections.defaultdict(list)
    class_inventory=[]
    with zipfile.ZipFile(original) as z, tempfile.TemporaryDirectory(prefix="ixio-crypto-") as td:
        root=pathlib.Path(td)
        for idx,name in enumerate(dex_files(z),1):
            dex=root/name
            dex.write_bytes(z.read(name))
            out=root/"dis"
            p=subprocess.run(["java","-Xmx2600m","-jar",str(jar),"d","--api","34",
                "--jobs","4","-o",str(out),str(dex)],
                text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=480)
            if p.returncode:
                raise RuntimeError(f"Baksmali {name} failed: {p.stdout[-1200:]}")
            smalis=list(out.rglob("*.smali"))
            count_app=0
            for smali in smalis:
                rel=str(smali.relative_to(out))
                if not rel.startswith(allowed_roots):
                    continue
                count_app+=1
                body=smali.read_text(encoding="utf8",errors="replace")
                class_names=[x.strip() for x in body.splitlines()[:12] if x.startswith(".class") or x.startswith(".super") or x.startswith(".source")]
                heads=[]
                hits=0
                for m in METHOD_RE.finditer(body):
                    mb=m.group()
                    head=mb.splitlines()[0]
                    heads.append(head)
                    groups=classify(rel,head,mb)
                    if not groups:continue
                    calls=[{"op":op,"target":target} for op,target in CALL_RE.findall(mb)]
                    crypto_calls=[c for c in calls if (
                        c["target"].startswith("L"+OWN) or
                        any(rex.search(c["target"]) for rex in compiled.values()) or
                        c["target"].startswith(("Ljava/security/","Ljavax/crypto/","Landroid/security/")))]
                    fields=[{"op":op,"target":target} for op,target in FIELD_RE.findall(mb)]
                    priority=(2 if any(x in rel for x in
                        ("ProvisioningManager","EncryptCtnUtil","AES256Util","KeyStore",
                         "CtnRepositoryImpl","MemberVerificationRepositoryImpl"))
                        else 1 if "PROVISIONING" in groups or "KEYSTORE" in groups
                        else 0)
                    refs={"dex":name,"class":rel,"signature":head,"families":groups,
                          "invoke_count":len(calls),"calls":crypto_calls[:120],
                          "field_accesses":fields[:85],
                          "branch_conditional_count":len(re.findall(r"(?m)^\s*if-\w+",mb)),
                          "redacted_asm":redacted_asm(mb,420 if priority==2 else 130) if priority else [],
                          "method_bytecode_smali_sha256":sha(mb.encode("utf8"))}
                    methods.append(refs)
                    hits+=1
                    for family in groups:by_family[family]+=1
                    for c in calls:
                        if c["target"].startswith("L"+OWN):
                            all_callers[c["target"].split("(")[0]].append(
                                {"dex":name,"class":rel,"caller":head,"opcode":c["op"]})
                if hits or any(compiled[k].search(rel) for k in FAMILY):
                    class_inventory.append({"dex":name,"class":rel,
                        "headers":class_names,"methods_total":len(heads),
                        "selected_methods":hits})
            summary[name+":all_smali_classes"]=len(smalis)
            summary[name+":app_owned_classes"]=count_app
            summary[name+":selected_methods"]=sum(x["dex"]==name for x in methods)
            print(f"DEX_ANALYZED {name} total_smali={len(smalis)} app_classes={count_app} selected_methods={summary[name+':selected_methods']}",flush=True)
            import shutil
            shutil.rmtree(out)
            dex.unlink()
    # Caller connections for key-ownership classes; include caller method as evidence.
    target_refs={}
    focus_re=re.compile(r"ProvisioningManager|EncryptCtnUtil|AES256Util|KeyStore|CtnRepository|TokenInterceptor|Login|Auth|ModelEncrypt|ModelDecrypt",re.I)
    for target,users in sorted(all_callers.items()):
        if focus_re.search(target):
            target_refs[target]=users[:400]
    method_focus=[m for m in methods if any(s in m["class"] for s in
        ("ProvisioningManager","EncryptCtnUtil","AES256Util","CtnRepositoryImpl","MemberVerificationRepositoryImpl"))]
    result={"origin":"RECONSTRUCTED_ORIGINAL_RUNTIME_DEX_NOT_PROTECTED_XAPK",
            "app_class_counts":dict(summary),
            "families_method_count":dict(by_family),
            "selected_method_count":len(methods),
            "interesting_class_count":len(class_inventory),
            "critical_methods":method_focus,
            "critical_incoming_calls":target_refs,
            "class_inventory":class_inventory,
            "all_selected_methods":methods}
    (report/f"{label}-full-crypto-method-index.json").write_text(
        json.dumps(result,ensure_ascii=False,indent=2))
    print("TOTAL_CRYPTO_RELEVANT_METHODS",label,len(methods),flush=True)
    print("FAMILY_COUNTS",json.dumps(dict(by_family),sort_keys=True),flush=True)
    print("PROVISIONING_AND_CTNCIPHER_CLASSES")
    for m in method_focus:
        print("ORIGINAL_DEX_METHOD",m["dex"],m["class"],m["signature"],
              "families="+",".join(m["families"]))
        for c in m["calls"][:28]:print("  CALL",c["op"],c["target"])
        for f in m["field_accesses"][:12]:print("  FIELD",f["op"],f["target"])
    for key in sorted(target_refs):
        if "ProvisioningManager" in key or "EncryptCtnUtil" in key:
            print("INBOUND",key,"callers",len(target_refs[key]))
            for caller in target_refs[key][:30]:
                print("  FROM",caller["dex"],caller["class"],caller["caller"][:140])
    return result

def main():
    ap=argparse.ArgumentParser()
    for name in ("original","qa","baksmali","report","protected-main-xapk","protected-recorder","recorder-reassembled"):
        ap.add_argument("--"+name,required=True,type=pathlib.Path)
    args=ap.parse_args()
    args.report.mkdir(parents=True,exist_ok=True)
    diff=inventory_apks(args.original,args.qa)
    (args.report/"reassembled-original-vs-qa-dex-hashes.json").write_text(json.dumps(diff,indent=2))
    print("QA_VS_ORIGINAL_DEX_CHANGED",diff["changed_dexes"],flush=True)
    with zipfile.ZipFile(args.protected_main_xapk) as x:
        print("ORIGINAL_PROTECTED_MAIN_XAPK",sha(args.protected_main_xapk.read_bytes()),flush=True)
        n=x.namelist()
        protected_summary={"xapk_sha256":sha(args.protected_main_xapk.read_bytes()),
            "apk_members":[{"name":k,"bytes":x.getinfo(k).file_size}
                          for k in n if k.endswith(".apk")],
            "note":"Protected original source APK; runtime reconstructed DEX used for method analysis."}
    with zipfile.ZipFile(args.protected_recorder) as r:
        rec={"protected_recorder_sha256":sha(args.protected_recorder.read_bytes()),
            "recorder_dexes":dex_files(r),
            "note":"Protected AppSealing recorder DEX is not guaranteed equivalent to runtime-unpacked recorder DEX."}
    (args.report/"source-provenance.json").write_text(json.dumps({"main":protected_summary,"recorder":rec},indent=2))
    analyze(args.original,args.baksmali,args.report,label='main',allowed_roots=(OWN,))
    analyze(args.recorder_reassembled,args.baksmali,args.report,label='recorder',allowed_roots=('com/lguplus/','com/inka/'))
    print("REPORT_READY=YES",flush=True)

if __name__=="__main__":main()
