#!/usr/bin/env python3
"""Test-only hook into IXIO's EXISTING model-download entry and HTTP stack.

Only invokes the original RecentCallsViewModel.checkAndStartAiModelDownload()
once when its original home ViewModel finishes construction. Original model
download, model manifest, authentication logic, recorder, PCM and STT unchanged.
Marker-only instrumentation is used to identify each original step and the
HTTP status of model catalog calls, without logging tokens or response bodies.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT="com/lguplus/aicallagent/"
VM=ROOT+"recentcalls/ui/RecentCallsViewModel.smali"
PROBE=ROOT+"recentcalls/ui/HitelOriginalModelProbe.smali"
MODEL_USE_CASE=ROOT+"dip/domain/ai/usecase/UpdateAiModelUseCaseImpl.smali"
REMOTE_SOURCE=ROOT+"network/ai/AiModelRemoteSourceImpl.smali"
MODEL_API=ROOT+"network/api/ixio/IxIOAppConfigApi.smali"
UPDATE_REPO=ROOT+"data/call/ai/AiModelUpdateRepositoryImpl.smali"
SERVICE_MANAGER=ROOT+"data/service/AiModelDownloadServiceManagerImpl.smali"
CLIENT_INTERCEPTOR=ROOT+"network/client/IXIOPagesLoginMockInterceptor.smali"
PROBE_DESC="L"+PROBE.removesuffix(".smali")+";"
VM_DESC="L"+VM.removesuffix(".smali")+";"
METHOD=re.compile(r"(?ms)^\.method[^\n]*\n.*?^\.end method$")
MATCH_OPCODE=re.compile(
    r"^(?:invoke[-/]|move[-/ ]|const[-/ ]|sget[-/ ]|iget[-/ ]|"
    r"iput[-/ ]|sput[-/ ]|return[-/ ]|new[-/ ]|if[-/ ]|goto[-/ ]|"
    r"check-cast\b|instance-of\b|throw\b|filled-new-array\b|"
    r"array-length\b|aget[-/ ]|aput[-/ ]|monitor[-/ ]|"
    r"add[-/ ]|sub[-/ ]|and[-/ ]|or[-/ ]|xor[-/ ]|"
    r"mul[-/ ]|div[-/ ]|rem[-/ ]|cmp[-/ ]|int-to[-/ ]|long-to[-/ ]|"
    r"packed-switch\b|sparse-switch\b|nop\b)"
)
HOOKS=(
    (15,VM,"checkAndStartAiModelDownload","ORIGINAL_RECENTCALLS_ENTRY_ENTER"),
    (15,VM,"proceedAiModelDownload","ORIGINAL_RECENTCALLS_PROCEED_ENTER"),
    (16,MODEL_USE_CASE,"canStartDownload","ORIGINAL_DOWNLOAD_GATE_ENTER"),
    (16,MODEL_USE_CASE,"checkDownloadAvailability","ORIGINAL_AVAILABILITY_GATE_ENTER"),
    (16,MODEL_USE_CASE,"getAiModelInfoList-IoAF18A","ORIGINAL_MODEL_LIST_ENTER"),
    (16,MODEL_USE_CASE,"fetchUpdatingAiModel","ORIGINAL_FETCH_UPDATING_MODEL_ENTER"),
    (16,MODEL_USE_CASE,"downloadMissingModels-IoAF18A","ORIGINAL_DOWNLOAD_MISSING_MODELS_ENTER"),
    (16,MODEL_USE_CASE,"updateAiModels","ORIGINAL_UPDATE_MODELS_ENTER"),
    (16,REMOTE_SOURCE,"fetchAiModelInfo-gIAlu-s","ORIGINAL_REMOTE_VERSION_API_ENTER"),
    (16,REMOTE_SOURCE,"fetchAiModelInfoAuthenticated-gIAlu-s","ORIGINAL_REMOTE_AUTHENTICATED_API_ENTER"),
    (18,UPDATE_REPO,"startDownloads","ORIGINAL_WORKMANAGER_START_DOWNLOADS_ENTER"),
    (18,UPDATE_REPO,"startDownloadsInternal","ORIGINAL_WORKMANAGER_ENQUEUE_ENTER"),
    (18,UPDATE_REPO,"createDownloadWorker","ORIGINAL_CREATE_DOWNLOAD_WORKER_ENTER"),
    (18,SERVICE_MANAGER,"startService","ORIGINAL_DOWNLOAD_NOTIFICATION_SERVICE_ENTER"),
)

def sha(s: str)->str:
    return hashlib.sha256(s.encode("utf8")).hexdigest()

def method_by_name(s: str,name: str)->re.Match[str]:
    hits=[]
    for m in METHOD.finditer(s):
        header=m.group().splitlines()[0]
        if re.search(r"(?<![\w$])"+re.escape(name)+r"\(",header):
            hits.append(m)
    if len(hits)!=1:
        raise RuntimeError(f"Expected unique existing method {name}; got {len(hits)}")
    return hits[0]

def patch_existing(p: Path,name: str, transform)->dict:
    src=p.read_text(encoding="utf8")
    m=method_by_name(src,name)
    old=m.group()
    new=transform(old)
    if new==old:raise RuntimeError(f"No modification in {p} method {name}")
    if old.splitlines()[0]!=new.splitlines()[0]:raise RuntimeError("Method signature changed")
    p.write_text(src[:m.start()]+new+src[m.end():],encoding="utf8")
    return {"file":str(p),"method":name,"original_sha256":sha(old),
            "instrumented_sha256":sha(new)}

def before_first_opcode(block: str, instruction: str)->str:
    lines=block.splitlines(keepends=True)
    for i,line in enumerate(lines):
        t=line.strip()
        if t.startswith((".",":","#")) or not t:
            continue
        if MATCH_OPCODE.match(t):
            lines.insert(i,"    "+instruction+"\n")
            return "".join(lines)
    raise RuntimeError(f"Cannot find first original instruction in {block.splitlines()[0]}")

def new_probe_smali()->str:
    out=[f".class public final {PROBE_DESC}",
         ".super Ljava/lang/Object;","",
         ".method public constructor <init>()V",
         "    .registers 1",
         "    invoke-direct {p0}, Ljava/lang/Object;-><init>()V",
         "    return-void",
         ".end method"]
    labels=["TRIGGERED_AFTER_ORIGINAL_VIEWMODEL_CONSTRUCTOR"]+[h[3] for h in HOOKS]
    for n,event in enumerate(labels):
        out.extend(["",
          f".method public static mark{n}()V","    .registers 2",
          '    const-string v0, "IXIO_ORIGINAL_MODEL_PROBE"',
          "    const-string v1, "+json.dumps(event),
          "    invoke-static {v0, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I",
          "    return-void",".end method"])
    return "\n".join(out)+"\n"

def extract_api_path(src: str,name: str)->str:
    m=method_by_name(src,name)
    values=re.findall(r'(?m)^\s+value\s*=\s*"([^"]+)"\s*$',m.group())
    # Some annotations include unrelated values; method-specific Retrofit path
    # must have a slash or a model-relevant token.
    path=next((v for v in values if "/" in v or "model" in v.lower()),None)
    if not path:raise RuntimeError(f"Can't find original Retrofit path {name}: {values}")
    return path

def inject_http_status_only(src: str, paths: list[str])->str:
    # This pass-through arm runs ONLY for non-Pages-login requests. Do not
    # inspect headers, query parameters, payloads, status bodies or tokens.
    before=("    :passthrough\n"
            "    invoke-interface {p1, v0}, Lokhttp3/Interceptor$Chain;"
            "->proceed(Lokhttp3/Request;)Lokhttp3/Response;\n"
            "    move-result-object v0\n"
            "    return-object v0")
    if src.count(before)!=1:raise RuntimeError("Unexpected login fixture interceptor shape")
    paths=sorted(set(x.split("{")[0].strip("/") for x in paths))
    if any(len(x)<4 for x in paths):raise RuntimeError(f"Ambiguous model path(s): {paths}")
    lines=["    :passthrough",
      "    # HITEL QA: pass-through original model catalog requests, fixed-label logs only.",
      "    invoke-virtual {v1}, Lokhttp3/HttpUrl;->encodedPath()Ljava/lang/String;",
      "    move-result-object v2"]
    for idx,part in enumerate(paths):
        lines.extend([
          f"    const-string v3, {json.dumps(part)}",
          "    invoke-virtual {v2, v3}, Ljava/lang/String;->contains(Ljava/lang/CharSequence;)Z",
          "    move-result v4",
          "    if-nez v4, :hitel_model_http_request"])
    lines.extend([
      "    const/4 v4, 0x0",
      "    goto :hitel_model_http_proceed",
      "    :hitel_model_http_request",
      '    const-string v5, "IXIO_ORIGINAL_MODEL_HTTP"',
      '    const-string v6, "REQUEST_TO_ORIGINAL_MODEL_CATALOG"',
      "    invoke-static {v5, v6}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I",
      "    :hitel_model_http_proceed",
      "    invoke-interface {p1, v0}, Lokhttp3/Interceptor$Chain;->proceed(Lokhttp3/Request;)Lokhttp3/Response;",
      "    move-result-object v0",
      "    if-eqz v4, :hitel_model_http_return",
      "    invoke-virtual {v0}, Lokhttp3/Response;->code()I",
      "    move-result v6",
      "    invoke-static {v6}, Ljava/lang/String;->valueOf(I)Ljava/lang/String;",
      "    move-result-object v6",
      '    const-string v5, "IXIO_ORIGINAL_MODEL_HTTP_CODE"',
      "    invoke-static {v5, v6}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I",
      "    :hitel_model_http_return",
      "    return-object v0"])
    after="\n".join(lines)
    return src.replace(before,after,1)

def main():
    parser=argparse.ArgumentParser()
    for n in (15,16,18):
        parser.add_argument(f"--smali{n}",type=Path,required=True)
    parser.add_argument("--report",type=Path,required=True)
    a=parser.parse_args()
    roots={n:getattr(a,f"smali{n}") for n in (15,16,18)}
    # Do not operate against other builds without the expected actual original.
    vmfile=roots[15]/VM
    src=vmfile.read_text(encoding="utf8")
    constructors=[
        m for m in METHOD.finditer(src)
        if ".method public constructor <init>(" in m.group().splitlines()[0]
        and "Lkotlinx/coroutines/flow/StateFlow;" in m.group().splitlines()[0]
    ]
    if len(constructors)!=1:
        raise RuntimeError(f"Expected unique full original home ViewModel constructor, got {len(constructors)}")
    constructor=constructors[0].group()
    if constructor.count("return-void")!=1:
        raise RuntimeError("Original home constructor has an unexpected return shape")
    if "checkAndStartAiModelDownload" in constructor:
        raise RuntimeError("Original constructor already directly triggers model download")
    call=(f"    invoke-static {{}}, {PROBE_DESC}->mark0()V\n"
          f"    invoke-virtual/range {{p0 .. p0}}, {VM_DESC}->checkAndStartAiModelDownload()V\n")
    patched=constructor.replace("    return-void",call+"    return-void",1)
    vmfile.write_text(src[:constructors[0].start()]+patched+src[constructors[0].end():],encoding="utf8")
    changes=[{"file":VM,"method":"<init>(original full constructor)",
              "modification":"CALL_EXISTING_METHOD_ONCE_PER_NEW_HOME_VIEWMODEL",
              "original_sha256":sha(constructor),"instrumented_sha256":sha(patched)}]
    probe=roots[15]/PROBE
    if probe.exists():raise RuntimeError("Original unexpectedly contains HITEL probe class")
    probe.parent.mkdir(parents=True,exist_ok=True)
    probe.write_text(new_probe_smali(),encoding="utf8")

    for i,(dex,rel,name,event) in enumerate(HOOKS,1):
        p=roots[dex]/rel
        change=patch_existing(p,name,
            lambda b,ii=i:before_first_opcode(
                b,f"invoke-static {{}}, {PROBE_DESC}->mark{ii}()V"))
        change["event"]=event
        changes.append(change)

    api_text=(roots[16]/MODEL_API).read_text(encoding="utf8")
    original_paths=[extract_api_path(api_text,n) for n in (
         "getAiModelVersionV2","getAiModel")]
    interp=roots[16]/CLIENT_INTERCEPTOR
    original_interceptor=interp.read_text(encoding="utf8")
    new_interceptor=inject_http_status_only(original_interceptor,original_paths)
    interp.write_text(new_interceptor,encoding="utf8")
    changes.append({"file":CLIENT_INTERCEPTOR,
       "modification":"FIXED_LABEL_AND_HTTP_STATUS_ONLY_ON_ORIGINAL_MODEL_API",
       "original_sha256":sha(original_interceptor),
       "instrumented_sha256":sha(new_interceptor)})
    # No user account, bearer token, path parameter or response body printed.
    report={"mode":"DIRECT_ORIGINAL_MODEL_ENTRY_AFTER_ORIGINAL_HOME_VIEWMODEL_CREATION",
      "per_model_api_request_behavior":"PASSTHROUGH_TO_UNCHANGED_VENDOR_ENDPOINT",
      "changed_original_model_instructions":"LOG_ONLY_FIRST_INSTRUCTION",
      "original_model_control_flow_and_http_unchanged":True,
      "original_recorder_stt_pcm_dex_unchanged":True,
      "new_home_trigger_calls_existing_method":True,
      "synthetic_pages_login_remains_test_only":True,
      "original_model_endpoint_templates":original_paths,
      "changed_methods":changes,
      "probe_marker_tag":"IXIO_ORIGINAL_MODEL_PROBE",
      "http_status_marker_tag":"IXIO_ORIGINAL_MODEL_HTTP_CODE"}
    a.report.parent.mkdir(parents=True,exist_ok=True)
    a.report.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding="utf8")
    print("ORIGINAL_MODEL_DIRECT_ENTRY_INJECTED=YES",flush=True)
    print("EXISTING_MODEL_API_PATHS",json.dumps(original_paths),flush=True)
    print("MODEL_PROBE_METHODS",len(changes),flush=True)
    print("NO_NEW_DOWNLOADER_NO_FAKE_MODEL_NO_MODEL_AUTH_BYPASS=YES",flush=True)

if __name__=="__main__":
    main()
