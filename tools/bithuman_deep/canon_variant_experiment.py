#!/usr/bin/env python3
"""Contrast Android canon.bin vs CoreML canon.f32 and audio-conditioned step under dec8.

Every image is an EXPERIMENT with unverified 36-channel mapping, not an authentic
speaker frame. The original idle image is the comparison reference.
"""
from pathlib import Path
import argparse,hashlib,io,json,subprocess,tempfile,time
import numpy as np
from PIL import Image,ImageDraw
import imageio_ffmpeg
from ai_edge_litert.interpreter import Interpreter
from imx_v2 import parse,extract

def stats(a):
    return {"min":float(a.min()),"max":float(a.max()),"mean":float(a.mean()),
            "std":float(a.std()),"sha256":hashlib.sha256(a.tobytes()).hexdigest()}

def load_idle(file):
    process=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),"-loglevel","error","-i",str(file),
        "-vf","scale=416:720","-frames:v","1","-f","image2pipe","-vcodec","png","-"],
        capture_output=True,timeout=60,check=True)
    return np.asarray(Image.open(io.BytesIO(process.stdout)).convert("RGB"),dtype=np.uint8)

def make_step(intr):
    t=np.arange(35200,dtype=np.float32)/16000
    audio=(0.12*np.sin(2*np.pi*220*t)+0.02*np.sin(2*np.pi*440*t)).astype(np.float32).reshape(1,35200)
    enc=intr.get_signature_runner("enc")(args_0=audio)["output_0"]
    tok=intr.get_signature_runner("tok14")(args_0=enc)["output_0"]
    # This is a ONE-STEP synthetic history, not real repeated speech synthesis.
    hist=np.zeros((1,16,16,90,52),dtype=np.float32)
    out=intr.get_signature_runner("step")(args_0=hist,args_1=tok[:,0,:,:])["output_0"]
    return out[0],{"encoder":list(enc.shape),"token":list(tok.shape),"step":list(out.shape)}

def run(imx,out):
    out.mkdir(parents=True,exist_ok=True)
    report={"status":"STARTED","interpretation":"Synthetic decoder-channel probing only; NO validated avatar animation",
            "cases":[]}
    dest=out/"canon_variants_report.json"
    def save():
        dest.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding="utf-8")
    save()
    with tempfile.TemporaryDirectory() as d:
        ix=parse(imx)
        members={}
        for file in ("canon.bin","canon.f32","combined_litert.tflite","idle.mp4"):
            members[file]=extract(imx,ix,file,Path(d))
        identity={}
        for file in ("canon.bin","canon.f32"):
            a=np.fromfile(members[file],dtype="<f4")
            assert a.size==16*90*52,(file,a.size)
            identity[file]=a.reshape(16,90,52)
        a,b=identity["canon.bin"],identity["canon.f32"]
        cosine=float(np.sum(a.astype(np.float64)*b.astype(np.float64))/
             (np.linalg.norm(a.astype(np.float64))*np.linalg.norm(b.astype(np.float64))))
        report["canon_differences"]={"canon_bin":stats(a),"canon_f32":stats(b),
            "cosine_similarity":cosine,"mean_absolute_difference":float(np.mean(np.abs(a-b))),
            "mean_squared_difference":float(np.mean((a-b)**2))}
        idle=load_idle(members["idle.mp4"])
        Image.fromarray(idle).save(out/"idle_reference.png")
        intr=Interpreter(model_path=str(members["combined_litert.tflite"]),num_threads=2)
        intr.allocate_tensors()
        motion,shapes=make_step(intr)
        report["synthetic_one_step"]={"shapes":shapes,"stats":stats(motion)}
        dec=intr.get_signature_runner("dec8")
        layouts={
            "canon0":lambda c:[(0,c)],
            "canon16":lambda c:[(16,c)],
            "canon20":lambda c:[(20,c)],
            "step0_canon16":lambda c:[(0,motion),(16,c)],
            "canon0_step16":lambda c:[(0,c),(16,motion)],
            "canon0_step20":lambda c:[(0,c),(20,motion)],
        }
        images=[("original_idle",Image.fromarray(idle))]
        for variant,canonical in identity.items():
            for name,layout in layouts.items():
                inputs=np.zeros((8,36,90,52),dtype=np.float32)
                for offset,values in layout(canonical):
                    inputs[:,offset:offset+16,:,:]=values
                clock=time.perf_counter()
                rgb=dec(args_0=inputs)["output_0"]
                duration=time.perf_counter()-clock
                assert rgb.shape==(8,3,720,416),rgb.shape
                assert np.isfinite(rgb).all()
                img=(np.clip(rgb[0].transpose(1,2,0),0,1)*255.0+0.5).astype(np.uint8)
                mae=float(np.mean(np.abs(img.astype(np.float64)-idle)))
                psnr=10*np.log10(255**2/max(1e-12,np.mean((img.astype(np.float64)-idle)**2)))
                label=variant.replace(".","_")+"_"+name
                Image.fromarray(img).save(out/(label+".png"))
                item={"case":label,"source":variant,"layout":name,"rgb_mae_vs_idle":mae,
                      "rgb_psnr_vs_idle":float(psnr),"image_std":float(img.std()),
                      "decode_seconds":round(duration,4),"sha256":hashlib.sha256(img.tobytes()).hexdigest()}
                report["cases"].append(item)
                images.append((label,Image.fromarray(img)))
                print("CANON_VARIANT",label,"MAE",round(mae,2),"PSNR",round(psnr,2),"STD",round(item["image_std"],2),flush=True)
                save()
        ncol=4
        thumb=(208,360)
        rows=(len(images)+ncol-1)//ncol
        sheet=Image.new("RGB",(ncol*thumb[0],rows*390),(20,20,25))
        draw=ImageDraw.Draw(sheet)
        for n,(label,img) in enumerate(images):
            x=(n%ncol)*thumb[0];y=(n//ncol)*390
            sheet.paste(img.resize(thumb),(x,y))
            draw.text((x+3,y+365),label,fill=(255,255,255))
        sheet.save(out/"canon_variants_contact_sheet.jpg",quality=87)
        report["status"]="SUCCEEDED"
        report["contact_sheet"]="canon_variants_contact_sheet.jpg"
        save()

if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--imx",type=Path,required=True)
    ap.add_argument("--out",type=Path,required=True)
    args=ap.parse_args()
    run(args.imx,args.out)
