package app.hitel.speakeronly;

import android.content.Context;
import android.content.ContentResolver;
import android.database.ContentObserver;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.database.Cursor;
import android.net.Uri;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import java.nio.ByteBuffer;
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
 * 48k to 16k PCM FIR -> original IXIO speechSDK; no AudioTrack or MediaProjection.
 */
final class SpeakerEngine {
  interface Callback {void state(String text,boolean finished);}
  interface CaptionListener {void caption(String text,boolean finalSegment);}
  interface RecordingStatusListener {
    void noRecordingEvidence(long waitingMs);
    void recordingCandidate(String filename,long sizeBytes,int growthEvents);
    void confirmedRecording(String filename,long sizeBytes);
  }
  private final Context context;
  private final TraceJournal log;
  private final Callback callback;
  private final CaptionListener captionListener;
  private final RecordingStatusListener recordListener;
  private final Object mirrorLock=new Object();
  private volatile boolean stop;
  private volatile boolean finished;
  private volatile Uri selected;
  private volatile Process follower;
  private volatile File mirror;
  private volatile long mirroredBytes;
  private volatile long receivedFrames;
  private volatile long pcmBytes;
  private volatile long expectedSourceDurationUs=-1;
  private volatile String endReason="NOT_STARTED";
  private volatile int requestedDeviceId;
  private volatile DirectPcmKoreanStt stt;
  private volatile StreamingAacPcmDecoder codec;
  private Thread worker;
  private Thread copier;
  private Thread stderr;
  private final AtomicLong lastStatusMs=new AtomicLong();
  static final long POLL_MS=250;

  SpeakerEngine(Context context,TraceJournal journal,Callback cb,int preferredId,
                RecordingStatusListener listener,CaptionListener captions){
    this.context=context.getApplicationContext();log=journal;callback=cb;
    requestedDeviceId=preferredId;recordListener=listener;captionListener=captions;
  }
  void start(Uri input,boolean folder){
    if(worker!=null)throw new IllegalStateException("already running");
    worker=new Thread(()->run(input,folder),"Recording-PCM-Direct-Korean-STT");
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
    notifyState("직접 STT 모드에서는 출력 장치가 필요 없습니다.",false);
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

  /**
   * Select the newest M4A as soon as it appears or becomes current.
   * Only distinguish a new call from stale files; never wait for 3 increments.
   * This path intentionally does not drop audio: a single pre-ready PCM trim
   * happens in DirectPcmKoreanStt once the original IXIO SDK becomes ready.
   */
  private Uri waitForRecording(Uri directory) throws Exception {
    DocumentFile root=DocumentFile.fromTreeUri(context,directory);
    if(root==null||!root.isDirectory())
      throw new IOException("통화 녹음 폴더 접근 실패. 폴더를 다시 선택하십시오.");
    String rootId=DocumentsContract.getTreeDocumentId(directory);
    final long beganWall=System.currentTimeMillis();
    final long began=SystemClock.elapsedRealtime();
    log.event("FOLDER","RECORDING_NEWEST_FILE_WATCH_STARTED",
      "uri",directory.toString(),"pollMs",100,"growthProofRequired",false,
      "eventSources","SAF_CONTENT_OBSERVER_AND_MEDIASTORE");
    final java.util.concurrent.atomic.AtomicBoolean changed=
      new java.util.concurrent.atomic.AtomicBoolean(true);
    ContentObserver observer=new ContentObserver(new Handler(Looper.getMainLooper())){
      @Override public void onChange(boolean selfChange){
        changed.set(true);
        log.event("FOLDER","RECORDING_CONTENT_CHANGED_EVENT",
          "uri",directory.toString());
      }
      @Override public void onChange(boolean selfChange,Uri uri){
        onChange(selfChange);
      }
    };
    boolean registered=false;
    try {
      try {
        context.getContentResolver().registerContentObserver(directory,true,observer);
        registered=true;
      }catch(Exception error){
        log.event("FOLDER","TREE_OBSERVER_UNAVAILABLE",
          "reason",error.getClass().getSimpleName());
      }
      try {
        context.getContentResolver().registerContentObserver(
          MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,true,observer);
        registered=true;
      }catch(Exception error){
        log.event("FOLDER","MEDIASTORE_OBSERVER_UNAVAILABLE",
          "reason",error.getClass().getSimpleName());
      }
      List<GrowingM4aSelector.Entry> found=new ArrayList<>();
      String baselineNewest=null;
      boolean sawBaseline=false;
      long nextRescan=0;
      long lastRecordRequest=0;
      int pollCount=0;
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
        GrowingM4aSelector.Entry newest=found.isEmpty()?null:found.get(0);
        if(!sawBaseline){
          baselineNewest=newest==null?null:newest.uri;
          sawBaseline=true;
        }
        // New filename OR new modification timestamp is sufficient; no
        // additional size/growth verification and no early AAC cutoff.
        if(newest!=null && (
            baselineNewest==null ||
            !newest.uri.equals(baselineNewest) ||
            newest.modified>=beganWall-2000L)){
          Uri selected=Uri.parse(newest.uri);
          log.event("SOURCE","LATEST_M4A_SELECTED_NO_GROWTH_GATE",
            "filename",newest.name,"bytes",newest.bytes,
            "modified",newest.modified,"uri",newest.uri,
            "elapsedSinceWatchStartMs",now-began);
          if(recordListener!=null)
            recordListener.confirmedRecording(newest.name,newest.bytes);
          notifyState("최신 녹음파일 즉시 선택: "+newest.name,false);
          return selected;
        }
        if(recordListener!=null && now-began>=2500 &&
           now-lastRecordRequest>=5000){
          lastRecordRequest=now;
          log.event("FOLDER","NO_NEW_RECORDING_YET",
            "waitingMs",now-began,"files",found.size());
          recordListener.noRecordingEvidence(now-began);
        }
        if(pollCount%10==0)
          notifyState("통화 녹음 시작 대기 · 최신 M4A 즉시 선택",false);
        pollCount++;
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
      log.event("APP","IXIO_ORIGINAL_STT_ENGINE_STARTED",
        "folder",folder,"nativeAbis",Arrays.toString(Build.SUPPORTED_ABIS),
        "sttModel",true,"speakerPlayback",false,"pcmRateHz",16000);
      // Prewarm the original IXIO speechSDK independently of growing M4A detection.
      // PCM is queued during initialization rather than silently discarded.
      stt=new DirectPcmKoreanStt(context,log,new DirectPcmKoreanStt.Listener(){
        @Override public void status(String message){notifyState(message,false);}
        @Override public void caption(String text,boolean finalSegment){
          if(captionListener!=null)captionListener.caption(text,finalSegment);
        }
      });
      stt.start();
      selected=folder?waitForRecording(input):input;
      if(selected==null){endReason="USER_STOP";return;}
      log.event("SOURCE",folder?"LIVE_GROWING_RECORDING_SELECTED":"MANUAL_FILE_SELECTED",
        "uri",selected.toString(),"folderDetection",folder);
      if(!folder){
        // Complete Samsung M4A: MediaExtractor reads original AAC access units,
        // sharing the original 16k FIR PCM sink and IXIO speechSDK with live mode.
        // The ARM-only external follower is NOT needed for the emulator offline test.
        codec=new StreamingAacPcmDecoder(log);
        log.event("TEST","OFFLINE_M4A_IXIO_SPEECHSDK_TEST_STARTED",
          "inputUri",selected.toString());
        readCompletedSamsungM4a(selected);
        endReason="ORIGINAL_SAMSUNG_M4A_PCM_DECODE_COMPLETE";
        return;
      }
      mirror=new File(context.getCacheDir(),"recording-speaker-"+SystemClock.elapsedRealtime()+".m4a");
      if(!mirror.createNewFile())throw new IOException("Mirror already exists");
      appendNewBytes(selected);
      log.event("SOURCE","LIVE_AAC_FROM_START",
          "initialMirroredBytes",mirroredBytes,
          "startupPcmTrimAtSdkReady",true);
      // Preserve original AAC decode and 16k FIR resampler, but no speaker track.
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
      if(!folder){
        // The original Samsung M4A is a finite file. The native AAC follower
        // intentionally waits for growth forever; terminate it after fixed
        // file PCM has gone unchanged for 2s and flush the original IXIO SDK.
        new Thread(()->{
          long began=SystemClock.elapsedRealtime();
          long lastPcm=-1,unchangedSince=began;
          while(!stop && SystemClock.elapsedRealtime()-began<60000){
            long actual=pcmBytes;
            if(actual!=lastPcm){lastPcm=actual;unchangedSince=SystemClock.elapsedRealtime();}
            else if(actual>0&&receivedFrames>0&&
                    SystemClock.elapsedRealtime()-unchangedSince>=2000){
              endReason="FIXED_M4A_AUTO_EOF";
              log.event("CONTROL","FIXED_M4A_AUTO_EOF",
                "pcmBytes",actual,"aacFrames",receivedFrames,
                "mirrorBytes",mirroredBytes,"sttReady",stt!=null&&stt.isReady());
              stop=true;
              Process proc=follower;if(proc!=null&&proc.isAlive())proc.destroy();
              Thread cp=copier;if(cp!=null)cp.interrupt();
              return;
            }
            try{Thread.sleep(250);}catch(InterruptedException ignore){return;}
          }
          if(!stop){
            endReason="FIXED_M4A_WATCHDOG_TIMEOUT";
            log.event("CONTROL","FIXED_M4A_WATCHDOG_TIMEOUT",
                "pcmBytes",pcmBytes,"frames",receivedFrames);
            stop=true;
            Process proc=follower;if(proc!=null&&proc.isAlive())proc.destroy();
          }
        },"IXIO-Fixed-M4A-Auto-Finish").start();
      }
      notifyState("16kHz PCM → IXIO 원본 speechSDK 직접 전송 · 입력 대기",false);
      followPcm(mirror);
      if("NOT_STARTED".equals(endReason))
        endReason=stop?"USER_STOP":"AAC_FOLLOWER_EXIT";
    }catch(Throwable err){
      if(!stop){endReason="ERROR_"+err.getClass().getSimpleName();
        log.error("STT","DIRECT_PIPELINE_FATAL_ERROR",err);}
      notifyState("직접 STT 오류: "+err.getClass().getSimpleName()+": "+err.getMessage(),false);
    }finally{
      stop=true;
      Process p=follower;
      if(p!=null&&p.isAlive())p.destroy();
      Thread t=copier;if(t!=null){t.interrupt();
        try{t.join(1800);}catch(InterruptedException e){Thread.currentThread().interrupt();}}
      StreamingAacPcmDecoder dec=codec;
      if(dec!=null){try{
          if(!folder||pcmBytes>0)
            dec.finish(pcm->{DirectPcmKoreanStt target=stt;if(target!=null)target.accept(pcm);pcmBytes+=pcm.length;});
        }catch(Throwable e){log.error("AAC","FINAL_DRAIN_FAILURE",e);}
        dec.close();
      }
      DirectPcmKoreanStt recognizer=stt;
      if(recognizer!=null){
        recognizer.finishAndWait();
        log.event("STT","DIRECT_PCM_DRAIN_SUMMARY",
            "pcmDurationMs",pcmBytes/32,"recognizedSamples",recognizer.recognizedSamples(),
            "sttCompleted",recognizer.completed(),
            "sttError",String.valueOf(recognizer.failure()));
        if(recognizer.failure()!=null||!recognizer.completed()){
          endReason="ERROR_IXIO_STT_NOT_COMPLETE";
          log.event("STT","IXIO_INCOMPLETE_RESULT_NOT_SUCCESS",
            "sdkCompleted",recognizer.completed(),
            "failure",String.valueOf(recognizer.failure()),
            "queueBytes",recognizer.queuedBytes(),
            "recognizedSamples",recognizer.recognizedSamples());
        }
        stt=null;
      }
      // Whole-file tests must match the declared duration of the selected M4A.
      if(!folder&&expectedSourceDurationUs>0){
        long decodedDurationUs=pcmBytes*1000000L/32000L;
        log.event("TEST","OFFLINE_SOURCE_DURATION_CONFORMANCE",
          "sourceDurationUs",expectedSourceDurationUs,
          "decodedPcmDurationUs",decodedDurationUs,
          "durationDeltaUs",expectedSourceDurationUs-decodedDurationUs);
        if(decodedDurationUs+2000000L<expectedSourceDurationUs){
          endReason="ERROR_OFFLINE_FILE_TRUNCATED";
          log.event("TEST","OFFLINE_FILE_SHORT_DECODE_NOT_SUCCESS",
            "expectedUs",expectedSourceDurationUs,"actualUs",decodedDurationUs);
        }
      }
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
      finalStatus="종료 · "+endReason+" · 직접 STT 입력 "+String.format(Locale.US,"%.2f",pcmBytes/32000.0)+"초";
      callback.state(finalStatus,true);
    }
  }

  private void readCompletedSamsungM4a(Uri file)throws Exception {
    MediaExtractor extractor=new MediaExtractor();
    try{
      extractor.setDataSource(context,file,null);
      int audioTrack=-1;
      for(int i=0;i<extractor.getTrackCount();i++){
        MediaFormat format=extractor.getTrackFormat(i);
        String mime=format.getString(MediaFormat.KEY_MIME);
        if(MediaFormat.MIMETYPE_AUDIO_AAC.equals(mime)){
          int rate=format.getInteger(MediaFormat.KEY_SAMPLE_RATE);
          int ch=format.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
          if(rate!=48000||ch!=1)
            throw new IOException("Original M4A must be AAC 48kHz mono; got "+rate+"/"+ch);
          audioTrack=i;break;
        }
      }
      if(audioTrack<0)throw new IOException("No AAC audio track in original Samsung M4A");
      MediaFormat sourceFormat=extractor.getTrackFormat(audioTrack);
      if(sourceFormat.containsKey(MediaFormat.KEY_DURATION))
        expectedSourceDurationUs=sourceFormat.getLong(MediaFormat.KEY_DURATION);
      log.event("TEST","OFFLINE_ORIGINAL_FILE_DURATION",
        "selectedUri",file.toString(),
        "expectedUs",expectedSourceDurationUs,
        "expectedSeconds",expectedSourceDurationUs/1000000.0);
      extractor.selectTrack(audioTrack);
      int frames=0;
      long previousTime=-1;
      ByteBuffer unit=ByteBuffer.allocateDirect(65536);
      while(!stop){
        unit.clear();
        int size=extractor.readSampleData(unit,0);
        if(size<0)break;
        if(size>unit.capacity()||size==0)
          throw new IOException("Invalid AAC access unit size "+size);
        long time=extractor.getSampleTime();
        if(time>=0&&time<previousTime)
          throw new IOException("Original AAC timestamps moved backwards");
        previousTime=time;
        unit.position(0);unit.limit(size);
        byte[] packet=new byte[size];
        unit.get(packet);
        codec.feedRawAacFrame(packet,pcm->{
          DirectPcmKoreanStt original=stt;
          if(original==null)throw new IOException("IXIO original SDK unavailable");
          original.accept(pcm);
          pcmBytes+=pcm.length;
          if(pcmBytes/32000>lastStatusMs.get()){
            lastStatusMs.set(pcmBytes/32000);
            log.event("TEST","ORIGINAL_IXIO_PCM_QUEUED",
              "pcmBytes",pcmBytes,"seconds",pcmBytes/32000.0,
              "originalModelReady",original.isReady(),
              "samplesRecognized",original.recognizedSamples());
          }
        });
        receivedFrames=++frames;
        if(!extractor.advance())break;
      }
      log.event("TEST","OFFLINE_M4A_AAC_DECODE_COMPLETED",
        "aacFrames",frames,"pcmBytes",pcmBytes,
        "pcmDurationSeconds",pcmBytes/32000.0);
      if(frames==0)throw new IOException("Original M4A contained no decodable AAC frames");
    }finally{extractor.release();}
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
       "sttProcessStarted",true,"sttRoute","DIRECT_PCM_TO_SHERPA");
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
          DirectPcmKoreanStt target=stt;
          if(target==null)throw new IOException("Direct STT sink not initialized");
          target.accept(pcm);
          pcmBytes+=pcm.length;
          if(pcmBytes/32000>lastStatusMs.get()){
            lastStatusMs.set(pcmBytes/32000);
            log.event("STT","DIRECT_PCM_SENT","pcmBytes",pcmBytes,
              "audioSeconds",pcmBytes/32000.0,"modelReady",target.isReady(),
              "queuedBytes",target.queuedBytes(),
              "recognizedSamples",target.recognizedSamples());
          }
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
