#!/usr/bin/env python3
"""Explore decoder input channel composition against bundled public identity sample.

Runs authentic public TFLite decoder on synthetic/canon placements. Produces
quantitative comparisons and illustrative experiment PNGs, not a verified portrait.
"""
import argparse
import hashlib
import io
import imageio_ffmpeg
import json
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from ai_edge_litert.interpreter import Interpreter

from imx_v2 import parse, extract


def video_first_frame(movie, target=(416,720)):
    command=[imageio_ffmpeg.get_ffmpeg_exe(),"-loglevel","error","-i",str(movie),"-vf",
             "scale=416:720:flags=bicubic","-frames:v","1",
             "-f","image2pipe","-vcodec","png","-"]
    done=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=50)
    if done.returncode!=0 or not done.stdout:
        raise RuntimeError("Cannot decode idle frame: "+done.stderr.decode("utf-8","replace")[:400])
    with Image.open(io.BytesIO(done.stdout)) as source:
        return np.asarray(source.convert("RGB"),dtype=np.uint8)


def pixel_metrics(image,ref):
    f=image.astype(np.float64)
    g=ref.astype(np.float64)
    # Single-frame comparisons. The correct active expression may differ from idle.
    return {
        "mse_vs_idle": float(np.mean((f-g)**2)),
        "mae_vs_idle": float(np.mean(np.abs(f-g))),
        "pixel_std": float(np.std(f)),
        "horizontal_gradient": float(np.mean(np.abs(f[:,1:]-f[:,:-1]))),
        "reference_pixel_std": float(np.std(g)),
        "sha256": hashlib.sha256(image.tobytes()).hexdigest(),
    }


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--imx",required=True,type=Path)
    p.add_argument("--out",required=True,type=Path)
    args=p.parse_args()
    args.out.mkdir(parents=True,exist_ok=True)
    manifest={"scope":"decoder channel-placement experiment (NOT full speaking avatar)",
              "cases":[],"status":"STARTED"}
    out=args.out/"decoder_placements.json"
    def save():
        out.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    save()

    index=parse(args.imx)
    with tempfile.TemporaryDirectory(prefix="bithuman-dec-") as tmp:
        base=Path(tmp)
        model=extract(args.imx,index,"combined_litert.tflite",base)
        canonfile=extract(args.imx,index,"canon.bin",base)
        idlefile=extract(args.imx,index,"idle.mp4",base)
        canon=np.fromfile(canonfile,dtype="<f4")
        if canon.size!=16*90*52:
            raise RuntimeError("canon.bin not 16*90*52 Float32")
        canon=canon.reshape(16,90,52)
        manifest["canon_stats"]={
            "min":float(canon.min()),"max":float(canon.max()),
            "std":float(canon.std()),"shape":list(canon.shape)}
        ref=video_first_frame(idlefile)
        Image.fromarray(ref).save(args.out/"idle_reference.png")
        interpreter=Interpreter(model_path=str(model),num_threads=2)
        interpreter.allocate_tensors()
        runner=interpreter.get_signature_runner("dec8")

        placements={
            "all_zero":[],
            "canon_0_16":[0],
            "canon_16_32":[16],
            "canon_20_36":[20],
            "canon_0_16_and_16_32":[0,16],
            "canon_0_16_and_20_36":[0,20],
        }
        contact=[]
        for name,starts in placements.items():
            t=np.zeros((8,36,90,52),dtype=np.float32)
            for start in starts:
                t[:,start:start+16,:,:]=canon
            start=time.perf_counter()
            output=runner(args_0=t)["output_0"]
            elapsed=time.perf_counter()-start
            image=np.clip(output[0].transpose(1,2,0),0.0,1.0)
            image=(image*255.0+0.5).astype(np.uint8)
            im=Image.fromarray(image,mode="RGB")
            filename=name+".png"
            im.save(args.out/filename)
            scores=pixel_metrics(image,ref)
            bgr=pixel_metrics(image[:,:,::-1],ref)
            item={"case":name,"placements":starts,
                  "decode_duration_seconds":round(elapsed,4),
                  "input_nonzero_count":int(np.count_nonzero(t)),
                  "output_min":float(output.min()),"output_max":float(output.max()),
                  "output_finite":bool(np.isfinite(output).all()),
                  "image":filename,"rgb":scores,"bgr_mae_vs_idle":bgr["mae_vs_idle"]}
            manifest["cases"].append(item)
            save()
            contact.append((name, im))
            print("DECODER_CASE",name,"seconds",item["decode_duration_seconds"],
                  "image_std",scores["pixel_std"],
                  "mae",scores["mae_vs_idle"],flush=True)
        # Include the actual idle reference first and avoid labels over any model output.
        thumb_width=208
        thumb_height=360
        cells=[("idle_reference",Image.fromarray(ref))]+contact
        canvas=Image.new("RGB",(4*thumb_width,2*(thumb_height+28)),color=(24,25,30))
        draw=ImageDraw.Draw(canvas)
        for n,(name,img) in enumerate(cells):
            x=(n%4)*thumb_width
            y=(n//4)*(thumb_height+28)
            canvas.paste(img.resize((thumb_width,thumb_height)),(x,y))
            draw.text((x+3,y+thumb_height+4),name,fill=(255,255,255))
        canvas.save(args.out/"comparison_sheet.png")
        manifest["status"]="SUCCEEDED"
        manifest["comparison_sheet"]="comparison_sheet.png"
        save()


if __name__=="__main__":
    main()
