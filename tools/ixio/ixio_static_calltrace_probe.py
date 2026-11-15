#!/usr/bin/env python3
"""Review original JADX output in runner; publish *only* structural call references.

No full Java source or private audio is emitted. This is a static reference index:
a reference is not proof that a method is invoked on real telephony audio.
"""
from __future__ import annotations
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re

SYMBOLS = [
    "getRecordedDataRx", "getRecordedDataTx",
    "sendRxData", "sendTxData",
    "startRecordCallback", "registerRecordCallback",
    "startRecording", "processAudioRecording", "read",
    "PcmAudioRepository", "CallIdConfigurablePcmAudioRepository",
    "DownlinkChunkTimestampAwarePcmAudioRepository",
    "AidlPollingSource", "LocalAudioRecordSource",
    "SpeechToTextRepository", "SpeechToTextRepositoryImpl",
    "IxispeechSDK_renewal_mergeKt", "speechSDK",
    "SttDataIntegrationUseCase", "TxPcmSpeechStartRepositoryImpl",
    "PcmAudioSourceModule", "AudioRecord", "AudioFormat",
    "MediaRecorder", "setAudioSource", "setSampleRate",
    "setChannelMask", "setEncoding", "AudioPlaybackCaptureConfiguration",
    "AudioSource", "VOICE_CALL", "VOICE_DOWNLINK",
    "VOICE_UPLINK", "VOICE_COMMUNICATION",
    "MIC", "sherpa", "ASR", "onTranscription",
]
REGEX = re.compile(r"\b(?:"+"|".join(map(re.escape,sorted(SYMBOLS,key=len,reverse=True)))+r")\b",re.I)
METHOD_HEAD = re.compile(
    r"(?:\b(?:public|private|protected|static|final|suspend|synchronized|abstract|native)\b\s+){0,5}"
    r"(?:[\w$<>?.\[\],]+\s+){1,4}([\w$<>]+)\s*\([^;\n{}]*\)\s*(?:throws\s+[\w., ]+)?\s*(?:\{|;)"
)
TARGET_PATHS = (
    "callrecorder", "aicallagentaidl", "ixispeech_ktn",
    "incall/call/data", "incall/call/service",
    "incall/call/di","incall/call/domain",
    "data/call/ai/", "dip/domain/call/repository",
    "dip/domain/ai/repository", "dip/domain/incallai/player",
    "mvoip/data", "mvoip/domain/adapter",
    "websocket","stt",
)
OWNERS = (
    "AudioRecord", "InCallService", "CallRecordingService",
    "AidlPollingSource", "LocalAudioRecordSource",
    "SpeechToTextRepositoryImpl", "PcmAudioSourceModule",
    "TxPcmSpeechStartRepositoryImpl", "PcmAudioRepository",
    "speechSDK", "AudioRecorder", "PcmPlayerService",
)
AUDIO_SOURCE = re.compile(
    r"(?:MediaRecorder\.AudioSource\.|AudioSource\.)"
    r"(MIC|VOICE_CALL|VOICE_COMMUNICATION|VOICE_DOWNLINK|VOICE_UPLINK|REMOTE_SUBMIX|CAMCORDER|UNPROCESSED)"
)
BUILDER_CALL = re.compile(
    r"\b(setAudioSource|setSampleRate|setChannelMask|setEncoding|setAudioFormat|getMinBufferSize|"
    r"getRecordedDataRx|getRecordedDataTx|sendRxData|sendTxData|startRecordCallback|"
    r"registerRecordCallback|startRecording|read)\s*\(([^)\n]{0,180})\)"
)
def safe_arg(s):
    # Parameters can contain private strings; retain only API names, identifiers,
    # small integer constants, operators and type information (no quoted strings).
    s=re.sub(r'"(?:\\.|[^"\\])*"', '"[redacted]"',s)
    s=re.sub(r"'(?:\\.|[^'\\])*'", "'[redacted]'",s)
    return re.sub(r"\s+"," ",s)[:110]
def analyze(root, outfile, group):
    files=list(root.rglob("*.java"))
    global_counts=collections.Counter()
    selected=[]
    relevant_paths=collections.defaultdict(list)
    for path in files:
        rel=str(path.relative_to(root))
        if path.stat().st_size>4_000_000:continue
        content=path.read_text(encoding="utf-8",errors="replace")
        hits=REGEX.findall(content)
        for h in hits:global_counts[h]+=1
        is_owner=any(x.lower() in rel.lower() for x in OWNERS)
        targeted=(any(p in rel.lower() for p in TARGET_PATHS) and len(hits)>0)
        if not (is_owner or targeted):continue
        lines=content.splitlines()
        method="class scope"
        method_hits=collections.defaultdict(set)
        method_refs=collections.defaultdict(lambda:collections.Counter())
        api_args=[]
        audio_sources=[]
        method_signatures=[]
        for i,line in enumerate(lines,1):
            maybe=METHOD_HEAD.search(line)
            if maybe and len(line)<280:
                name=maybe.group(1)
                if name not in ("if","while","switch","for","catch","return"):
                    method=name
                    if is_owner and len(method_signatures)<130:
                        method_signatures.append({"line":i,"method_name":name})
            matches=REGEX.findall(line)
            for h in matches:
                method_hits[method].add(h)
                method_refs[method][h]+=1
            for source in AUDIO_SOURCE.findall(line):
                if len(audio_sources)<30:
                    audio_sources.append({"line":i,"source":source,"method":method})
            if len(api_args)<50:
                for name,arg in BUILDER_CALL.findall(line):
                    api_args.append({"line":i,"call":name,"args":safe_arg(arg),"method":method})
        # Store pure structural signatures only. No decompiled source lines.
        classes={"path":rel,"java_file_bytes":path.stat().st_size,
          "java_sha256":hashlib.sha256(content.encode()).hexdigest(),
          "relevant_symbol_occurrences":len(hits),
          "audio_source_constants":audio_sources,
          "api_call_arguments":api_args,
          "method_headings":method_signatures[:100],
          "methods_with_reference":{
             m:{"symbols":sorted(sym),"counts":dict(method_refs[m])}
             for m,sym in list(method_hits.items())[:100]
             if sym
          },
          "jadx_not_decompiled": "Method not decompiled:" in content}
        selected.append(classes)
        for h in set(hits):
            if len(relevant_paths[h])<70:relevant_paths[h].append(rel)
    # Prioritize target packages, exact source paths and core logic owners.
    selected.sort(key=lambda x:(not any(q.lower() in x["path"].lower() for q in OWNERS),
         -x["relevant_symbol_occurrences"],x["path"]))
    output={
      "app_group":group,
      "analysis_type":"JADX structural cross-reference index, no executable verification",
      "source_java_files_total":len(files),
      "indexed_relevant_java_files":len(selected),
      "failed_decompilation_java_files_count":sum(x["jadx_not_decompiled"] for x in selected),
      "symbol_occurrence_counts":dict(global_counts.most_common()),
      "symbol_referring_classes":dict(relevant_paths),
      "selected_class_reports":selected[:340],
      "warning":"File source/name references do not establish access rights or data-flow causality. Follow up with method-level bytecode inspection."
    }
    outfile.parent.mkdir(parents=True,exist_ok=True)
    outfile.write_text(json.dumps(output,indent=2,ensure_ascii=False),encoding="utf-8")
    print(json.dumps({k:v for k,v in output.items() if k not in ("selected_class_reports","symbol_referring_classes")},ensure_ascii=False))
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--sources",required=True)
    p.add_argument("--output",required=True)
    p.add_argument("--group",required=True)
    args=p.parse_args()
    analyze(Path(args.sources),Path(args.output),args.group)
if __name__=="__main__":main()
