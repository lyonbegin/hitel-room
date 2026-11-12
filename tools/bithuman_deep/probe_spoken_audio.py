#!/usr/bin/env python3
"""Real spoken TTS test of public Expression2 independent phase4 model.

Generate two original English speech clips locally via espeak-ng (no cloud).
Resample as 16kHz mono Float32, feed exact 35200 model input samples,
and compare separately rendered 53 RGB frames and mouth-region dynamics.

Only establishes a measurable acoustic-to-render response, NOT verified
phoneme-accurate lip synchronisation or vendor pipeline equivalence.
"""
import argparse
import hashlib
import json
import subprocess
import tempfile
import time
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image

from ai_edge_litert.interpreter import Interpreter
from imx_v2 import parse, extract
from decoder_phase4_reconstruction import decoder_input, decode_frames, refer_frame, write_mp4


PHRASES = {
    "plosive": "Papa mama papa baby.",
    "rounded": "Ooh, woo, ooh, woo.",
}
# Approximate mouth region of the public Wise Pup reference at 416 x 720.
# This is a heuristic crop, not an automatic facial landmark mask.
ROI = [130, 322, 286, 527]


def run_process(args, timeout=80):
    p = subprocess.run(args, capture_output=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError("command failed " + " ".join(args[:2]) + ": " + p.stderr.decode("utf-8","replace")[:300])
    return p


def synthesize(phrase, outdir, name):
    file = outdir / (name + ".wav")
    run_process(["espeak-ng", "-v", "en-us", "-s", "145", "-w", str(file), phrase])
    assert file.exists() and file.stat().st_size > 3000
    return file


def convert_16khz_pcm(source, outdir, name):
    raw=outdir/(name+".f32")
    run_process([
        imageio_ffmpeg.get_ffmpeg_exe(), "-nostdin", "-v", "error",
        "-y", "-i", str(source),
        "-ac", "1", "-ar", "16000", "-f", "f32le", str(raw)
    ])
    samples=np.fromfile(raw,dtype="<f4")
    assert len(samples)>=1600
    # Explicitly capture truncation/padding, rather than silently reshaping.
    prelen=len(samples)
    if len(samples)<35200:
        samples=np.pad(samples,(0,35200-len(samples))).astype(np.float32)
    else:
        samples=samples[:35200].copy()
    assert samples.shape==(35200,)
    return samples,{"original_samples_16khz":prelen,
                    "samples_used":35200,
                    "zero_pad_samples":max(0,35200-prelen),
                    "discarded_samples":max(0,prelen-35200),
                    "peak":float(np.max(np.abs(samples))),
                    "rms":float(np.sqrt(np.mean(samples**2))),
                    "sha256":hashlib.sha256(samples.tobytes()).hexdigest()}


def model_frames(intr,canonical,audio):
    x=audio.reshape(1,35200)
    enc=intr.get_signature_runner("enc")(args_0=x)["output_0"]
    tokens=intr.get_signature_runner("tok14")(args_0=enc)["output_0"]
    history=np.repeat(canonical[None,:,None,:,:],16,axis=2).copy()
    step=intr.get_signature_runner("step")
    motions=[]
    steps=[]
    for i in range(14):
        ts=time.perf_counter()
        latent=step(args_0=history,args_1=tokens[:,i,:,:])["output_0"]
        steps.append(time.perf_counter()-ts)
        assert latent.shape==(1,16,90,52) and np.isfinite(latent).all()
        motions.append(latent[0].copy())
        history[:,:,:-1,:,:]=history[:,:,1:,:,:].copy()
        history[:,:,-1,:,:]=latent
    frames,durations,batches=decode_frames(intr,decoder_input(motions))
    return frames,{"model_steps":14,"decoder_batches":batches,
                   "step_seconds_total":sum(steps),"decoder_seconds_total":sum(durations),
                   "frame_count":len(frames),
                   "enc_sha256":hashlib.sha256(enc.tobytes()).hexdigest(),
                   "tok_sha256":hashlib.sha256(tokens.tobytes()).hexdigest(),
                   "frames_sha256":[hashlib.sha256(z.tobytes()).hexdigest() for z in frames]}


def mux_video_with_speech(input_video,input_wav,dest):
    run_process([
        imageio_ffmpeg.get_ffmpeg_exe(),"-nostdin","-loglevel","error",
        "-y","-i",str(input_video),"-i",str(input_wav),
        "-filter_complex","[1:a]aresample=16000,apad,atrim=duration=2.65[a]",
        "-map","0:v:0","-map","[a]",
        "-c:v","copy","-c:a","aac","-b:a","96k",
        "-t","2.65","-movflags","+faststart",str(dest)
    ],timeout=80)
    assert dest.stat().st_size>4000


def evaluate_pair(a,b):
    assert len(a)==len(b)==53
    xa,ya,xb,yb=ROI
    full=[];mouth=[]
    for fa,fb in zip(a,b):
        f=fa.astype(np.float32);g=fb.astype(np.float32)
        full.append(float(np.mean(np.abs(f-g))))
        mouth.append(float(np.mean(np.abs(f[ya:yb,xa:xb]-g[ya:yb,xa:xb]))))
    inside=[float(np.mean(np.abs(a[i][ya:yb,xa:xb].astype(np.float32) -
                                  a[i-1][ya:yb,xa:xb].astype(np.float32))))
            for i in range(1,len(a))]
    other=[float(np.mean(np.abs(b[i][ya:yb,xa:xb].astype(np.float32) -
                                  b[i-1][ya:yb,xa:xb].astype(np.float32))))
            for i in range(1,len(b))]
    return {"frames_compared":53,"mouth_crop_xyxy":ROI,
            "full_frame_mae_between_phrases":float(np.mean(full)),
            "mouth_region_mae_between_phrases":float(np.mean(mouth)),
            "mouth_region_within_plosive_temporal_mae":float(np.mean(inside)),
            "mouth_region_within_rounded_temporal_mae":float(np.mean(other)),
            "distinct_first_frames":not np.array_equal(a[0],b[0]),
            "distinct_full_sequences":any(not np.array_equal(x,y) for x,y in zip(a,b))}


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--imx",type=Path,required=True)
    ap.add_argument("--output",type=Path,required=True)
    args=ap.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    report={"status":"STARTED","type":"spoken input sensitivity; NOT certified phoneme-synchronous lip sync",
            "roi_method":"heuristic approximate reference mouth crop, no landmark tracking",
            "phrases":{}}
    record=args.output/"speech_probe.json"
    def save():
        record.write_text(json.dumps(report,indent=2,ensure_ascii=False))
    save()
    with tempfile.TemporaryDirectory(prefix="bithuman-real-speech-") as tmp:
        base=Path(tmp)
        table=parse(args.imx)
        model=extract(args.imx,table,"combined_litert.tflite",base)
        canon=extract(args.imx,table,"canon.bin",base)
        identity=np.fromfile(canon,dtype="<f4").reshape(16,90,52)
        intr=Interpreter(model_path=str(model),num_threads=2)
        intr.allocate_tensors()
        outputs={}
        for name,phrase in PHRASES.items():
            wav=synthesize(phrase,args.output,name)
            samples,metadata=convert_16khz_pcm(wav,base,name)
            frames,details=model_frames(intr,identity,samples)
            assert len(frames)==53
            silent_video=args.output/(name+"_mute.mp4")
            write_mp4(frames,silent_video)
            video=args.output/(name+"_spoken.mp4")
            mux_video_with_speech(silent_video,wav,video)
            silent_video.unlink()
            Image.fromarray(frames[0]).save(args.output/(name+"_first.png"))
            report["phrases"][name]={"text":phrase,"audio":wav.name,
                "video":video.name,"video_bytes":video.stat().st_size,
                "audio_input":metadata,"rendering":details}
            outputs[name]=frames
            save()
            print("SPEECH_RENDER",name,"frames",len(frames),
                  "pcm_RMS",metadata["rms"],"mp4_bytes",video.stat().st_size,flush=True)
        report["comparison"]=evaluate_pair(outputs["plosive"],outputs["rounded"])
        report["status"]="SUCCEEDED"
        save()
        print("SPEECH_COMPARISON",json.dumps(report["comparison"]),flush=True)


if __name__=="__main__":
    main()
