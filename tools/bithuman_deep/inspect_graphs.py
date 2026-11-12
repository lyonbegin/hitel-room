#!/usr/bin/env python3
"""Inspect tensor signatures of genuine public bitHuman IMX models without running inference.

Depends on pip-installable open model parsers (tflite, onnx); does not import vendor
SDK, invoke a renderer, use credentials, or publish model weights.
"""
import argparse
from collections import Counter
import json
import tempfile
from pathlib import Path
from imx_v2 import parse, extract


def tensor_info(tensor):
    try:
        arr = tensor.ShapeAsNumpy()
        shape = [int(x) for x in arr] if arr is not None else []
    except (AttributeError, TypeError):
        shape = [int(tensor.Shape(i)) for i in range(tensor.ShapeLength())]
    name = tensor.Name()
    return {"name": name.decode("utf-8", "replace") if name else "", "shape": shape, "dtype_code": int(tensor.Type())}


def tflite_report(path):
    import tflite
    raw = path.read_bytes()
    model = tflite.Model.GetRootAsModel(raw, 0)
    op_codes = []
    for i in range(model.OperatorCodesLength()):
        op = model.OperatorCodes(i)
        custom = op.CustomCode()
        opcode = int(op.BuiltinCode())
        opname = "custom:" + custom.decode("utf-8", "replace") if custom else "builtin:" + str(opcode)
        op_codes.append(opname)
    graph = {
        "schema_version": model.Version(),
        "subgraph_count": model.SubgraphsLength(),
        "operator_code_types": op_codes,
        "subgraphs": [],
    }
    for si in range(min(model.SubgraphsLength(), 32)):
        sg = model.Subgraphs(si)
        counts = Counter()
        for oi in range(sg.OperatorsLength()):
            inst = sg.Operators(oi)
            index = int(inst.OpcodeIndex())
            counts[op_codes[index] if index < len(op_codes) else "unknown:" + str(index)] += 1
        def tensor_at(i):
            return tensor_info(sg.Tensors(i))
        graph["subgraphs"].append({
            "subgraph_index": si,
            "name": (sg.Name() or b"").decode("utf-8", "replace"),
            "tensor_count": sg.TensorsLength(),
            "operator_count": sg.OperatorsLength(),
            "operators": dict(counts.most_common(60)),
            "inputs": [tensor_at(int(sg.Inputs(i))) for i in range(sg.InputsLength())],
            "outputs": [tensor_at(int(sg.Outputs(i))) for i in range(sg.OutputsLength())],
        })
    return graph


def onnx_report(path):
    import onnx
    model = onnx.load_model(str(path), load_external_data=False)
    graph = model.graph
    def endpoint(node):
        tt = node.type.tensor_type
        if tt.HasField("shape"):
            shape = [
                int(d.dim_value) if d.HasField("dim_value") else
                str(d.dim_param) if d.HasField("dim_param") else None
                for d in tt.shape.dim
            ]
        else:
            shape = []
        return {"name": node.name, "shape": shape, "dtype_code": int(tt.elem_type)}
    return {
        "ir_version": int(model.ir_version),
        "opsets": [{"domain": x.domain, "version": int(x.version)} for x in model.opset_import],
        "node_count": len(graph.node),
        "initializer_count": len(graph.initializer),
        "operators": dict(Counter(x.op_type for x in graph.node).most_common(70)),
        "inputs": [endpoint(x) for x in graph.input[:40]],
        "outputs": [endpoint(x) for x in graph.output[:40]],
    }


def inspect_family(label, imx_path):
    table = parse(imx_path)
    candidates = [e for e in table["members"] if e["name"].endswith((".tflite", ".onnx"))]
    summary = {
        "model_family": label,
        "imx_file_bytes": table["file_size_bytes"],
        "total_members": table["member_count"],
        "graph_models": {},
    }
    with tempfile.TemporaryDirectory(prefix="bithuman-graph-") as tmp:
        for entry in candidates:
            name = entry["name"]
            try:
                local = extract(imx_path, table, name, Path(tmp))
                parsed = tflite_report(local) if name.endswith(".tflite") else onnx_report(local)
                summary["graph_models"][name] = {
                    "bytes": entry["size_bytes"], "status": "PARSED", "graph": parsed
                }
            except Exception as err:
                summary["graph_models"][name] = {
                    "bytes": entry["size_bytes"], "status": "ERROR",
                    "error": type(err).__name__ + ": " + str(err)[:600],
                }
    return summary


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--expression-imx", type=Path, required=True)
    p.add_argument("--essence-imx", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    data = {
        "scope": "read-only tensor shape/operator graph analysis, no weights included",
        "models": {
            "expression2": inspect_family("expression2", args.expression_imx),
            "essence2": inspect_family("essence2", args.essence_imx),
        },
    }
    (args.out / "model_graphs.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = ["# bitHuman public IMX tensor graph audit", "", "Only graph metadata, no model weights.", ""]
    for family, info in data["models"].items():
        lines += ["## " + family, ""]
        for name, result in info["graph_models"].items():
            lines += ["### " + name, "", "- File bytes: " + str(result["bytes"]), "- Parse: " + result["status"]]
            if "graph" in result:
                graph = result["graph"]
                sections = graph.get("subgraphs", [graph])
                for sub in sections[:12]:
                    lines += ["- Operators: " + str(sub.get("operator_count", sub.get("node_count")))]
                    lines += ["- Inputs: " + json.dumps(sub.get("inputs", [])[:20], ensure_ascii=False)]
                    lines += ["- Outputs: " + json.dumps(sub.get("outputs", [])[:20], ensure_ascii=False)]
                    lines += ["- Operator types: " + json.dumps(sub.get("operators", {}), ensure_ascii=False)[:1500]]
            else:
                lines.append("- Error: " + result["error"])
            lines.append("")
    (args.out / "model_graphs.md").write_text("\n".join(lines), encoding="utf-8")
    for family, info in data["models"].items():
        for name, result in info["graph_models"].items():
            print("GRAPH", family, name, result["status"],
                  "subgraphs=", result.get("graph", {}).get("subgraph_count", 1),
                  "nodes=", result.get("graph", {}).get("node_count", ""))
    parsed = [
        (family, name) for family, info in data["models"].items()
        for name, result in info["graph_models"].items() if result["status"] == "PARSED"
    ]
    if not any(family == "expression2" and name.endswith(".tflite") for family, name in parsed):
        raise SystemExit("Expression 2 TFLite graph not parsed")
    if not any(family == "essence2" and name.endswith(".onnx") for family, name in parsed):
        raise SystemExit("Essence 2 ONNX graph not parsed")


if __name__ == "__main__":
    main()
