"""Pack PKTW and PKTV test candidates into the original LiteRT-LM container.
Preserve header version and original section alignment. Test packs are NOT
production models until MediaPipe runtime and Korean intelligibility pass.
"""
import argparse
import copy
import hashlib
import json
import pathlib
import shutil
import struct
import subprocess
import tempfile

BLOCK = 16384
def align(n):
    return (n + BLOCK - 1) // BLOCK * BLOCK

def header_of(path, schema, temp):
    with path.open("rb") as f:
        prefix = f.read(32)
        assert prefix[:8] == b"LITERTLM"
        end = struct.unpack_from("<Q", prefix, 24)[0]
        assert 32 < end <= BLOCK
        header = f.read(end - 32)
    src = temp / "original.bin"
    src.write_bytes(header)
    subprocess.run(["flatc","--json","--strict-json","--raw-binary","-o",str(temp),str(schema),"--",str(src)],check=True)
    return prefix, json.loads((temp / "original.json").read_text())

def name_of(s):
    for x in s.get("items",[]):
        if x["key"] == "name": return x["value"]["value"]
    return None

def generic(name):
    return {"items":[{"key":"name","value_type":"StringValue","value":{"value":name}}],
            "data_type":"GenericBinaryData"}

def pack(reference, schema, output, replacements, extra, keep_all):
    with tempfile.TemporaryDirectory() as tmp:
        temp=pathlib.Path(tmp)
        prefix, header=header_of(reference,schema,temp)
        old=header["section_metadata"]["objects"]
        plans=[]
        for obj in old:
            name=name_of(obj)
            key=name or obj["data_type"]
            if key in replacements:
                plans.append((copy.deepcopy(obj), replacements[key]))
            elif keep_all or obj["data_type"]=="Text2SpeechMetadataProto":
                plans.append((copy.deepcopy(obj),(obj["begin_offset"],obj["end_offset"])))
        for obj,path in extra:
            plans.append((obj,path))
        at=BLOCK
        for obj,src in plans:
            length=src[1]-src[0] if isinstance(src,tuple) else src.stat().st_size
            at=align(at)
            obj["begin_offset"]=at
            obj["end_offset"]=at+length
            at+=length
        header["section_metadata"]["objects"]=[obj for obj,_ in plans]
        src_json=temp/"packed.json";src_json.write_text(json.dumps(header))
        subprocess.run(["flatc","--binary","--strict-json","-o",str(temp),str(schema),str(src_json)],check=True)
        candidates=[p for p in temp.glob("packed.*") if p.suffix!=".json"]
        assert len(candidates)==1,candidates
        flat=candidates[0].read_bytes()
        assert len(flat)+32 <= BLOCK
        prefix=prefix[:24]+struct.pack("<Q",len(flat)+32)
        output.parent.mkdir(parents=True,exist_ok=True)
        with output.open("wb") as f,reference.open("rb") as orig:
            f.write(prefix+flat)
            for obj,src in plans:
                f.seek(obj["begin_offset"])
                if isinstance(src,tuple):
                    orig.seek(src[0]);remaining=src[1]-src[0]
                    while remaining:
                        b=orig.read(min(4*1024*1024,remaining))
                        assert b
                        f.write(b);remaining-=len(b)
                else:
                    with src.open("rb") as stream: shutil.copyfileobj(stream,f)
            f.truncate(at)
        assert output.stat().st_size==at
        print("PACK_STRUCTURAL_PASS",output,at,len(plans))
        return header

def main():
    p=argparse.ArgumentParser()
    for n in ["reference","schema","weights","tokenizer","voice","out"]:
        p.add_argument("--"+n,type=pathlib.Path,required=True)
    p.add_argument("--mode",choices=["standalone-alias","multilingual-ko"],required=True)
    a=p.parse_args()
    with a.weights.open("rb") as f: assert f.read(4)==b"PKTW"
    with a.voice.open("rb") as f:
        assert f.read(4)==b"PKTV"
        n=struct.unpack("<I",f.read(4))[0]
    assert a.voice.stat().st_size==8+n*6*2*1024*2
    if a.mode=="standalone-alias":
        # Test-only known locale/voice slot. No original installed model is modified.
        header=pack(a.reference,a.schema,a.out,{"SP_Tokenizer":a.tokenizer,"pocket_tts_weights":a.weights,"alba":a.voice},[],False)
    else:
        header=pack(a.reference,a.schema,a.out,{},[(generic("sp_tokenizer_ko"),a.tokenizer),(generic("pocket_tts_weights_ko"),a.weights),(generic("ko_hitel"),a.voice)],True)
    a.out.with_suffix(".sections.json").write_text(json.dumps(header,indent=2))
if __name__=="__main__":
    main()
