package app.hitel.speakeronly;

import android.content.Context;
import android.content.ContentResolver;
import android.database.ContentObserver;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
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
  interface RecordingStatusListener {
    void noRecordingEvidence(long waitingMs);
    void confirmedRecording(String filename,long sizeBytes);
  }
  private final Context context;
  private final TraceJournal log;
  private final Callback callback;
  private final RecordingStatusListener recordListener;
  private volatile long confirmedFileBytes;
  private volatile long skippedPreLiveFrames;
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

  SpeakerEngine(Context context,TraceJournal journal,Callback cb,int preferredId,
                RecordingStatusListener listener){
    this.context=context.getApplicationContext();log=journal;callback=cb;
    requestedDeviceId=preferredId;recordListener=listener;
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

  /** Iterate children through one DocumentsProvider query per directory,
   * instead of one IPC per file via DocumentFile.length()/lastModified().
   * Recursively include Samsung's Call/ subdirectory under Recordings/.
   */
  private void scanChildren(Uri treeUri,String documentId,int depth,int[] budget,
                            List<GrowingM4aSelector.Entry> entries) throws Exception {
    if(depth>3||budget[0]<=0)return;
    Uri childUri=DocumentsContract.buildChildDocumentsUriUsingTree(treeUri,documentId);
    String[] projection={
      DocumentsContract.Document.COLUMN_DOCUMENT_ID,
      DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_MIME_TYPE,
      DocumentsContract.Document.COLUMN_SIZE,
      DocumentsContract.Document.COLUMN_LAST_MODIFIED
    };
    List<String> folders=new ArrayList<>();
    try(Cursor c=context.getContentResolver().query(childUri,projection,null,null,null)){
      if(c==null)throw new IOException("녹음 폴더 조회 실패: "+childUri);
      int idIndex=c.getColumnIndexOrThrow(projection[0]);
      int nameIndex=c.getColumnIndexOrThrow(projection[1]);
      int typeIndex=c.getColumnIndexOrThrow(projection[2]);
      int sizeIndex=c.getColumnIndexOrThrow(projection[3]);
      int timeIndex=c.getColumnIndexOrThrow(projection[4]);
      while(c.moveToNext()&&budget[0]>0){
        --budget[0];
        String id=c.getString(idIndex);
        String name=c.getString(nameIndex);
        String mime=c.getString(typeIndex);
        if(DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)){
          if(depth<3)folders.add(id);
          continue;
        }
        if(!GrowingM4aSelector.isM4a(name))continue;
        long size=c.isNull(sizeIndex)?0:Math.max(0,c.getLong(sizeIndex));
        long modified=c.isNull(timeIndex)?0:c.getLong(timeIndex);
        Uri file=DocumentsContract.buildDocumentUriUsingTree(treeUri,id);
        entries.add(new GrowingM4aSelector.Entry(file.toString(),name,size,modified));
      }
    }
    for(String folder:folders){
      if(budget[0]<=0)break;
      scanChildren(treeUri,folder,depth+1,budget,entries);
    }
  }

  /** Samsung providers can return a stale COLUMN_SIZE. For the newest M4A
   * files use the ACTUAL open file-descriptor length on each poll.
   */
  private long actualFileLength(Uri file,long metadataSize){
    try(ParcelFileDescriptor fd=context.getContentResolver().openFileDescriptor(file,"r")){
      if(fd==null)return metadataSize;
      long stat=fd.getStatSize();
      if(stat>=0)return stat;
      try(FileInputStream in=new FileInputStream(fd.getFileDescriptor())){
        return Math.max(0,in.getChannel().size());
      }
    }catch(Exception e){
      log.event("FOLDER","FILE_LENGTH_PROBE_FAILED",
          "uri",file.toString(),"error",e.getClass().getSimpleName());
      return metadataSize;
    }
  }

  private Uri waitForRecording(Uri directory) throws Exception {
    DocumentFile root=DocumentFile.fromTreeUri(context,directory);
    if(root==null||!root.isDirectory())
      throw new IOException("통화 녹음 폴더 접근 실패. 폴더를 다시 선택하십시오.");
    String rootId=DocumentsContract.getTreeDocumentId(directory);
    GrowingM4aSelector detector=new GrowingM4aSelector();
    log.event("FOLDER","RECORDING_EVENT_WATCH_STARTED",
        "uri",directory.toString(),"pollMs",100,"requiredPositiveGrowthEvents",3,
        "eventSources","SAF_CONTENT_OBSERVER_AND_MEDIASTORE");
    notifyState("통화 연결 · 녹음 시작/파일 변경 이벤트 감시 중",false);

    final java.util.concurrent.atomic.AtomicBoolean changed=
        new java.util.concurrent.atomic.AtomicBoolean(true);
    ContentObserver observer=new ContentObserver(new Handler(Looper.getMainLooper())){
      @Override public void onChange(boolean selfChange){
        changed.set(true);
        log.event("FOLDER","RECORDING_CONTENT_CHANGED_EVENT","uri",directory.toString());
      }
      @Override public void onChange(boolean selfChange,Uri changedUri){
        onChange(selfChange);
      }
    };
    boolean registered=false;
    try{
      try{
        context.getContentResolver().registerContentObserver(directory,true,observer);
        registered=true;
      }catch(Exception error){
        log.event("FOLDER","TREE_OBSERVER_UNAVAILABLE",
            "reason",error.getClass().getSimpleName());
      }
      try{
        context.getContentResolver().registerContentObserver(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,true,observer);
        registered=true;
      }catch(Exception error){
        log.event("FOLDER","MEDIASTORE_OBSERVER_UNAVAILABLE",
            "reason",error.getClass().getSimpleName());
      }

      List<GrowingM4aSelector.Entry> found=new ArrayList<>();
      int scan=0;
      long started=SystemClock.elapsedRealtime();
      long nextRescan=0;
      long lastRecordRequest=0;
      while(!stop){
        long now=SystemClock.elapsedRealtime();
        if(changed.getAndSet(false)||now>=nextRescan){
          found=new ArrayList<>();
          scanChildren(directory,rootId,0,new int[]{4000},found);
          found.sort((x,y)->{
            int t=Long.compare(y.modified,x.modified);
            return t!=0?t:y.name.compareTo(x.name);
          });
          nextRescan=now+1000;
        }
        List<GrowingM4aSelector.Entry> snapshot=new ArrayList<>(found);
        for(int i=0;i<Math.min(4,snapshot.size());i++){
          GrowingM4aSelector.Entry e=snapshot.get(i);
          long liveBytes=actualFileLength(Uri.parse(e.uri),e.bytes);
          snapshot.set(i,new GrowingM4aSelector.Entry(
              e.uri,e.name,liveBytes,e.modified));
        }
        GrowingM4aSelector.Decision d=detector.observe(snapshot);
        if(d.growing!=null){
          Uri file=Uri.parse(d.growing.uri);
          log.event("FOLDER","LIVE_M4A_CONFIRMED_GROWING",
              "fileName",d.growing.name,"sizeBytes",d.growing.bytes,
              "growthBytes",d.growthBytes,"positiveGrowthEvents",
              d.verifiedGrowthEvents,"uri",d.growing.uri);
          if(recordListener!=null)
            recordListener.confirmedRecording(d.growing.name,d.growing.bytes);
          notifyState("녹음 중 파일 발견: "+d.growing.name+
              " · 100ms 검사 3회 크기 증가 확인",false);
          return file;
        }
        if(recordListener!=null && now-started>=2500 &&
           d.verifiedGrowthEvents==0 && now-lastRecordRequest>=5000){
          lastRecordRequest=now;
          log.event("FOLDER","NO_RECORDING_GROWTH_REQUEST_START",
              "waitingMs",now-started,"files",d.files,
              "latestFile",d.latest==null?"":d.latest.name);
          recordListener.noRecordingEvidence(now-started);
        }
        if(scan%10==0){
          if(d.latest==null)
            notifyState("통화 연결 · 아직 녹음 파일 없음 · 녹음 시작 요청/대기",false);
          else
            notifyState("최신 M4A: "+d.latest.name+" ("+d.latest.bytes+
                "바이트) · 증가 "+d.verifiedGrowthEvents+"/3회 확인 중",false);
        }
        scan++;
        Thread.sleep(100);
      }
      return null;
    }finally{
      if(registered)context.getContentResolver().unregisterContentObserver(observer);
    }
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
      log.event("SOURCE",folder?"LIVE_GROWING_RECORDING_SELECTED":"MANUAL_FILE_SELECTED",
        "uri",selected.toString(),"folderDetection",folder);
      mirror=new File(context.getCacheDir(),"recording-speaker-"+SystemClock.elapsedRealtime()+".m4a");
      if(!mirror.createNewFile())throw new IOException("Mirror already exists");
      appendNewBytes(selected);
      confirmedFileBytes=folder?mirroredBytes:0;
      log.event("SOURCE","LIVE_PLAYBACK_CUTOFF",
          "sourceBytesAtVerification",confirmedFileBytes,
          "preLiveAudioWillBeSuppressed",folder);
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
        final boolean inLiveWindow=confirmedFileBytes==0 ||
            offset>=Math.max(0L,confirmedFileBytes-2048);
        codec.feedAdtsFrame(adts,pcm->{
          if(!inLiveWindow){skippedPreLiveFrames++;return;}
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
