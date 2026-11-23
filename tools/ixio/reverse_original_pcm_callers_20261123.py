#!/usr/bin/env python3
"""Method-level original IXIO APK DEX callsite inventory; no credential or model export."""
from pathlib import Path
import zipfile, subprocess, re, json, time, collections, sys
root=Path("/tmp/ixio-pcm-reverse")
root.mkdir(parents=True,exist_ok=True)
out=Path("evidence")
out.mkdir(exist_ok=True)
apks={
 "main": Path("original/IXIO_Main_OriginalFGSPrestartQA_20261122.apk"),
 "recorder": Path("original/IXIO_Recorder_Companion_OriginalFlowTrace_20261122.apk"),
}
tokens=["SpeechInference","SpeechToTextRepositoryImpl","AudioRecord","onAudioData","onPcmData","CombinedSTTKWS","ixispeech_ktn"]
target=[]
inventory=[]
for app,apk in apks.items():
 with zipfile.ZipFile(apk) as archive:
  for dx in archive.namelist():
   if not re.fullmatch(r"classes\d*\.dex",dx):continue
   raw=archive.read(dx)
   markers=[t for t in tokens if t.encode() in raw]
   inventory.append({"app":app,"dex":dx,"bytes":len(raw),"markers":markers})
   choose=(app=="main" and (dx in ["classes6.dex","classes9.dex","classes16.dex","classes18.dex"] or "SpeechInference" in markers or "SpeechToTextRepositoryImpl" in markers)) or (app=="recorder" and ("AudioRecord" in markers or dx=="classes.dex"))
   if choose:
    p=root/app/dx
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_bytes(raw)
    target.append((app,dx,p))
(out/"dex-inventory.json").write_text(json.dumps(inventory,ensure_ascii=False,indent=2))
print("DEX_COUNT",len(inventory),"SELECTED_DEX",len(target),flush=True)
markers=["->SpeechInference(","->loadSTT(","->loadVAD(",
 "Landroid/media/AudioRecord;->read(","Landroid/media/AudioRecord;->startRecording(",
 "Landroid/media/AudioRecord;->stop(","Landroid/media/AudioRecord;->getRecordingState(",
 "Landroid/media/MediaRecorder;->","Landroid/media/AudioTrack;->",
 "onAudioData","onPcmData","Lcom/lguplus/aicallagent/data/call/ai/SpeechToTextRepositoryImpl;"]
hits=[]
contexts=[]
for app,dx,p in target:
 dst=root/"smali"/app/dx.replace(".dex","")
 dst.mkdir(parents=True,exist_ok=True)
 cmd=["java","-Xmx2400m","-jar","bin/baksmali.jar","d","--api","34","--jobs","3","-o",str(dst),str(p)]
 started=time.monotonic()
 result=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=240)
 print("DISASSEMBLE",app,dx,result.returncode,round(time.monotonic()-started,1),flush=True)
 if result.returncode!=0:raise RuntimeError(result.stdout[-1500:])
 for sf in dst.rglob("*.smali"):
  lines=sf.read_text(errors="replace").splitlines()
  begin=None;method=""
  for i,line in enumerate(lines):
   if line.startswith(".method "):begin=i;method=line
   if line.startswith(".end method") and begin is not None:
    found=[(j,term) for j in range(begin,i+1) for term in markers if term in lines[j]]
    if found:
     loc=str(sf.relative_to(root/"smali"))
     row={"app":app,"dex":dx,"file":loc,"method":method,"start":begin+1,"end":i+1,
      "calls":[{"line":j+1,"match":term,"statement":lines[j].strip()} for j,term in found]}
     hits.append(row)
     important=[(j,k) for j,k in found if "SpeechInference(" in k or "AudioRecord;->read(" in k or "loadSTT(" in k or "startRecording(" in k]
     if important:
      contexts.append(f"## {app} {dx} {loc} {method}")
      for j,k in important[:12]:
       contexts.append("\n".join(f"{n+1}: {lines[n]}" for n in range(max(begin,j-22),min(i+1,j+18))))
    begin=None
(out/"callsite-index.json").write_text(json.dumps(hits,ensure_ascii=False,indent=2))
(out/"critical-bytecode-context.txt").write_text("\n\n".join(contexts)[:1000000])
counts=collections.Counter((x["app"],z["match"]) for x in hits for z in x["calls"])
(out/"summary.txt").write_text("\n".join(f"{a} {b}: {n}" for (a,b),n in sorted(counts.items())))
print("RELEVANT_METHODS",len(hits),flush=True)
for (a,b),n in sorted(counts.items()):print("COUNT",a,n,b,flush=True)
for x in hits:
 important=[z for z in x["calls"] if any(term in z["match"] for term in ["SpeechInference(","AudioRecord;->read(","loadSTT(","startRecording("])]
 if important: print("CRITICAL",x["app"],x["dex"],x["file"],x["method"],[(z["line"],z["statement"][:130]) for z in important[:3]],flush=True)
print("FINISHED_ORIGINAL_APK_PCM_TO_SPEECHSDK_REVERSE",flush=True)
