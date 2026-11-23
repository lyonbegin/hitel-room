#!/usr/bin/env python3
"""Trace original LocalAudioRecordSource -> Flow -> STT repo at method bytecode level."""
from pathlib import Path
import re, json
root=Path("/tmp/ixio-pcm-bridge/smali")
paths={
  "main":root/"main",
  "recorder":root/"recorder",
}
output=Path("evidence")
output.mkdir(exist_ok=True)
target_methods=[]
critical_calls=[]
settings=[]
for app,folder in paths.items():
  for p in folder.rglob("*.smali"):
    name=p.name
    if not (app=="main" or any(t in name for t in ("CallRecordingService","InCallService","RecordCallbackRepositoryImpl"))):continue
    txt=p.read_text(errors="replace")
    lines=txt.splitlines()
    method_start=0
    method=""
    for i,line in enumerate(lines):
      if line.startswith(".method "):
        method_start=i;method=line
      if line.startswith(".end method"):
        block=lines[method_start:i+1]
        has_method=bool(method)
        if not has_method:continue
        location=f"{app}/{p.relative_to(folder)}"
        # Trace interface calls, not just concrete SpeechToTextRepositoryImpl.
        targets=["->recognize([F","->getDownlinkFlow(","->getUplinkFlow(",
          "->getDownlinkFlow$","->getUplinkFlow$",
          "->SpeechInference(","Landroid/media/AudioRecord;->read(",
          "Landroid/media/AudioRecord$Builder;->","Landroid/media/AudioFormat$Builder;->",
          "Landroid/media/AudioRecord;-><init>(",
          "Landroid/media/MediaRecorder$AudioSource;",
          "->emit(Ljava/lang/Object;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;"]
        for j,s in enumerate(block):
          if any(k in s for k in targets):
            critical_calls.append({"app":app,"file":location,"method":method,"line":method_start+j+1,"code":s.strip()})
        if "LocalAudioRecordSource" in name or "SpeechToTextRepositoryImpl.smali" in name or any(t in name for t in ("CallRecordingService$processAudioRecording","InCallService$processAudioRecording")):
          if any(t in method for t in ["invokeSuspend"," start("," create","<init>","recognize(","getDownlinkFlow","getUplinkFlow","initAudio","startVoiceRecord"]):
            important=([(j,s) for j,s in enumerate(block) if any(k in s for k in [
               "AudioRecord", "AudioFormat", "const/16", "const v","const/4", "emit(", "Flow", "Float", "Double", "Short", "->read(", "sampleRate", "channel",
                "->recognize(", "->SpeechInference(", "->toFloat(", "->map(", "->collect(", "->buffer(","->stateIn(", "->shareIn(", "->setAudioSource(", "->setSampleRate("])])
            if important:
              target_methods.append({"file":location,"method":method,"start":method_start+1,
                "lines":len(block),"points":[{"line":method_start+j+1,"code":s.strip()} for j,s in important[:110]]})
        method=""
items=sorted(critical_calls,key=lambda x:(x["app"],x["file"],x["line"]))
(output/"pcm-bridge-crossrefs.json").write_text(json.dumps(items,ensure_ascii=False,indent=2))
(output/"pcm-bridge-method-contracts.json").write_text(json.dumps(target_methods,ensure_ascii=False,indent=2))
for item in items:
  code=item["code"]
  if any(t in code for t in ["->recognize([F","AudioRecord;->read(","AudioRecord$Builder;->setAudioSource(","AudioRecord;-><init>","AudioFormat$Builder;->setSampleRate(","->getDownlinkFlow(","->getUplinkFlow("]):
    print("PCM_BRIDGE_CALL",item["app"],item["file"],item["method"],item["line"],code,flush=True)
for x in target_methods:
  if any(k in x["file"] for k in ["LocalAudioRecordSource","SpeechToTextRepositoryImpl"]):
    if any(k in x["method"] for k in ["invokeSuspend"," start(","<init>"]):
      print("PCM_ORIGINAL_METHOD",x["file"],x["method"],"bodylines",x["lines"],flush=True)
      for p in x["points"]:
        if any(k in p["code"] for k in ["AudioRecord","AudioFormat","->emit(","->read(","->setAudioSource(","->setSampleRate(","const/16","->toFloat","->collect(","->buffer("]):
          print("PCM_INSTRUCTION",p["line"],p["code"],flush=True)
print("TOTAL_METHODS",len(target_methods),"TOTAL_PCM_CROSSREFS",len(items),flush=True)
