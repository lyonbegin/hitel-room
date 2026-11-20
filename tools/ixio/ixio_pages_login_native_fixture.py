#!/usr/bin/env python3
"""Isolated static Pages IXIO login-only QA fixture. No Cloudflare, G2 or Railway.

The original DEX files are input. Preserve all original non-login calls, URLs,
encryption methods, recorder, STT, models, manifest and resources. Install one
OkHttp application interceptor that returns deterministic TEST ONLY responses
for explicit Pages login API paths and delegates *all* other requests unchanged.
The GitHub Pages browser OAuth screen returns a code/state to the genuine app
deep-link. This is NOT real authentication and must never be used in production.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import re
from pathlib import Path

ROOT = "com/lguplus/aicallagent/"
LOGIN_API = ROOT + "network/api/ixio/IxIOMemberServiceApi.smali"
AUTH_API = ROOT + "network/api/ixio/IxIOAuthApi.smali"
SETUP_API = ROOT + "network/api/ixio/IxIOSetupWizardApi.smali"
BASE = ROOT + "network/client/BaseServer.smali"
MOCK = ROOT + "network/client/IXIOPagesLoginMockInterceptor.smali"
ENTRY = ROOT + "domain/init/usecase/ResolveOnboardingLoginEntryUseCase.smali"
VERIFY_CALLER = ROOT + "data/auth/MemberVerificationRepositoryImpl.smali"
LOGIN_CALLER = ROOT + "domain/init/usecase/LogInUseCase.smali"
PAGES = "https://lyonbegin.github.io/hitel-room/"
API_PREFIX = PAGES + "ixio-qa-api/"
STATE = "hitel_pages_qa_state_20261120"
TEST_CTN = "ixio_pages_qa_ctn_fixture_no_real_identity"

def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()

def method(src: str, name: str) -> re.Match[str]:
    pattern = re.compile(
        r"(?ms)^\.method[^\n]*[ \t]" + re.escape(name) +
        r"\([^)]*\)[^\n]*\n.*?^\.end method$"
    )
    hits = list(pattern.finditer(src))
    if len(hits) != 1:
        raise AssertionError(f"Expected exactly one {name}, got {len(hits)}")
    return hits[0]

def patch_method(p: Path, name: str, transform) -> None:
    src = p.read_text(encoding="utf-8")
    m = method(src, name)
    old = m.group()
    new = transform(old)
    if old == new:
        raise AssertionError(f"Not modified: {p} {name}")
    p.write_text(src[:m.start()] + new + src[m.end():], encoding="utf-8")

def patch_retrofit(p: Path, name: str, verb: str, original_path: str) -> None:
    def edit(block: str) -> str:
        pattern = re.compile(
            r"(?ms)(\.annotation runtime Lretrofit2/http/" + verb +
            r";\n\s+value = )" + re.escape(json.dumps(original_path)) +
            r"(\n\s+\.end annotation)"
        )
        new, count = pattern.subn(
            lambda m: m.group(1) + json.dumps(API_PREFIX + original_path) + m.group(2),
            block
        )
        if count != 1:
            raise AssertionError(f"{name} {verb} {original_path}: {count} annotations")
        assert new.replace(json.dumps(API_PREFIX + original_path),
                           json.dumps(original_path), 1) == block
        return new
    patch_method(p, name, edit)

def patch_onboarding(block: str) -> str:
    b = (
        "    sget-object p0, Lcom/lguplus/aicallagent/domain/init/usecase/"
        "OnboardingLoginEntry$Blocked;->INSTANCE:Lcom/lguplus/aicallagent/"
        "domain/init/usecase/OnboardingLoginEntry$Blocked;"
    )
    l = (
        "    sget-object p0, Lcom/lguplus/aicallagent/domain/init/usecase/"
        "OnboardingLoginEntry$Login;->INSTANCE:Lcom/lguplus/aicallagent/"
        "domain/init/usecase/OnboardingLoginEntry$Login;"
    )
    assert block.count(b) == 1
    return block.replace(b, l, 1)

def patch_verify_caller(block: str) -> str:
    reg = re.compile(
        r"(?m)^    invoke-virtual \{p2, p1, v1\}, "
        r"Lcom/lguplus/aicallagent/util/EncryptCtnUtil;->encrypt\("
        r"Ljava/lang/String;Lkotlin/coroutines/Continuation;\)Ljava/lang/Object;"
        r"\n(?:[ \t]*\n)*    move-result-object p2"
    )
    assert len(list(reg.finditer(block))) == 1
    return reg.sub(lambda _: "    const-string p2, " + json.dumps(TEST_CTN), block, count=1)

def patch_login_caller(block: str) -> str:
    reg = re.compile(
        r"(?m)^    invoke-virtual \{p1, v0\}, "
        r"Lcom/lguplus/aicallagent/domain/ixio/usecase/GetEncryptedCtnUseCase;->invoke"
        r"\(Lkotlin/coroutines/Continuation;\)Ljava/lang/Object;"
        r"\n(?:[ \t]*\n)*    move-result-object p1"
    )
    assert len(list(reg.finditer(block))) == 1
    return reg.sub(lambda _: "    const-string p1, " + json.dumps(TEST_CTN), block, count=1)

def patch_base_client(block: str) -> str:
    marker = (
        "    invoke-virtual {v0}, Lokhttp3/OkHttpClient;->newBuilder()"
        "Lokhttp3/OkHttpClient$Builder;\n\n"
        "    move-result-object v0"
    )
    assert block.count(marker) == 1
    injection = (
        "\n\n"
        "    # HITEL Pages QA: a PASS-THROUGH interceptor for every non-login URL.\n"
        "    new-instance v4, Lcom/lguplus/aicallagent/network/client/"
        "IXIOPagesLoginMockInterceptor;\n"
        "    invoke-direct {v4}, Lcom/lguplus/aicallagent/network/client/"
        "IXIOPagesLoginMockInterceptor;-><init>()V\n"
        "    invoke-virtual {v0, v4}, Lokhttp3/OkHttpClient$Builder;"
        "->addInterceptor(Lokhttp3/Interceptor;)Lokhttp3/OkHttpClient$Builder;"
    )
    return block.replace(marker, marker + injection, 1)

def jwt_stub(kind: str) -> str:
    def b64(d: dict) -> str:
        return base64.urlsafe_b64encode(
            json.dumps(d, separators=(",", ":"), sort_keys=True).encode()
        ).decode().rstrip("=")
    # Intentionally INVALID signature; not a bearer credential accepted by a
    # real server. Only needed for client-side syntactic parsing in offline QA.
    return (
        b64({"alg":"HS256","typ":"JWT"}) + "." +
        b64({"sub":"hitel-pages-qa-local-only","iss":"hitel-pages-offline-qa",
             "iat":1795000000,"exp":4102444800,
             "token_use":kind,"aud":"hitel-pages-offline-client"}) +
        ".not-a-valid-cryptographic-signature"
    )

def response_jsons() -> dict[str, str]:
    login = {
        "baseUrl":PAGES,
        "authUri":"ixio-qa-login/",
        "tokenUri":"auth-code",
        "scopes":["openid","profile"],
        "clientId":"hitel-ci-android",
        "callbackUrl":"com.lguplus.aicallagent:/oauth2redirect",
        "prompt":"login",
        "state":STATE,
        "login_hint":"01077776666",
        "loginType":"HITEL_INTERNAL_QA",
    }
    token = {
        "accessToken":jwt_stub("access"), "refreshToken":jwt_stub("refresh"),
        "idToken":jwt_stub("id"), "tokenType":"Bearer", "name":"",
        "email":"","gender":"","birthdate":"","marketId":"LGT",
        "authUrl":None,
    }
    def wrap(d: dict | None, code="SUCCESS", message="OK") -> str:
        return json.dumps({"code":code,"message":message,"data":d},
                          separators=(",", ":"), ensure_ascii=True)
    return {
        "v1/members/verify-ctn":wrap({"isRegistered":True}),
        "v2/login":wrap(login),
        "login":wrap(login),
        "auth-code":wrap(token),
        "autologin":wrap(None,"ERROR_QA_NO_AUTOLOGIN","Offline test login only"),
    }

def interceptor_source() -> str:
    """Generate a tiny OkHttp interceptor. Restrict matching to exact Pages API
    path and method, never intercept the vendor's actual HTTPS host."""
    out = [
        ".class public final Lcom/lguplus/aicallagent/network/client/IXIOPagesLoginMockInterceptor;",
        ".super Ljava/lang/Object;",
        ".implements Lokhttp3/Interceptor;",
        "",
        ".method public constructor <init>()V",
        "    .registers 1",
        "    invoke-direct {p0}, Ljava/lang/Object;-><init>()V",
        "    return-void",
        ".end method",
        "",
        ".method public intercept(Lokhttp3/Interceptor$Chain;)Lokhttp3/Response;",
        "    .registers 10",
        "    invoke-interface {p1}, Lokhttp3/Interceptor$Chain;->request()Lokhttp3/Request;",
        "    move-result-object v0",
        "    invoke-virtual {v0}, Lokhttp3/Request;->url()Lokhttp3/HttpUrl;",
        "    move-result-object v1",
        "    invoke-virtual {v1}, Lokhttp3/HttpUrl;->host()Ljava/lang/String;",
        "    move-result-object v2",
        '    const-string v3, "lyonbegin.github.io"',
        "    invoke-virtual {v3, v2}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z",
        "    move-result v4",
        "    if-eqz v4, :passthrough",
        "    invoke-virtual {v1}, Lokhttp3/HttpUrl;->encodedPath()Ljava/lang/String;",
        "    move-result-object v2",
        "    invoke-virtual {v0}, Lokhttp3/Request;->method()Ljava/lang/String;",
        "    move-result-object v5",
        '    const-string v3, "POST"',
        "    invoke-virtual {v3, v5}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z",
        "    move-result v4",
        "    if-nez v4, :post",
        '    const-string v3, "GET"',
        "    invoke-virtual {v3, v5}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z",
        "    move-result v4",
        "    if-eqz v4, :passthrough",
        '    const-string v3, "/hitel-room/ixio-qa-api/login"',
        "    invoke-virtual {v3, v2}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z",
        "    move-result v4",
        "    if-eqz v4, :passthrough",
        "    goto :mock_login",
        "",
        "    :post",
    ]
    body = response_jsons()
    routes = [
        ("v1/members/verify-ctn","mock_verify"),
        ("v2/login","mock_login"),
        ("auth-code","mock_token"),
        ("autologin","mock_auto"),
    ]
    for name,label in routes:
        out.extend([
            '    const-string v3, ' + json.dumps("/hitel-room/ixio-qa-api/" + name),
            "    invoke-virtual {v3, v2}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z",
            "    move-result v4",
            f"    if-nez v4, :{label}",
        ])
    out.extend(["    goto :passthrough"])
    for label,endpoint in [
        ("mock_verify","v1/members/verify-ctn"), ("mock_login","v2/login"),
        ("mock_token","auth-code"), ("mock_auto","autologin"),
    ]:
        out.extend([
            "",
            f"    :{label}",
            "    const-string v6, " + json.dumps(body[endpoint], ensure_ascii=True),
            "    goto :mock_response",
        ])
    out.extend([
        "",
        "    :mock_response",
        '    const-string v2, "IXIO_PAGES_QA_ONLY"',
        '    const-string v3, "Offline login-only response. All vendor HTTP untouched."',
        "    invoke-static {v2, v3}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I",
        "    new-instance v1, Lokhttp3/Response$Builder;",
        "    invoke-direct {v1}, Lokhttp3/Response$Builder;-><init>()V",
        "    invoke-virtual {v1, v0}, Lokhttp3/Response$Builder;->request(Lokhttp3/Request;)Lokhttp3/Response$Builder;",
        "    sget-object v2, Lokhttp3/Protocol;->HTTP_1_1:Lokhttp3/Protocol;",
        "    invoke-virtual {v1, v2}, Lokhttp3/Response$Builder;->protocol(Lokhttp3/Protocol;)Lokhttp3/Response$Builder;",
        "    const/16 v2, 0xc8",
        "    invoke-virtual {v1, v2}, Lokhttp3/Response$Builder;->code(I)Lokhttp3/Response$Builder;",
        '    const-string v2, "OK"',
        "    invoke-virtual {v1, v2}, Lokhttp3/Response$Builder;->message(Ljava/lang/String;)Lokhttp3/Response$Builder;",
        "    sget-object v2, Lokhttp3/ResponseBody;->Companion:Lokhttp3/ResponseBody$Companion;",
        "    sget-object v3, Lokhttp3/MediaType;->Companion:Lokhttp3/MediaType$Companion;",
        '    const-string v4, "application/json; charset=utf-8"',
        "    invoke-virtual {v3, v4}, Lokhttp3/MediaType$Companion;->get(Ljava/lang/String;)Lokhttp3/MediaType;",
        "    move-result-object v3",
        "    invoke-virtual {v2, v6, v3}, Lokhttp3/ResponseBody$Companion;->create(Ljava/lang/String;Lokhttp3/MediaType;)Lokhttp3/ResponseBody;",
        "    move-result-object v2",
        "    invoke-virtual {v1, v2}, Lokhttp3/Response$Builder;->body(Lokhttp3/ResponseBody;)Lokhttp3/Response$Builder;",
        "    invoke-virtual {v1}, Lokhttp3/Response$Builder;->build()Lokhttp3/Response;",
        "    move-result-object v0",
        "    return-object v0",
        "",
        "    :passthrough",
        "    invoke-interface {p1, v0}, Lokhttp3/Interceptor$Chain;->proceed(Lokhttp3/Request;)Lokhttp3/Response;",
        "    move-result-object v0",
        "    return-object v0",
        ".end method",
        "",
    ])
    return "\n".join(out)

def main() -> None:
    parser = argparse.ArgumentParser()
    for n in (15,16,18):
        parser.add_argument(f"--smali{n}", type=Path, required=True)
    parser.add_argument("--report",type=Path,required=True)
    args = parser.parse_args()
    roots={n:getattr(args,f"smali{n}") for n in (15,16,18)}
    files={n:sorted(roots[n].rglob("*.smali")) for n in roots}
    if any(len(files[n])<1000 for n in roots):
        raise AssertionError("Incomplete original DEX disassembly")
    original={p:sha(p) for n in roots for p in files[n]}
    def source(n: int, rel: str) -> Path:
        p=roots[n]/rel
        if p not in original:raise FileNotFoundError(str(p))
        return p
    for rel, name, verb, endpoint in [
        (LOGIN_API,"getLoginData","GET","login"),
        (LOGIN_API,"getLoginDataV2","POST","v2/login"),
        (LOGIN_API,"getTokenData","POST","auth-code"),
        (AUTH_API,"postAutoLogin","POST","autologin"),
        (SETUP_API,"verifyCtn","POST","v1/members/verify-ctn"),
    ]:
        patch_retrofit(source(16,rel),name,verb,endpoint)
    patch_method(source(15,ENTRY),"invoke",patch_onboarding)
    patch_method(source(15,LOGIN_CALLER),"invoke",patch_login_caller)
    patch_method(source(18,VERIFY_CALLER),"verifyCtn-gIAlu-s",patch_verify_caller)
    patch_method(source(16,BASE),"createClient$network",patch_base_client)
    mock=roots[16]/MOCK
    if mock.exists():raise AssertionError("Mock class already in original APK")
    mock.parent.mkdir(parents=True,exist_ok=True)
    mock.write_text(interceptor_source(),encoding="utf-8")
    changed={}
    for n in roots:
        changed[n]=[str(p.relative_to(roots[n])) for p in files[n] if sha(p)!=original[p]]
    expected={15:{ENTRY,LOGIN_CALLER},16:{LOGIN_API,AUTH_API,SETUP_API,BASE},18:{VERIFY_CALLER}}
    for n in roots:
        if set(changed[n])!=expected[n]:
            raise AssertionError({"dex":n,"got":changed[n],"expected":sorted(expected[n])})
    protected=[
        "com/lguplus/aicallagent/util/EncryptCtnUtil.smali",
        "com/lguplus/aicallagent/util/AES256Util.smali",
        "com/lguplus/aicallagent/network/IXIBuildConfig$Api.smali",
        "com/lguplus/aicallagent/network/client/RetrofitServiceFactory.smali",
        "com/lguplus/aicallagent/network/client/ixio/IxIOAuthServer.smali",
        "com/lguplus/aicallagent/network/client/ixio/IxIOSetupWizardServer.smali",
        "com/lguplus/aicallagent/network/client/ixio/IxIOMemberServiceServer.smali",
    ]
    for rel in protected:
        p=roots[16]/rel
        if p not in original or original[p]!=sha(p):
            raise AssertionError("Protected original function or URL changed: "+rel)
    report={
        "mode":"STATIC_PAGES_OAUTH_PLUS_ANDROID_LOCAL_LOGIN_ONLY_FIXTURE",
        "external_api_servers_used":[],
        "pages_browser_login":PAGES+"ixio-qa-login/",
        "login_apis_mocked":[f"{API_PREFIX}{q}" for q in response_jsons()],
        "original_nonlogin_url_unchanged":True,
        "original_ctn_aes_dek_stt_recording_unchanged":True,
        "changes_by_dex":changed,
        "new_class":MOCK,
        "synthetic_test_tokens_only":True,
        "not_real_customer_authentication":True,
    }
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print("STATIC_GITHUB_PAGES_ONLY_LOGIN_FIXTURE_CODE_GENERATED=YES")
    print("ORIGINAL_NONLOGIN_URLS_CRYPTO_STT_RECORDER_UNCHANGED=YES")
    print("CHANGED_ORIGINAL_CLASSES_BY_DEX="+json.dumps(changed,sort_keys=True))
    print("OFFLINE_TEST_ONLY_NOT_REAL_AUTHENTICATION=YES")

if __name__=="__main__":
    main()
