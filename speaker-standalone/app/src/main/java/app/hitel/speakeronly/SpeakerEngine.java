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
  private volatile File mirror;
  private volatile long mirroredBytes;
  private volatile long receivedFrames;
  private volatile long pcmBytes;
  private volatile long expectedSourceDurationUs=-1;
  private volatile String endReason="NOT_STARTED";
  private volatile int requestedDeviceId;
  private volatile DirectPcmKoreanStt stt;
  private volatile GithubFaad2PcmSource faadSource;
  private Thread worker;
  private Thread copier;
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
    GithubFaad2PcmSource source=faadSource;
    if(source!=null)source.requestStop();
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

  /** Select ONLY the newest recording under the designated SAF folder.
   * No 3-growth proof, no size-based selection, no cutoff of initial audio.
   * The active call recorder's newest file is picked as it appears.
   */
  private Uri waitForRecording(Uri directory)throws Exception {
    DocumentFile root=DocumentFile.fromTreeUri(context,directory);
    if(root==null||!root.isDirectory())
      throw new IOException("녹음 폴더 접근 실패. 폴더를 다시 선택하십시오.");
    String rootId=DocumentsContract.getTreeDocumentId(directory);
    final long beganWall=System.currentTimeMillis();
    final long began=SystemClock.elapsedRealtime();
    String priorNewest=null;
    boolean sawBaseline=false;
    long lastStartRequest=0;
    while(!stop){
      List<GrowingM4aSelector.Entry> found=new ArrayList<>();
      scanChildren(directory,rootId,0,new int[]{4000},found);
      found.sort((x,y)->{
        int t=Long.compare(y.modified,x.modified);
        return t!=0?t:y.name.compareTo(x.name);
      });
      GrowingM4aSelector.Entry newest=found.isEmpty()?null:found.get(0);
      if(!sawBaseline){
        priorNewest=newest==null?null:newest.uri;
        sawBaseline=true;
      }
      // When recording begins, the newest file is newly created or has
      // a fresh write timestamp. Never wait for three observed size increments.
      if(newest!=null && (
          priorNewest==null ||
          !newest.uri.equals(priorNewest) ||
          newest.modified>=beganWall-2000L)){
        Uri chosen=Uri.parse(newest.uri);
        log.event("SOURCE","FAAD2_NEWEST_RECORDING_SELECTED",
          "name",newest.name,"uri",newest.uri,
          "modified",newest.modified,"selection","LATEST_ONLY_NO_GROWTH_GATE");
        if(recordListener!=null)
          recordListener.confirmedRecording(newest.name,newest.bytes);
        return chosen;
      }
      long elapsed=SystemClock.elapsedRealtime()-began;
      if(recordListener!=null && elapsed>=1500 && elapsed-lastStartRequest>=4000){
        lastStartRequest=elapsed;
        recordListener.noRecordingEvidence(elapsed);
      }
      if(elapsed<5000 || elapsed%5000<150)
        notifyState("통화 녹음 시작 대기 · 최신 M4A 파일 자동 선택",false);
      Thread.sleep(120);
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
    try{
      log.event("APP","FAAD2_GITHUB_M4A_PCM_QUEUE_STARTED",
        "mode",folder?"latest-recording":"fixed-file",
        "source","knik0/faad2-2.11.4","sink","IXIO-original-speechSDK",
        "rate",16000,"channels",1,"pcmBytesPerChunk",1024);
      stt=new DirectPcmKoreanStt(context,log,new DirectPcmKoreanStt.Listener(){
        @Override public void status(String message){notifyState(message,false);}
        @Override public void caption(String text,boolean finalSegment){
          if(captionListener!=null)captionListener.caption(text,finalSegment);
        }
      });
      stt.start();
      selected=folder?waitForRecording(input):input;
      if(selected==null){endReason="USER_STOP";return;}
      log.event("SOURCE","FAAD2_ONE_SOURCE_SELECTED","uri",selected.toString());
      mirror=new File(context.getCacheDir(),
        "faad2-github-original-"+SystemClock.elapsedRealtime()+".m4a");
      if(!mirror.createNewFile())throw new IOException("Mirror already exists");
      if(folder){
        appendNewBytes(selected);
        copier=new Thread(()->{
          while(!stop){
            try{appendNewBytes(selected);}
            catch(Throwable e){if(!stop)log.error("MIRROR","FAAD2_MIRROR_COPY_FAILED",e);}
            try{Thread.sleep(POLL_MS);}
            catch(InterruptedException e){return;}
          }
        },"FAAD2-Growing-M4A-Mirror");
        copier.start();
      }else{
        try(InputStream in=context.getContentResolver().openInputStream(selected);
            FileOutputStream out=new FileOutputStream(mirror)){
          if(in==null)throw new IOException("Cannot open chosen M4A");
          byte[] buffer=new byte[65536];int n;
          while((n=in.read(buffer))!=-1)out.write(buffer,0,n);
          out.flush();
        }
        mirroredBytes=mirror.length();
      }
      faadSource=new GithubFaad2PcmSource(log);
      notifyState("GitHub FAAD2 → PCM 512샘플 FIFO → IXIO 원본 STT",false);
      faadSource.pump(context,mirror,!folder,pcm->{
        DirectPcmKoreanStt target=stt;
        if(target==null)throw new IOException("Original IXIO STT unavailable");
        target.accept(pcm);
        pcmBytes+=pcm.length;
        if(pcmBytes<=32768 || pcmBytes%(32000L*5)<1024)
          log.event("STT","GITHUB_FAAD2_PCM_TO_IXIO_FIFO",
            "bytes",pcmBytes,"samples16k",pcmBytes/2,
            "queuedBytes",target.queuedBytes(),"consumed",target.recognizedSamples());
      });
      endReason=stop?"CALL_STOP_DRAINED":"FAAD2_FILE_COMPLETE";
    }catch(Throwable err){
      if(!stop){
        endReason="ERROR_"+err.getClass().getSimpleName();
        log.error("FAAD2","GITHUB_EXTERNAL_AAC_PIPELINE_FAILED",err);
      }
      notifyState("FAAD2 PCM 오류: "+err.getClass().getSimpleName()+": "+err.getMessage(),false);
    }finally{
      stop=true;
      GithubFaad2PcmSource source=faadSource;
      if(source!=null)source.requestStop();
      Thread t=copier;
      if(t!=null){t.interrupt();
        try{t.join(1800);}catch(InterruptedException e){Thread.currentThread().interrupt();}
      }
      DirectPcmKoreanStt recognizer=stt;
      if(recognizer!=null){
        recognizer.finishAndWait(); // drain ALL FIFO, including last queued 32ms.
        log.event("STT","FAAD2_IXIO_QUEUE_FULL_DRAIN",
          "pcmBytes",pcmBytes,"queuedBytes",recognizer.queuedBytes(),
          "recognizedSamples",recognizer.recognizedSamples(),
          "sdkCompleted",recognizer.completed(),"error",String.valueOf(recognizer.failure()));
        if(recognizer.failure()!=null||!recognizer.completed())
          endReason="ERROR_IXIO_STT_NOT_COMPLETE";
        stt=null;
      }
      File temp=mirror;
      if(temp!=null)log.event("MIRROR","FAAD2_TEMP_CLEANED",
        "deleted",temp.delete(),"bytes",mirroredBytes);
      log.event("APP","FAAD2_SESSION_END","reason",endReason,
        "sourceBytes",mirroredBytes,"pcmBytes",pcmBytes,
        "pcmChunks512",source==null?0:source.emittedChunks());
      log.diagnosticSummary();
      finished=true;
      callback.state("종료 · "+endReason+" · PCM "+
        String.format(Locale.US,"%.2f",pcmBytes/32000.0)+"초",true);
    }
  }

}
