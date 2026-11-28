"""Convert a six-layer Korean checkpoint to MediaPipe PKTW using a pinned
reference container. Fail closed on record count, names, shape and lengths.
PKTW is inferred from the actual reference binary; runtime validation follows.
"""
import argparse
import hashlib
import json
import math
import pathlib
import struct
import numpy as np

def u32(b, p):
    return struct.unpack_from("<I", b, p)[0]

def sha(b):
    return hashlib.sha256(b).hexdigest()

def parse(data, tensors):
    assert data[:4] == b"PKTW"
    count = u32(data, 4)
    p = 8
    records = []
    for _ in range(count):
        size = u32(data, p); p += 4
        assert 0 < size < 256
        name = data[p:p+size].decode("ascii"); p += size
        dtype, n = struct.unpack_from("<II", data, p); p += 8
        shape = tensors[name]["shape"]
        assert math.prod(shape) == n, (name, n, shape)
        rows = None
        if dtype == 1:
            payload = n * 2
        elif dtype == 2:
            rows = u32(data, p); p += 4
            assert len(shape) == 2 and rows == shape[0] and n % rows == 0, (name, rows, shape)
            payload = rows * 4 + n
        else:
            raise ValueError((name, dtype))
        assert p + payload <= len(data)
        records.append((name, dtype, n, rows, p, payload))
        p += payload
    assert p == len(data), (p, len(data))
    assert len({r[0] for r in records}) == count
    return records

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reference", required=True)
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    out = pathlib.Path(args.out); out.mkdir(parents=True, exist_ok=True)
    with open(args.reference, "rb") as f:
        f.seek(81920)
        ref = f.read(120090818)
    with open(args.checkpoint, "rb") as f:
        n = struct.unpack("<Q", f.read(8))[0]
        tensors = json.loads(f.read(n))
    records = parse(ref, tensors)
    assert len(records) == 169
    assert sum(r[1] == 2 for r in records) == 25
    source = np.memmap(args.checkpoint, dtype="uint8", mode="r", offset=8+n)
    report = []
    dest = out / "pocket_tts_weights_ko.bin"
    with dest.open("wb") as f:
        f.write(b"PKTW" + struct.pack("<I", len(records)))
        for name, dtype, count, rows, pos, payload in records:
            meta = tensors[name]
            assert meta["dtype"] == "F32"
            start, end = meta["data_offsets"]
            a = np.frombuffer(source[start:end], dtype="<f4").reshape(meta["shape"])
            assert a.size == count and np.isfinite(a).all(), name
            key = name.encode("ascii")
            f.write(struct.pack("<I", len(key)) + key + struct.pack("<II", dtype, count))
            if dtype == 1:
                converted = a.astype("<f2")
                assert np.isfinite(converted).all()
                f.write(converted.tobytes())
                error = float(np.max(np.abs(a - converted.astype(np.float32))))
            else:
                # Symmetric signed per-row INT8. Match reference record layout:
                # row count, one little-endian FP32 scale per row, then signed bytes.
                scale = np.max(np.abs(a), axis=1).astype("<f4") / np.float32(127)
                scale[scale == 0] = 1
                q = np.clip(np.rint(a / scale[:,None]), -127, 127).astype(np.int8)
                f.write(struct.pack("<I", rows))
                f.write(scale.astype("<f4").tobytes())
                f.write(q.tobytes())
                error = float(np.max(np.abs(a - q.astype(np.float32)*scale[:,None])))
            report.append({"name":name,"dtype":dtype,"shape":meta["shape"],"max_abs_error":error})
    converted = dest.read_bytes()
    assert len(converted) == len(ref)
    assert parse(converted,tensors) == records
    ignored = sorted(set(tensors) - {"__metadata__"} - {r[0] for r in records})
    (out/"conversion-report.json").write_text(json.dumps({
        "status":"PKTW_STRUCTURAL_PASS_NOT_RUNTIME",
        "sha256":sha(converted),"bytes":len(converted),"records":len(records),
        "unrepresented_checkpoint_tensors":ignored,"entries":report},indent=2))
    print("PKTW_STRUCTURAL_PASS",len(records),len(converted),sha(converted))
    print("UNREPRESENTED",ignored)
if __name__ == "__main__":
    main()
