#!/usr/bin/env python3
"""Metadata-only report of JADX analysis. Java source stays encrypted/private."""
from __future__ import annotations
import argparse
import hashlib
import json
import pathlib
import re

KEYWORDS=[
 "CallRecordingService","AudioRecording","PcmPlayer","AudioRecord",
 "AudioTrack","InCallService","CallRecorder","IAISoundEvent",
 "ICallRecordingAidl","IInCallAidl","RecordCallback","AudioManager",
 "AudioSource","startVoiceRecord","stopVoiceRecord","downProducer",
 "upProducer","RecordingDataSource","sherpa","transcri","SpeechRecognizer",
]
API_PATTERN=re.compile(r"\b(?:AudioRecord|AudioTrack|MediaRecorder|AudioManager|AudioFormat|"
    r"AudioPlaybackCaptureConfiguration|MediaProjection|ParcelFileDescriptor|"
    r"ByteBuffer|InputStream|OutputStream|"
    r"IAISoundEventAidlInterface|ICallRecordingAidlInterface|IPcmPlayerAidlInterface)\b"
    r"|\b(?:startRecording|stopRecording|processAudioRecording|"
    r"startVoiceRecording|onAudio|sendAudio|sendPcm|writeAudio|readAudio|onTranscription|transcribe)\b")
METHOD_PATTERN=re.compile(
 r"\b(?:public|private|protected|static|final|synchronized|native|abstract|"
 r"void|int|boolean|String|ByteBuffer|Object|long|float)\b[^\n;{}]{0,130}\([^;{}]*\)\s*(?:throws\s+[\w., ]+)?\s*\{"
)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--sources",required=True)
    ap.add_argument("--output",required=True)
    a=ap.parse_args()
    root=pathlib.Path(a.sources)
    java=list(root.rglob("*.java"))
    items=[]
    key_count={}
    for p in java:
        path=str(p.relative_to(root))
        name=p.stem
        if not any(t.lower() in path.lower() for t in KEYWORDS):
            continue
        src=p.read_text(encoding="utf-8",errors="replace")
        apis=sorted(set(API_PATTERN.findall(src)))
        methods=[m.group(0).replace("\n"," ").strip() for m in METHOD_PATTERN.finditer(src)]
        selected_calls=[]
        for i,line in enumerate(src.splitlines(),1):
            found=sorted(set(API_PATTERN.findall(line)))
            if found and len(selected_calls)<180:
                selected_calls.append({"line":i,"api_symbols":found})
                for symbol in found:key_count[symbol]=key_count.get(symbol,0)+1
        items.append({"file":path,"size_bytes":p.stat().st_size,
                      "sha256":hashlib.sha256(src.encode()).hexdigest(),
                      "relevant_api_symbols":apis,
                      "method_signatures":methods[:120],
                      "referenced_api_line_numbers":selected_calls})
    result={"tool":"official skylot/jadx",
       "source_code_published":False,
       "java_source_file_count":len(java),
       "relevant_java_file_count":len(items),
       "relevant_api_reference_counts":key_count,
       "files":items[:160]}
    pathlib.Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({k:v for k,v in result.items() if k!="files"},ensure_ascii=False))
if __name__=="__main__":main()
