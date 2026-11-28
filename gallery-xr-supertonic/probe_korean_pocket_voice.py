"""Generate a Korean-model voice cache from a synthetic, non-person prompt.
Export two candidate layouts for runtime verification; no claim of PKTV ABI until
comparison with an original voice or real native inference."""
import argparse
import json
import pathlib
import struct
import numpy as np
import torch
from pocket_tts import TTSModel
from safetensors.torch import save_file

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--config",required=True)
    p.add_argument("--voice",required=True)
    p.add_argument("--output",required=True)
    args=p.parse_args()
    out=pathlib.Path(args.output)
    out.mkdir(parents=True,exist_ok=True)
    torch.set_num_threads(2)
    torch.manual_seed(0)
    model=TTSModel.load_model(config=args.config)
    state=model.get_state_for_audio_prompt(pathlib.Path(args.voice))
    caches=[]
    report={}
    for key, tensors in sorted(state.items()):
        report[key]={k:list(v.shape) for k,v in tensors.items()}
        if "cache" not in tensors: continue
        cache=tensors["cache"].detach().cpu().float()
        assert cache.ndim==5 and cache.shape[:2]==(2,1) and cache.shape[-2:]==(16,64),(key,cache.shape)
        if "offset" in tensors: n=int(tensors["offset"].reshape(-1)[0])
        elif "current_end" in tensors: n=tensors["current_end"].shape[0]
        else: n=cache.shape[2]
        assert n>0 and n<=cache.shape[2],(key,n,cache.shape)
        a=cache[:,0,:n].numpy()
        assert np.isfinite(a).all()
        caches.append((key,a))
    assert len(caches)==6,[k for k,_ in caches]
    n=caches[0][1].shape[1]
    assert all(a.shape==(2,n,16,64) for _,a in caches)
    for variant in ("layer-kv-time","layer-time-kv","layer-kv-head","kv-layer-time"):
        if variant=="layer-kv-time": data=np.stack([a for _,a in caches])
        elif variant=="layer-time-kv": data=np.stack([a.transpose(1,0,2,3) for _,a in caches])
        elif variant=="layer-kv-head": data=np.stack([a.transpose(0,2,1,3) for _,a in caches])
        else: data=np.stack([a for _,a in caches]).transpose(1,0,2,3,4)
        b=b"PKTV"+struct.pack("<I",n)+data.astype("<f2").tobytes()
        assert len(b)==8+n*6*2*1024*2
        (out/(variant+".pktv")).write_bytes(b)
    (out/"voice-state.json").write_text(json.dumps({"frames":n,"layout_unverified":True,"modules":report},indent=2))
    # Original model inference baseline, not Android engine certification.
    chunks=model.generate_audio(state,"안녕하세요. 한국어 음성 합성 시험입니다.")
    audio=chunks.detach().cpu().numpy().reshape(-1)
    assert np.isfinite(audio).all() and len(audio)>2400
    import wave
    with wave.open(str(out/"reference-korean.wav"),"wb") as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(24000)
        f.writeframes((np.clip(audio,-1,1)*32767).astype("<i2").tobytes())
    print("PYTORCH_KOREAN_REFERENCE_PASS",len(audio),n)
if __name__=="__main__":
    main()
