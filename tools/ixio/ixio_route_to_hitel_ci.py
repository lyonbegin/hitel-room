#!/usr/bin/env python3
"""Test-only original IXIO DEX patch for a GitHub Actions ephemeral HITEL backend.

Never patch a production install or point vendor subscriber data to vendor APIs.
The app contains a one-run QA assertion and uses emulator-only 10.0.2.2:8000.
All edits are explicit and verified against original Smali method names.
"""
import argparse
import json
import pathlib
import re

DEFAULT="http://10.0.2.2:8000/"
MARKER="HITEL_CI_BACKEND_URL_ONLY"

def replace_method(path,descriptor,method_body):
    data=path.read_text(encoding="utf8")
    pat=re.compile(r"(?ms)^\.method[^\n]*[ \t]"+re.escape(descriptor)+r"\n.*?^\.end method$")
    matches=list(pat.finditer(data))
    if len(matches)!=1:
        raise ValueError(f"Expected exactly 1 {descriptor} in {path}: {len(matches)}")
    new=pat.sub(method_body.rstrip(),data,count=1)
    path.write_text(new,encoding="utf8")
    return {"file":str(path),"method":descriptor}

def string_return_method(original_line,retval):
    return original_line+"\n    .registers 1\n    const-string p0, "+json.dumps(retval)+"\n    return-object p0\n.end method"

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",type=pathlib.Path,required=True)
    ap.add_argument("--qa-assertion",required=True)
    ap.add_argument("--base-url",default=DEFAULT)
    ap.add_argument("--report",type=pathlib.Path,required=True)
    arg=ap.parse_args()
    if arg.base_url!=DEFAULT:raise ValueError("CI build supports only emulator host 10.0.2.2")
    if len(arg.qa_assertion)<32 or not arg.qa_assertion.isascii():raise ValueError("Short or invalid CI assertion")
    root=arg.root/"com/lguplus/aicallagent"
    files={
      "base":root/"network/client/BaseServer.smali",
      "factory":root/"network/client/RetrofitServiceFactory.smali",
      "api":root/"network/IXIBuildConfig$Api.smali",
      "aes":root/"util/AES256Util.smali",
      "ctn":root/"util/EncryptCtnUtil.smali",
      "network_config":root/"network/NetworkUrlConfigImpl.smali",
    }
    for k,p in files.items():
        if not p.exists():raise FileNotFoundError(f"{k}: {p}")
    modified=[]
    # Network construction must have a loopback URL BEFORE any Retrofit client is created.
    for key,header in (
      ("base",".method private final getUrl()Ljava/lang/String;"),
      ("factory",".method private final resolveBaseUrl(Lcom/lguplus/aicallagent/network/client/NetworkBaseUrl;)Ljava/lang/String;"),
    ):
        method=header+"\n    .registers 2\n    const-string v0, "+json.dumps(arg.base_url)+"\n    return-object v0\n.end method"
        modified.append(replace_method(files[key],header.split()[-1],method))

    # Other original code often runs AES.decrypt() on encrypted BuildConfig API host strings.
    # Replace ONLY the code's API URL getters by an explicit local marker.
    data=files["api"].read_text(encoding="utf8")
    targets=re.findall(r"(?m)^\.method public final (get[A-Za-z0-9_$]*URL\(\)Ljava/lang/String;)$",data)
    if len(targets)<5:
        raise ValueError(f"Too few original URL getters found: {targets}")
    for mname in targets:
        header=".method public final "+mname
        modified.append(replace_method(files["api"],mname,string_return_method(header,MARKER)))

    # AES.decrypt remains unchanged for everything except the explicit local build marker.
    p=files["aes"]
    data=p.read_text(encoding="utf8")
    sig="decrypt(Ljava/lang/String;)Ljava/lang/String;"
    pat=re.compile(r"(?ms)^(\.method public final "+re.escape(sig)+r"\n[ \t]*\.registers[ \t]+\d+[^\n]*\n)(.*?)(^\.end method$)")
    ms=list(pat.finditer(data))
    if len(ms)!=1:raise ValueError("AES256Util.decrypt signature missing or ambiguous")
    branch=(
       "    const-string v0, "+json.dumps(MARKER)+"\n"
       "    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z\n"
       "    move-result v0\n"
       "    if-eqz v0, :hitel_ci_run_original_decrypt\n"
       "    const-string v0, "+json.dumps(arg.base_url)+"\n"
       "    return-object v0\n"
       "    :hitel_ci_run_original_decrypt\n"
    )
    # Do not collide with labels from original code
    if ":hitel_ci_run_original_decrypt" in ms[0].group(2):raise ValueError("label conflict")
    data=data[:ms[0].start()]+ms[0].group(1)+branch+ms[0].group(2)+ms[0].group(3)+data[ms[0].end():]
    p.write_text(data,encoding="utf8")
    modified.append({"file":str(p),"method":sig,"change":"only explicit CI marker"})

    # App-config crypto getter is initialized eagerly, so don't let it decrypt CI marker.
    header=".method public constructor <init>(Lcom/lguplus/aicallagent/util/crypto/CryptoService;)V"
    method=(header+"\n    .registers 3\n"
      "    invoke-direct {p0}, Ljava/lang/Object;-><init>()V\n"
      "    iput-object p1, p0, Lcom/lguplus/aicallagent/network/NetworkUrlConfigImpl;->cryptoService:Lcom/lguplus/aicallagent/util/crypto/CryptoService;\n"
      "    const-string v0, "+json.dumps(arg.base_url)+"\n"
      "    iput-object v0, p0, Lcom/lguplus/aicallagent/network/NetworkUrlConfigImpl;->appConfigServiceBaseUrl:Ljava/lang/String;\n"
      "    return-void\n.end method")
    modified.append(replace_method(files["network_config"],header.split()[-1],method))

    # Only the ephemeral GitHub Actions emulator test uses a pre-authorized, seeded QA identity.
    # This is NOT a vendor CTN cipher replacement for production.
    sig="encrypt(Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;"
    header=".method public final "+sig
    method=header+"\n    .registers 3\n    const-string v0, "+json.dumps(arg.qa_assertion)+"\n    return-object v0\n.end method"
    modified.append(replace_method(files["ctn"],sig,method))
    arg.report.parent.mkdir(parents=True,exist_ok=True)
    arg.report.write_text(json.dumps({
      "test_scope":"GitHub Actions emulator only; no external host or real user",
      "origin":"original IXIO main classes16.dex; other DEX unchanged",
      "patched_smali_methods":modified,
      "api_getters_patched":targets,
      "original_vendor_urls_kept_out_of_execution_for_patched_retrofit_builders":True,
      "ci_qa_assertion_included":True,
      "ci_qa_assertion_value_logged":False,
      "local_base_url":arg.base_url,
      "limitation":"This proves only test-app routing; actual account/token/login and STT functionality require separate device testing."
    },ensure_ascii=False,indent=2))
    print("PATCHED_METHOD_COUNT",len(modified))
    print("API_URL_GETTERS",targets)
    print("CI_ORIGINAL_STT_DEX_UNMODIFIED",True)

if __name__=="__main__":
    main()
