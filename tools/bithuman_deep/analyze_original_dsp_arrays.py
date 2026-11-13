#!/usr/bin/env python3
"""Analyze exact original Expression2 DSP output and candidate output per Float32 sample.

Consumes ADB-extracted original 44000 Float32 inputs and 35200 Float32 outputs.
Reports input fingerprint, SHA-256 of both outputs, absolute numerical errors,
bitwise match rate, signed monotonic Float32 ULP deltas, per-1120 block statistics.
Does not infer SDK authenticity from a zero error alone: data must have come from
the original native JNI oracle workflow and reference hashes are recorded.
"""
import argparse
import hashlib
import json
import math
import struct
from pathlib import Path

NAME_LIST = ("silence", "impulse", "sine", "fixed_noise", "spoken_tts")
WIDTH = 1120

def load_float_data(path, expected):
    raw=path.read_bytes()
    assert len(raw)==expected*4,(str(path),len(raw),expected*4)
    return raw,struct.unpack("<"+str(expected)+"f",raw)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def ordered(u):
    # Monotonic integer order for IEEE Float32 positive and negative values.
    return (~u)&0xffffffff if u&0x80000000 else (u|0x80000000)

def analyze(name, folder):
    in_data,input_values=load_float_data(folder/(name+"_input.f32"),44000)
    orig_raw,orig=load_float_data(folder/(name+"_original.f32"),35200)
    cand_raw,cand=load_float_data(folder/(name+"_candidate.f32"),35200)
    assert all(math.isfinite(z) for z in orig) and all(math.isfinite(z) for z in cand)
    refbits=struct.unpack("<35200I",orig_raw)
    candidatebits=struct.unpack("<35200I",cand_raw)
    first=None
    different=0
    exact=0
    sumerr=0.0
    maxerr=0.0
    max_ulp=0
    histogram={}
    blocks=[]
    for block in range((35200+WIDTH-1)//WIDTH):
        stop=min((block+1)*WIDTH,35200)
        d=stop-block*WIDTH
        local_match=0; local_abs=0.0; local_max=0.0; local_ulp=0
        for i in range(block*WIDTH,stop):
            v=abs(orig[i]-cand[i])
            u=abs(ordered(refbits[i])-ordered(candidatebits[i]))
            histogram[u]=histogram.get(u,0)+1
            if v>local_max:local_max=v
            local_abs+=v
            if u>local_ulp:local_ulp=u
            if refbits[i]==candidatebits[i]:
                local_match+=1
                exact+=1
            else:
                different+=1
                if first is None:
                    first={"index":i,"reference":orig[i],"candidate":cand[i],
                           "ulp_distance":u,"absolute_error":v}
            sumerr+=v
            if v>maxerr:maxerr=v
            if u>max_ulp:max_ulp=u
        blocks.append({"block":block,"samples":d,"exact_match":local_match,
                       "mismatch":d-local_match,"mae":local_abs/d,
                       "maximum_absolute_error":local_max,"max_ulp":local_ulp})
    return {"case":name,"input_sha256":sha(in_data),"original_sha256":sha(orig_raw),
            "candidate_sha256":sha(cand_raw),"reference_samples":len(orig),
            "exact_samples":exact,"mismatch_samples":different,
            "bit_exact":different==0,"mean_absolute_error":sumerr/len(orig),
            "maximum_absolute_error":maxerr,"max_ulp":max_ulp,
            "first_mismatch":first,
            "ulp_histogram":dict(sorted(histogram.items())[:100]),
            "blocks":blocks}

def main():
    arg=argparse.ArgumentParser()
    arg.add_argument("--inputs",type=Path,required=True)
    arg.add_argument("--output",type=Path,required=True)
    args=arg.parse_args()
    data={"source":"EXPR2 original Android JNI oracle exact array snapshots",
          "not_claimed":"complete SDK parity or original source recovered",
          "cases":[analyze(k,args.inputs) for k in NAME_LIST]}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(data,indent=2),encoding="utf-8")
    for x in data["cases"]:
        print("ORIGINAL_DSP_ARRAY_DIFF",x["case"],"exact",x["exact_samples"],
              "MAE",x["mean_absolute_error"],"ULP_MAX",x["max_ulp"],
              "FIRST_MISMATCH",x["first_mismatch"],flush=True)
    assert len(data["cases"])==5
if __name__=="__main__":
    main()
