package app.hitel.speakeronly;

import android.content.Context;
import android.os.SystemClock;
import java.io.File;
import java.io.IOException;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Experimental native-model recognizer that preserves the 512-sample PCM FIFO.
 * Unlike IXIO's earlier snapshot gate this NEVER discards pre-ready PCM.
 * No external PCM playback or microphone capture: input is the existing M4A path.
 *
 * Runs on its own worker: upstream AAC decoding never blocks on the STT engine.
 */
final class NativePcmKoreanStt {
  private final Context context;
  private final TraceJournal log;
  private final DirectPcmKoreanStt.Listener listener;
  private final LinkedBlockingQueue<byte[]> fifo = new LinkedBlockingQueue<>();
  private final AtomicLong pendingBytes = new AtomicLong();
  private volatile boolean finishing, ready, completed;
  private volatile Throwable failure;
  private volatile long recognizedSamples;
  private Thread worker;

  NativePcmKoreanStt(Context context, TraceJournal log,
                     DirectPcmKoreanStt.Listener listener) {
    this.context = context.getApplicationContext();
    this.log = log;
    this.listener = listener;
  }

  void start() {
    if (worker != null) throw new IllegalStateException("Native STT already started");
    worker = new Thread(this::run, "HITEL-Native-STT-Worker");
    worker.start();
    log.event("STT","NATIVE_STT_EXPERIMENT_START",
      "source","FAAD2 PCM512 FIFO","preReadyDrop",false,
      "fallbackSubstitution",false);
  }

  void accept(byte[] pcm) throws IOException {
    if (pcm == null || pcm.length == 0) return;
    if ((pcm.length & 1) != 0) throw new IOException("PCM16 requires even bytes");
    if (finishing) throw new IOException("Native STT input already ended");
    if (failure != null) throw new IOException("Native STT engine failed", failure);
    byte[] copy = pcm.clone();
    pendingBytes.addAndGet(copy.length);
    fifo.add(copy);
  }

  long queuedBytes() { return pendingBytes.get(); }
  long recognizedSamples() { return recognizedSamples; }
  boolean completed() { return completed; }
  Throwable failure() { return failure; }

  void finishAndWait() {
    finishing = true;
    Thread t = worker;
    if (t == null) return;
    long lastAdvance = SystemClock.elapsedRealtime();
    long lastSample = recognizedSamples;
    while (t.isAlive()) {
      try { t.join(10000); }
      catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        failure = new IOException("Native STT drain interrupted",e);
        log.error("STT","NATIVE_STT_FINISH_INTERRUPTED",failure);
        return;
      }
      if (!t.isAlive()) break;
      long now = SystemClock.elapsedRealtime();
      if (lastSample != recognizedSamples) {
        lastSample = recognizedSamples;
        lastAdvance = now;
      }
      log.event("STT","NATIVE_STT_DRAIN_PROGRESS",
        "samples",recognizedSamples,"pendingBytes",pendingBytes.get(),
        "ready",ready,"noProgressMs",now-lastAdvance);
      if (now-lastAdvance > 600000) {
        failure = new IOException("Native STT no progress for 10 minutes");
        t.interrupt();
        log.error("STT","NATIVE_STT_NO_PROGRESS",failure);
        break;
      }
    }
  }

  private void run() {
    StringBuilder committed = new StringBuilder();
    File models = new File(context.getFilesDir(),DirectPcmKoreanStt.MODEL_DIR);
    try (NativeSttBridge bridge = new NativeSttBridge(models,new NativeSttBridge.Listener() {
      @Override public void caption(String sentence,boolean isFinal,
                                     long samples,long revision,long emittedNs) {
        log.event("CAPTION","NATIVE_CAPTION_IMMEDIATE",
          "revision",revision,"audioSamples",samples,
          "nativeEmittedNs",emittedNs,"isFinal",isFinal,
          "text",sentence);
        if (isFinal && !sentence.isEmpty()) {
          if (committed.length()>0) committed.append('\n');
          committed.append(sentence);
          listener.caption(committed.toString(),true);
        } else if (!isFinal) {
          // Whole-current-utterance update; do NOT append into previous partial.
          listener.caption(sentence,false);
        }
      }
      @Override public void trace(String phase,long samples,long decoderStep,
                                  long processingUs,boolean changed) {
        if ("NATIVE_DECODE_DONE".equals(phase) || "NATIVE_ENDPOINT".equals(phase))
          log.event("STT","NATIVE_DECODE_TRACE",
            "phase",phase,"samples",samples,"step",decoderStep,
            "durationUs",processingUs,"textChanged",changed);
      }
    })) {
      ready = true;
      listener.status("실험 네이티브 STT 모델 로딩 완료 · PCM 무손실 순차 입력");
      while (!finishing || !fifo.isEmpty()) {
        byte[] pcm;
        try { pcm=fifo.poll(32,TimeUnit.MILLISECONDS); }
        catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          throw new IOException("Native STT worker interrupted before FIFO drain",e);
        }
        if (pcm==null) continue;
        bridge.acceptPcm(pcm);
        recognizedSamples+=pcm.length/2;
        pendingBytes.addAndGet(-pcm.length);
      }
      bridge.finish();
      completed = true;
      log.event("STT","NATIVE_STT_DRAIN_COMPLETE",
        "recognizedSamples",recognizedSamples,"queuedBytes",pendingBytes.get(),
        "hadOriginalModel",true);
    } catch (Throwable error) {
      if (failure==null) failure=error;
      log.error("STT","NATIVE_STT_RUNTIME_FAILED",error);
      listener.status("실험 네이티브 STT 실패: "+error.getClass().getSimpleName()
        +" · 원본 IXIO SDK와 별도 테스트 중");
    } finally {
      ready=false;
    }
  }
}
