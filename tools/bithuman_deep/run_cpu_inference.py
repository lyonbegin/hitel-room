#!/usr/bin/env python3
"""CPU inference probe for publicly distributed bitHuman IMX graph members.

Independent runtime only. No vendor SDK invocation, keys, network, or license
changes. Provenance: public bitHuman showcase IMX.
Stages are written to JSON after each operation so timeouts leave evidence.
"""
import argparse
import hashlib
import json
import math
import os
import resource
import time
import traceback
from pathlib import Path

import numpy as np
from imx_v2 import parse, extract


def now():
    return time.time()


class Recorder:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.data = {"status": "STARTED", "started_at_unix": now(), "stages": []}
        self.write()

    def write(self):
        self.path.write_text(json.dumps(self.data, indent=2, ensure_ascii=False), encoding="utf-8")

    def stage(self, name, **kwargs):
        self.data["stages"].append({"name": name, "unix": now(), **kwargs})
        self.write()
        print("INFERENCE_STAGE", name, json.dumps(kwargs, ensure_ascii=False), flush=True)

    def fail(self, err):
        self.data["status"] = "FAILED"
        self.data["failure_type"] = type(err).__name__
        self.data["failure_reason"] = str(err)[:1300]
        self.data["traceback"] = traceback.format_exc()[-3500:]
        self.write()
        print("INFERENCE_FAILED", self.data["failure_reason"], flush=True)

    def success(self, **kwargs):
        self.data.update(status="SUCCEEDED", **kwargs)
        self.write()


def summarize(array):
    array = np.asarray(array)
    return {
        "shape": list(array.shape),
        "dtype": str(array.dtype),
        "finite": bool(np.all(np.isfinite(array))),
        "minimum": float(np.min(array)) if array.size else None,
        "maximum": float(np.max(array)) if array.size else None,
        "mean": float(np.mean(array, dtype=np.float64)) if array.size else None,
        "standard_deviation": float(np.std(array, dtype=np.float64)) if array.size else None,
        "sha256": hashlib.sha256(array.tobytes(order="C")).hexdigest(),
    }


def synth_audio(size, mode):
    t = np.arange(size, dtype=np.float32) / 16000.0
    if mode == "silence":
        return np.zeros(size, dtype=np.float32)
    return (0.14 * np.sin(2 * np.pi * 220.0 * t)
            + 0.06 * np.sin(2 * np.pi * 440.0 * t)).astype(np.float32)


def expression2_probe(model, report, mode):
    from ai_edge_litert.interpreter import Interpreter

    r = Recorder(report)
    r.stage("source_verified", path=model.name, bytes=model.stat().st_size)
    try:
        st = now()
        interpreter = Interpreter(model_path=str(model), num_threads=2)
        r.stage("interpreter_created", seconds=round(now()-st, 4),
                signature_list=interpreter.get_signature_list(),
                subgraphs=int(interpreter.num_subgraphs()))
        signatures = interpreter.get_signature_list()
        st = now()
        interpreter.allocate_tensors()
        r.stage("tensors_allocated", seconds=round(now()-st, 4),
                max_rss_kb=int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss))
        if "enc" in signatures:
            details = signatures["enc"]
            if len(details["inputs"]) != 1:
                raise RuntimeError("encoder signature has unexpected input count")
            inputname = details["inputs"][0]
            runner = interpreter.get_signature_runner("enc")
            # Shape confirmed by independent graph inspection: [1,35200] FLOAT32
            audio = synth_audio(35200, mode).reshape(1, 35200)
            st = now()
            output = runner(**{inputname: audio})
            elapsed = now()-st
            stats = {name: summarize(value) for name, value in output.items()}
            r.stage("encoder_invoke_success", route="named_signature_enc", seconds=round(elapsed, 4),
                    input=summarize(audio), outputs=stats)
        else:
            inputs = interpreter.get_input_details()
            outputs = interpreter.get_output_details()
            r.stage("primary_subgraph_interfaces",
                    inputs=[{"name": x["name"], "shape": x["shape"].tolist(), "dtype": str(x["dtype"]), "index": int(x["index"])} for x in inputs],
                    outputs=[{"name": x["name"], "shape": x["shape"].tolist(), "dtype": str(x["dtype"]), "index": int(x["index"])} for x in outputs])
            if len(inputs) != 1 or list(inputs[0]["shape"]) != [1, 35200]:
                raise RuntimeError("primary subgraph input differs from known encoder shape")
            audio = synth_audio(35200, mode).reshape(1, 35200)
            interpreter.set_tensor(int(inputs[0]["index"]), audio)
            st = now()
            interpreter.invoke()
            elapsed = now()-st
            stats = {x["name"]: summarize(interpreter.get_tensor(int(x["index"]))) for x in outputs}
            r.stage("encoder_invoke_success", route="primary_subgraph", seconds=round(elapsed, 4),
                    input=summarize(audio), outputs=stats)
        if not stats or not all(x["finite"] for x in stats.values()):
            raise RuntimeError("non-finite output or no outputs")
        r.success(route="litert_cpu", case=mode, output_count=len(stats),
                  outputs=stats, max_rss_kb=int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss))
    except BaseException as err:
        r.fail(err)
        raise


def essence2_probe(model, report, mode):
    import onnxruntime as ort

    r = Recorder(report)
    r.stage("source_verified", path=model.name, bytes=model.stat().st_size)
    try:
        options = ort.SessionOptions()
        options.intra_op_num_threads = 2
        options.inter_op_num_threads = 1
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
        start = now()
        session = ort.InferenceSession(str(model), sess_options=options, providers=["CPUExecutionProvider"])
        r.stage("onnx_session_created", seconds=round(now()-start, 4),
                providers=session.get_providers())
        inputs = session.get_inputs()
        outputs = session.get_outputs()
        metadata = {
            "inputs": [{"name": x.name, "shape": x.shape, "type": x.type} for x in inputs],
            "outputs": [{"name": x.name, "shape": x.shape, "type": x.type} for x in outputs],
        }
        r.stage("onnx_interfaces", **metadata)
        if {i.name for i in inputs} != {"ctx_t", "prev", "h"}:
            raise RuntimeError("unexpected ONNX decoder input names")
        arrays = {
            "ctx_t": np.zeros((1,256), dtype=np.float32),
            "prev": np.zeros((1,63), dtype=np.float32),
            "h": np.zeros((1,1,256), dtype=np.float32),
        }
        if mode == "sine":
            arrays["ctx_t"][0] = synth_audio(256, "sine") * 0.6
        start = now()
        res = session.run(None, arrays)
        duration = now()-start
        results = {x.name: summarize(v) for x,v in zip(outputs,res)}
        r.stage("onnx_invoke_success", seconds=round(duration,4), outputs=results)
        if len(res) != 2 or not all(np.all(np.isfinite(v)) for v in res):
            raise RuntimeError("decoder produced non-finite arrays or wrong output count")
        r.success(route="onnxruntime_cpu", case=mode, outputs=results,
                  max_rss_kb=int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss))
    except BaseException as err:
        r.fail(err)
        raise


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--imx", type=Path, required=True)
    p.add_argument("--kind", choices=["expression2", "essence2"], required=True)
    p.add_argument("--mode", choices=["silence", "sine"], default="silence")
    p.add_argument("--report", type=Path, required=True)
    args = p.parse_args()
    table = parse(args.imx)
    name = "combined_litert.tflite" if args.kind == "expression2" else "a2x_dec.onnx"
    import tempfile
    with tempfile.TemporaryDirectory(prefix="bithuman-test-") as directory:
        member = extract(args.imx, table, name, Path(directory))
        if args.kind == "expression2":
            expression2_probe(member, args.report, args.mode)
        else:
            essence2_probe(member, args.report, args.mode)


if __name__ == "__main__":
    main()
