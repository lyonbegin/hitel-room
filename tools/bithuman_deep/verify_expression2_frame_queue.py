#!/usr/bin/env python3
"""Validate actual unmodified Expression2 0.6.2 feed/pump/pull frame transport.

Tests byte-exact original ARM64 instruction hashes, actual Ghidra body markers,
original JVM method bodies and JNI-to-native direct edges. No invented SDK,
vendor binary modification, credential or emulator simulation is involved.
"""
import argparse
import csv
import hashlib
import json
import re
from pathlib import Path

CASES={
 "Native_feed":("001724d8",["FUN_001a7fbc","param_4,param_5,param_6","0x668"]),
 "FUN_001a7fbc":("001a7fbc",["FUN_001a77c0","FUN_001a7db0","FUN_001acf1c","FUN_001a80dc"]),
 "FUN_001a80dc":("001a80dc",["0x6400","44000","0x47e0","FUN_001a8500"]),
 "FUN_001a8404":("001a8404",["FUN_001a7a04","FUN_001a80dc","FUN_001a82f0"]),
 "FUN_001a7a04":("001a7a04",["condition_variable::wait","param_1[0x1a] = lVar11","std::__ndk1::mutex::lock"]),
 "FUN_001a82f0":("001a82f0",["FUN_001a7a04","gettimeofday"]),
 "FUN_001a84cc":("001a84cc",["param_1 + 0x7c","param_1 + 0xd0"]),
 "Native_queuedFrames":("00172e40",["FUN_001a84cc"]),
 "FUN_001aa594":("001aa594",["FUN_001a8404","FUN_001a82f0"]),
 "Native_pumpForPull":("00172d1c",["FUN_001aa594"]),
 "FUN_001aa40c":("001aa40c",["param_1 + 0xd0","param_1 + 0x7c","memcpy(param_2,__src,0x124800)","operator_delete(__src)","*param_4 = uVar6"]),
 "Native_pullToBuffer":("00172e7c",["0x1247ff","FUN_001aa40c","0x6a0","DIRECT_ByteBuffer"]),
 "FUN_001a8230":("001a8230",["FUN_001a80dc","FUN_001a82f0","0x31"]),
 "FUN_001a7cfc":("001a7cfc",["FUN_001a7db0","FUN_001a77c0"]),
 "FUN_001a77c0":("001a77c0",["FUN_001a7a04","param_1[0x1a] = 0","param_1[10] = 0"]),
}
LINKS=[
 ("Native_feed","FUN_001a7fbc"),("FUN_001a7fbc","FUN_001a80dc"),
 ("Native_pump","FUN_001a8404"),("FUN_001a8404","FUN_001a7a04"),
 ("FUN_001a8404","FUN_001a80dc"),("FUN_001a80dc","FUN_001a8500"),
 ("Native_queuedFrames","FUN_001a84cc"),
 ("Native_pullToBuffer","FUN_001aa40c"),
 ("Native_pumpForPull","FUN_001aa594"),
 ("FUN_001aa594","FUN_001a8404"),("FUN_001aa594","FUN_001a82f0"),
 ("FUN_001a82f0","FUN_001a7a04"),
 ("Native_endSegment","FUN_001a8230"),("Native_beginSegment","FUN_001a7cfc"),
]
METHODS={
 "feed":("float[], int, int",["copyOfRange","Method enqueue:"]),
 "runWorker":(None,["ArrayBlockingQueue.poll:","ArrayBlockingQueue.take:","Native.feed:","Native.endSegment:","Native.beginSegment:","Native.reset:","pumpQuietly"]),
 "pull":("java.nio.ByteBuffer",["SelfHostMeter.noteObserved","MeterHost.gate:","Native.pullToBuffer:","Method stamp:"]),
 "pumpQuietly":(None,["Native.pump:","Lock.lock:","Lock.unlock:"]),
 "flushTail":("long",["Method enqueue:","Method drainPending:"]),
 "resetState":("boolean",["Method enqueue:"]),
 "stamp":("long[]",["ptsBaseFrames","lastIndex"]),
}
def label(n):
 return "Java_ai_bithuman_expression2_"+n if n.startswith("Native_") else n

def method_body(source,name,hint):
 headers=list(re.finditer(r"(?m)^  (?:public|protected|private) [^\n;]+\([^;\n]*\);",source))
 for i,h in enumerate(headers):
  if re.search(r"\b"+re.escape(name)+r"\(",h.group()) and (hint is None or hint in h.group()):
   return source[h.start():headers[i+1].start() if i+1<len(headers) else len(source)]
 raise AssertionError("Missing JVM method "+name+" / "+str(hint))

def verify(native,jvm,out):
 rows=list(csv.DictReader((native/"functions.tsv").open(),delimiter="\t"))
 assert len(rows)==1035
 idx={r["name"]:r for r in rows}
 original=[]
 for name,(address,markers) in CASES.items():
  symbol=label(name)
  row=idx[symbol]
  assert row["address"]==address
  listings=list((native/"native-instruction-bytes").glob("*_"+address+".lst"))
  decompiled=list((native/"decompiler-reconstruction-not-original").glob("*_"+address+".c"))
  assert len(listings)==len(decompiled)==1
  digest=hashlib.sha256()
  ninstr=0
  for line in listings[0].read_text().splitlines():
   if not line.strip() or line.startswith("#"):continue
   chunks=line.split("\t")
   assert len(chunks)>=3
   digest.update(bytes.fromhex(chunks[1]))
   ninstr+=1
  assert digest.hexdigest()==row["bytes_sha256"],("Binary instruction hash differs",name)
  assert ninstr==int(row["instruction_count"])
  pseudocode=decompiled[0].read_text()
  assert all(m in pseudocode for m in markers),("Original function body differs",name)
  original.append({"original_function":symbol,"original_arm64_vaddr":address,
    "original_instruction_sha256":row["bytes_sha256"],"instruction_count":ninstr,
    "gated_original_body_markers":markers,
    "machine_instruction_evidence_file":listings[0].name,
    "decompiler_file":decompiled[0].name})
 names=(jvm/"class-names.txt").read_text().splitlines()
 assert len(names)==92
 def bytecode(name):
  cls="ai.bithuman.expression2."+name
  index=names.index(cls)+1
  return (jvm/"classes"/("%05d.javap.txt"%index)).read_text()
 avatar=bytecode("Expression2Avatar")
 source=bytecode("Native")
 verified_jvm=[]
 for name,(hint,frags) in METHODS.items():
  body=method_body(avatar,name,hint)
  assert all(t in body for t in frags),(name,"JVM method differs")
  verified_jvm.append({"jvm_function":name,
    "bytecode_method_sha256":hashlib.sha256(body.encode()).hexdigest(),
    "original_instruction_checks":frags})
 assert "queuedFrames(" in source and "pullToBuffer(" in source
 edges=list(csv.DictReader((native/"call-edges.tsv").open(),delimiter="\t"))
 edgeset={(x["caller_address"],x["callee_address"]) for x in edges}
 for a,b in LINKS:
  assert (idx[label(a)]["address"],idx[label(b)]["address"]) in edgeset,(a,b)
 observations={
  "input_jobs":"JVM ArrayBlockingQueue(1024) stores work items, not frames",
  "native_frame_queue_count":"64-bit queued value at engine+0xd0, mutex at engine+0x7c (FUN_001a84cc)",
  "native_frame_pop":"FUN_001aa40c holds queue mutex, advances head, decrements count",
  "native_frame_byte_size":0x124800,
  "direct_byte_buffer":"Native_pullToBuffer demands a DIRECT ByteBuffer capacity >=0x124800",
  "ownership":"queued frame is copied into caller buffer then native allocation is freed",
  "frame_metadata":"up to four long metadata values copied to caller array",
  "native_pump":"FUN_001a8404 invokes backend flush/pump and buffered-audio scheduler",
  "end_segment":"FUN_001a8230 finalizes tail and processes buffered steps",
  "reset":"FUN_001a77c0 clears buffered sample counts and output state; mode parity unverified",
  "provenance":"Original function addresses and instruction bytes; C pseudocode is Ghidra reconstruction",
 }
 output={"sdk":"ai.bithuman:expression2-android:0.6.2",
  "result":"PASS static original-code integrity, NOT runtime frame rate or complete SDK",
  "original_arm64_function_checks":original,
  "original_jvm_method_checks":verified_jvm,
  "native_direct_edges":[{"caller":label(a),"callee":label(b)} for a,b in LINKS],
  "source_derived_observations":observations,
  "not_proven":["Indirect function calls","Concurrency under a reset race",
   "Native image channel order bit equivalence","True frame queue max size",
   "Original engine live output and authentication","Real-time latency/FPS"]}
 out.mkdir(parents=True,exist_ok=True)
 (out/"native_frame_queue_contract.json").write_text(json.dumps(output,ensure_ascii=False,indent=2))
 md=["# Expression 2 native frame transport / original code proof","",
  "Read-only verification of machine instruction bytes, JVM bytecode and Ghidra reconstructed native functions.",
  "No custom emulator or guessed streaming engine is used.","",
  "## Original code coverage","",
  "- Native functions: "+str(len(original)),
  "- JVM methods: "+str(len(verified_jvm)),
  "- Original direct call edges: "+str(len(LINKS)),"",
  "## Source-bound findings",""]
 md += ["- "+k+": "+str(v) for k,v in observations.items()]
 md += ["","## Pending evidence",""] + ["- "+v for v in output["not_proven"]]
 md += ["","## Original function address and hash","",
  "| Function | Address | ARM64 instruction SHA256 |","|---|---|---|"]
 md += ["| "+r["original_function"]+" | "+r["original_arm64_vaddr"]+
        " | "+r["original_instruction_sha256"]+" |" for r in original]
 (out/"native_frame_queue_contract.md").write_text("\n".join(md)+"\n")
 print("EXPR2_ORIGINAL_FRAME_QUEUE_PASS",len(original),"ARM64",
   len(verified_jvm),"JVM",len(LINKS),"CALL_EDGES",flush=True)

if __name__=="__main__":
 p=argparse.ArgumentParser()
 p.add_argument("--native",type=Path,required=True)
 p.add_argument("--jvm",type=Path,required=True)
 p.add_argument("--out",type=Path,required=True)
 a=p.parse_args()
 verify(a.native,a.jvm,a.out)
