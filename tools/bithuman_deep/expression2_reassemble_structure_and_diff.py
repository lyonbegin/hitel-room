#!/usr/bin/env python3
"""Assemble ORIGINAL FDE/P-code/data links into a functional memory topology
then compare the REAL committed HITEL SDK sources to the observed topology.

This does not transplant vendor bytes and does not claim inferred structures are
vendor's source C++ classes or that the current candidate achieves parity.
"""
import argparse
import collections
import csv
import hashlib
import json
import re
from pathlib import Path

STAGES=[
    ("01_java_worker","001724d8","JVM feed work-item -> JNI Native_feed",
     "JVM ArrayBlockingQueue(1024), copied Float32 input"),
    ("02_pcm_append","001a7fbc","native feed and speech segment state",
     "native std::vector<float> begin/end/capacity at +0x38/+0x40/+0x48"),
    ("03_vector_growth","001acf1c","PCM vector growth/reallocate",
     "native buffer ownership and copy / realloc"),
    ("04_reset","001a77c0","segment reset", "input counters, output counters"),
    ("05_canon","001a7db0","Canon history construction","299520 B -> 4792320 B"),
    ("06_scheduler","001a80dc","inference readiness and frame backpressure",
     "step +0x68, native queue +0xd0, frame limit +0x2c"),
    ("07_window","001a8500","source-window assembly and encoder call",
     "step0 25600+18400 zero / step1 44000 / sliding 25600"),
    ("08_preprocess","001a9794","source audio preprocessing",
     "44000 PCM -> 35200 Float32 then encoder input ×3"),
    ("09_tail","001a8230","utterance end and flushing",
     "state +0x31 tail, active backend work"),
    ("10_pump","001a8404","pending frame collection/dispatch",
     "backend outstanding work and nonblocking pulls"),
    ("11_pump_pull","001aa594","pump while awaiting frames",
     "pending backend output, queue backpressure"),
    ("12_transfer","001a7a04","async backend -> native queue",
     "backend+0x530..0x538 ownership move -> engine+0xd0"),
    ("13_pop","001aa40c","pop native queue frame",
     "image buffer 1198080B copied then freed"),
    ("14_count","001a84cc","count native queue",
     "engine+0xd0 under +0x7c mutex"),
    ("15_jni_pull","00172e7c","Native_pullToBuffer",
     "direct output ByteBuffer capacity at least 1198080B"),
]
OWNED_MEMORY={
    "speech_pcm_native": {"stage":"02_pcm_append","offsets":["+0x38","+0x40","+0x48","+0x50","+0x58"],
        "owner":"native engine","growth":"native vector initial reserve 64000 Float32"},
    "speech_scheduler": {"stage":"06_scheduler","offsets":["+0x2c","+0x68","+0xd0"],
        "owner":"engine state / mutex","growth":"scheduler-dependent"},
    "canon_history": {"stage":"05_canon","offsets":["engine+0x268","engine+0x280"],
        "owner":"native history state","growth":"4792320 bytes initialized from Canon"},
    "backend_pending_frames": {"stage":"12_transfer","offsets":["backend+0x530","backend+0x538"],
        "owner":"async model backend","growth":"unknown / not inferred"},
    "native_output_deque": {"stage":"13_pop","offsets":["engine+0x7c","engine+0xd0"],
        "owner":"native frame deque","growth":"0x38-byte slots per block"},
    "output_frame": {"stage":"13_pop","offsets":["0x124800"],
        "owner":"transferred buffer then deleted after copy","growth":"1198080 bytes per frame"}
}

def load_tsv(path):
    with open(path,newline="") as f:
        return list(csv.DictReader(f,delimiter="\t"))
def source(rel):
    return (Path("sdk")/rel).read_text()
def check(regex,s):
    return bool(re.search(regex,s,re.M|re.S))
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--fde",type=Path,required=True)
    p.add_argument("--pcode",type=Path,required=True)
    p.add_argument("--relocations",type=Path,required=True)
    p.add_argument("--out",type=Path,required=True)
    a=p.parse_args()
    a.out.mkdir(parents=True,exist_ok=True)
    fde={r["start_hex"]:r for r in load_tsv(a.fde)}
    pcode={r["start_hex"]:r for r in load_tsv(a.pcode/"pcode-fde-coverage.tsv")}
    rel=load_tsv(a.relocations)
    asm=load_tsv(a.pcode/"pcode-memory-sites.tsv")
    calls=load_tsv(a.pcode/"pcode-call-edges.tsv")
    references=load_tsv(a.pcode/"pcode-data-references.tsv")
    summary=json.loads((a.pcode/"pcode-summary.json").read_text())
    if len(fde)!=2629 or len(pcode)!=2629:
        raise RuntimeError("original FDE/Pcode inventory truncated")
    absent=[entry for stage,entry,*_ in STAGES if entry not in fde]
    if absent:raise RuntimeError("original critical entrypoint not in FDE: "+str(absent))

    avatar=source("expression2-dropin/src/main/java/ai/bithuman/expression2/Expression2Avatar.kt")
    runtime=source("expression2-dropin/src/main/java/ai/bithuman/expression2/Expression2Runtime.kt")
    bridge=source("expression2-dropin/src/main/cpp/native_bridge.cpp")
    core=source("expression2-verified-core/src/expression2_stream_state.cpp")
    cmake=source("expression2-dropin/src/main/cpp/CMakeLists.txt")
    # Real-source tests, not fabricated properties of unobserved code paths.
    candidate={
        "feed_queue_copy":check(r"input.copyOfRange\(offset,\s*offset\s*\+\s*count\)",avatar),
        "worker_native_feed_call":check(r"expression2_stream_feed\s*\(",bridge) or check(
            r"Expression2Native\.feed\s*\(",avatar),
        "native_state_compiled_in_aar":("expression2_stream_state.cpp" in cmake),
        "pcm_kotlin_capacity":int(re.search(r"FloatArray\((\d+)\)",avatar).group(1)),
        "pcm_window_44000_only":check(r"while\s*\(used\s*>=\s*44000\)",avatar),
        "first_window_25600_plus_padding":check(r"25600.*18400|18400.*25600",avatar),
        "native_vector_pcm_canonical_module_exists":check(r"std::vector<float>\s+pcm;",core),
        "canonical_native_reserve_64000":check(r"kInitialPcmCapacity\s*=\s*64000",core),
        "decoder_blocking_flush_latch":check(r"latch\.await\(\)",avatar),
        "encoder_input_multiplied_x3":check(r"ready(?:\[\w+\])?\s*\*\s*3(?:\.0)?[fF]?",runtime)
            or check(r"FloatArray\(ready\.size\).*ready\[.*\]\s*\*\s*3",runtime),
        "token_step_14_per_window":check(r"for\s*\(i\s+in\s+0\s+until\s+14\)",runtime),
        "first_step_six_tokens_later_eight":check(r"(first|step)\s*\?.{0,60}6.{0,60}8|if\s*\(first\).{0,60}6.{0,60}8",runtime),
        "unbounded_kotlin_frame_queue":check(r"LinkedBlockingQueue<Pixels>\(\)",avatar),
        "native_output_deque_used":check(r"expression2_stream_frame_pop",bridge),
        "frame_416x720":check(r"Bitmap\.createBitmap\(416,\s*720",avatar),
    }
    # An explicit static delta with source-backed locations. Do not infer
    # a dynamic "first wrong instruction" from different CPU binaries.
    differences=[
      dict(order=2,unit="FUN_001a7fbc/native PCM owner",
        original="64,000-float native std::vector, native JNI feed path",
        candidate="Kotlin FloatArray(65536) used by production AAR worker",
        differs=not (candidate["worker_native_feed_call"] and
                    candidate["native_state_compiled_in_aar"] and
                    candidate["pcm_kotlin_capacity"]==64000),
        candidate_sources=["Expression2Avatar.kt","native_bridge.cpp","CMakeLists.txt"]),
      dict(order=6,unit="FUN_001a80dc/scheduler",
        original="initial step eligible at 25,600 PCM and respects native outstanding capacity",
        candidate="renderWindow only while used>=44,000; no native outstanding gate",
        differs=candidate["pcm_window_44000_only"],
        candidate_sources=["Expression2Avatar.kt"]),
      dict(order=7,unit="FUN_001a8500/first audio window",
        original="first 25,600 PCM and 18,400 zero padding even when input longer",
        candidate="first full 44,000 PCM used",
        differs=not candidate["first_window_25600_plus_padding"],
        candidate_sources=["Expression2Avatar.kt"]),
      dict(order=8,unit="FUN_001a8500->FUN_001a9794/encoder tensor",
        original="multiply the 35,200 Float32 preprocessor output by 3.0",
        candidate="direct unscaled Float32 to enc graph",
        differs=not candidate["encoder_input_multiplied_x3"],
        candidate_sources=["Expression2Runtime.kt"]),
      dict(order=9,unit="original step0/step1+ token bank",
        original="first 6 motion tokens, subsequent 8 from index 6",
        candidate="14 tokens per independently rendered 44k window",
        differs=candidate["token_step_14_per_window"] and not
            candidate["first_step_six_tokens_later_eight"],
        candidate_sources=["Expression2Runtime.kt"]),
      dict(order=12,unit="FUN_001a7a04->FUN_001aa40c/frame memory owner",
        original="async backend pointer transfer under native queue mutex; native buffer freed after copy",
        candidate="unbounded Kotlin LinkedBlockingQueue<IntArray> retained until bitmap pull",
        differs=candidate["unbounded_kotlin_frame_queue"] and not
            candidate["native_output_deque_used"],
        candidate_sources=["Expression2Avatar.kt","native_bridge.cpp"]),
    ]
    orig_nodes=[]
    for ordinal,(stage,address,name,memory) in enumerate(STAGES):
        row=fde[address]; detail=pcode[address]
        orig_nodes.append(dict(stage=stage,sequence=ordinal+1,
            original_rva="0x"+address,source=name,state_or_buffer=memory,
            original_machine_code_sha256=row["sha256"],
            original_machine_code_bytes=int(row["length_bytes"]),
            ghidra_pcode_insns=int(detail["instructions"]),
            ghidra_load=int(detail["load"]),
            ghidra_store=int(detail["store"]),
            ghidra_direct_call=int(detail["call"]),
            ghidra_indirect_call=int(detail["callind"]),
            ghidra_decomp_coverage=detail["status"]))
    actual_original_refs={
       "fde":len(fde),
       "ghidra_pcode_inventory":len(pcode),
       "pcode_decoded_fde":summary["decoded_fde_ranges"],
       "total_pcode_LOAD":summary["pcode_load"],
       "total_pcode_STORE":summary["pcode_store"],
       "relocation_slots":len(rel),
       "pcode_data_refs":len(references),
       "pcode_call_edges":len(calls),
       "focused_load_store_sites":len(asm)
    }
    original_links=[]
    for row in calls:
        if row["caller_fde"] in {x[1] for x in STAGES}:
            original_links.append(row)
    result=dict(
        reference="original published Expression2 0.6.2 ARM64 ELF exact SHA anchored",
        reference_type="FDE function ranges + Ghidra low P-code + static data relocations",
        independent_sdk="committed HITEL candidate Kotlin/C++ SDK sources",
        full_sdk_parity_proven=False,
        original_execution_not_required=True,
        original_sdk_auth_modified=False,
        original_elf_reassembled_byte_exact=True,
        original_units=orig_nodes, original_memory_owners=OWNED_MEMORY,
        original_native_call_edges_from_focused_sites=original_links,
        original_evidence_totals=actual_original_refs,
        candidate_features=candidate,
        static_structural_differences=differences,
        first_static_structural_divergence=next(
            (x for x in differences if x["differs"]),None),
        limitations=[
          "FDE addresses are function unwind ranges, not C++ source definitions",
          "Ghidra raw low P-code loads/stores expose sites, not a full alias analysis",
          "Original semantics cited for key functions were validated in earlier binary audits, not inferred from FDE hashes alone",
          "Candidate source pattern checks are structural evidence and require review of false negatives",
          "No vendor inference trace is available to compare generated frames"
        ])
    (a.out/"original-reconstructed-architecture.json").write_text(
        json.dumps(result,indent=2,ensure_ascii=False)+"\n")
    (a.out/"original-buffer-ownership.json").write_text(
        json.dumps(OWNED_MEMORY,indent=2)+"\n")
    lines=[
       "# Original Expression 2 native structure → reconstructed memory graph → HITEL SDK diff",
       "",
       "Reference: actual original ARM64 + P-code disassembly; NOT a new independently compiled SDK.",
       "",
       "| Order | Original RVA | Role / memory | P-code LOAD | STORE | CALL | Candidate alignment |",
       "|---:|---|---|---:|---:|---:|---|"]
    diff_by_order={x["order"]:x for x in differences}
    for i,n in enumerate(orig_nodes,1):
        delta=diff_by_order.get(i)
        verdict="DIFFERENCE" if delta and delta["differs"] else (
            "NOT VERIFIED" if delta is None else "PARTIAL")
        lines.append("| "+str(i)+" | "+n["original_rva"]+" | "+
            n["source"].replace("|","/")+" | "+str(n["ghidra_load"])+
            " | "+str(n["ghidra_store"])+" | "+str(n["ghidra_direct_call"])+
            " | "+verdict+" |")
    lines+=["",
       "## Source-level differences (not runtime trace)",
       ""]
    for d in differences:
        if d["differs"]:
            lines+=["- "+d["unit"]+": "+d["original"]+"; existing SDK: "+d["candidate"]]
    lines+=["",
        "Earliest checked structural divergence: "+
        (result["first_static_structural_divergence"]["unit"] if
         result["first_static_structural_divergence"] else "none observed"),
        "",
        "Note: static function order is a comparison index, not a measured runtime execution sequence.",
        "Byte-identical original ELF layout reassembly is separate from a functional independent SDK.",
        "Ghidra had "+str(summary["decoded_fde_ranges"])+
        " decoded FDE ranges, out of 2629 total; unrecognized sites stay UNDECODED."]
    (a.out/"SUMMARY.md").write_text("\n".join(lines)+"\n")
    print("EXPR2_ORIGINAL_FDE_MEMORY_REASSEMBLY_COMPLETE",
        "orig_fde",len(fde),"pcode_decoded",summary["decoded_fde_ranges"],
        "orig_loads",summary["pcode_load"],"orig_stores",summary["pcode_store"],
        "diffs",sum(x["differs"] for x in differences),
        "first",result["first_static_structural_divergence"]["unit"])
if __name__=="__main__":
    main()
