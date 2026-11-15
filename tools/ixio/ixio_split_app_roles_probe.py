#!/usr/bin/env python3
"""App-isolated IXIO call/PCM/STT static evidence; NOT a memory dumper.
Only code identities and call arguments are reported. Full recovered sources remain encrypted.
"""
from __future__ import annotations
import argparse
from collections import Counter
import json
from pathlib import Path
import re

TARGETS = {
 "main": [
   "incall/call/domain/usecase/PcmAudioSourceFactory.java",
   "incall/call/di/PcmAudioSourceModule.java",
   "incall/call/data/AidlPollingSource.java",
   "incall/call/data/AidlPollingSource$uplinkFlow$1.java",
   "incall/call/data/AidlPollingSource$downlinkFlow$1.java",
   "incall/call/data/AidlCallbackSource.java",
   "incall/call/data/LocalAudioRecordSource.java",
   "incall/call/data/LocalAudioRecordSource$uplinkFlow$1.java",
   "incall/call/data/LocalAudioRecordSource$downlinkFlow$1.java",
   "incall/call/data/RecordRepository.java",
   "incall/call/data/RecordRepository$recordCallbackStub$1$sendRxData$1.java",
   "incall/call/data/RecordRepository$recordCallbackStub$1$sendTxData$1.java",
   "incall/call/domain/usecase/AidlRecorderCallbackUseCaseImpl.java",
   "incall/call/service/CallScriptManager.java",
   "incall/call/service/CallRecordingService.java",
   "data/call/ai/SpeechToTextRepositoryImpl.java",
   "dip/domain/ai/repository/SpeechToTextRepository.java",
   "incall/call/domain/usecase/SttDataIntegrationUseCaseImpl.java",
   "ixispeech_ktn/speechSDK.java",
 ],
 "recorder": [
   "callrecorder/CallRecordingService.java",
   "callrecorder/InCallService.java",
   "callrecorder/CallRecordingService$processAudioRecording$downProducerJob$1.java",
   "callrecorder/CallRecordingService$processAudioRecording$upProducerJob$1.java",
   "callrecorder/InCallService$processAudioRecording$downProducerJob$1.java",
   "callrecorder/InCallService$processAudioRecording$upProducerJob$1.java",
   "callrecorder/data/repository/RecordCallbackRepositoryImpl.java",
   "callrecorder/data/repository/RecordCallbackRepository.java",
   "callrecorder/data/repository/PcmPlayerRepositoryImpl.java",
   "callrecorder/domain/GetMediaRecorderUseCase.java",
   "callrecorder/domain/RecordCallbackUseCase.java",
   "callrecorder/CallRecorder.java",
 ]
}
APIS = [
 "new AudioRecord", "new MediaRecorder", "getMinBufferSize",
 "setAudioSource", "AudioRecord.Builder", "setSampleRate", "setChannelMask",
 "setEncoding", "VOICE_CALL", "VOICE_DOWNLINK", "VOICE_UPLINK",
 "VOICE_COMMUNICATION", "MIC",
 "getRecordedDataRx", "getRecordedDataTx", "sendRxData", "sendTxData",
 "registerRecordCallback", "startRecordCallback",
 "getDownlinkFlow", "getUplinkFlow", "downlinkFlow", "uplinkFlow",
 "AidlPollingSource", "AidlCallbackSource", "LocalAudioRecordSource",
 "getHasRawShortAccess", "getRawUplinkShortArray",
 "create", "provide", "bindService",
 "SpeechToTextRepository", "SpeechToTextRepositoryImpl",
 "speechSDK", "loadSTT", "recognize", "SpeechInference",
 "getTxSpeechRecognitionResultFlow", "getRxSpeechRecognitionResultFlow",
 "SttDataIntegrationUseCase", "processAudioRecording", "AudioRecord.read",
]
KEYS = sorted(APIS,key=len,reverse=True)
def strip_literals(s: str) -> str:
    s=re.sub(r'"(?:\\.|[^"\\])*"', '"[omitted]"', s)
    s=re.sub(r"'(?:\\.|[^'\\])*'", "'[omitted]'", s)
    return s

def extract_call_args(text: str, pos: int, max_len=1100) -> str:
    # bounded, balanced parentheses; not executable source export
    idx=text.find("(",pos,pos+max_len)
    if idx<0: return ""
    depth=0; start=idx+1
    for i in range(idx,min(len(text),idx+max_len)):
        if text[i]=="(":depth+=1
        elif text[i]==")":
            depth-=1
            if depth==0:
                return re.sub(r"\s+"," ",strip_literals(text[start:i])).strip()[:240]
    return "UNBALANCED_OR_LONG"
def inspect(root:Path,target:str):
    all_java=list(root.rglob("*.java"))
    reports=[]
    for suffix in TARGETS[target]:
        selected=[p for p in all_java if str(p.relative_to(root)).replace("\\","/").endswith(suffix)]
        if not selected:reports.append({"class_suffix":suffix,"found":False});continue
        p=selected[0]; s=p.read_text(encoding="utf-8",errors="replace"); lines=s.splitlines(keepends=True)
        found=[]
        offset=0
        call_counts=Counter()
        for i,line in enumerate(lines,1):
            for api in KEYS:
                if api not in line:continue
                # For a text-match API, collect nearby symbol-level call args.
                appearances=[m.start() for m in re.finditer(re.escape(api),line)]
                for at in appearances[:3]:
                    call_counts[api]+=1
                    if len(found)<110:
                        args=extract_call_args(s,offset+at+len(api))
                        guards=[a for a in ("if","when","isAidl","isMvoip","localAudioRecord","aidlPolling",
                                           "isCallback","getDownlinkFlow","getUplinkFlow") if a in line]
                        found.append({"line":i,"symbol":api,"call_arguments":args,
                                      "line_has_decision_terms":guards})
            offset+=len(line)
        methods=[]
        for i,line in enumerate(lines,1):
            m=re.search(r"\b(?:public|private|protected|static|final|synchronized|void|boolean|int|String|Object)\b.{0,140}\b([A-Za-z_$][\w$]*)\s*\(",line)
            if m and len(methods)<100: methods.append({"line":i,"method":m.group(1)})
        reports.append({
          "class_suffix":suffix,"found":True,"java_line_count":len(lines),
          "jadx_undecoded_method":("Method not decompiled:" in s),
          "symbol_occurrences":dict(call_counts),
          "method_headings":methods,
          "symbol_calls":found,
        })
    # Whole-app search only for STT engine vs telephony recorder implementation evidence.
    whole=Counter()
    symbolic_sources={
     "speechSDK_definitions": [],"speech_repository_definitions":[],
     "audio_record_owners":[],"aidl_record_owner":[],
    }
    for p in all_java:
        name=p.stem
        rel=str(p.relative_to(root))
        # File names and classes, not loose string references
        if name=="speechSDK" or name=="SpeechToTextRepositoryImpl":
            tag="speechSDK_definitions" if name=="speechSDK" else "speech_repository_definitions"
            symbolic_sources[tag].append(rel)
        if name in ("CallRecordingService","InCallService","LocalAudioRecordSource","RecordCallbackRepositoryImpl"):
            symbolic_sources["audio_record_owners"].append(rel)
        if name in ("AidlPollingSource","AidlCallbackSource","RecordRepository"):
            symbolic_sources["aidl_record_owner"].append(rel)
    for cls in reports:
        for k,n in cls.get("symbol_occurrences",{}).items():
            whole[k]+=n
    result={
      "target_group":target,
      "original_app_namespace":"com.lguplus.aicallagent" if target=="main" else "com.lguplus.callrecorder",
      "source_java_files":len(all_java),
      "scanned_target_files":len(reports),
      "whole_app_named_class_definitions":symbolic_sources,
      "target_symbol_occurrences":dict(whole),
      "class_reports":reports,
      "evidence_limitations":"Static method-name/argument references only. AIDL call sites do not prove successful binding; AudioRecord source depends on runtime permissions/device."
    }
    return result
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--group",choices=TARGETS.keys(),required=True)
    ap.add_argument("--sources",required=True)
    ap.add_argument("--output",required=True)
    a=ap.parse_args()
    r=inspect(Path(a.sources),a.group)
    Path(a.output).parent.mkdir(parents=True,exist_ok=True)
    Path(a.output).write_text(json.dumps(r,indent=2,ensure_ascii=False),encoding="utf-8")
    print(json.dumps({k:v for k,v in r.items() if k!="class_reports"},ensure_ascii=False))
if __name__=="__main__":main()
