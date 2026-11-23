#!/usr/bin/env python3
"""Inspect method-level original IXIO PCM source contracts and DI/coroutine consumer.
Input: /tmp/ixio-pcm-bridge/smali/main from prior reproducible workflow.
Never upload APK binaries, credentials or audio.
"""
from pathlib import Path
import re,json,collections
root=Path('/tmp/ixio-pcm-bridge/smali/main')
out=Path('evidence');out.mkdir(exist_ok=True)
types={
"source":"com/lguplus/aicallagent/incall/call/data/LocalAudioRecordSource.smali",
"up":"com/lguplus/aicallagent/incall/call/data/LocalAudioRecordSource$uplinkFlow$1.smali",
"down":"com/lguplus/aicallagent/incall/call/data/LocalAudioRecordSource$downlinkFlow$1.smali",
"collector":"com/lguplus/aicallagent/incall/call/service/CallScriptManager$readAndRecognizeDownLinkAudio$2$1.smali",
"recognize_manager":"com/lguplus/aicallagent/incall/call/service/CallScriptManager.smali",
"stt_repository":"com/lguplus/aicallagent/data/call/ai/SpeechToTextRepositoryImpl.smali",
"interface":"com/lguplus/aicallagent/dip/domain/call/repository/PcmAudioRepository.smali",
}
patterns={
"source":[".class ",".implements ",".field ",".method ","-><init>(IIIII)","->getMinBufferSize","->getDownlinkFlow","->getUplinkFlow","->startRecording","->getState","->stop(","->release(","0x1f4","0x3e80"],
"up":[".method ","->read([SII)I","->send(Ljava/lang/Object;","aget-short","div-float/2addr","array-length","const/16 v6, 0x200"],
"down":[".method ","->read([SII)I","->send(Ljava/lang/Object;","aget-short","div-float/2addr","array-length","const/16 v6, 0x200"],
"collector":[".method ","->emit(","->recognizeDownLinkAudio(","->launch(","->async(","->invokeSuspend(","->copyOf("],
"recognize_manager":[".method private final recognizeDownLinkAudio(",".method private final recognizeUplinkAudio(",".method private final accumulateSamples(","->recognize([F","->getDownlinkFlow","->getUplinkFlow"],
"stt_repository":[".method public recognize(","->SpeechInference([FIZ)","->getFirst()","->getThird()","->lock()","->unlock()"],
"interface":[".class ",".method ","getDownlinkFlow","getUplinkFlow","start(","stop("]
}
data={}
for category,rel in types.items():
 p=root/rel
 if not p.exists():
  print('MISSING',category,rel,flush=True);continue
 lines=p.read_text(errors='replace').splitlines()
 matches=[]
 for i,x in enumerate(lines):
  if any(z in x for z in patterns[category]):
   matches.append({'line':i+1,'text':x.strip()})
 data[category]={'path':rel,'line_count':len(lines),'matches':matches}
 print('SOURCE',category,rel,'lines',len(lines),'matches',len(matches),flush=True)
 for m in matches[:95]:
  print('SYMBOL',category,m['line'],m['text'][:280],flush=True)
(out/'original-pcm-source-symbol-index.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
# Emit small exact critical method samples and register flow; class source only where necessary.
windows={
"source":[(185,298),(592,683),(1165,1220),(1250,1345)],
"down":[(265,377)],
"up":[(265,377)],
"collector":[(1,320)],
"recognize_manager":[(8130,8195)],
"stt_repository":[(5100,5151)],
"interface":[(1,125)],
}
for kind,ranges in windows.items():
 if kind not in data:continue
 lines=(root/types[kind]).read_text(errors='replace').splitlines()
 for lo,hi in ranges:
  print('BLOCK_BEGIN',kind,lo,hi,flush=True)
  for i in range(lo-1,min(hi,len(lines))):
   if kind=='collector' or kind=='interface' or any(z in lines[i] for z in ["const/","invoke-","move-result","aget","aput","div-","array-length","if-","add-int","new-array","->","goto","return","sget","iput","iget","check-cast"]):
    print('BC',kind,i+1,lines[i].strip()[:310],flush=True)
  print('BLOCK_END',kind,lo,hi,flush=True)
print('ORIGINAL_PCM_SOURCE_DEEP_SCAN_COMPLETED',flush=True)
