package app.hitel.speakeronly;

import android.content.Context;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * GitHub upstream AAC pipeline: knik0/faad2 NeAACDecDecode() consumption,
 * as used by nerln/argano.  No FFmpeg AAC-frame oracle and no MediaCodec.
 *
 * The native FAAD2 process follows the selected file from mdat offset 0
 * and emits raw signed 48kHz mono PCM16LE. This class performs a continuous
 * stateful 3:1 anti-aliased conversion to 16kHz and emits exactly 512 samples
 * (1024 bytes) per chunk. Silence is never filtered.
 */
final class GithubFaad2PcmSource {
  interface PcmSink { void accept(byte[] pcm16_16k_mono) throws Exception; }
  private static final int CHUNK_SAMPLES=512;
  private static final int CHUNK_BYTES=CHUNK_SAMPLES*2;
  private static final int FIR_TAPS=63;
  private final TraceJournal log;
  private final double[] taps=new double[FIR_TAPS];
  private final double[] history=new double[FIR_TAPS];
  private int historyPos, byteLow=-1,pcmFill;
  private long inputFrames,pcmSamples,chunks;
  private final byte[] window=new byte[CHUNK_BYTES];
  private volatile Process process;
  private volatile Thread stderrThread;

  GithubFaad2PcmSource(TraceJournal journal) {
    this.log=journal;
    double sum=0;
    for(int i=0;i<FIR_TAPS;i++){
      int d=i-(FIR_TAPS-1)/2;
      double cutoff=0.145; // cycles/sample at 48k; < 16k Nyquist
      double sinc=d==0?2*cutoff:Math.sin(2*Math.PI*cutoff*d)/(Math.PI*d);
      taps[i]=sinc*(0.54-0.46*Math.cos(2*Math.PI*i/(FIR_TAPS-1)));
      sum+=taps[i];
    }
    for(int i=0;i<FIR_TAPS;i++)taps[i]/=sum;
  }

  void requestStop() {
    Process p=process;
    if(p!=null&&p.isAlive())p.destroy();
  }

  long producedSamples(){return pcmSamples;}
  long emittedChunks(){return chunks;}

  void pump(Context context,File file,boolean completedFile,PcmSink sink)throws Exception{
    File nativeExecutable=new File(context.getApplicationInfo().nativeLibraryDir,
      "libfaad2-growing-pcm.so");
    if(!nativeExecutable.isFile()||!nativeExecutable.canExecute())
      throw new IOException("FAAD2 native executable not installed: "+nativeExecutable);
    ProcessBuilder pb=new ProcessBuilder(
      completedFile?new String[]{nativeExecutable.getAbsolutePath(),file.getAbsolutePath(),"--complete"}
        :new String[]{nativeExecutable.getAbsolutePath(),file.getAbsolutePath()});
    Process p=pb.start();
    process=p;
    log.event("FAAD2","UPSTREAM_LIBFAAD2_PCM_START",
      "decoder","knik0/faad2-2.11.4","algorithm","nerln/argano-NeAACDecDecode",
      "growing",!completedFile,"path",file.getName(),"readWindowSamples",CHUNK_SAMPLES);
    Thread err=new Thread(()->{
      try(BufferedReader reader=new BufferedReader(new InputStreamReader(
        p.getErrorStream(),StandardCharsets.UTF_8))){
        String line;
        while((line=reader.readLine())!=null)
          log.event("FAAD2","UPSTREAM_DECODER_LOG","line",line);
      }catch(Throwable e){
        log.error("FAAD2","UPSTREAM_STDERR_READER_ERROR",e);
      }
    },"FAAD2-Stderr");
    stderrThread=err;err.start();
    Throwable problem=null;
    try(InputStream in=new BufferedInputStream(p.getInputStream(),16384)){
      byte[] buffer=new byte[16384];
      int n;
      while((n=in.read(buffer))>=0){
        if(n==0)continue;
        for(int i=0;i<n;i++){
          int current=buffer[i]&255;
          if(byteLow<0){byteLow=current;continue;}
          short sample=(short)(byteLow|(current<<8));
          byteLow=-1;
          accept48kSample(sample,sink);
        }
      }
      if(byteLow>=0)throw new IOException("Truncated 48kHz PCM sample from FAAD2");
      if(pcmFill>0){
        // Final short tail is zero-padded, not dropped. Still exactly 512 samples.
        int padded=CHUNK_BYTES-pcmFill;
        Arrays.fill(window,pcmFill,CHUNK_BYTES,(byte)0);
        emit(sink);
        log.event("FAAD2","FINAL_512_PCM_PADDED","zeroPaddingBytes",padded);
      }
    }catch(Throwable error){problem=error;throw error;
    }finally{
      if(problem!=null && p.isAlive())p.destroy();
      int rc;
      try{rc=p.waitFor();}
      catch(InterruptedException e){p.destroyForcibly();Thread.currentThread().interrupt();throw e;}
      try{err.join(2000);}catch(InterruptedException e){Thread.currentThread().interrupt();}
      process=null;
      log.event("FAAD2","UPSTREAM_PCM_EXIT","code",rc,
        "sourceSamples48k",inputFrames,"pcmSamples16k",pcmSamples,
        "pcmChunks512",chunks,"completedFile",completedFile);
      if(problem==null&&completedFile&&rc!=0)
        throw new IOException("FAAD2 upstream decoder failed, exit="+rc);
    }
  }

  private void accept48kSample(short sample,PcmSink sink)throws Exception {
    history[historyPos]=sample;
    historyPos=(historyPos+1)%FIR_TAPS;
    inputFrames++;
    if(inputFrames%3!=0)return;
    double v=0;
    for(int i=0;i<FIR_TAPS;i++)
      v+=history[(historyPos+i)%FIR_TAPS]*taps[i];
    int signed=(int)Math.round(v);
    signed=Math.max(-32768,Math.min(32767,signed));
    window[pcmFill++]=(byte)(signed&255);
    window[pcmFill++]=(byte)((signed>>>8)&255);
    pcmSamples++;
    if(pcmFill==CHUNK_BYTES)emit(sink);
  }

  private void emit(PcmSink sink)throws Exception {
    sink.accept(Arrays.copyOf(window,CHUNK_BYTES));
    pcmFill=0;chunks++;
    if(chunks<=3||chunks%100==0)
      log.event("FAAD2","PCM_512_FIFO_PRODUCED",
        "chunks",chunks,"samples16k",pcmSamples,"bytes",CHUNK_BYTES);
  }
}
