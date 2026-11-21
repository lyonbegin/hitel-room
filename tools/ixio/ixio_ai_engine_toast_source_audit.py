#!/usr/bin/env python3
"""Read-only exact Korean toast resource and model/recording toggle DEX audit."""
from pathlib import Path
import json, re, subprocess

ROOT=Path(".toast-source-private")
OUT=Path("ixio-toast-source-evidence")
OUT.mkdir(exist_ok=True)
apk=ROOT/"IXIO_Main_NoAppSealing_Single.apk"
sdk=Path("/usr/local/lib/android/sdk")
aapt=sorted(sdk.glob("build-tools/*/aapt2"))[-1]
dump=subprocess.check_output([str(aapt),"dump","resources",str(apk)],text=True,errors="replace")
resource=re.compile(r"resource (0x[0-9a-fA-F]+) (\S+)")
needles=("요청을 처리하지","잠시 후 다시 시도","AI 엔진을 다운로드","AI 엔진을 업데이트","익시오를 이용할 수 없는 휴대폰")
entries=[]
current=None
for line in dump.splitlines():
    match=resource.search(line)
    if match:
        current={"id":match.group(1),"name":match.group(2),"lines":[]}
        entries.append(current)
    if current:
        current["lines"].append(line)
matched=[x for x in entries if any(v in "\n".join(x["lines"]) for v in needles)]
print("EXACT_TOAST_RESOURCES",json.dumps(matched,ensure_ascii=False),flush=True)
(OUT/"toast-resources.json").write_text(json.dumps(matched,ensure_ascii=False,indent=2))
ids={x["id"].lower() for x in matched}
names={x["name"].split("/")[-1] for x in matched}
METHOD=re.compile(r"(?ms)^\.method[^\n]*\n.*?^\.end method$")
records=[]
selected_names=re.compile(r"(DownloadViewModel|AiModelRemoteSourceImpl|UpdateAiModelUseCaseImpl|CheckAiModelAvailabilityUseCaseImpl|CheckRecordingAvailabilityUseCaseImpl|CallRecorderSetting|RecordingSetting|RecordSetting|setting/viewmodel/SettingViewModel|DiscoverViewModel|ResolveOnboardingLoginEntryUseCase|DeviceUtil|DeviceInfoUtil|CheckDevice|SupportedModel)")
support_call=re.compile(r"NotSupportedModelDialog\(|isSupportedModel|isSupportedDevice|notSupportedModel|NotSupportedModel|SupportDevice|DeviceNotSupport|supportedModel|SupportedDevice")
for folder in sorted(ROOT.glob("smali*")):
    for file in sorted(folder.rglob("*.smali")):
        rel=file.relative_to(folder).as_posix()
        if not rel.startswith(("com/lguplus/","com/pineone/")):
            continue
        src=file.read_text(errors="replace")
        resource_hit=any(("->"+n+":I") in src for n in names) or any(n in src.lower() for n in ids) or "showVasErrorRetryToast()V" in src
        selected=bool(selected_names.search(rel)) or "showVasErrorRetryToast()V" in src
        support_selected=bool(support_call.search(src))
        if not resource_hit and not selected and not support_selected:
            continue
        for match in METHOD.finditer(src):
            body=match.group()
            direct=any(("->"+n+":I") in body for n in names) or any(n in body.lower() for n in ids)
            head=body.splitlines()[0]
            if not direct and not selected and not support_call.search(body):
                continue
            if not direct and ("<init>" in head or "getStable" in head):
                continue
            safe=[]
            for line in body.splitlines():
                t=line.strip()
                if t.startswith((".line",".local",".end local",".restart local",".param",".end param",".prologue",".source")):
                    continue
                if t.startswith("const-string") and not any(v in t for v in needles):
                    lit=re.search(r'"(.*)"',t)
                    value=lit.group(1) if lit else ""
                    if len(value)>100 or re.search(r"[A-Za-z0-9+/=_-]{45,}",value):
                        t=re.sub(r'".*"','"[STATIC_LONG_LITERAL_REDACTED]"',t)
                if t:
                    safe.append(t)
            item={"dex":folder.name,"class":rel,"header":head,"direct_toast_resource":direct,
                  "instructions":safe}
            records.append(item)
            print("SOURCE_BEGIN",folder.name,rel,head,"DIRECT_TOAST",direct,flush=True)
            for row in safe[:1400]:
                print("SMALI",row,flush=True)
            print("SOURCE_END",flush=True)
(OUT/"model-toggle-toast-methods.json").write_text(json.dumps(records,ensure_ascii=False,indent=2))
print("TOAST_GATE_METHOD_COUNT",len(records),flush=True)
assert matched,"Exact screenshot toast not found in resources"
assert any(x["direct_toast_resource"] for x in records),"No original toast resource call site found"
