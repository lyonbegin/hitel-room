import json,time,os,inspect,math
from pathlib import Path
from huggingface_hub import list_repo_files
import torch, numpy as np
from scipy.io.wavfile import write
from pocket_tts import TTSModel
out=Path("evidence");out.mkdir(exist_ok=True)
files=list_repo_files("litert-community/pocket-tts")
print("OFFICIAL_LITERTLM_FILES",json.dumps([f for f in files if f.endswith(".litertlm")]),flush=True)
print("CPU",os.cpu_count(),"torch",torch.__version__,flush=True)
config="hf://seastar105/pocket-tts-korean-100m/korean.yaml@d5418f368ed97bc982ab80c5b639fe28f280636b"
voice="hf://kyutai/tts-voices/alba-mackenna/casual.wav"
texts=["안녕하세요. 오늘은 한국어 음성 합성 속도를 시험합니다.","지금 인공지능이 답변을 생성하는 동안 다음 문장을 동시에 음성으로 출력할 수 있는지 확인하고 있습니다."]
results=[]
for threads in (2,4):
 torch.set_num_threads(threads)
 t=time.perf_counter()
 model=TTSModel.load_model(config=config,sampler_decode_steps=1,temp=0.3)
 print("MODEL_LOAD",threads,time.perf_counter()-t,flush=True)
 t=time.perf_counter()
 state=model.get_state_for_audio_prompt(voice)
 print("VOICE_PREPARE",threads,time.perf_counter()-t,flush=True)
 # first call and warm calls, genuine generator; no fabricated PCM
 for i,txt in enumerate(texts):
  chunks=[];times=[];start=time.perf_counter()
  for chunk in model.generate_audio_stream(state,txt):
   arr=chunk.detach().cpu().numpy().reshape(-1)
   if len(arr):
    chunks.append(arr.copy());times.append(time.perf_counter()-start)
    print("PCM_CHUNK",threads,i,len(chunks),len(arr),round(times[-1],4),flush=True)
  elapsed=time.perf_counter()-start
  assert len(chunks)>1,"Not multiple streamed chunks"
  audio=np.concatenate(chunks)
  assert np.isfinite(audio).all() and np.max(np.abs(audio))>0.001
  duration=len(audio)/model.sample_rate
  item=dict(threads=threads,text=txt,ttfa_s=times[0],elapsed_s=elapsed,audio_s=duration,rtf=elapsed/duration,chunks=len(chunks),sample_rate=model.sample_rate,chunk_arrivals_s=times)
  results.append(item)
  print("RESULT",json.dumps(item,ensure_ascii=False),flush=True)
  write(out/f"ko-{threads}-{i}.wav",model.sample_rate,(np.clip(audio,-1,1)*32767).astype(np.int16))
  (out/"results.json").write_text(json.dumps(results,ensure_ascii=False,indent=2))
 del model,state
print("STREAM_TEST_COMPLETE",flush=True)
