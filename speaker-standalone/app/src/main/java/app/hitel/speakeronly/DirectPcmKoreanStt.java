package app.hitel.speakeronly;

import android.content.Context;
import android.os.SystemClock;
import com.k2fsa.sherpa.onnx.OnlineRecognizer;
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import com.k2fsa.sherpa.onnx.OnlineStream;
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Direct, 16,000 Hz mono signed PCM16 -> Sherpa Korean Zipformer.
 *
 * Does NOT capture a microphone, AudioTrack or another application.
 * A dedicated worker preloads the model WHILE Samsung's M4A folder is watched.
 * PCM arriving during warmup remains in a bounded queue, not dropped.
 * Only verified new M4A bytes reach this sink through SpeakerEngine's
 * existing growing-M4A decoder.
 */
final class DirectPcmKoreanStt {
  interface Listener {
    void status(String message);
    void caption(String committedAndPartial,boolean finalSegment);
  }
  private static final int RATE=16000;
  private static final int QUEUE_CAPACITY=1024;
  private static final String[] MODELS={
      "encoder-epoch-99-avg-1.int8.onnx",
      "decoder-epoch-99-avg-1.onnx",
      "joiner-epoch-99-avg-1.int8.onnx",
      "tokens.txt"};
  private static final long[] MIN_SIZE={115000000L,9500000L,2000000L,50000L};
  private final Context context;
  private final TraceJournal log;
  private final Listener listener;
  private final ArrayBlockingQueue<byte[]> pcmQueue=new ArrayBlockingQueue<>(QUEUE_CAPACITY);
  private volatile boolean inputFinished;
  private volatile boolean ready;
  private volatile boolean completed;
  private volatile Throwable failure;
  private volatile long queuedBytes;
  private volatile long recognizedSamples;
  private Thread worker;

  DirectPcmKoreanStt(Context context,TraceJournal journal,Listener cb){
    this.context=context.getApplicationContext();log=journal;listener=cb;
  }
  void start(){
    if(worker!=null)throw new IllegalStateException("STT already started");
    worker=new Thread(this::work,"Direct-PCM-Korean-Zipformer");
    worker.start();
    log.event("STT","MODEL_PREWARM_STARTED","source","direct growing M4A PCM",
      "sampleRate",RATE,"model","streaming-zipformer-ko-2024-06-16");
  }
  boolean isReady(){return ready;}
  boolean completed(){return completed;}
  Throwable failure(){return failure;}
  long queuedBytes(){return queuedBytes;}
  long recognizedSamples(){return recognizedSamples;}

  void accept(byte[] pcm)throws IOException {
    if(pcm==null||pcm.length==0)return;
    if((pcm.length&1)!=0)throw new IOException("PCM16 frame has odd bytes "+pcm.length);
    if(failure!=null)throw new IOException("Korean STT failed: "+failure,failure);
    if(inputFinished)throw new IOException("STT already finished");
    // Copy because the decoder owns and may reuse its packet buffer.
    byte[] owned=pcm.clone();
    if(!pcmQueue.offer(owned)){
      log.event("STT","PCM_QUEUE_OVERFLOW","queuedChunks",pcmQueue.size(),
         "queuedBytes",queuedBytes,"failed",true);
      throw new IOException("STT model too slow: PCM queue full; must not silently lose call speech");
    }
    queuedBytes+=owned.length;
    if(queuedBytes<=64000 || queuedBytes%(32000*10)<owned.length)
      log.event("STT","PCM_DIRECT_QUEUED","totalBytes",queuedBytes,
         "queuedChunks",pcmQueue.size(),"modelReady",ready);
  }
  void finishAndWait(){
    inputFinished=true;
    Thread w=worker;
    if(w!=null){
      try{w.join(30000);}catch(InterruptedException e){Thread.currentThread().interrupt();}
      if(w.isAlive())
        log.event("STT","FINAL_INFERENCE_STILL_RUNNING",
            "pendingChunks",pcmQueue.size(),
            "reason","30-second drain limit (worker cleans up when done)");
    }
  }

  private File extractModel()throws IOException {
    File target=new File(context.getFilesDir(),"sherpa-ko-direct-v1");
    if(!target.exists()&&!target.mkdirs())
      throw new IOException("Cannot create Korean ASR model directory");
    for(int i=0;i<MODELS.length;i++){
      String name=MODELS[i];
      File output=new File(target,name);
      if(output.length()>=MIN_SIZE[i])continue;
      listener.status("한국어 STT 모델 준비: "+name);
      File part=new File(target,name+".part");
      if(part.exists()&&!part.delete())throw new IOException("Cannot clean incomplete model: "+name);
      try(InputStream in=context.getAssets().open("models/"+name);
          FileOutputStream out=new FileOutputStream(part)){
        byte[] buf=new byte[131072];int n;
        while((n=in.read(buf))!=-1)out.write(buf,0,n);
        out.getFD().sync();
      }
      if(part.length()<MIN_SIZE[i])
        throw new IOException("Korean STT model truncated: "+name+", bytes="+part.length());
      if(output.exists()&&!output.delete())throw new IOException("Cannot replace "+name);
      if(!part.renameTo(output))throw new IOException("Model move failed: "+name);
    }
    return target;
  }

  private void work(){
    OnlineRecognizer recognizer=null;
    OnlineStream stream=null;
    StringBuilder committed=new StringBuilder();
    long decodeSteps=0,nonZero=0,endpoints=0;
    String previous="";
    long lastUiAt=0,lastEvidenceAt=0;
    try{
      File dir=extractModel();
      OnlineTransducerModelConfig transducer=new OnlineTransducerModelConfig();
      transducer.setEncoder(new File(dir,MODELS[0]).getAbsolutePath());
      transducer.setDecoder(new File(dir,MODELS[1]).getAbsolutePath());
      transducer.setJoiner(new File(dir,MODELS[2]).getAbsolutePath());
      OnlineModelConfig model=new OnlineModelConfig();
      model.setTransducer(transducer);
      model.setTokens(new File(dir,MODELS[3]).getAbsolutePath());
      model.setModelType("zipformer");
      model.setNumThreads(2);
      model.setProvider("cpu");
      OnlineRecognizerConfig config=new OnlineRecognizerConfig();
      config.setModelConfig(model);
      config.setEnableEndpoint(true);
      config.setDecodingMethod("greedy_search");
      recognizer=new OnlineRecognizer(null,config);
      stream=recognizer.createStream("");
      ready=true;
      log.event("STT","MODEL_READY","pendingPcmChunks",pcmQueue.size(),
         "queuedPcmSeconds",queuedBytes/32000.0);
      listener.status("16kHz 직접 STT 모델 준비 완료 · PCM 입력 분석 중");
      while(true){
        byte[] pcm=pcmQueue.poll(300,TimeUnit.MILLISECONDS);
        if(pcm==null){
          if(inputFinished&&pcmQueue.isEmpty())break;
          continue;
        }
        float[] normalized=new float[pcm.length/2];
        for(int i=0,j=0;i<normalized.length;i++,j+=2){
          short sample=(short)((pcm[j]&255)|((pcm[j+1]&255)<<8));
          normalized[i]=sample/32768f;
          if(Math.abs((int)sample)>250)nonZero++;
        }
        stream.acceptWaveform(normalized,RATE);
        recognizedSamples+=normalized.length;
        while(recognizer.isReady(stream)){recognizer.decode(stream);decodeSteps++;}
        String partial=recognizer.getResult(stream).getText().trim();
        if(recognizer.isEndpoint(stream)){
          if(!partial.isEmpty()){
            if(committed.length()>0)committed.append("\n");
            committed.append(partial);
            listener.caption(committed.toString(),true);
            log.event("STT","DIRECT_FINAL_SEGMENT","text",partial,
                "samples",recognizedSamples,"decodeSteps",decodeSteps);
            endpoints++;
          }
          recognizer.reset(stream);
          partial="";
        }
        String shown=committed.length()==0?partial:
           (partial.isEmpty()?committed.toString():committed+"\n"+partial);
        long now=SystemClock.elapsedRealtime();
        if(!shown.equals(previous)&&now-lastUiAt>=150){
          previous=shown;lastUiAt=now;
          listener.caption(shown,false);
          log.event("STT","DIRECT_PARTIAL","text",shown,
             "samples",recognizedSamples);
        }
        if(now-lastEvidenceAt>=2500){
          lastEvidenceAt=now;
          log.event("STT","DIRECT_PCM_EVIDENCE",
              "pcmSeconds",recognizedSamples/16000.0,
              "rmsNonZeroSamples",nonZero,"decodeSteps",decodeSteps,
              "queueSize",pcmQueue.size(),"endpoints",endpoints);
          if(shown.isEmpty())
            listener.status(String.format(Locale.US,
                "직접 STT 입력 %.1f초 · 인식 처리 %d회 · 진폭 있는 샘플 %d",
                recognizedSamples/16000.0,decodeSteps,nonZero));
        }
      }
      stream.acceptWaveform(new float[4800],RATE);
      stream.inputFinished();
      while(recognizer.isReady(stream)){recognizer.decode(stream);decodeSteps++;}
      String tail=recognizer.getResult(stream).getText().trim();
      if(!tail.isEmpty()){
        if(committed.length()>0)committed.append("\n");
        committed.append(tail);
        listener.caption(committed.toString(),true);
      }
      log.event("STT","DIRECT_SESSION_FINAL","samples",recognizedSamples,
          "durationSec",recognizedSamples/16000.0,
          "decodeSteps",decodeSteps,"nonZeroSamples",nonZero,
          "finalSegments",endpoints,"lastText",committed.toString());
      listener.status("직접 한국어 STT 종료 · 입력 "+
          String.format(Locale.US,"%.1f",recognizedSamples/16000.0)+
          "초 · 자막 "+committed.length()+"자");
    }catch(Throwable ex){
      failure=ex;
      log.error("STT","DIRECT_STT_FAILED",ex);
      listener.status("한국어 직접 STT 실패: "+ex.getClass().getSimpleName()+": "+ex.getMessage());
    }finally{
      if(stream!=null)try{stream.release();}catch(Throwable ignored){}
      if(recognizer!=null)try{recognizer.release();}catch(Throwable ignored){}
      ready=false;completed=true;
      log.event("STT","DIRECT_STT_RELEASED","failed",failure!=null,
          "pcmSamples",recognizedSamples,"queuedChunks",pcmQueue.size());
    }
  }
}
