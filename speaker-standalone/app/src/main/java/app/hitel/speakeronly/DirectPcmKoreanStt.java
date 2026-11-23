package app.hitel.speakeronly;

import android.content.Context;
import android.os.SystemClock;
import dalvik.system.DexClassLoader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.util.Locale;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Exact IXIO speechSDK front-end, NOT HITEL14 Sherpa OnlineRecognizer.
 *
 * The model and binary code are taken from the user's original IXIO build.
 * No fallback to any open-source Korean model is permitted.
 * The file-backed IXIO LocalAudioRecordSource supplies 16kHz mono float[512]
 * from Samsung M4A decoder PCM16, matching the ORIGINAL source contract.
 *
 * Source contract confirmed from IXIO restored DEX:
 *   com.lguplus.ixispeech_ktn.speechSDK.loadSTT(String,String,String,String,String,float)
 *   com.lguplus.ixispeech_ktn.speechSDK.loadVAD(String)
 *   com.lguplus.ixispeech_ktn.speechSDK.SpeechInference(float[],int,boolean):kotlin.Triple
 *   com.lguplus.ixispeech_ktn.speechSDK.release()
 */
final class DirectPcmKoreanStt {
  interface Listener {
    void status(String message);
    void caption(String committedAndPartial, boolean finalSegment);
  }

  static final String MODEL_DIR="ixio-stt";
  // ART binds each JNI .so to the initiating ClassLoader. All original
  // IXIO SDK sessions must use one DexClassLoader for this app process.
  private static final Object IXIO_LOADER_LOCK=new Object();
  private static volatile ClassLoader sharedIxioLoader;
  private static final int RATE=16000;
  private static final int CHANNEL=0;
  // 4096 original 32ms frames ~= 131 seconds capacity, so accelerated
  // playback of recorded files does not silently lose whole utterances.
  private static final int QUEUE_CAPACITY=4096;
  private final Context context;
  private final TraceJournal log;
  private final Listener listener;
  private final ArrayBlockingQueue<float[]> queue=new ArrayBlockingQueue<>(QUEUE_CAPACITY);
  private volatile boolean inputFinished,ready,completed;
  private volatile Throwable failure;
  private volatile long queuedBytes,recognizedSamples;
  private Thread worker;

  DirectPcmKoreanStt(Context context,TraceJournal journal,Listener listener) {
    this.context=context.getApplicationContext();
    this.log=journal;
    this.listener=listener;
  }

  void start(){
    if(worker!=null)throw new IllegalStateException("IXIO STT worker already started");
    worker=new Thread(this::work,"IXIO-Original-SpeechSDK");
    worker.start();
    log.event("STT","IXIO_SPEECHSDK_START_REQUESTED",
      "source","Samsung M4A decoded PCM -> IXIO LocalAudioRecordSource float512 Flow",
      "publicHitelSherpa",false,"ixioOriginal",true);
  }

  boolean isReady(){return ready;}
  boolean completed(){return completed;}
  Throwable failure(){return failure;}
  long queuedBytes(){return queuedBytes;}
  long recognizedSamples(){return recognizedSamples;}

  /** Compatibility for any older PCM16LE producer. The new file source feeds
   * original-style float[512] directly via acceptFloat(). */
  void accept(byte[] pcm)throws IOException {
    if(pcm==null||pcm.length==0)return;
    if((pcm.length&1)!=0)throw new IOException("PCM16 must have an even byte length");
    acceptFloat(IxioPcmNormalizer.decode(pcm));
  }

  /** Equivalent of original IXIO CallScriptManager's Flow.collect collector:
   * receive already-normalized 16kHz PCM frames and copy to an owned queue.
   * The original LocalAudioRecordSource reuses its float[512] per read, so
   * cloning is essential BEFORE returning to the producer.
   */
  void acceptFloat(float[] samples)throws IOException {
    if(samples==null||samples.length==0)return;
    if(failure!=null)throw new IOException("IXIO speechSDK failed",failure);
    if(inputFinished)throw new IOException("IXIO STT already finished");
    float[] owned=samples.clone();
    try{
      if(!queue.offer(owned,2,TimeUnit.SECONDS)){
        log.event("STT","IXIO_PCM_QUEUE_FULL","chunks",queue.size(),
          "receivedSamples",queuedBytes/2,"newFrameSamples",owned.length);
        throw new IOException("IXIO speechSDK too slow: original PCM Flow queue full");
      }
    }catch(InterruptedException error){
      Thread.currentThread().interrupt();
      throw new IOException("Interrupted while delivering original-style PCM frame",error);
    }
    queuedBytes+=(long)owned.length*2;
    if(queuedBytes<=64000 || queuedBytes%(RATE*2*10)<owned.length*2)
      log.event("STT","IXIO_PCM_QUEUED","bytes",queuedBytes,
        "modelReady",ready,"chunks",queue.size(),"originalFrameSamples",owned.length);
  }

  void finishAndWait(){
    inputFinished=true;
    Thread current=worker;
    if(current==null)return;
    // The previous join(30000) silently returned while real inference still
    // ran, causing the UI to report a partial recording as a finished one.
    // Wait for the queue AND original SDK endpoint to complete. Log progress
    // every 10s; fail explicitly after a prolonged *lack of progress*.
    long started=SystemClock.elapsedRealtime();
    long lastAdvance=started;
    long lastSamples=recognizedSamples;
    while(current.isAlive()){
      try{current.join(10000);}catch(InterruptedException error){
        Thread.currentThread().interrupt();
        failure=new IOException("Interrupted while waiting for complete original IXIO STT",error);
        log.error("STT","IXIO_FINAL_DRAIN_INTERRUPTED",failure);
        return;
      }
      if(!current.isAlive())break;
      long now=SystemClock.elapsedRealtime();
      if(recognizedSamples!=lastSamples){
        lastSamples=recognizedSamples;
        lastAdvance=now;
      }
      log.event("STT","IXIO_FINAL_DRAIN_STILL_RUNNING",
        "waitMs",now-started,"noProgressMs",now-lastAdvance,
        "recognizedSamples",recognizedSamples,"queuedChunks",queue.size(),
        "ready",ready,"completed",completed);
      if(now-lastAdvance>=600000){
        failure=new IOException("Original IXIO speechSDK made no transcription progress for 600 seconds");
        log.error("STT","IXIO_FINAL_DRAIN_STALLED",failure);
        current.interrupt();
        return;
      }
    }
    log.event("STT","IXIO_FINAL_DRAIN_FINISHED",
      "waitMs",SystemClock.elapsedRealtime()-started,
      "recognizedSamples",recognizedSamples,"queuedChunks",queue.size(),
      "sdkCompleted",completed,"failed",failure!=null);
  }

  private File model(String name)throws IOException {
    File file=new File(new File(context.getFilesDir(),MODEL_DIR),name);
    if("bpe.vocab".equals(name)&&(!file.isFile()||file.length()==0)){
      File dir=file.getParentFile();
      if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("Cannot initialize IXIO model dir");
      try(InputStream in=context.getAssets().open("ixio/bpe.vocab");
          FileOutputStream out=new FileOutputStream(file)){
        byte[] buffer=new byte[65536];int size;
        while((size=in.read(buffer))!=-1)out.write(buffer,0,size);
        out.getFD().sync();
      }
    }
    if(!file.isFile()||file.length()==0)
      throw new IOException("IXIO STT model missing: "+name+
        ". Import the original IXIO STT model ZIP first; no public-model fallback.");
    return file;
  }

  /**
   * A loader-only jar containing original classes6.dex + classes16.dex is
   * prepared by the build from the original IXIO APK. This is not a
   * reimplementation of IXIO's recognition algorithm.
   */
  ClassLoader ixioClassLoader()throws Exception {
    ClassLoader cached=sharedIxioLoader;
    if(cached!=null)return cached;
    synchronized(IXIO_LOADER_LOCK){
      cached=sharedIxioLoader;
      if(cached!=null)return cached;
      File jar=new File(context.getCodeCacheDir(),"ixio-original-sdk.jar");
      if(!jar.isFile()||jar.length()==0){
        File pending=new File(context.getCodeCacheDir(),"ixio-original-sdk.pending");
        if(pending.exists()&&!pending.delete())throw new IOException("Cannot reset IXIO SDK staging");
        try(InputStream in=context.getAssets().open("ixio/ixio-original-sdk.jar");
            FileOutputStream out=new FileOutputStream(pending)){
          byte[] buf=new byte[65536];int n;
          while((n=in.read(buf))!=-1)out.write(buf,0,n);
          out.getFD().sync();
        }
        if(!pending.setReadOnly())
          throw new IOException("Android requires read-only dynamically loaded IXIO code");
        if(!pending.renameTo(jar))
          throw new IOException("Cannot activate original IXIO SDK dex");
      }
      if(jar.canWrite())throw new IOException("IXIO DEX jar must be read-only");
      ClassLoader created=new DexClassLoader(jar.getAbsolutePath(),
        context.getCodeCacheDir().getAbsolutePath(),
        context.getApplicationInfo().nativeLibraryDir,
        context.getClassLoader());
      // Volatile publication and the monitor prevent a different
      // DexClassLoader from loading the same sherpa-onnx-jni.so.
      sharedIxioLoader=created;
      return created;
    }
  }

  private void work(){
    Object sdk=null;
    Method release=null;
    long nonZero=0;
    StringBuilder committed=new StringBuilder();
    String lastDisplayed="";
    long lastLog=0;
    long inferCalls=0,slowestInferenceMs=0;
    boolean endpointSeen=false;
    try{
      File encoder=model("encoder.ort");
      File decoder=model("decoder.ort");
      File joiner=model("joiner.ort");
      File tokens=model("tokens.txt");
      File bpe=model("bpe.vocab");
      listener.status("IXIO 원본 speechSDK 및 STT 모델 초기화 중");
      ClassLoader loader=ixioClassLoader();
      log.event("STT","IXIO_SHARED_CLASSLOADER_ACQUIRED",
        "loaderIdentity",System.identityHashCode(loader),
        "loaderType",loader.getClass().getName(),"singleProcessLoader",true);
      Class<?> klass=loader.loadClass("com.lguplus.ixispeech_ktn.speechSDK");
      sdk=klass.getDeclaredConstructor().newInstance();
      release=klass.getMethod("release");
      Method load=klass.getMethod("loadSTT",
        String.class,String.class,String.class,String.class,String.class,float.class);
      Method loadVAD=klass.getMethod("loadVAD",String.class);
      Method infer=klass.getMethod("SpeechInference",float[].class,int.class,boolean.class);
      // The IXIO original repository calls loadVAD(path) before loadSTT,
      // then loadSTT with amplitude 1.0f (verified in original smali).
      File vad=model("vad.onnx");
      loadVAD.invoke(sdk,vad.getAbsolutePath());
      log.event("STT","IXIO_ORIGINAL_VAD_PATH_SET",
        "bytes",vad.length(),"file",vad.getName());
      load.invoke(sdk,encoder.getAbsolutePath(),decoder.getAbsolutePath(),
        joiner.getAbsolutePath(),tokens.getAbsolutePath(),bpe.getAbsolutePath(),1.0f);
      // Original IXIO silently returns if any required model is missing.
      // Do not report READY unless its real internal sttReady flag is true.
      java.lang.reflect.Field flag=klass.getDeclaredField("sttReady");
      flag.setAccessible(true);
      if(!flag.getBoolean(sdk))
        throw new IOException("Original IXIO speechSDK returned sttReady=false after loadSTT");
      ready=true;
      log.event("STT","IXIO_ORIGINAL_SPEECHSDK_READY",
        "class",klass.getName(),"channel",CHANNEL,"rate",RATE,"amplitude",1.0f);
      listener.status("IXIO 원본 speechSDK 준비 완료");
      Method tripleFirst=null,tripleThird=null;
      while(true){
        float[] samples=queue.poll(300,TimeUnit.MILLISECONDS);
        if(samples==null){
          if(inputFinished&&queue.isEmpty())break;
          continue;
        }
        // Exactly the IXIO original 16kHz mono float[] input contract.
        // No per-window AGC or duration/frequency changes are allowed.
        IxioPcmNormalizer.Stats stats=IxioPcmNormalizer.stats(samples);
        if(stats.hasInvalid())
          throw new IOException("IXIO float[] contained a NaN or infinity");
        nonZero+=stats.nonzero;
        if(inferCalls==0||inferCalls%8==0||stats.clipped>0)
          log.event("STT","IXIO_PCM_FLOAT_CONTRACT",
            "chunk",inferCalls,"sampleRate",RATE,"channels",1,
            "floatFrames",stats.frames,"durationMs",stats.frames*1000.0/RATE,
            "rms",stats.rms,"dc",stats.dc,"peak",stats.peak,
            "clipCount",stats.clipped,"nearSilent",stats.isNearSilent());
        long inferStarted=SystemClock.elapsedRealtime();
        Object triple=infer.invoke(sdk,samples,CHANNEL,false);
        long inferMs=SystemClock.elapsedRealtime()-inferStarted;
        if(inferMs>slowestInferenceMs)slowestInferenceMs=inferMs;
        inferCalls++;
        recognizedSamples+=samples.length;
        if(triple==null)continue;
        if(tripleFirst==null){
          tripleFirst=triple.getClass().getMethod("getFirst");
          tripleThird=triple.getClass().getMethod("getThird");
        }
        Object first=tripleFirst.invoke(triple);
        Object third=tripleThird.invoke(triple);
        String partial=first==null?"":String.valueOf(first).trim();
        boolean endpoint=Boolean.TRUE.equals(third);
        if(endpoint || (!partial.isEmpty() && inferCalls%4==1))
          log.event("STT","IXIO_SPEECHSDK_TRIPLE_RESULT",
            "inference",inferCalls,"text",partial,
            "kws",String.valueOf(triple.getClass().getMethod("getSecond").invoke(triple)),
            "endpoint",endpoint,"inferenceMs",inferMs);
        if(endpoint){
          endpointSeen=true;
          if(!partial.isEmpty()){
            if(committed.length()>0)committed.append("\n");
            committed.append(partial);
            log.event("STT","IXIO_FINAL_SEGMENT","text",partial,
              "samples",recognizedSamples);
            listener.caption(committed.toString(),true);
          }
          partial="";
        }
        String shown=committed.length()==0?partial:
          (partial.isEmpty()?committed.toString():committed+"\n"+partial);
        if(!shown.equals(lastDisplayed)){
          lastDisplayed=shown;
          listener.caption(shown,false);
        }
        long now=SystemClock.elapsedRealtime();
        if(now-lastLog>=2500){
          lastLog=now;
          log.event("STT","IXIO_PCM_EVIDENCE",
            "recognizedSamples",recognizedSamples,"nonZeroSamples",nonZero,
            "queuedChunks",queue.size(),"sdkReady",ready);
        }
      }
      // IXIO's OnlineStream endpoint logic requires trailing PCM frames.
      // Feed 200ms blocks (the same format as real audio), up to 2.6 seconds.
      // Distinguish partial text from a genuine SDK endpoint. The original
      // speechSDK, NOT a second recognizer, performs every inference.
      int tailChunks=0;
      if(recognizedSamples>0){
        for(int i=0;i<13;i++){
          long began=SystemClock.elapsedRealtime();
          Object tail=infer.invoke(sdk,new float[3200],CHANNEL,false);
          long elapsed=SystemClock.elapsedRealtime()-began;
          tailChunks++;
          inferCalls++;
          if(tail==null)continue;
          Method firstMethod=tail.getClass().getMethod("getFirst");
          Method thirdMethod=tail.getClass().getMethod("getThird");
          Object first=firstMethod.invoke(tail);
          String t=first==null?"":String.valueOf(first).trim();
          boolean end=Boolean.TRUE.equals(thirdMethod.invoke(tail));
          log.event("STT","IXIO_ENDPOINT_TAIL_STEP",
            "silenceMs",tailChunks*200,"text",t,"endpoint",end,
            "inferenceMs",elapsed);
          if(end){
            endpointSeen=true;
            if(!t.isEmpty()){
              if(committed.length()>0)committed.append("\n");
              committed.append(t);
              listener.caption(committed.toString(),true);
              log.event("STT","IXIO_FINAL_SEGMENT","text",t,"tail",true);
            }
            break;
          }
          if(!t.isEmpty()&&!t.equals(lastDisplayed)){
            lastDisplayed=t;
            listener.caption(committed.length()==0?t:committed+"\n"+t,false);
          }
        }
      }
      log.event("STT","IXIO_SESSION_FINAL","samples",recognizedSamples,
        "nonZeroSamples",nonZero,"captionChars",committed.length(),
        "endpointObserved",endpointSeen,"tailSilenceMs",tailChunks*200,
        "inferenceCalls",inferCalls,"maxInferenceMs",slowestInferenceMs);
      listener.status(String.format(Locale.KOREA,
        "IXIO STT 종료 · PCM %.1f초",recognizedSamples/(double)RATE));
    }catch(Throwable error){
      Throwable actual=error instanceof java.lang.reflect.InvocationTargetException
        && ((java.lang.reflect.InvocationTargetException)error).getCause()!=null
        ?((java.lang.reflect.InvocationTargetException)error).getCause():error;
      failure=actual;
      log.error("STT","IXIO_SPEECHSDK_FAILURE",actual);
      listener.status("IXIO 원본 STT 실패: "+
        actual.getClass().getSimpleName()+": "+actual.getMessage());
    }finally{
      if(sdk!=null&&release!=null)
        try{release.invoke(sdk);}catch(Throwable error){
          log.error("STT","IXIO_SPEECHSDK_RELEASE_FAILED",error);
        }
      ready=false;completed=true;
      log.event("STT","IXIO_SDK_RELEASED","failed",failure!=null,
        "samples",recognizedSamples);
    }
  }
}
