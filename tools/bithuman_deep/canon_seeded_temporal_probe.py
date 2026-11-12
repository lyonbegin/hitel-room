#!/usr/bin/env python3
"""Generate diagnostically useful short face sequences using independent LiteRT.

Native JNI research shows canon (16 channels * 90 * 52 floats) repeated 16 times
into the step history buffer. This experiment probes two update directions and a
zero-history baseline; decoder channels 32..35 are still unknown and set to zero.

Outputs are EXPERIMENTAL and NOT validated bitHuman lip-sync or vendor parity.
No API secret, no vendor SDK, no authentication change.
"""
import argparse
import hashlib
import io
import json
import subprocess
import tempfile
import time
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw
from ai_edge_litert.interpreter import Interpreter

from imx_v2 import parse, extract


def actual_idle_first_frame(idle):
    result = subprocess.run([
        imageio_ffmpeg.get_ffmpeg_exe(),"-loglevel","error","-i",str(idle),
        "-vf","scale=416:720","-frames:v","1","-f","image2pipe",
        "-vcodec","png","-"],capture_output=True,timeout=60,check=True)
    return np.asarray(Image.open(io.BytesIO(result.stdout)).convert("RGB"),dtype=np.uint8)


def encode_mp4(frames,filepath):
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    proc=subprocess.run([
        ff,"-loglevel","error","-y","-f","rawvideo","-pix_fmt","rgb24",
        "-s","416x720","-r","20","-i","-","-an",
        "-c:v","libx264","-preset","ultrafast","-pix_fmt","yuv420p",
        "-movflags","+faststart",str(filepath)],input=b"".join(x.tobytes() for x in frames),
        capture_output=True,timeout=80)
    if proc.returncode!=0:
        raise RuntimeError("ffmpeg failed: "+proc.stderr.decode("utf8","replace")[:700])
    return filepath.stat().st_size


def flatten(arr):
    return arr.astype(np.float32,copy=False)


def generate(interp, canon, tokens, seed, direction):
    step=interp.get_signature_runner("step")
    decode=interp.get_signature_runner("dec8")
    if seed=="canon":
        history=np.repeat(canon[None,:,None,:,:],16,axis=2).copy()
    else:
        history=np.zeros((1,16,16,90,52),dtype=np.float32)
    motions=[]
    step_times=[]
    for i in range(tokens.shape[1]):
        start=time.perf_counter()
        curr=step(args_0=history,args_1=tokens[:,i,:,:])["output_0"]
        step_times.append(time.perf_counter()-start)
        assert curr.shape==(1,16,90,52) and np.isfinite(curr).all()
        motions.append(curr[0].copy())
        if direction=="append":
            history[:,:,:-1,:,:]=history[:,:,1:,:,:].copy()
            history[:,:,-1,:,:]=curr
        else:
            history[:,:,1:,:,:]=history[:,:,:-1,:,:].copy()
            history[:,:,0,:,:]=curr
    frames=[]
    dec_times=[]
    for begin in range(0,len(motions),8):
        chunk=motions[begin:begin+8]
        while len(chunk)<8:
            chunk.append(chunk[-1])
        inp=np.zeros((8,36,90,52),dtype=np.float32)
        inp[:,:16,:,:]=np.stack(chunk)
        inp[:,16:32,:,:]=canon
        clock=time.perf_counter()
        out=decode(args_0=inp)["output_0"]
        dec_times.append(time.perf_counter()-clock)
        assert out.shape==(8,3,720,416) and np.isfinite(out).all()
        for idx in range(min(8,len(motions)-begin)):
            rgb=(np.clip(out[idx].transpose(1,2,0),0,1)*255+0.5).astype(np.uint8)
            frames.append(rgb)
    assert len(frames)==14
    return frames,step_times,dec_times,motions


def run(source,out):
    out.mkdir(parents=True,exist_ok=True)
    report_path=out/"temporal_probe.json"
    report={"status":"STARTED","type":"proof-of-concept; not validated speaking avatar",
            "basis":"actual native canon history copy; unknown decoder extra channels 32:36",
            "modes":{}}
    def persist():
        report_path.write_text(json.dumps(report,indent=2),encoding="utf-8")
    persist()
    with tempfile.TemporaryDirectory(prefix="bitHuman-pipeline-") as directory:
        ix=parse(source)
        member={name:extract(source,ix,name,Path(directory)) for name in
                ("canon.bin","combined_litert.tflite","idle.mp4")}
        canon=np.fromfile(member["canon.bin"],dtype="<f4").reshape(16,90,52)
        idle=actual_idle_first_frame(member["idle.mp4"])
        Image.fromarray(idle).save(out/"idle_reference.png")
        interpreter=Interpreter(model_path=str(member["combined_litert.tflite"]),num_threads=2)
        interpreter.allocate_tensors()
        t=np.arange(35200,dtype=np.float32)/16000
        wave=(0.12*np.sin(2*np.pi*220*t)+0.02*np.sin(2*np.pi*440*t)).astype(np.float32).reshape(1,-1)
        enc=interpreter.get_signature_runner("enc")(args_0=wave)["output_0"]
        tokens=interpreter.get_signature_runner("tok14")(args_0=enc)["output_0"]
        report["real_audio_features_shape"]=list(tokens.shape)
        modes=[
            ("canon_append","canon","append"),
            ("canon_prepend","canon","prepend"),
            ("zero_append_baseline","zeros","append"),
        ]
        contacts=[("Original idle",idle)]
        for mode,seed,direction in modes:
            frames,times,decs,motions=generate(interpreter,canon,tokens,seed,direction)
            first=frames[0]
            path=out/(mode+".mp4")
            nbytes=encode_mp4(frames,path)
            reference_error=float(np.mean(np.abs(first.astype(np.float64)-idle)))
            first_png=out/(mode+"_first.png")
            Image.fromarray(first).save(first_png)
            temporal_magnitude=[float(np.mean(np.abs(frames[i].astype(np.float32)-frames[i-1])))
                                 for i in range(1,len(frames))]
            report["modes"][mode]={
                "seed":seed,"history_shift":direction,"frames":len(frames),
                "step_ms":[round(v*1000,2) for v in times],
                "decoder_ms":[round(v*1000,2) for v in decs],
                "first_frame_mae_vs_idle":reference_error,
                "frame_temporal_pixel_mae_mean":float(np.mean(temporal_magnitude)),
                "frame_temporal_pixel_mae_max":float(np.max(temporal_magnitude)),
                "frame_rgb_sha256":[hashlib.sha256(x.tobytes()).hexdigest() for x in frames],
                "mp4":path.name,"mp4_bytes":nbytes,
                "first_png":first_png.name,
                "latent_output_first_stats":{
                    "mean":float(motions[0].mean()),"std":float(motions[0].std())},
                "latent_output_last_stats":{
                    "mean":float(motions[-1].mean()),"std":float(motions[-1].std())},
            }
            contacts.extend([(mode+" first",frames[0]),(mode+" last",frames[-1])])
            persist()
            print("TEMPORAL_PROBE",mode,"frame0_MAE",round(reference_error,3),
                  "motion_MAE",round(float(np.mean(temporal_magnitude)),3),
                  "MP4_BYTES",nbytes,flush=True)
        cols=4;wh=(208,360)
        rows=(len(contacts)+cols-1)//cols
        sheet=Image.new("RGB",(cols*wh[0],rows*392),(25,25,30))
        d=ImageDraw.Draw(sheet)
        for i,(name,arr) in enumerate(contacts):
            left=i%cols*wh[0];top=i//cols*392
            sheet.paste(Image.fromarray(arr).resize(wh),(left,top))
            d.text((left+3,top+366),name,fill=(255,255,255))
        sheet.save(out/"temporal_probe_contact_sheet.jpg",quality=86)
        report["status"]="SUCCEEDED"
        persist()


if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--imx",required=True,type=Path)
    p.add_argument("--out",required=True,type=Path)
    args=p.parse_args()
    run(args.imx,args.out)
