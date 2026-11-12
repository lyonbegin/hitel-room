#!/usr/bin/env python3
"""Independent full-signature CPU execution probe of the public Expression 2 LiteRT graph.

Runs enc->tok14 with real intermediate tensors; probes step/dec8/dec16 separately
using clearly identified synthetic conditioning, without claiming true lip-sync.
No bitHuman SDK or API credential is used.
"""
import argparse
import json
import hashlib
import math
import os
import resource
import tempfile
import time
import traceback
from pathlib import Path

import numpy as np
from ai_edge_litert.interpreter import Interpreter

from imx_v2 import parse, extract

SIGNATURES = ("enc", "tok14", "step", "dec8", "dec16")


def tensor_stats(data):
    array = np.asarray(data)
    finite = bool(np.isfinite(array).all())
    return {
        "shape": [int(v) for v in array.shape],
        "dtype": str(array.dtype),
        "finite": finite,
        "min": float(np.nanmin(array)) if array.size else None,
        "max": float(np.nanmax(array)) if array.size else None,
        "mean": float(np.nanmean(array.astype(np.float64))) if array.size else None,
        "std": float(np.nanstd(array.astype(np.float64))) if array.size else None,
        "sha256": hashlib.sha256(array.tobytes()).hexdigest(),
    }


class Report:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.data = {"status": "STARTED", "runs": {}, "timestamp_unix": time.time(),
                     "warning": "Synthetic intermediate state for step/decoder; not a valid reconstructed renderer."}
        self.save()

    def save(self):
        self.path.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding="utf-8")

    def event(self, message, **details):
        self.data["runs"][message] = details
        self.save()
        print("EXPRESSION_FULL_PROBE", message, json.dumps(details, ensure_ascii=False)[:1300], flush=True)


def signature_call(interpreter, name, args, report, input_provenance):
    st=time.perf_counter()
    out=interpreter.get_signature_runner(name)(**args)
    elapsed=time.perf_counter()-st
    data={key:tensor_stats(v) for key,v in out.items()}
    report.event(name, duration_seconds=round(elapsed,5),
                 input_provenance=input_provenance,
                 output_tensors=data,
                 max_rss_kb=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    if not data or not all(x["finite"] for x in data.values()):
        raise RuntimeError(name + " returned nonfinite or empty result")
    return out


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--imx", type=Path, required=True)
    p.add_argument("--report", type=Path, required=True)
    p.add_argument("--skip-decoders", action="store_true")
    args=p.parse_args()
    report=Report(args.report)
    try:
        with tempfile.TemporaryDirectory(prefix="ex2-model-") as tmp:
            index=parse(args.imx)
            model=extract(args.imx,index,"combined_litert.tflite",Path(tmp))
            report.event("imx", member_count=index["member_count"],
                         tflite_bytes=model.stat().st_size)
            intr=Interpreter(model_path=str(model),num_threads=2)
            signatures=intr.get_signature_list()
            report.event("signatures", entries=signatures, subgraphs=intr.num_subgraphs())
            if set(SIGNATURES)-set(signatures):
                raise RuntimeError("Unexpected missing signatures: " + str(set(SIGNATURES)-set(signatures)))
            intr.allocate_tensors()
            report.event("allocated", max_rss_kb=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
            ts=np.arange(35200,dtype=np.float32)/np.float32(16000.0)
            wav=(0.12*np.sin(2*np.pi*220*ts)+0.02*np.sin(2*np.pi*440*ts)).astype(np.float32).reshape(1,-1)
            enc=signature_call(intr,"enc",{"args_0":wav},report,"synthetic 16kHz PCM sine mixture")
            encdata=enc["output_0"]
            assert encdata.shape==(1,55,12,768),encdata.shape
            tok=signature_call(intr,"tok14",{"args_0":encdata},report,"direct enc output tensor, no synthetic bridge")
            tokdata=tok["output_0"]
            assert tokdata.shape==(1,14,16,384),tokdata.shape
            # Correct temporal scheduling is NOT verified: using one of 14 token banks for this isolated test.
            latent=np.zeros((1,16,16,90,52),dtype=np.float32)
            conditioning=tokdata[:,0,:,:].copy()
            step=signature_call(intr,"step",{"args_0":latent,"args_1":conditioning},
                                report,"synthetic zero latent and first token bank from tok14 (not a validated scheduler)")
            assert step["output_0"].shape==(1,16,90,52),step["output_0"].shape
            if not args.skip_decoders:
                # Decoder input construction is not documented; zeros test runtime compatibility ONLY.
                for name,batch in (("dec8",8),("dec16",16)):
                    decinput=np.zeros((batch,36,90,52),dtype=np.float32)
                    out=signature_call(intr,name,{"args_0":decinput},report,
                                       "synthetic zero decoder features; NOT a true identity-conditioned frame")
                    assert out["output_0"].shape==(batch,3,720,416),out["output_0"].shape
            report.data["status"]="SUCCEEDED"
            report.data["completed_signatures"]=[x for x in SIGNATURES if x in report.data["runs"]]
            report.save()
    except BaseException as e:
        report.data["status"]="FAILED"
        report.data["error_type"]=type(e).__name__
        report.data["error"]=str(e)[:2000]
        report.data["traceback"]=traceback.format_exc()[-3500:]
        report.save()
        print("EXPRESSION_FULL_PROBE_FAILED",repr(e),flush=True)
        raise


if __name__=="__main__":
    main()
