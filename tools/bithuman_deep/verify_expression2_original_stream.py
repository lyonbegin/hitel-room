#!/usr/bin/env python3
"""Expression2 stream audit only: compare actual JVM instruction listings and ARM64
machine instruction hashes recovered from the unmodified published SDK.
No implementation, emulation, code patching or invented audio scheduler.
"""
import argparse
import csv
import json
import re
from pathlib import Path

JNI = "Java_ai_bithuman_expression2_Native_"
EXPECTED = {
    "feed": ("001724d8", "2714bf99c6a1d5fa34f13af83920c81e7bdc3bc885427e4d5d4094035cce10d5"),
    "pump": ("00172bf8", "2ad46e79bf65d18195afa4ee6ea35e090afffb2986f94d5f01bc60d77d9db26b"),
    "pumpForPull": ("00172d1c", "29b92774593349683196f8a71c44108ae8e4314fdef580d6e70104fdc4bf832f"),
    "pullToBuffer": ("00172e7c", "451e33be262d35cf1df66814d3ed277041a2c458a8748e566f20b5e627469a76"),
    "beginSegment": ("001724d0", "87fecc2ee032c7adddd83b0cc3c22dc9ec83bcb521d7b2e78e7782a02d6dbaca"),
    "endSegment": ("00172acc", "1a8d9d82ba0bdd8b2f4d5929761a8117904c70098fff65298707e000dd685268"),
    "reset": ("00172e68", "849c6b4bb0d310e1a58445a5813890e0bf8b19d15112cc4e050d759900bdf0fc"),
    "queuedFrames": ("00172e40", "eeb02cc99a4c8fffc0513a8ea741c12ac625d3684c627dbd55ba229a061a4001"),
}
ROOT_EDGES = [
    ("feed", "FUN_001a7fbc"), ("pump", "FUN_001a8404"),
    ("pumpForPull", "FUN_001aa594"), ("beginSegment", "FUN_001a7cfc"),
    ("endSegment", "FUN_001a8230"), ("reset", "FUN_001a779c"),
]
INTERNAL_EDGES = [
    ("FUN_001a7fbc", "FUN_001a80dc"),
    ("FUN_001a8404", "FUN_001a80dc"),
    ("FUN_001a80dc", "FUN_001a8500"),
]

def verified_jvm_method(javap, name, fragments):
    pattern = r"(?m)^  (?:private|public|protected) [^\n]*?" + name + r"\([^;\n]*\);"
    m = re.search(pattern, javap)
    assert m is not None, ("method absent", name)
    boundary = re.search(r"(?m)^  (?:private|public|protected) [^\n]*?;", javap[m.end():])
    end = m.end() + boundary.start() if boundary else len(javap)
    snippet = javap[m.start():end]
    for fragment in fragments:
        assert fragment in snippet, ("original JVM bytecode fact missing", name, fragment)
    return {"name": name, "verified_jvm_instruction_fragments": fragments}

def main(jvm, native, out):
    names = (jvm / "class-names.txt").read_text().splitlines()
    assert len(names) == 92, ("Unexpected JVM class inventory", len(names))
    clazz = "ai.bithuman.expression2.Expression2Avatar"
    javap = (jvm / "classes" / ("%05d.javap.txt" % (names.index(clazz)+1))).read_text()
    facts = {
        "feed": ["ArraysKt.copyOfRange:([FII)[F", "Method enqueue:"],
        "flushTail": ["Method enqueue:", "Method drainPending:"],
        "beginSegment": ["Method enqueue:", "Method drainPending:"],
        "enqueue": ["Method startWorker:", "ArrayBlockingQueue.put:", "Field inFlight:"],
        "drainPending": ["Field inFlight:", "Condition.await:"],
        "startWorker": ["String expression2-render", "Thread.setDaemon:", "Thread.setPriority:", "Thread.start:"],
        "runWorker": ["long 5l", "ArrayBlockingQueue.poll:", "ArrayBlockingQueue.take:",
                      "Method pumpQuietly:", "Native.feed:", "Native.endSegment:",
                      "Native.beginSegment:", "Native.reset:"],
        "pumpQuietly": ["Native.pump:"],
        "utteranceOpen": ["Native.hasPendingTail:"],
        "pull": ["SelfHostMeter.noteObserved", "MeterHost.gate:", "SelfHostMeter.withholds",
                 "Native.pullToBuffer:", "Method stamp:"],
        "pump": ["Native.pump:"],
        "resetState": ["Method enqueue:"],
        "stamp": ["ptsBaseFrames", "lastIndex", "long 1000000l", "bipush        20", "Expression2Frame"],
    }
    checked = {key: verified_jvm_method(javap, key, frags) for key,frags in facts.items()}
    assert "sipush        1024" in javap
    rows = list(csv.DictReader((native / "functions.tsv").open(), delimiter="\t"))
    assert len(rows) == 1035
    assert sum(int(row["instruction_count"]) for row in rows) == 65933
    index = {row["name"]: row for row in rows}
    root_data = {}
    for name,(addr,digest) in EXPECTED.items():
        symbol = JNI + name
        row = index[symbol]
        assert (row["address"],row["bytes_sha256"]) == (addr,digest), (symbol,"original function mismatch")
        assert row["decompile"] == "SUCCESS"
        root_data[name] = {"jni_symbol":symbol,"ghidra_vaddr":addr,
                           "original_machine_instruction_sha256":digest,
                           "machine_instructions":int(row["instruction_count"])}
    edges = list(csv.DictReader((native / "call-edges.tsv").open(),delimiter="\t"))
    checked_edges = []
    for caller,callee in [(JNI+a,b) for a,b in ROOT_EDGES] + INTERNAL_EDGES:
        a,b = index[caller],index[callee]
        assert any(e["caller_address"] == a["address"] and e["callee_address"] == b["address"]
                   for e in edges), ("original native direct call missing",caller,callee)
        checked_edges.append({"caller":caller,"callee":callee,
                              "caller_address":a["address"],"callee_address":b["address"]})
    window = index["FUN_001a80dc"]
    files = list((native / "decompiler-reconstruction-not-original").glob("*_" + window["address"] + ".c"))
    assert len(files) == 1
    win = files[0].read_text()
    for fragment in ["lVar4 = 0x6400;", "lVar4 = 44000;", "0x47e0", "FUN_001a8500"]:
        assert fragment in win, ("window check not recovered",fragment)
    contract = {
        "sdk":"ai.bithuman:expression2-android:0.6.2",
        "evidence":"actual original JVM bytecode and native ARM64 instruction records",
        "original_jvm_methods":checked,
        "native_jni_roots":root_data,"native_direct_edges":checked_edges,
        "original_input_queue_capacity":1024,"original_worker_poll_max_ms":5,
        "original_frame_timestamp_contract":{
            "source_function":"Expression2Avatar.stamp(long[])",
            "model_frame_index":"meta[0]",
            "clock_reset":"if lastIndex>=0 and newIndex<=lastIndex, ptsBaseFrames += lastIndex+1-newIndex",
            "presentationTimeUs":"(ptsBaseFrames + meta[0]) * 1000000 / 20",
            "audioSample":"meta[2]",
            "isSpeech":"meta[3] != 0",
            "verified_frame_duration_us":50000
        },
        "original_audio_scheduler_sample_thresholds":{
            "initial":25600,"second":44000,
            "later":"index * 25600 + 18400",
            "note":"Static branch conditions, not real-world latency measurements"
        },
        "original_arm64_function_count":len(rows),
        "original_arm64_instruction_count":65933,
        "disclaimer":"No custom SDK built; static findings are not proof of dynamic timing or full indirect call coverage"
    }
    out.mkdir(parents=True,exist_ok=True)
    (out/"original-stream-contract.json").write_text(json.dumps(contract,indent=2,ensure_ascii=False))
    md = ["# Original Expression2 SDK streaming function verification","","This report is derived from unmodified JVM bytecode and original ARM64 machine instructions.","",
          "## Confirmed original methods",""]
    md += ["- "+name+": "+", ".join(facts[name]) for name in facts]
    md += ["","## Confirmed native execution entry points",""]
    md += ["- "+name+": "+v["ghidra_vaddr"]+" SHA256 "+v["original_machine_instruction_sha256"]
           for name,v in root_data.items()]
    md += ["","## Original audio processing thresholds","",
           "- First native buffered-audio threshold: 25600 Float32 samples (1.6s at 16kHz).",
           "- Second threshold: 44000 samples (2.75s at 16kHz).",
           "- Later branch threshold: index x 25600 + 18400 samples.",
           "- Kotlin input pending queue holds up to 1024 jobs, not 1024 frames.",
           "- Worker uses timed 5ms polling when utterance is open and invokes native pump on idle poll.",
           "- Native JNI feed/pump/pull entry points and their direct call links are checked against original function addresses and hashes.",
           "- Original SDK timestamps frames using 50000us per output frame (20fps), adjusts the base when frame index restarts, and attaches audioSample / isSpeech from native metadata.",
           "- Original SDK is not the same as a custom static 53-frame batch renderer.",
           "",
           "## Not yet verified","","- Indirect JNI/native call dispatch, runtime A/V timing, complete buffer ownership and errors.",
           "- Original engine versus independent implementation frame-level parity.",
           "- Any claim of production-ready real-time Android rendering.",
           "- Recovered Ghidra C code is not the literal original developer-written C++ source."]
    (out/"original-stream-contract.md").write_text("\n".join(md)+"\n")
    print("EXPR2_ORIGINAL_STREAM_CONTRACT_PASS",len(checked),"JVM",len(root_data),
          "NATIVE_JNI",len(checked_edges),"EDGES")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--jvm",type=Path,required=True)
    p.add_argument("--native",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True)
    a = p.parse_args()
    main(a.jvm,a.native,a.out)
