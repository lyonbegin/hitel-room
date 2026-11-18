#!/usr/bin/env python3
"""Isolated IXIO HITEL synthetic LOGIN verification fixture — only two callsites.

For GitHub Actions emulator tests, reuse the verified old HITEL server and
test account from run 44008666524 without globally patching crypto or URLs.
1) Retrofit verifyCtn endpoint is the sole non-vendor path for the startup login
   verification; all other IXIOSetupWizardApi methods retain original URLs.
2) The *caller* MemberVerificationRepositoryImpl.verifyCtn receives the
   short-lived synthetic QA assertion at exactly its EncryptCtnUtil.encrypt
   callsite. The original EncryptCtnUtil and DEK/AES implementations are NEVER
   modified. A fixture is NOT a real subscriber verification or production login.
"""
from __future__ import annotations
import argparse,hashlib,json,re
from pathlib import Path

API="com/lguplus/aicallagent/network/api/ixio/IxIOSetupWizardApi.smali"
CALLER="com/lguplus/aicallagent/data/auth/MemberVerificationRepositoryImpl.smali"
LOGIN_USECASE="com/lguplus/aicallagent/domain/init/usecase/LogInUseCase.smali"
ORIGINAL_POST="v1/members/verify-ctn"
ORIGINAL_ENCRYPT=(
    "    invoke-virtual {p2, p1, v1}, "
    "Lcom/lguplus/aicallagent/util/EncryptCtnUtil;->encrypt("
    "Ljava/lang/String;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;\n"
    "    move-result-object p2"
)

def only_method(src:str,method:str)->re.Match[str]:
    pattern=r"(?ms)^\.method[^\n]*[ \t]"+re.escape(method)+r"\([^)]*\)[^\n]*\n.*?^\.end method$"
    found=list(re.finditer(pattern,src))
    if len(found)!=1:raise AssertionError((method,"method count",len(found)))
    return found[0]

def digest(p:Path)->str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

def main()->None:
    ap=argparse.ArgumentParser()
    ap.add_argument("--smali15",type=Path,required=True)
    ap.add_argument("--smali16",type=Path,required=True)
    ap.add_argument("--smali18",type=Path,required=True)
    ap.add_argument("--base-url",required=True)
    ap.add_argument("--qa-assertion",required=True)
    ap.add_argument("--report",type=Path,required=True)
    args=ap.parse_args()
    if not re.fullmatch(r"https://[a-z0-9-]+\.trycloudflare\.com/",args.base_url):
        raise ValueError("Only temporary HTTPS isolated QA backend supported")
    if not re.fullmatch(r"ixioqa_[0-9a-f]{80}",args.qa_assertion):
        raise ValueError("An isolated random, 80-char test assertion is required")
    root15=args.smali15;root16=args.smali16;root18=args.smali18
    files15=list(root15.rglob("*.smali"))
    files16=list(root16.rglob("*.smali"))
    files18=list(root18.rglob("*.smali"))
    if len(files15)<1000 or len(files16)<1000 or len(files18)<1000:
        raise AssertionError("Incomplete original DEX decoding")
    originals={p:digest(p) for p in files15+files16+files18}
    p_login=root15/LOGIN_USECASE
    p_api=root16/API
    p_caller=root18/CALLER
    if p_login not in originals or p_api not in originals or p_caller not in originals:
        raise FileNotFoundError("Original IXIO login verification classes missing")

    src=p_api.read_text()
    m=only_method(src,"verifyCtn")
    block=m.group()
    # Do not change the other Retrofit setup-wizard functions.
    post=re.compile(r'(?ms)(\.annotation runtime Lretrofit2/http/POST;\n\s+value = )"([^"]+)"(\n\s+\.end annotation)')
    matches=list(post.finditer(block))
    if len(matches)!=1:
        raise AssertionError(f"VerifyCtn POST annotations: {len(matches)}")
    source_path=matches[0].group(2)
    if source_path!=ORIGINAL_POST:
        raise AssertionError(f"Actual original verifyCtn relative URL does not match approved path: {source_path}")
    patched=post.sub(lambda hit:hit.group(1)+json.dumps(args.base_url+ORIGINAL_POST)+hit.group(3),block,count=1)
    if patched.replace(json.dumps(args.base_url+ORIGINAL_POST),json.dumps(ORIGINAL_POST),1)!=block:
        raise AssertionError("Unexpected mutation outside Retrofit verifyCtn annotation")
    p_api.write_text(src[:m.start()]+patched+src[m.end():])

    src=p_caller.read_text()
    m=only_method(src,"verifyCtn-gIAlu-s")
    block=m.group()
    # Baksmali may preserve blank lines between instruction and move-result.
    # Match precisely this one original login-only coroutine callsite.
    pattern=re.compile(
        r"(?m)^    invoke-virtual \{p2, p1, v1\}, "
        r"Lcom/lguplus/aicallagent/util/EncryptCtnUtil;->encrypt\("
        r"Ljava/lang/String;Lkotlin/coroutines/Continuation;\)Ljava/lang/Object;"
        r"\n(?:[ \t]*\n)*    move-result-object p2"
    )
    matches=list(pattern.finditer(block))
    if len(matches)!=1:
        raise AssertionError(("Exactly one original login crypto CALLSITE required",len(matches)))
    original_call=matches[0].group()
    const="    const-string p2, "+json.dumps(args.qa_assertion)
    patched=pattern.sub(lambda _:const,block,count=1)
    if patched.replace(const,original_call,1)!=block:
        raise AssertionError("Unexpected mutation in original repository method")
    p_caller.write_text(src[:m.start()]+patched+src[m.end():])

    # Only LogInUseCase.invoke() consumes the test assertion for /v2/login.
    # Keep generic GetEncryptedCtnUseCase, CtnRepository, EncryptCtnUtil
    # and all other original consumer methods entirely unchanged.
    src=p_login.read_text()
    m=only_method(src,"invoke")
    block=m.group()
    login_call=re.compile(
        r"(?m)^    invoke-virtual \{p1, v0\}, "
        r"Lcom/lguplus/aicallagent/domain/ixio/usecase/GetEncryptedCtnUseCase;->invoke"
        r"\(Lkotlin/coroutines/Continuation;\)Ljava/lang/Object;"
        r"\n(?:[ \t]*\n)*    move-result-object p1"
    )
    found=list(login_call.finditer(block))
    if len(found)!=1:
        raise AssertionError(("Exactly one LogInUseCase GetEncryptedCtn callsite required",len(found)))
    original_call=found[0].group()
    const_login="    const-string p1, "+json.dumps(args.qa_assertion)
    patched=login_call.sub(lambda _:const_login,block,count=1)
    if patched.replace(const_login,original_call,1)!=block:
        raise AssertionError("Unexpected original LogInUseCase mutation")
    p_login.write_text(src[:m.start()]+patched+src[m.end():])

    modified=[]
    for p in files15+files16+files18:
        if digest(p)!=originals[p]:
            root=root15 if p in files15 else root16 if p in files16 else root18
            modified.append(str(p.relative_to(root)))
    expected={LOGIN_USECASE,API,CALLER}
    if set(modified)!=expected:raise AssertionError(("Other code changed",modified))
    crypto=root16/"com/lguplus/aicallagent/util/EncryptCtnUtil.smali"
    if crypto not in originals or digest(crypto)!=originals[crypto]:
        raise AssertionError("Original CTN encryption was modified")
    report={
        "scope":"isolated synthetic HITEL QA login only",
        "source_success_run":44008666524,
        "original_verify_ctn_path":ORIGINAL_POST,
        "changed_method_1":"IxIOSetupWizardApi.verifyCtn() POST annotation only",
        "changed_method_2":"MemberVerificationRepositoryImpl.verifyCtn-gIAlu-s() synthetic QA assertion at original encryption callsite only",
        "changed_method_3":"LogInUseCase.invoke() synthetic QA assertion at original GetEncryptedCtnUseCase callsite only",
        "modified_source_files":sorted(modified),
        "modified_file_count":len(modified),
        "all_other_url_methods_original":True,
        "global_ctn_aes_dek_original":True,
        "synthetic_test_identity_only":True,
        "real_customer_login_claimed":False,
        "public_release_permitted":False,
        "qa_assertion_not_logged":True,
    }
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print("SCOPED_IXIO_VERIFY_CTN_LOGIN_ONLY_PATCH=PASS")
    print("ORIGINAL_MEMBER_AND_NONLOGIN_URLS_UNMODIFIED=YES")
    print("ORIGINAL_ENCRYPT_CTN_DEK_AES_UNMODIFIED=YES")
    print("QA_ASSERTION_NEVER_LOGGED=YES")

if __name__=="__main__":
    main()
