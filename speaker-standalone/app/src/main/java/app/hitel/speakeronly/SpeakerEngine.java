package app.hitel.speakeronly;

import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import androidx.documentfile.provider.DocumentFile;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.channels.FileChannel;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

/**
 * ONLY: Samsung growing M4A via SAF -> seekable append mirror ->
 * upstream AAC packet follower -> one persistent Android MediaCodec ->
 * 48k to 16k PCM FIR -> AudioTrack. No STT/ASR/VAD/model code or dependency.
 */
final class SpeakerEngine {
  interface Callback {void state(String text,boolean finished);}
  private final Context context;
  private final TraceJournal log;
  private final Callback callback;
  private final Object mirrorLock=new Object();
  private volatile boolean stop;
  private volatile boolean finished;
  private volatile Uri selected;
  private volatile Process follower;
  private volatile File mirror;
  private volatile long mirroredBytes;
  private volatile long receivedFrames;
  private volatile long pcmBytes;
  private volatile String endReason="NOT_STARTED";
  private volatile int requestedDeviceId;
  private volatile PcmSpeakerMonitor speaker;
  private volatile StreamingAacPcmDecoder codec;
  private Thread worker;
  private Thread copier;
  private Thread stderr;
  private final AtomicLong lastStatusMs=new AtomicLong();
  static final long POLL_MS=250;

  SpeakerEngine(Context context,TraceJournal journal,Callback cb,int preferredId){
    this.context=context.getApplicationContext();log=journal;callback=cb;
    requestedDeviceId=preferredId;
  }
  void start(Uri input,boolean folder){
    if(worker!=null)throw new IllegalStateException("already running");
    worker=new Thread(()->run(input,folder),"Recording-PCM-Speaker");
    worker.start();
  }
  void stop(){
    stop=true;
    log.event("CONTROL","STOP_REQUEST","frames",receivedFrames,
      "pcmBytes",pcmBytes,"mirrorBytes",mirroredBytes);
    Process p=follower;
    if(p!=null&&p.isAlive())p.destroy();
    Thread t=copier;if(t!=null)t.interrupt();
  }
  boolean done(){return finished;}
  void output(int id){
    requestedDeviceId=id;
    PcmSpeakerMonitor device=speaker;
    if(device!=null)device.setOutputDevice(id);
    else notifyState("출력 장치 설정됨 · 음성 PCM 수신 대기",false);
  }
  private void notifyState(String s,boolean end){
    if(log!=null)log.event("UI","MONITOR_STATUS","text",s,"finished",end);
    callback.state(s,end);
  }

  private static boolean audioFile(DocumentFile f){
    if(f==null||!f.isFile())return false;
    String s=f.getName();
    return s!=null&&(s.toLowerCase(Locale.ROOT).endsWith(".m4a")||
       s.toLowerCase(Locale.ROOT).endsWith(".mp4")||
       s.toLowerCase(Locale.ROOT).endsWith(".3gp"));
  }
  private Uri waitForRecording(Uri directory) throws Exception {
    DocumentFile tree=DocumentFile.fromTreeUri(context,directory);
    if(tree==null||!tree.isDirectory())throw new IOException("선택한 폴더를 열 수 없습니다.");
    HashMap<String,Long> baseline=new HashMap<>();
    for(DocumentFile f:tree.listFiles())
      if(audioFile(f))baseline.put(f.getUri().toString(),Math.max(0L,f.length()));
    log.event("FOLDER","WATCH_STARTED","knownFiles",baseline.size(),
       "policy","new or growing M4A since watch start");
    notifyState("녹음 폴더 감시 중 · 새 통화 녹음 시작 대기",false);
    while(!stop){
      DocumentFile best=null;long amount=0;
      for(DocumentFile f:tree.listFiles()){
        if(!audioFile(f))continue;
        long size=f.length();
        long previous=baseline.containsKey(f.getUri().toString())?
          baseline.get(f.getUri().toString()):0L;
        if(size>Math.max(128L,previous) && size-previous>amount){
          amount=size-previous;best=f;
        }
      }
      if(best!=null){
        log.event("FOLDER","GROWING_RECORDING_SELECTED",
          "uri",best.getUri().toString(),"bytes",best.length());
        return best.getUri();
      }
      Thread.sleep(450);
    }
    return null;
  }

  private void appendNewBytes(Uri file) throws Exception {
    synchronized(mirrorLock){
      // Reopen the selected SAF fd on each growth poll. Android DocumentsProvider
      // metadata can be stale; the actual readable fd is authoritative.
      try(ParcelFileDescriptor pfd=context.getContentResolver().openFileDescriptor(file,"r")){
        if(pfd==null)throw new IOException("SAF openFileDescriptor returned null");
        try(FileInputStream input=new FileInputStream(pfd.getFileDescriptor())){
          FileChannel channel=input.getChannel();
          long available=channel.size();
          if(available<mirroredBytes){
            throw new IOException("Recording was truncated: "+available+"<"+mirroredBytes);
          }
          if(available==mirroredBytes)return;
          channel.position(mirroredBytes);
          try(FileOutputStream output=new FileOutputStream(mirror,true)){
            byte[] bytes=new byte[65536];int n;
            long added=0;
            while(mirroredBytes<available &&
                (n=input.read(bytes,0,(int)Math.min(bytes.length,available-mirroredBytes)))>0){
              output.write(bytes,0,n);
              mirroredBytes+=n;added+=n;
            }
            output.flush();
            if(added>0)log.event("MIRROR","APPENDED_NEW_SOURCE_BYTES",
               "newBytes",added,"mirrorBytes",mirroredBytes,
               "sourceAvailableBytes",available,"sourceOffset",mirroredBytes,
               "method","SAF_FILE_DESCRIPTOR_SEEK");
          }
        }
      }
    }
  }

  private void run(Uri input,boolean folder){
    String finalStatus;
    try{
      log.event("APP","SPEAKER_ONLY_ENGINE_STARTED",
        "folder",folder,"nativeAbis",Arrays.toString(Build.SUPPORTED_ABIS),
        "sttModel",false,"requestedOutputId",requestedDeviceId);
      selected=folder?waitForRecording(input):input;
      if(selected==null){endReason="USER_STOP";return;}
      mirror=new File(context.getCacheDir(),"recording-speaker-"+SystemClock.elapsedRealtime()+".m4a");
      if(!mirror.createNewFile())throw new IOException("Mirror already exists");
      appendNewBytes(selected);
      speaker=new PcmSpeakerMonitor(context,log,requestedDeviceId,text->notifyState(text,false));
      // AudioTrack is intentionally NOT created yet: wait until PCM arrives.
      codec=new StreamingAacPcmDecoder(log);
      copier=new Thread(()->{
        while(!stop){
          try{appendNewBytes(selected);}
          catch(Throwable problem){
            if(!stop)log.error("MIRROR","POLL_FAILED",problem);
          }
          try{Thread.sleep(POLL_MS);}
          catch(InterruptedException e){return;}
        }
      },"Recording-M4A-SAF-Copier");
      copier.start();
      notifyState("16kHz 음성 스트리밍 · 실제 PCM 입력 대기",false);
      followPcm(mirror);
      endReason=stop?"USER_STOP":"AAC_FOLLOWER_EXIT";
    }catch(Throwable err){
      if(!stop){endReason="ERROR_"+err.getClass().getSimpleName();
        log.error("SPEAKER","FATAL_ERROR",err);}
      notifyState("음성 재생 오류: "+err.getClass().getSimpleName()+": "+err.getMessage(),false);
    }finally{
      stop=true;
      Process p=follower;
      if(p!=null&&p.isAlive())p.destroy();
      Thread t=copier;if(t!=null){t.interrupt();
        try{t.join(1800);}catch(InterruptedException e){Thread.currentThread().interrupt();}}
      StreamingAacPcmDecoder dec=codec;
      if(dec!=null){try{
          dec.finish(pcm->{PcmSpeakerMonitor sp=speaker;if(sp!=null)sp.write(pcm);pcmBytes+=pcm.length;});
        }catch(Throwable e){log.error("AAC","FINAL_DRAIN_FAILURE",e);}
        dec.close();
      }
      PcmSpeakerMonitor sp=speaker;
      if(sp!=null){sp.close();speaker=null;}
      File temp=mirror;
      if(temp!=null){
        boolean deleted=temp.delete();
        log.event("MIRROR","TEMP_CLEANED","deleted",deleted,
          "bytes",mirroredBytes);
      }
      log.event("APP","SESSION_END","reason",endReason,
        "pcmBytes",pcmBytes,"pcmDurationMs",pcmBytes/32,
        "frames",receivedFrames,"sourceBytes",mirroredBytes);
      log.diagnosticSummary();
      finished=true;
      finalStatus="종료 · "+endReason+" · 재생 "+String.format(Locale.US,"%.2f",pcmBytes/32000.0)+"초";
      callback.state(finalStatus,true);
    }
  }

  private void followPcm(File mirrorFile)throws Exception {
    File elf=new File(context.getApplicationInfo().nativeLibraryDir,"libaac-mdat-follow.so");
    if(!elf.isFile()||!elf.canExecute())
      throw new IOException("AAC follower binary not installed: "+elf);
    ProcessBuilder builder=new ProcessBuilder(elf.getAbsolutePath(),
        mirrorFile.getAbsolutePath(),"48000","1");
    builder.redirectErrorStream(false);
    String old=builder.environment().get("LD_LIBRARY_PATH");
    builder.environment().put("LD_LIBRARY_PATH",
      context.getApplicationInfo().nativeLibraryDir+(old==null?"":":"+old));
    Process p=builder.start();
    follower=p;
    log.event("FOLLOW","PERSISTENT_PROCESS_STARTED",
       "path",elf.getName(),"mirrorBytes",mirroredBytes,
       "sttProcessStarted",false);
    stderr=new Thread(()->{
      try(BufferedReader reader=new BufferedReader(
          new InputStreamReader(p.getErrorStream(),StandardCharsets.UTF_8))){
        String line;
        while((line=reader.readLine())!=null)
          log.event("FOLLOW","NATIVE_MESSAGE","line",line);
      }catch(Throwable e){if(!stop)log.error("FOLLOW","STDERR_READ_ERROR",e);}
    },"Recording-AAC-Follower-Log");
    stderr.start();
    byte[] header=new byte[12];
    long prevSource=-1;
    try(DataInputStream input=new DataInputStream(
        new BufferedInputStream(p.getInputStream(),65536))){
      while(!stop){
        try{input.readFully(header);}
        catch(IOException e){
          if(stop){log.event("FOLLOW","EXPECTED_STOP_READER_UNBLOCKED",
             "exception",e.getClass().getSimpleName());break;}
          throw e;
        }
        int n=(header[0]&255)|((header[1]&255)<<8)|
            ((header[2]&255)<<16)|((header[3]&255)<<24);
        long offset=0;
        for(int i=0;i<8;i++)offset|=((long)(header[4+i]&255))<<(8*i);
        if(n<8||n>8192||offset<=prevSource)
          throw new IOException("AAC follower packet length/cursor invalid: "+n+"/"+offset);
        byte[] adts=new byte[n];
        try{input.readFully(adts);}
        catch(IOException e){if(stop)break;throw e;}
        codec.feedAdtsFrame(adts,pcm->{
          PcmSpeakerMonitor active=speaker;
          if(active==null)throw new IOException("AudioTrack monitor stopped");
          active.write(pcm);
          pcmBytes+=pcm.length;
          if(pcmBytes/32000>lastStatusMs.get())
            lastStatusMs.set(pcmBytes/32000);
        });
        prevSource=offset;
        receivedFrames++;
        if(receivedFrames<=3||receivedFrames%12==0)
          log.event("AAC","FOLLOW_FRAME_CONSUMED","frame",receivedFrames,
            "compressedBytes",n,"sourceCursor",offset,
            "pcmBytes",pcmBytes,"pcmTimeMs",pcmBytes/32);
      }
    }finally{
      p.destroy();
      if(stderr!=null){
        try{stderr.join(1600);}catch(InterruptedException e){Thread.currentThread().interrupt();}
      }
      follower=null;
    }
  }
}
