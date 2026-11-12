#!/usr/bin/env python3
"""Independent Expression2 phase4 decoder reproduction using public TFLite weights.

JNI static analysis points to a 36-channel decoder:
  [0:16]   current motion (16,90,52)
  [16:32]  previous motion (16,90,52)
  [32:36]  spatial one-hot phase of 4 successive frames

First motion emits only phase=3 with itself as previous. Each later motion
emits phases 0,1,2,3. Thus 14 model steps -> 1 + 13*4 = 53 RGB frames.

Sample audio is synthesized test signal; authentic human lip-sync is NOT proven.
No bitHuman SDK, API credentials, or vendor session is used.
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
from PIL import Image,ImageDraw
from ai_edge_litert.interpreter import Interpreter
from imx_v2 import parse,extract


def refer_frame(path):
    p=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),"-loglevel","error","-i",str(path),
                      "-vf","scale=416:720","-frames:v","1","-f","image2pipe","-vcodec","png","-"],
                     capture_output=True,check=True,timeout=60)
    return np.array(Image.open(io.BytesIO(p.stdout)).convert("RGB"))


def write_mp4(frames,target,fps=20):
    p=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),"-loglevel","error","-y",
                      "-f","rawvideo","-pix_fmt","rgb24","-s","416x720",
                      "-r",str(fps),"-i","-","-an","-c:v","libx264",
                      "-preset","ultrafast","-pix_fmt","yuv420p",
                      "-movflags","+faststart",str(target)],
                     input=b"".join(f.tobytes() for f in frames),
                     capture_output=True,timeout=180)
    if p.returncode!=0:
        raise RuntimeError("Unable to encode video: "+p.stderr.decode("utf8","replace")[-900:])
    return target.stat().st_size


def model_features(intr,canon):
    t=np.arange(35200,dtype=np.float32)/16000.0
    audio=(0.12*np.sin(2*np.pi*220*t)+0.02*np.sin(2*np.pi*440*t)).astype(np.float32).reshape(1,-1)
    enc=intr.get_signature_runner("enc")(args_0=audio)["output_0"]
    tok=intr.get_signature_runner("tok14")(args_0=enc)["output_0"]
    assert enc.shape==(1,55,12,768)
    assert tok.shape==(1,14,16,384)
    history=np.repeat(canon[None,:,None,:,:],16,axis=2).copy()
    step=intr.get_signature_runner("step")
    motions=[]
    step_ms=[]
    for index in range(14):
        start=time.perf_counter()
        result=step(args_0=history,args_1=tok[:,index,:,:])["output_0"]
        step_ms.append((time.perf_counter()-start)*1000)
        assert result.shape==(1,16,90,52)
        assert np.isfinite(result).all()
        motions.append(result[0].copy())
        history[:,:,:-1,:,:]=history[:,:,1:,:,:].copy()
        history[:,:,-1,:,:]=result
    return motions,step_ms


def decoder_input(motions):
    frame_specs=[]
    for idx,current in enumerate(motions):
        previous=motions[idx-1] if idx else current
        phase_values=(3,) if idx==0 else (0,1,2,3)
        for phase in phase_values:
            frame_specs.append({"step_index":idx,"phase":phase,"current":current,"previous":previous})
    assert len(frame_specs)==53
    return frame_specs


def decode_frames(intr,specs):
    frames=[]
    times=[]
    batches=[]
    offset=0
    while offset<len(specs):
        remaining=len(specs)-offset
        batch=16 if remaining>=16 else 8
        signature="dec16" if batch==16 else "dec8"
        inputs=np.zeros((batch,36,90,52),dtype=np.float32)
        n=min(batch,remaining)
        for j,frame in enumerate(specs[offset:offset+n]):
            inputs[j,0:16,:,:]=frame["current"]
            inputs[j,16:32,:,:]=frame["previous"]
            inputs[j,32+frame["phase"],:,:]=1.0
        if n<batch:
            inputs[n:]=inputs[n-1]
        clock=time.perf_counter()
        output=intr.get_signature_runner(signature)(args_0=inputs)["output_0"]
        times.append((time.perf_counter()-clock)*1000)
        assert output.shape==(batch,3,720,416) and np.isfinite(output).all()
        for j in range(n):
            rgb=(np.clip(output[j].transpose(1,2,0),0.0,1.0)*255.0+0.5).astype(np.uint8)
            frames.append(rgb)
        batches.append({"signature":signature,"batch":batch,"kept":n})
        offset+=n
    return frames,times,batches


def main():
    args=argparse.ArgumentParser()
    args.add_argument("--imx",required=True,type=Path)
    args.add_argument("--out",required=True,type=Path)
    opts=args.parse_args()
    out=opts.out
    out.mkdir(parents=True,exist_ok=True)
    report={"status":"STARTED",
            "warnings":["Model source is public Wise Pup IMX",
                        "Sample input is 220/440 Hz tones, not spoken phonemes",
                        "Audio frontend and timing not proven equivalent to vendor",
                        "Decoder layout derived from JNI static analysis, not vendor output parity"],
            "phase_layout":"current[16],previous[16],one_hot_phase[4]",
            "history_seed":"canon.bin repeated 16 history slots",
            "history_update":"shift left by one history slot; append new step",
            "fps":20}
    report_file=out/"phase4_report.json"
    def save():
        report_file.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding="utf8")
    save()
    with tempfile.TemporaryDirectory(prefix="bithuman-phase4-") as folder:
        idx=parse(opts.imx)
        src={name:extract(opts.imx,idx,name,Path(folder)) for name in
             ("canon.bin","combined_litert.tflite","idle.mp4")}
        canon=np.fromfile(src["canon.bin"],dtype="<f4").reshape(16,90,52)
        reference=refer_frame(src["idle.mp4"])
        intr=Interpreter(model_path=str(src["combined_litert.tflite"]),num_threads=2)
        intr.allocate_tensors()
        motions,step_times=model_features(intr,canon)
        specs=decoder_input(motions)
        frames,decoder_times,batches=decode_frames(intr,specs)
        assert len(frames)==53
        video=out/"phase4_53frames_20fps.mp4"
        nbytes=write_mp4(frames,video)
        first=frames[0]
        diff=float(np.abs(first.astype(np.float64)-reference).mean())
        diffs=[float(np.abs(frames[i].astype(np.float32)-frames[i-1]).mean())
               for i in range(1,len(frames))]
        contact=[("Original",reference)]
        for i in (0,1,3,13,26,39,52):
            contact.append((f"Generated #{i}",frames[i]))
        width,height=208,360
        sheet=Image.new("RGB",(4*width,2*390),(20,24,29))
        d=ImageDraw.Draw(sheet)
        for i,(name,image) in enumerate(contact):
            x=i%4*width;y=i//4*390
            sheet.paste(Image.fromarray(image).resize((width,height)),(x,y))
            d.text((x+5,y+364),name,fill=(240,240,240))
        sheet.save(out/"phase4_comparison.jpg",quality=90)
        Image.fromarray(first).save(out/"phase4_first.png")
        Image.fromarray(frames[-1]).save(out/"phase4_last.png")
        report.update(status="SUCCEEDED",frames=53,video_seconds=53/20,
                      video_file=video.name,video_bytes=nbytes,
                      models={"enc":1,"tok14":1,"step":14,"dec16":3,"dec8":1},
                      batches=batches,
                      first_frame_mae_vs_idle=diff,
                      temporal_pixel_abs_change_mean=float(np.mean(diffs)),
                      temporal_pixel_abs_change_max=float(np.max(diffs)),
                      step_invocation_ms=[round(v,3) for v in step_times],
                      decoder_invocation_ms=[round(v,3) for v in decoder_times],
                      frames_sha256=[hashlib.sha256(frame.tobytes()).hexdigest() for frame in frames],
                      first_png="phase4_first.png",last_png="phase4_last.png",
                      comparison="phase4_comparison.jpg")
        save()
        print("PHASE4_RENDER_SUCCESS frames=53 fps=20 duration_s=2.65",
              "first_MAE=",round(diff,3),"motion=",round(float(np.mean(diffs)),3),
              "video_bytes=",nbytes,flush=True)
        print("PHASE4_DECODER_BATCHES",batches,flush=True)


if __name__=="__main__":
    main()
