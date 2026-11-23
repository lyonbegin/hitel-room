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
 * argano-style AAC frame parsing via FAAD2, native 48k->16k PCM,
 * 512-sample FIFO producer-consumer -> original IXIO speechSDK.
 * No legacy follower, MediaCodec or AudioTrack is executed.
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

  /** Pick ONE newest recording from the user-chosen folder when it appears.
   * No three-growth-event detection, no audio skipping, no VAD.
   * The last-modified time is only used to avoid an OLD call's file when
   * telephony fires before Samsung has created the next recording.
   */
  private Uri waitForRecording(Uri directory,boolean requireFresh) throws Exception {
    DocumentFile root=DocumentFile.fromTreeUri(context,directory);
    if(root==null||!root.isDirectory())
      throw new IOException("통화 녹음 폴더 접근 실패. 폴더를 다시 선택하십시오.");
    String rootId=DocumentsContract.getTreeDocumentId(directory);
    long began=SystemClock.elapsedRealtime();
    long wallStart=System.currentTimeMillis();
    long lastRequest=0;
    log.event("FOLDER","WAIT_FOR_NEWEST_RECORDING_FILE",
      "folder",directory.toString(),"readFromFirstFrame",true,"growthGate",false);
    notifyState("녹음 시작 대기 · 지정 폴더의 최신 M4A 하나 선택",false);
    while(!stop){
      List<GrowingM4aSelector.Entry> found=new ArrayList<>();
      scanChildren(directory,rootId,0,new int[]{4000},found);
      found.sort((a,b)->{
        int c=Long.compare(b.modified,a.modified);
        return c!=0?c:b.name.compareTo(a.name);
      });
      if(!found.isEmpty()){
        GrowingM4aSelector.Entry latest=found.get(0);
        // A source must belong to this recording session, not an old call.
        if(!requireFresh || latest.modified>=wallStart-3000L){
          selected=Uri.parse(latest.uri);
          log.event("FOLDER","NEWEST_RECORDING_SELECTED_NO_GROWTH_GATE",
            "file",latest.name,"uri",latest.uri,
            "modified",latest.modified,"sizeHint",latest.bytes);
          if(recordListener!=null)
            recordListener.confirmedRecording(latest.name,latest.bytes);
          notifyState("녹음 중 최신 파일 선택: "+latest.name,false);
          return selected;
        }
      }
      long now=SystemClock.elapsedRealtime();
      if(recordListener!=null && now-began>2500 && now-lastRequest>=5000){
        lastRequest=now;
        recordListener.noRecordingEvidence(now-began);
      }
      Thread.sleep(100);
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
      log.event("APP","ARGANO_FAAD2_FIFO_ENGINE_STARTED",
        "folder",folder,"nativeAbis",Arrays.toString(Build.SUPPORTED_ABIS),
        "pcmRateHz",16000,"pcmChannels",1,"pcmBits",16,"pcmSamplesPerRead",512,
        "producerConsumerQueue",true,"legacyAacFollower",false);
      stt=new DirectPcmKoreanStt(context,log,new DirectPcmKoreanStt.Listener(){
        @Override public void status(String message){notifyState(message,false);}
        @Override public void caption(String text,boolean finalSegment){
          if(captionListener!=null)captionListener.caption(text,finalSegment);
        }
      });
      stt.start(); // independent consumer thread starts before PCM producer
      boolean directoryInput=folder;
      if(!directoryInput){
        try{
          DocumentFile tree=DocumentFile.fromTreeUri(context,input);
          directoryInput=tree!=null&&tree.isDirectory();
        }catch(Exception notTree){directoryInput=false;}
      }
      // Automatic calls await this call's recording. Manual folder tests use
      // the latest existing file even after recording has already completed.
      selected=directoryInput?waitForRecording(input,folder):input;
      if(selected==null){endReason="USER_STOP";return;}
      log.event("SOURCE","ARGANO_FAAD2_SOURCE_SELECTED",
        "uri",selected.toString(),"folder",folder,"fromRecordingStart",true);
      mirror=new File(context.getCacheDir(),
          "argano-faad-recording-"+SystemClock.elapsedRealtime()+".m4a");
      if(!mirror.createNewFile())throw new IOException("Mirror already exists");
      appendNewBytes(selected); // all bytes from source offset zero
      if(!folder){
        // Extract duration metadata only; AAC decoding always uses FAAD2 below.
        MediaExtractor meta=new MediaExtractor();
        try{
          meta.setDataSource(context,selected,null);
          for(int i=0;i<meta.getTrackCount();i++){
            MediaFormat f=meta.getTrackFormat(i);
            if(MediaFormat.MIMETYPE_AUDIO_AAC.equals(f.getString(MediaFormat.KEY_MIME))){
              if(f.containsKey(MediaFormat.KEY_DURATION))
                expectedSourceDurationUs=f.getLong(MediaFormat.KEY_DURATION);
              break;
            }
          }
        }catch(Throwable error){
          log.event("TEST","OPTIONAL_M4A_DURATION_UNAVAILABLE",
            "error",error.getClass().getSimpleName());
        }finally{
          meta.release();
        }
      }else{
        copier=new Thread(()->{
          while(!stop){
            try{appendNewBytes(selected);}
            catch(Throwable problem){
              if(!stop)log.error("MIRROR","ARGANO_SOURCE_READ_FAILED",problem);
            }
            try{Thread.sleep(POLL_MS);}
            catch(InterruptedException interrupted){return;}
          }
        },"Argano-M4A-Sequential-Source-Producer");
        copier.start();
      }
      notifyState("FAAD2 원시 AAC 복호화 → 32ms PCM FIFO → IXIO STT",false);
      followPcm(mirror,folder);
      if("NOT_STARTED".equals(endReason))
        endReason=stop?"CALL_ENDED_DRAIN_FIFO":"ARGANO_FAAD2_EOF";
    }catch(Throwable err){
      if(!stop){
        endReason="ERROR_"+err.getClass().getSimpleName();
        log.error("STT","ARGANO_FAAD2_PIPELINE_FATAL",err);
      }
      notifyState("FAAD2 처리 오류: "+err.getClass().getSimpleName()+": "+err.getMessage(),false);
    }finally{
      stop=true;
      Process p=follower;
      if(p!=null&&p.isAlive())p.destroy();
      Thread t=copier;
      if(t!=null){
        t.interrupt();
        try{t.join(1800);}
        catch(InterruptedException e){Thread.currentThread().interrupt();}
      }
      DirectPcmKoreanStt recognizer=stt;
      if(recognizer!=null){
        // Producer stops first; the consumer drains ALL FIFO frames thereafter.
        recognizer.finishAndWait();
        log.event("STT","PCM512_FIFO_DRAIN_SUMMARY",
          "pcmBytes",pcmBytes,"recognizedSamples",recognizer.recognizedSamples(),
          "sttCompleted",recognizer.completed(),
          "sttError",String.valueOf(recognizer.failure()));
        if(recognizer.failure()!=null||!recognizer.completed()){
          endReason="ERROR_IXIO_STT_NOT_COMPLETE";
          log.event("STT","IXIO_INCOMPLETE_RESULT_NOT_SUCCESS",
            "sdkCompleted",recognizer.completed(),
            "failure",String.valueOf(recognizer.failure()),
            "queuedBytes",recognizer.queuedBytes(),
            "recognizedSamples",recognizer.recognizedSamples());
        }
        stt=null;
      }
      if(!folder&&expectedSourceDurationUs>0){
        long decodedDurationUs=pcmBytes*1000000L/32000L;
        log.event("TEST","OFFLINE_SOURCE_DURATION_CONFORMANCE",
          "sourceDurationUs",expectedSourceDurationUs,
          "decodedPcmDurationUs",decodedDurationUs);
        if(decodedDurationUs+2000000L<expectedSourceDurationUs){
          endReason="ERROR_OFFLINE_FILE_TRUNCATED";
          log.event("TEST","OFFLINE_FILE_SHORT_DECODE_NOT_SUCCESS",
            "expectedUs",expectedSourceDurationUs,"actualUs",decodedDurationUs);
        }
      }
      File temp=mirror;
      if(temp!=null){
        boolean deleted=temp.delete();
        log.event("MIRROR","ARGANO_TEMP_CLEANED","deleted",deleted,"bytes",mirroredBytes);
      }
      log.event("APP","SESSION_END","reason",endReason,
        "pcmBytes",pcmBytes,"pcmDurationMs",pcmBytes/32,
        "frames",receivedFrames,"sourceBytes",mirroredBytes);
      log.diagnosticSummary();
      finished=true;
      callback.state("종료 · "+endReason+" · PCM "+
        String.format(Locale.US,"%.2f",pcmBytes/32000.0)+"초",true);
    }
  }

  /** Producer: external argano/FAAD2 emits continuous PCM16LE.
   * The exact 512-sample frames are placed into a FIFO; IXIO consumes
   * independently via Pcm512Fifo.read(short[],0,512).
   */
  private void followPcm(File mirrorFile,boolean live)throws Exception {
    File elf=new File(context.getApplicationInfo().nativeLibraryDir,
        "libargano-faad-pcm.so");
    if(!elf.isFile()||!elf.canExecute())
      throw new IOException("Argano/FAAD2 binary not installed: "+elf);
    ProcessBuilder builder=new ProcessBuilder(elf.getAbsolutePath(),
        mirrorFile.getAbsolutePath(),live?"follow":"fixed");
    builder.redirectErrorStream(false);
    String old=builder.environment().get("LD_LIBRARY_PATH");
    builder.environment().put("LD_LIBRARY_PATH",
      context.getApplicationInfo().nativeLibraryDir+(old==null?"":":"+old));
    Process p=builder.start();
    follower=p;
    log.event("ARGANO","EXTERNAL_FAAD2_PCM_PRODUCER_STARTED",
      "binary",elf.getName(),"mirrorBytes",mirroredBytes,
      "producer","NeAACDecDecode","consumer","Pcm512Fifo.read",
      "samplesPerRead",512,"live",live);
    stderr=new Thread(()->{
      try(BufferedReader reader=new BufferedReader(
          new InputStreamReader(p.getErrorStream(),StandardCharsets.UTF_8))){
        String line;
        while((line=reader.readLine())!=null)
          log.event("ARGANO","FAAD2_NATIVE_LOG","line",line);
      }catch(Throwable error){
        if(!stop)log.error("ARGANO","FAAD2_LOG_FAILURE",error);
      }
    },"Argano-FAAD2-Diagnostic-Reader");
    stderr.start();
    Pcm512Chunker chunker=new Pcm512Chunker(pcm->{
      DirectPcmKoreanStt target=stt;
      if(target==null)throw new IOException("IXIO consumer not initialized");
      target.accept(pcm); // independent FIFO producer never waits on inference
      pcmBytes+=pcm.length;
      receivedFrames++;
      if(receivedFrames<=3 || receivedFrames%128==0)
        log.event("PCM","PCM512_ENQUEUED",
          "frames",receivedFrames,"samplesPerFrame",512,
          "durationMs",receivedFrames*32,
          "cumulativeBytes",pcmBytes,"queuedFrames",receivedFrames-
           target.recognizedSamples()/512);
    });
    byte[] buf=new byte[8192];
    try(BufferedInputStream nativePcm=new BufferedInputStream(p.getInputStream(),65536)){
      // Even after call stop, drain the native process stdout to EOF:
      // SIGTERM asks native FAAD2 to flush its remaining resampler samples.
      while(true){
        int n=nativePcm.read(buf);
        if(n<0)break;
        // A pipe read may split a 16-bit sample; chunker retains the partial byte.
        chunker.write(buf,0,n);
      }
      chunker.finish(); // last partial frame is zero-padded, never dropped
      log.event("PCM","PCM512_PRODUCER_FINISHED",
        "sourceBytes",chunker.inputBytes(),
        "queuedFrames",chunker.frames(),"pcmBytes",pcmBytes);
      if(!stop){
        int exit=p.waitFor();
        if(exit!=0)throw new IOException("FAAD2 producer exit="+exit);
      }
    }finally{
      p.destroy();
      if(stderr!=null){
        try{stderr.join(1600);}
        catch(InterruptedException e){Thread.currentThread().interrupt();}
      }
      follower=null;
    }
  }
}
