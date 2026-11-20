#!/usr/bin/env python3
"""Read-only original IXIO model download + recorder continuation-path audit.
NO gate skipping, no replacement models, no rebuilding app, no credentials.
Only reports exact source DEX class, method, calls, conditions and redacted literals.
"""
from __future__ import annotations
import argparse, collections, json, pathlib, re, subprocess, tempfile, zipfile
from typing import Any

METHOD=re.compile(r"(?ms)^\.method[^\n]*\n.*?^\.end method$")
INVOKE=re.compile(r"(?m)^\s*(invoke-[\w/-]+)\s+\{[^}]*\},\s+(L[^;\s]+;->[^\s]+)")
TARGETS=(
 ("INIT_MODEL","domain/init/usecase/InitScreenUseCase.smali"),
 ("MODEL_CHECK","domain/init/usecase/CheckAiModelListUseCase.smali"),
 ("RECENT_UI","recentcalls/ui/RecentCallsViewModel.smali"),
 ("MODEL_UI","ui/progressbar/DownloadViewModel.smali"),
 ("MODEL_ORCHESTRATOR","dip/domain/ai/usecase/UpdateAiModelUseCaseImpl.smali"),
 ("MODEL_AVAILABILITY","dip/domain/ai/usecase/CheckAiModelAvailabilityUseCaseImpl.smali"),
 ("MODEL_REMOTE","network/ai/AiModelRemoteSourceImpl.smali"),
 ("MODEL_REMOTE_INTERFACE","network/ai/AiModelRemoteSource.smali"),
 ("MODEL_API","network/ai/AiModelApi.smali"),
 ("MODEL_UPDATE","data/call/ai/AiModelUpdateRepositoryImpl.smali"),
 ("MODEL_REPO","data/ai/AiModelRepositoryImpl.smali"),
 ("MODEL_MANAGEMENT","data/ai/AiModelManagementRepositoryImpl.smali"),
 ("MODEL_SERVICE","data/service/AiModelDownloadService.smali"),
 ("MODEL_SERVICE_MANAGER","data/service/AiModelDownloadServiceManagerImpl.smali"),
 ("MODEL_LIST","data/init/CheckAiModelListRepositoryImpl.smali"),
 ("MODEL_FILE","data/call/ai/AiModelFileRepositoryImpl.smali"),
 ("RECORDER_STATE","domain/setting/usecase/CheckCallRecorderAppStateUseCase.smali"),
 ("RECORDER_POLICY","dip/domain/recording/usecase/CheckRecordingAvailabilityUseCaseImpl.smali"),
 ("RECORD_AVAIL_PARAM","dip/domain/recording/model/RecordingAvailabilityParam.smali"),
 ("RECORD_SETTINGS","data/setting/CallRecorderSettingRepositoryImpl.smali"),
 ("IN_CALL","incall/call/service/InCallServiceImpl.smali"),
 ("CALL_VM","incall/call/viewmodel/CallViewModel.smali"),
)
PATTERN=re.compile(r"(?i)(download|model|update|record|service|complete|init|version|"
                   r"fetch|url|state|progress|oncreate|onstart|check|policy|available|"
                   r"permission|bind|callconnected|start|retry)")
CRITICAL_INVOKES=re.compile(r"(?i)(AiModel|model|Download|download|Record|record|"
                            r"Retrofit|OkHttp|UserService|ServiceManager|WorkManager|"
                            r"android/app/DownloadManager|Context;->start|"
                            r"ContextCompat;->startForegroundService|"
                            r"Bind|Remote|Updater|URL|Url|Service;->|IXIApplication;)")
RED_FLAG_RE=re.compile(r"(?i)(model.*download|download.*model|downloadservice|"
                       r"ModelRemote|modelList|model.*version|RecordFail|"
                       r"RECORDING_POLICY_NOT_ALLOWED|isRecordingAllowedByPolicy|"
                       r"RecordingAvailabilityParam|InCallService|AiModelFile)")
def method_index(src,cls,dex):
    result=[]
    for item in METHOD.finditer(src):
        block=item.group()
        head=block.splitlines()[0]
        if not PATTERN.search(head):continue
        all_calls=INVOKE.findall(block)
        wanted=[{"op":op,"target":dest} for op,dest in all_calls if CRITICAL_INVOKES.search(dest)]
        if not (wanted or PATTERN.search(head)):continue
        literals=[]
        # Whitelist only nonsensitive workflow diagnostics, never emit arbitrary strings
        for line in block.splitlines():
            m=re.search(r'\bconst-string(?:/jumbo)?\s+[pv]\d+,\s+"([^"]+)"',line)
            if m and m.group(1) in {"RECORDING_POLICY_NOT_ALLOWED","SUCCESS","ERROR",
                    "PENDING","FAILED","COMPLETE","DOWNLOADING","NOT_DOWNLOADED"}:
                literals.append(m.group(1))
        short_cond=[
            ln.strip()[:260] for ln in block.splitlines()
            if re.search(r"^\s*(if-|goto|throw |sget-object|new-instance)\b",ln)
            and re.search(r"(?i)(model|download|record|policy|fail|permission|service|:cond|:goto)",ln)
        ]
        result.append({"dex":dex,"class":cls,"method":head,
          "invokes":wanted[:180],
          "all_invokes_count":len(all_calls),
          "condition_count":len(re.findall(r"(?m)^\s*if-\w+",block)),
          "relevant_branch_statements":short_cond[:85],
          "safe_literal_flags":sorted(set(literals))})
    return result

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--apk",required=True,type=pathlib.Path)
    p.add_argument("--baksmali",required=True,type=pathlib.Path)
    p.add_argument("--out",required=True,type=pathlib.Path)
    a=p.parse_args()
    a.out.mkdir(parents=True,exist_ok=True)
    report={"source_apk":"ORIGINAL_REASSEMBLED_IXIO_NOT_HITEL_QA",
            "matched_classes":[],"methods":[],"incoming_targets":{},
            "model_api_candidates":[],"recorder_model_transition":[]}
    with zipfile.ZipFile(a.apk) as z, tempfile.TemporaryDirectory() as td:
        base=pathlib.Path(td)
        allfiles={}
        for n in (15,16,17,18):
            name=f"classes{n}.dex"
            d=base/name
            d.write_bytes(z.read(name))
            out=base/f"smali{n}"
            cp=subprocess.run(["java","-Xmx2500m","-jar",str(a.baksmali),
                "d","--jobs","3","--api","34","-o",str(out),str(d)],
                capture_output=True,text=True,timeout=260)
            if cp.returncode:raise RuntimeError(cp.stdout[-1000:]+cp.stderr[-1000:])
            allfiles[n]=out
            print("UNPACKED_ORIGINAL",name,len(list(out.rglob("*.smali"))),flush=True)
        aroot="com/lguplus/aicallagent/"
        target_names=set()
        for tag,part in TARGETS:
            found=[]
            for n,out in allfiles.items():
                fp=out/(aroot+part)
                if fp.exists():
                    text=fp.read_text(errors="replace")
                    entries=method_index(text,part,f"classes{n}.dex")
                    report["methods"].extend(entries)
                    found.append(f"classes{n}.dex")
                    target_names.add(fp.stem)
                    print("TARGET",tag,part,"DEX",n,"methods",len(entries),flush=True)
            report["matched_classes"].append({"name":tag,"path":part,"found_in":found})
        # Match additional service/api/repository types only; not all third-party framework classes
        for n,out in allfiles.items():
            for f in (out/aroot).rglob("*.smali"):
                rel=str(f.relative_to(out))
                if not re.search(r"(?i)(AiModel|ModelDownload|DownloadAi|ModelFile|ModelUpdate|"
                                 r"ModelRemote|AiEngine|DownloadManager|CallRecorder|RecordingAvailability)",rel):
                    continue
                if any(rel==aroot+part for _,part in TARGETS):continue
                code=f.read_text(errors="replace")
                for m in METHOD.finditer(code):
                    b=m.group()
                    head=b.splitlines()[0]
                    if not PATTERN.search(head):continue
                    if not re.search(r"(?i)(download|model|http|record|start|check)",head):continue
                    calls=[{"op":op,"target":dest} for op,dest in INVOKE.findall(b)
                           if CRITICAL_INVOKES.search(dest)]
                    if not calls:continue
                    report["model_api_candidates"].append({
                        "dex":f"classes{n}.dex","class":rel,
                        "method":head,"calls":calls[:35]})
        # Inbound call sites into key model download and recorder classes, beyond root packages
        keys=("AiModelDownloadService","AiModelDownloadServiceManagerImpl",
              "AiModelUpdateRepositoryImpl","UpdateAiModelUseCaseImpl",
              "AiModelRemoteSourceImpl","CheckAiModelListRepository",
              "CheckRecordingAvailabilityUseCaseImpl")
        edges=collections.defaultdict(list)
        for n,out in allfiles.items():
            for f in (out/aroot).rglob("*.smali"):
                rel=str(f.relative_to(out))
                src=f.read_text(errors="replace")
                for m in METHOD.finditer(src):
                    head=m.group().splitlines()[0]
                    for op,dest in INVOKE.findall(m.group()):
                        if any(k in dest for k in keys):
                            edges[dest.split("(")[0]].append({"dex":f"classes{n}.dex",
                                  "caller_class":rel,"caller_method":head,"opcode":op})
        report["incoming_targets"]={k:v[:120] for k,v in sorted(edges.items())}
    (a.out/"original-model-download-and-recorder-exact-methods.json").write_text(
        json.dumps(report,ensure_ascii=False,indent=2))
    print("TARGET_METHODS_TOTAL",len(report["methods"]),flush=True)
    print("DISCOVERED_EXTRA_CALLS",len(report["model_api_candidates"]),flush=True)
    for x in report["methods"]:
        if not re.search(r"(?i)(Download|UpdateAiModel|AiModel|record|policy|start|onCreate)",x["method"]):continue
        print("FLOW_METHOD",x["dex"],x["class"],x["method"],"branches",x["condition_count"])
        for c in x["invokes"][:38]:
            print("  TO",c["target"])
    for k,edges in report["incoming_targets"].items():
        if any(t in k for t in ["AiModelDownloadService;->", "AiModelDownloadServiceManagerImpl;->",
                                 "AiModelRemoteSourceImpl;->", "CheckRecordingAvailabilityUseCaseImpl;->"]):
            print("INBOUND_CALL",k,"count",len(edges))
            for x in edges[:20]:print("  FROM",x["dex"],x["caller_class"],x["caller_method"])
    print("ORIGINAL_MODEL_AND_RECORDER_PATHS_MAPPED=YES",flush=True)
if __name__=="__main__":main()
