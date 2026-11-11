package app.hitel.sherpaoriginalcli;

import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.provider.DocumentsContract;
import android.util.Log;
import androidx.documentfile.provider.DocumentFile;
import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegKitConfig;
import com.arthenica.ffmpegkit.FFmpegSession;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/** Android growing-recording diagnostic:
 * SAF / local path -> FFmpegKit -follow 1 -> FIFO raw PCM -> persistent Sherpa-ONNX SenseVoice C API.
 * All failures, byte growth, MP4 header, timeouts and native logs remain in a ZIP-exportable journal.
 */
public final class GrowingCallEngine {
  public interface Callback { void onStatus(String status,String transcription); }
  final Context context;
  final TraceJournal log;
  final Callback callback;
  volatile boolean stop=false;
  volatile FFmpegSession ffmpeg;
  volatile Process sherpa;
  volatile String fifo;
  volatile String transcription="";
  volatile boolean hasLiveHypothesis=false;
  volatile boolean onlineModelReady=false;
  final java.util.concurrent.CountDownLatch onlineModelReadyLatch=new java.util.concurrent.CountDownLatch(1);
  volatile long nativeLiveBootNs=0;
  volatile long nativeLiveId=0;
  volatile long nativeLiveAudioMs=0;
  private int loudChunks=0,quietChunks=0;
  private boolean activeEnergyBurst=false;
  volatile long nativeLaunchElapsed=0;
  volatile long lastStaleLogElapsed=0;
  volatile Uri activeUri;
  volatile File workingMirror;
  volatile long mirroredBytes=0;
  volatile StreamingAacPcmDecoder continuousAacDecoder;
  // Poll ONLY for source growth every 300ms. Native STT receives PCM when decoded;
  // neither input nor captions wait for VAD, silence, or utterance completion.
  static final long STREAM_POLL_MS=300;
  volatile long nextAacFrameSourceByte=0; // source bytes up to last COMPLETE AAC frame
  volatile long pendingDeltaPcmBytes=0; // only the PCM sent from an interrupted delta
  final AtomicLong pcmBytes=new AtomicLong();
  final AtomicLong committedPcmBytes=new AtomicLong();
  final AtomicLong lastPcm=new AtomicLong();
  final AtomicInteger chunkCount=new AtomicInteger();
  final AtomicInteger resultCount=new AtomicInteger();
  volatile int fileChangeCount=0;
  volatile long observedGrowthBytes=0;
  volatile long currentSize=-1;
  volatile boolean finished=false;
  volatile String endReason="NOT_STARTED";
  private Thread worker;
  // Transport PCM to the persistent Silero VAD every 0.5s, NEVER use a fixed STT boundary.
  static final int WINDOW_SAMPLES=16000/5; // 200ms PCM transport, not recognition segmentation
  static final int WINDOW_BYTES=WINDOW_SAMPLES*2;

  public GrowingCallEngine(Context context,TraceJournal log,Callback callback){
    this.context=context.getApplicationContext();
    this.log=log;this.callback=callback;
  }
  public void start(Uri uri,boolean isFolder){
    if(worker!=null)throw new IllegalStateException("Session already started");
    worker=new Thread(()->run(uri,isFolder),"Growing-M4A-FFmpeg-Engine");
    worker.start();
  }
  public void stop(){
    stop=true;
    onlineModelReadyLatch.countDown(); // unblock prewarm gate for cancellation
    log.event("CONTROL","STOP_REQUEST","ffmpegSessionId",ffmpeg==null?-1:ffmpeg.getSessionId(),
      "pcmBytes",pcmBytes.get(),"chunks",chunkCount.get());
    FFmpegSession s=ffmpeg;
    if(s!=null)FFmpegKit.cancel(s.getSessionId());
    // Do not destroy the recognizer here: the worker sends a clean EOF (0,0)
    // so Silero VAD can flush the final utterance and print its last caption.
    log.event("CONTROL","VAD_GRACEFUL_FINAL_FLUSH_REQUESTED");
    String path=fifo;
    if(path!=null){
      // FIFO reader can be waiting in open(), if ffmpeg failed before opening the write end.
      new Thread(()->{try(FileOutputStream out=new FileOutputStream(path)){out.flush();}
         catch(Exception e){log.event("PIPE","UNBLOCK_OPEN_FAILURE","error",String.valueOf(e));}},
         "Unblock-FFmpeg-FIFO").start();
    }
  }
  public boolean done(){return finished;}
  public String transcript(){return transcription;}
  void status(String message){
    log.event("STATUS","MESSAGE","text",message);
    callback.onStatus(message,transcription);
  }

  void run(Uri given,boolean directoryMode){
    log.timing("ENGINE","SESSION_START","folderMode",directoryMode);
    log.event("CONTROL","ENGINE_START","inputUri",String.valueOf(given),"folderMode",directoryMode,
      "targetAbi",Arrays.toString(Build.SUPPORTED_ABIS));
    try{
      // Start the 174M model BEFORE waiting for a new Samsung call. In the
      // field trace cold model initialization took 13.79 seconds; overlap
      // that cost with idle folder monitoring, not with incoming speech.
      log.timing("MODEL","PREWARM_BEGIN","beforeFileDiscovery",true);
      nativeStart();
      log.timing("MODEL","PREWARM_PROCESS_STARTED","nativeReady",false);
      log.event("LATENCY","MODEL_PREWARM_STARTED","beforeFileDiscovery",true);
      status("한국어 STT 모델 준비 중 · 녹음 파일 감시를 병행합니다");
      Uri file=directoryMode?waitForGrowingFile(given):given;
      if(file==null)throw new IOException("파일을 발견하지 못했거나 감시를 중지했습니다.");
      activeUri=file;
      File dir=new File(context.getCacheDir(),"growing-m4a-reader");
      if(!dir.exists()&&!dir.mkdirs())throw new IOException("Cannot create private FFmpeg input folder");
      workingMirror=new File(dir,"recording-"+SystemClock.elapsedRealtime()+".m4a");
      log.event("MIRROR","PRIVATE_MIRROR_CREATED","path",workingMirror.getAbsolutePath(),
        "note","Android SAF provides bytes; private seekable file is FFmpeg input; deleted on stop");
      appendMirror(file,"initial");
      log.event("FILE","SELECTED_FOR_STREAM","uri",file.toString(),"displayName",display(file));
      File sampler=takeSample(file,"initial");
      if(sampler!=null)log.event("FILE","INITIAL_HEADER_SAVED","name",sampler.getName());
      Thread monitor=new Thread(()->pollChanges(file),"Growing-Recording-Snapshot");
      monitor.start();
      try {
        processSource(file);
      } finally {
        monitor.interrupt();
        try{monitor.join(1300);}catch(InterruptedException ignored){}
      }
    }catch(Throwable t){
      endReason="ERROR_"+t.getClass().getSimpleName();
      log.error("ENGINE","FATAL_ERROR",t);
      status("실패: "+t.getClass().getSimpleName()+": "+t.getMessage()+" · ZIP 로그 저장");
    }finally{
      stop=true;
      FFmpegSession session=ffmpeg;
      if(session!=null)FFmpegKit.cancel(session.getSessionId());
      Process p=sherpa;
      if(p!=null&&p.isAlive())p.destroyForcibly();
      log.event("CONTROL","END","reason",endReason,"pcmBytes",pcmBytes.get(),
        "pcmSeconds",pcmBytes.get()/32000.0,"uniquePcmSentBytes",committedPcmBytes.get(),"chunksSent",chunkCount.get(),
        "sttResults",resultCount.get(),"fileChanges",fileChangeCount,
        "fileGrowthBytes",observedGrowthBytes,"transcriptChars",transcription.length());
      File temp=workingMirror;
      if(temp!=null){
        boolean removed=temp.delete();
        log.event("MIRROR","PRIVATE_MIRROR_REMOVED","deleted",removed,
          "bytesWritten",mirroredBytes,"path",temp.getAbsolutePath());
      }
      log.diagnosticSummary();
      finished=true;
      callback.onStatus("진단 종료 · "+endReason+" · ZIP 로그를 저장하십시오.",transcription);
    }
  }

  static boolean looksAudio(DocumentFile f){
    String n=f.getName();
    if(n==null)return false;
    String name=n.toLowerCase(Locale.US);
    return name.endsWith(".m4a")||name.endsWith(".aac")||name.endsWith(".mp4")
      ||name.endsWith(".3gp")||name.endsWith(".amr")||name.endsWith(".wav");
  }
  String display(Uri uri){
    try(android.database.Cursor cursor=context.getContentResolver().query(uri,
        new String[]{android.provider.OpenableColumns.DISPLAY_NAME},null,null,null)){
      if(cursor!=null && cursor.moveToFirst()&&!cursor.isNull(0))return cursor.getString(0);
    }catch(Exception err){log.error("FILE","DISPLAY_NAME_QUERY_FAILED",err);}
    return uri.getLastPathSegment()==null?"unknown":uri.getLastPathSegment();
  }

  Uri waitForGrowingFile(Uri folder)throws Exception {
    log.event("FOLDER","TREE_SCAN_START","uri",folder.toString());
    DocumentFile directory=DocumentFile.fromTreeUri(context,folder);
    if(directory==null||!directory.isDirectory())throw new IOException("선택한 URI가 폴더가 아닙니다.");
    HashMap<String,Long> baseline=new HashMap<>();
    boolean first=true;
    long scans=0;
    while(!stop){
      DocumentFile[] children;
      try{children=directory.listFiles();}
      catch(Exception ex){log.error("FOLDER","LIST_FAILED",ex);Thread.sleep(1500);continue;}
      scans++;
      DocumentFile growing=null;long bestTime=-1;
      int candidateCount=0;
      for(DocumentFile f:children){
        if(!f.isFile()||!looksAudio(f))continue;
        candidateCount++;
        String key=f.getUri().toString();
        long current=f.length();long updated=f.lastModified();
        Long old=baseline.put(key,current);
        if(!first && (old==null || old.longValue()!=current)){
          log.event("FOLDER","CHILD_CHANGED","name",f.getName(),"old",old,"new",current,
            "modified",updated,"uri",key);
          if(current>=1024 && (growing==null || updated>bestTime)){
            growing=f;bestTime=updated;
          }
        }
      }
      if(scans==1||scans%5==0)
        log.event("FOLDER","SCAN","iteration",scans,"count",candidateCount,"files",children.length,
          "selection","new or size-changing audio only");
      first=false;
      if(growing!=null){
        log.timing("FILE","NEW_RECORDING_DISCOVERED","bytes",growing.length(),"scan",scans);
        log.event("FOLDER","ACTIVE_FILE_DETECTED","name",growing.getName(),
          "size",growing.length(),"uri",growing.getUri().toString());
        status("증가하는 녹음 파일 감지: "+growing.getName());
        return growing.getUri();
      }
      Thread.sleep(180);
    }
    return null;
  }

  /**
   * DocumentFile.length() may be cached by MediaStore/DocumentsUI for a URI
   * selected before an external recorder app appends new bytes. A newly-opened
   * real file descriptor exposes the current inode size via fstat.
   */
  long currentReadableSize(Uri uri,long providerMetadataSize) {
    try(ParcelFileDescriptor fd=context.getContentResolver().openFileDescriptor(uri,"r")){
      if(fd!=null){
        long size=fd.getStatSize();
        if(size>=0){
          if(providerMetadataSize>=0 && size!=providerMetadataSize)
            log.event("FILE","PROVIDER_METADATA_STALE","providerSize",providerMetadataSize,
              "realFdSize",size,"uri",uri.toString());
          return size;
        }
      }
    }catch(Throwable e){
      log.event("FILE","LIVE_FD_STAT_UNAVAILABLE","message",String.valueOf(e),
        "metadataFallback",providerMetadataSize);
    }
    return providerMetadataSize;
  }

  void pollChanges(Uri uri){
    long lastSize=Long.MIN_VALUE,lastModified=Long.MIN_VALUE,checks=0;
    while(!stop && !Thread.currentThread().isInterrupted()){
      checks++;
      try{
        DocumentFile document=DocumentFile.fromSingleUri(context,uri);
        long metadataSize=document==null?-1:document.length();
        long n=currentReadableSize(uri,metadataSize);
        long modified=document==null?-1:document.lastModified();
        if(n==0||n<0)log.event("FILE","UNAVAILABLE_OR_EMPTY","size",n,"lastModified",modified);
        if(n!=lastSize||modified!=lastModified){
          if(lastSize>=0&&n>lastSize){
            observedGrowthBytes+=n-lastSize;fileChangeCount++;
            log.timing("FILE","RECORDING_GREW","newBytes",n,"deltaBytes",n-lastSize,"poll",checks);
          }
          if(lastSize>=0&&n<lastSize)log.event("FILE","TRUNCATED_OR_REPLACED","old",lastSize,"new",n);
          if(n>=0 && (n>mirroredBytes || n<mirroredBytes)){
            appendMirror(uri,"size-change-"+checks);
          }
          log.event("FILE","SIZE_OR_MTIME_CHANGED","oldBytes",lastSize,"newBytes",n,
            "delta",lastSize>=0?n-lastSize:0,"mtime",modified,"checks",checks);
          lastSize=n;lastModified=modified;currentSize=n;
          if(n>0 && (checks==1||checks%8==0))takeSample(uri,"growth-"+checks);
        }else if(checks%5==0){
          log.event("FILE","POLL_STABLE","bytes",n,"lastModified",modified,"checks",checks,
            "noPcmForMs",lastPcm.get()==0?-1:SystemClock.elapsedRealtime()-lastPcm.get());
        }
      }catch(Throwable t){log.error("FILE","POLL_ERROR",t);}
      try{Thread.sleep(STREAM_POLL_MS);}catch(InterruptedException e){break;}
    }
    log.event("FILE","POLL_STOPPED","checks",checks);
  }

  File takeSample(Uri uri,String label){
    ParcelFileDescriptor fd=null;
    try{
      fd=context.getContentResolver().openFileDescriptor(uri,"r");
      if(fd==null)throw new IOException("ContentResolver openFileDescriptor returned null");
      long stat=fd.getStatSize();
      byte[] prefix=new byte[512];int n;
      try(FileInputStream in=new FileInputStream(fd.getFileDescriptor())){
        n=in.read(prefix);
      }
      if(n<0)n=0;
      StringBuilder hex=new StringBuilder(),ascii=new StringBuilder();
      for(int i=0;i<Math.min(n,96);i++){
        hex.append(String.format(Locale.US,"%02x ",prefix[i]&255));
        ascii.append((prefix[i]>=32&&prefix[i]<=126)?(char)prefix[i]:'.');
      }
      File f=new File(log.dir(),"mp4-header-"+label+".bin");
      try(FileOutputStream out=new FileOutputStream(f)){out.write(prefix,0,n);}
      log.event("FORMAT","HEADER_PROBE","label",label,"bytesRead",n,"statSize",stat,
        "hexFirst96",hex.toString(),"asciiFirst96",ascii.toString(),"boxes",scanBoxes(prefix,n));
      return f;
    }catch(Throwable e){log.error("FORMAT","HEADER_PROBE_FAILED_"+label,e);return null;}
    finally{if(fd!=null)try{fd.close();}catch(Exception ignored){}}
  }
  /** Copy only newly-written bytes from Android SAF source into a seekable private
   *  file. FFmpegKit's saf: reader can fail to seek to trailing MP4 moov and
   *  /proc/self/fd is denied under Android 15 scoped storage. Do not log audio.
   */
  /** Jump to the committed source byte, rather than reopening and decoding
   * the preceding M4A on each growth event. Prefer an actual seekable SAF FD;
   * some DocumentsProviders return pipes, in which case preserve the original
   * InputStream.skip() fallback. The caller still only appends new bytes.
   */
  InputStream openMirrorDelta(Uri uri,long offset)throws IOException {
    ParcelFileDescriptor fd=null;
    try{
      fd=context.getContentResolver().openFileDescriptor(uri,"r");
      if(fd!=null && fd.getStatSize()>=0){
        FileInputStream seekable=new FileInputStream(fd.getFileDescriptor());
        try{
          seekable.getChannel().position(offset);
          long actual=seekable.getChannel().position();
          if(actual!=offset)throw new IOException("Seek mismatch: "+actual+" != "+offset);
          log.timing("MIRROR","SOURCE_SEEK","sourceOffset",offset,
            "fileSizeAtOpen",fd.getStatSize(),"method","SAF_FILE_DESCRIPTOR");
          return seekable; // FileInputStream owns the FD after return.
        }catch(Throwable failed){
          try{seekable.close();}catch(Exception ignored){}
          throw new IOException("SAF source FD was not seekable",failed);
        }
      }
    }catch(Throwable unsupported){
      log.event("MIRROR","SOURCE_SEEK_UNSUPPORTED","sourceOffset",offset,
        "error",String.valueOf(unsupported),"fallback","INPUT_STREAM_SKIP");
    }finally{
      // Successful transfer is owned by the FileInputStream; close only a
      // descriptor which was not transferred (e.g. a provider pipe).
      // The transferred descriptor stays alive with the returned stream.
      if(fd!=null && fd.getStatSize()<0)try{fd.close();}catch(Exception ignored){}
    }
    InputStream fallback=context.getContentResolver().openInputStream(uri);
    if(fallback==null)throw new IOException("SAF source InputStream is null");
    try{
      long remaining=offset;
      while(remaining>0){
        long skipped=fallback.skip(remaining);
        if(skipped>0){remaining-=skipped;continue;}
        if(fallback.read()<0)throw new EOFException("SAF stream shorter than cursor: "+remaining);
        remaining--;
      }
      log.timing("MIRROR","SOURCE_SEEK","sourceOffset",offset,
        "method","SAF_INPUT_STREAM_SKIP");
      return fallback;
    }catch(Throwable e){
      try{fallback.close();}catch(Exception ignored){}
      if(e instanceof IOException)throw (IOException)e;
      throw new IOException("SAF skip fallback failed",e);
    }
  }

  synchronized void appendMirror(Uri uri,String label){
    File target=workingMirror;
    if(target==null)return;
    long start=mirroredBytes;
    long begin=SystemClock.elapsedRealtime();
    try{
      long available=-1;
      try{
        DocumentFile doc=DocumentFile.fromSingleUri(context,uri);
        if(doc!=null)available=currentReadableSize(uri,doc.length());
      }catch(Throwable ignored){}
      if(available>=0 && available<mirroredBytes){
        log.event("MIRROR","SOURCE_TRUNCATED","previous",mirroredBytes,"newSize",available);
        try(FileOutputStream truncate=new FileOutputStream(target,false)){}
        mirroredBytes=0;
        nextAacFrameSourceByte=0;
        pendingDeltaPcmBytes=0;
        log.event("CURSOR","RESET_AFTER_SOURCE_TRUNCATION","bytesNow",available);
        start=0;
      }
      if(available>=0 && available==mirroredBytes){
        if("initial".equals(label))log.event("MIRROR","NO_BYTES_AVAILABLE","size",available);
        return;
      }
      try(InputStream in=openMirrorDelta(uri,mirroredBytes)){
        try(FileOutputStream dest=new FileOutputStream(target,true)){
          byte[] buffer=new byte[32768];
          int n;
          long appended=0;
          while((n=in.read(buffer))!=-1){
            if(stop)break;
            if(n<=0)continue;
            dest.write(buffer,0,n);
            appended+=n;
            if(appended>64*1024*1024L)throw new IOException("Diagnostic safety: file grew beyond 64MB in single update");
          }
          dest.flush();
          mirroredBytes+=appended;
          log.timing("FILE","MIRROR_APPENDED","addedBytes",appended,"totalBytes",mirroredBytes,
            "durationMs",SystemClock.elapsedRealtime()-begin);
          log.event("MIRROR","INCREMENT_APPENDED","label",label,"oldOffset",start,
            "bytesAppended",appended,"newOffset",mirroredBytes,
            "sourceSize",available,"elapsedMs",SystemClock.elapsedRealtime()-begin,
            "layout",describeMirrorLayout(target));
        }
      }
    }catch(Throwable e){log.error("MIRROR","INCREMENT_READ_FAILED_"+label,e);}
  }

  static String describeMirrorLayout(File f) {
    StringBuilder result=new StringBuilder();
    try(RandomAccessFile raf=new RandomAccessFile(f,"r")){
      long length=raf.length();
      long pos=0;
      int count=0;
      while(pos+8<=length && count++<20){
        raf.seek(pos);
        int size32=raf.readInt();
        byte[] type=new byte[4];raf.readFully(type);
        String name=new String(type,StandardCharsets.US_ASCII);
        long size=size32&0xffffffffL;
        if(size==1){if(pos+16>length)break;size=raf.readLong();}
        if(size==0)size=length-pos;
        result.append(name).append("@").append(pos).append("+").append(size).append(";");
        if(size<8 || pos+size>length){
          result.append("INCOMPLETE_BOX;");
          break;
        }
        if("moov".equals(name))result.append("MOOV_FOUND;");
        pos+=size;
      }
    }catch(Throwable error){result.append("SCAN_ERROR=").append(error.getMessage());}
    return result.toString();
  }

  static long u32(byte[] a,int off) {
    return ((long)(a[off]&255)<<24)|((long)(a[off+1]&255)<<16)
      |((long)(a[off+2]&255)<<8)|(a[off+3]&255);
  }
  static String scanBoxes(byte[] data,int n){
    StringBuilder b=new StringBuilder();
    int pos=0,limit=0;
    while(pos+8<=n&&limit++<20){
      long size=u32(data,pos);
      String type=new String(data,pos+4,4,StandardCharsets.US_ASCII);
      b.append(pos).append(":").append(type).append(":").append(size).append(";");
      if(size==0){b.append("TO_EOF");break;}
      if(size==1){b.append("EXTENDED_BOX");break;}
      if(size<8 || size>Integer.MAX_VALUE){b.append("BAD_BOX");break;}
      if(pos+size>n){b.append("BOX_EXTENDS_PAST_PROBE");break;}
      pos+=(int)size;
    }
    return b.toString();
  }

  static void little32(OutputStream out,int value)throws IOException{
    out.write(value&255);out.write((value>>8)&255);
    out.write((value>>16)&255);out.write((value>>24)&255);
  }
  File extract(String name,long min)throws Exception {
    File dir=new File(context.getFilesDir(),"sensevoice-int8");
    if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("Cannot create model folder");
    File target=new File(dir,name);
    if(target.length()>=min){log.event("MODEL","REUSING","name",name,"bytes",target.length());return target;}
    log.event("MODEL","EXTRACT_BEGIN","name",name);
    File tmp=new File(dir,name+".partial");
    try(InputStream in=context.getAssets().open("sensevoice/"+name);
        FileOutputStream out=new FileOutputStream(tmp,false)){
      byte[] buffer=new byte[131072];int n;
      while((n=in.read(buffer))!=-1){if(stop)throw new InterruptedException("stop");if(n>0)out.write(buffer,0,n);}
      out.getFD().sync();
    }
    if(tmp.length()<min)throw new IOException("Model truncated: "+name);
    if(target.exists()&&!target.delete())throw new IOException("Cannot replace "+name);
    if(!tmp.renameTo(target))throw new IOException("Cannot move model "+name);
    log.event("MODEL","EXTRACT_END","name",name,"bytes",target.length());
    return target;
  }

  void nativeReader(Process p){
    new Thread(()->{
      try(BufferedReader reader=new BufferedReader(new InputStreamReader(p.getInputStream(),StandardCharsets.UTF_8))){
        String line;
        while((line=reader.readLine())!=null){
          final long receivedNs=SystemClock.elapsedRealtimeNanos();
          if(line.startsWith("ONLINE_TIMING:")){
            try{
              String[] metric=line.split(":",6);
              if(metric.length==6){
                long sampleId=Long.parseLong(metric[2]);
                long audioMs=Long.parseLong(metric[3]);
                long nativeNs=Long.parseLong(metric[4]);
                long durationUs=Long.parseLong(metric[5]);
                log.timingAt(nativeNs,"NATIVE",metric[1],"sampleId",sampleId,
                  "audioEndMs",audioMs,"durationUs",durationUs,
                  "javaReaderLagMs",(receivedNs-nativeNs)/1000000.0);
                if("LIVE".equals(metric[1])){
                  nativeLiveBootNs=nativeNs;
                  nativeLiveAudioMs=audioMs;
                  nativeLiveId=sampleId;
                }
              }
            }catch(RuntimeException e){log.event("NATIVE","TIMING_PARSE_ERROR","line",line,"error",e.toString());}
            continue;
          }
          if(line.startsWith("ONLINE_LIVE:"))
            log.timingAt(receivedNs,"BRIDGE","LIVE_STDOUT_RECEIVED",
              "nativeHypothesisId",nativeLiveId,"nativeBootNs",nativeLiveBootNs,
              "nativeToReaderMs",nativeLiveBootNs>0?(receivedNs-nativeLiveBootNs)/1000000.0:-1);
          log.raw("stt-raw.txt",line);
          log.event("STT","NATIVE_OUTPUT","text",line);
          if(line.startsWith("ONLINE_PRIOR_SEALED:"))
            log.timingAt(receivedNs,"STT","PRIOR_UTTERANCE_SEALED","details",line);
          if(line.startsWith("ONLINE_PRIOR_CONTEXT:"))
            log.timingAt(receivedNs,"STT","FULL_PRIOR_PCM_CONTEXT","details",line);
          if(line.startsWith("ONLINE_CONTEXT_MERGE:"))
            log.timingAt(receivedNs,"STT","FULL_PRIOR_PREFIX_MERGED","details",line);
          if(line.startsWith("ONLINE_CONTEXT_LIVE_MERGE:"))
            log.timingAt(receivedNs,"STT","PRIOR_OVERLAP_LIVE_CORRECTION","details",line);
          if(line.startsWith("ONLINE_READY:")){
            onlineModelReady=true;
            onlineModelReadyLatch.countDown();
            log.event("ONLINE","MODEL_READY","settings",line,
              "prewarmDurationMs",SystemClock.elapsedRealtime()-nativeLaunchElapsed);
            log.timing("MODEL","READY_IN_JAVA","startupMs",SystemClock.elapsedRealtime()-nativeLaunchElapsed);
            callback.onStatus("한국어 STT 모델 준비 완료 · 실시간 인식 가능",transcription);
          }
          if(line.startsWith("ONLINE_LIVE:")){
            String[] latest=line.split(":",3);
            if(latest.length==3){
              String provisional=latest[2].trim();
              if(!provisional.isEmpty()){
                hasLiveHypothesis=true;
                transcription=provisional; // REPLACE, do not append duplicates
                long wall=SystemClock.elapsedRealtime();
                log.event("STT","LIVE_CAPTION","audioMs",latest[1],
                  "publishedElapsedMs",wall,"text",provisional,
                  "confirmed",false);
                log.timing("STT","LIVE_RESULT_TO_SERVICE",
                  "nativeHypothesisId",nativeLiveId,"audioEndMs",nativeLiveAudioMs,
                  "nativeBootNs",nativeLiveBootNs,"chars",provisional.length());
                callback.onStatus("실시간 자막 · 진행 중 인식 (자동 보정)",transcription);
              }
            }
          }
          if(line.startsWith("ONLINE_LIVE_TAIL:")){
            String[] tail=line.split(":",3);
            if(tail.length==3)log.event("STT","LIVE_LAST_2_WORDS",
                "audioMs",tail[1],"text",tail[2]);
          }
          if(line.startsWith("ONLINE_HYPOTHESIS:")){
            String[] on=line.split(":",3);
            if(on.length==3)log.event("ONLINE","HYPOTHESIS",
                "audioMs",on[1],"text",on[2]);
          }
          if(line.startsWith("ONLINE_ACCEPTED:")){
            log.event("ONLINE","PCM_ACCEPTED","details",line);
          }
          if(line.startsWith("ONLINE_REWRITE_SKIPPED:")){
            log.event("ONLINE","REWRITE_SKIPPED","details",line);
          }
          if(line.startsWith("ONLINE_FINISHED:")){
            log.event("ONLINE","FINAL_FLUSH","details",line);
          }
          if(line.startsWith("VAD_READY:")){
            log.event("VAD","MODEL_READY","settings",line.substring("VAD_READY:".length()));
          }
          if(line.startsWith("VAD_SEGMENT:")){
            String[] a=line.split(":",6);
            if(a.length==6){
              log.event("VAD","UTTERANCE_BOUNDARY","utterance",a[1],
                "startMs",a[2],"endMs",a[3],"silenceMs",a[4],
                "priorUtteranceMs",a[5]);
            }
          }
          if(line.startsWith("VAD_CONTEXT:")){
            String[] c=line.split(":",6);
            if(c.length==6){
              log.event("VAD","CONTEXT_AUDIO","utterance",c[1],
                "priorMs",c[2],"silenceMs",c[3],
                "currentMs",c[4],"contextMs",c[5]);
            }
          }
          if(line.startsWith("SHORT_PAUSE:")){
            String[] pauseParts=line.split(":",5);
            if(pauseParts.length==5)log.event("WORD","SHORT_PAUSE","sequence",pauseParts[1],
              "startMs",pauseParts[2],"endMs",pauseParts[3],"durationMs",pauseParts[4]);
          }
          if(line.startsWith("WORD_TIME_MODE:")){
            log.event("WORD","TIMESTAMP_SOURCE","details",line);
          }
          if(line.startsWith("WORD_REWRITE_OVERLAP_SKIPPED:")){
            log.event("WORD","REWRITE_OVERLAP_SKIPPED","details",line);
          }
          if(line.startsWith("WORD_COMMIT:")){
            String[] c=line.split(":",5);
            if(c.length==5)log.event("WORD","COMMITTED","sequence",c[1],
              "startMs",c[2],"endMs",c[3],"source",c[4]);
          }
          if(line.startsWith("WORD_HYPOTHESIS:")){
            String[] h=line.split(":",4);
            if(h.length==4)log.event("WORD","HYPOTHESIS","audioMs",h[1],
              "wordCount",h[2],"text",h[3]);
          }
          if(line.startsWith("VAD_FINAL_CONTEXT_TEXT:")){
            log.event("VAD","FINAL_CONTEXT_ONLY","details",line);
          }
          if(line.startsWith("STT_ALIGNMENT:")){
            String[] a=line.split(":",4);
            if(a.length==4){
              log.event("VAD","CONTEXT_DEDUP","utterance",a[1],
                "method",a[2],"normalizedError",a[3]);
            }
          }
          if(line.startsWith("VAD_FINISHED:")){
            log.event("VAD","FINAL_FLUSH_FINISHED","details",line);
          }
          if(line.startsWith("STT_SEGMENT:")){
            String[] sections=line.split(":",3);
            if(sections.length==3){
              int seq;
              try{seq=Integer.parseInt(sections[1]);}catch(NumberFormatException e){seq=-1;}
              if(!hasLiveHypothesis && !sections[2].trim().isEmpty()){
                transcription+=((transcription.isEmpty())?"":"\n")+sections[2].trim();
              }
              resultCount.incrementAndGet();
              log.event("STT","CAPTION","sequence",seq,"text",sections[2].trim(),
                "accumulatedChars",transcription.length());
              callback.onStatus("STT "+seq+"구간: "+sections[2].trim(),transcription);
            }
          }
        }
      }catch(Throwable t){log.error("STT","NATIVE_OUTPUT_READER_ERROR",t);}
    },"SenseVoice-Native-Stdout").start();
  }
  void nativeStart()throws Exception {
    File executable=new File(context.getApplicationInfo().nativeLibraryDir,"libsensevoice-stream.so");
    log.event("STT","BINARY_PROBE","path",executable.getAbsolutePath(),
      "exists",executable.exists(),"executable",executable.canExecute(),"bytes",executable.length());
    if(!executable.isFile()||!executable.canExecute())
      throw new IOException("ARM64 SenseVoice stream CLI missing");
    File tokens=extract("tokens.txt",1000);
    File encoder=extract("encoder.int8.onnx",1000000);
    File decoder=extract("decoder.int8.onnx",100000);
    File joiner=extract("joiner.int8.onnx",100000);
    ProcessBuilder pb=new ProcessBuilder(executable.getAbsolutePath(),
      tokens.getAbsolutePath(),encoder.getAbsolutePath(),
      decoder.getAbsolutePath(),joiner.getAbsolutePath());
    String old=pb.environment().get("LD_LIBRARY_PATH");
    pb.environment().put("LD_LIBRARY_PATH",context.getApplicationInfo().nativeLibraryDir+
      (old==null?"":":"+old));
    pb.directory(context.getFilesDir());pb.redirectErrorStream(true);
    nativeLaunchElapsed=SystemClock.elapsedRealtime();
    log.timing("MODEL","NATIVE_PROCESS_LAUNCH_BEGIN","launchElapsedMs",nativeLaunchElapsed);
    sherpa=pb.start();
    log.event("STT","NATIVE_START","processAlive",sherpa.isAlive(),
      "startedBeforeRecordingFileDiscovered",true,
      "command",executable.getName()+" [tokens] [zipformer-encoder] [decoder] [joiner]","abi",Arrays.toString(Build.SUPPORTED_ABIS));
    nativeReader(sherpa);
    log.timing("MODEL","NATIVE_PROCESS_LAUNCHED","pidAvailable",Build.VERSION.SDK_INT>=26);
  }

  static String escape(String input){return "\""+input.replace("\\","\\\\").replace("\"","\\\"")+"\"";}
  String directPath(Uri uri){
    try{
      String docId=DocumentsContract.getDocumentId(uri);
      if(docId!=null&&docId.startsWith("primary:")){
        File f=new File("/storage/emulated/0/",docId.substring(8));
        log.event("INPUT","DIRECT_PROBE","path",f.getAbsolutePath(),
          "exists",f.exists(),"read",f.canRead(),"length",f.length());
        if(f.isFile()&&f.canRead())return f.getAbsolutePath();
      }
    }catch(Exception e){log.event("INPUT","NOT_PRIMARY_DOCUMENT","why",String.valueOf(e));}
    return null;
  }
  void processSource(Uri uri)throws Exception {
    if(sherpa==null || !sherpa.isAlive())throw new IOException("Prewarmed online STT process not running");
    // The original v11 race let FFmpeg feed a cold native process. Its stdin
    // blocked while the 174M model loaded for 45s in the emulator; the FFmpeg
    // 25s no-PCM watchdog then aborted the M4A after only 4.07s of PCM.
    // Keep folder/recording discovery and mirroring alive, but do not launch
    // audio decoding until the recognizer has explicitly emitted ONLINE_READY.
    final long gateBegin=SystemClock.elapsedRealtimeNanos();
    log.timingAt(gateBegin,"MODEL","PREWARM_GATE_WAIT_BEGIN","recordingSelected",true);
    boolean signalled=onlineModelReadyLatch.await(100,java.util.concurrent.TimeUnit.SECONDS);
    if(stop){endReason="USER_STOP";return;}
    if(!signalled||!onlineModelReady||sherpa==null||!sherpa.isAlive())
      throw new IOException("174M recognizer did not become ONLINE_READY within 100s");
    final long gateEnd=SystemClock.elapsedRealtimeNanos();
    log.timingAt(gateEnd,"MODEL","PREWARM_GATE_RELEASED",
      "waitDurationMs",(gateEnd-gateBegin)/1000000.0,"nativeAlive",sherpa.isAlive());
    String path=workingMirror==null?null:workingMirror.getAbsolutePath();
    log.event("INPUT","SEEKABLE_PRIVATE_MIRROR_PREFERRED","path",path,
      "sourceUri",uri.toString(),"initialBytes",mirroredBytes);
    ParcelFileDescriptor pfd=null;
    try{
      String alternateInput=null;
      String safInput=null;
      try{
        safInput=FFmpegKitConfig.getSafParameterForRead(context,uri);
        log.event("INPUT","SAF_REGISTERED","safPath",String.valueOf(safInput));
      }catch(Throwable e){log.error("INPUT","SAF_REGISTER_FAILED",e);}
      if(path==null && safInput!=null && !safInput.isEmpty()){
        path=safInput;
        log.event("INPUT","SAF_PREFERRED","input",path,
          "reason","Android 15 /proc/self/fd read denied on original emulator test");
      }else if(path!=null && safInput!=null && !safInput.isEmpty()){
        alternateInput=safInput;
      }
      if(path==null){
        pfd=context.getContentResolver().openFileDescriptor(uri,"r");
        if(pfd==null)throw new IOException("No readable direct file, SAF, or content FD");
        path="/proc/self/fd/"+pfd.getFd();
        log.event("INPUT","PROC_FD_SELECTED","fd",pfd.getFd(),"stat",pfd.getStatSize(),"path",path);
      }else if(path.startsWith("saf:")){
        try {
          pfd=context.getContentResolver().openFileDescriptor(uri,"r");
          if(pfd!=null){
            alternateInput="/proc/self/fd/"+pfd.getFd();
            log.event("INPUT","PROC_FD_SECONDARY","fd",pfd.getFd(),
              "note","For comparison only; /proc/self/fd may be denied on Android 15");
          }
        }catch(Throwable e){log.error("INPUT","PROC_FD_SECONDARY_UNAVAILABLE",e);}
      }
      long initial=SystemClock.elapsedRealtime();
      int attempt=0,failures=0;
      long sizeBefore=-1;
      long processedMirrorBytes=-1;
      StreamingAacPcmDecoder incrementalDecoder=null;
      try {
      while(!stop&&attempt<600){
        // The original Samsung recorder keeps one M4A open. AAC-LC inside its
        // mdat has no ADTS frame headers, while the trailing moov is absent.
        // Recover complete AAC frames from the latest seekable mirror, without
        // ever stopping the recorder or modifying its original file.
        long snapshotBytes=mirroredBytes;
        if(snapshotBytes<1024 || snapshotBytes==processedMirrorBytes){
          Thread.sleep(100);continue;
        }
        File local=workingMirror;
        String layout=local==null?"NO_MIRROR":describeMirrorLayout(local);
        boolean finalMoov=layout.contains("MOOV_FOUND;");
        log.timing("AAC","SNAPSHOT_READY","sourceBytes",snapshotBytes,"finalMoov",finalMoov);
        File adts=new File(context.getCacheDir(),"aac-recovery-"+log.id()+".aac");
        long recoveredDeltaEnd=-1;
        final long deltaStart=nextAacFrameSourceByte;
        if(finalMoov && deltaStart==0){
          // A pre-existing finished file may be AAC at 16kHz/44.1kHz instead
          // of Samsung 48kHz; do not misidentify its raw AAC profile.
          // The incremental cursor applies to a recording detected BEFORE moov.
          adts=null;
          log.event("AAC","FINISHED_FILE_STANDARD_DECODE","sourceBytes",snapshotBytes);
        }else recoveredDeltaEnd=recoverMdatAac(local,adts,snapshotBytes,deltaStart);
        if(recoveredDeltaEnd>deltaStart){
          log.event("AAC","NEW_FRAMES_READY","sourceStart",deltaStart,
            "sourceEnd",recoveredDeltaEnd,"newSourceBytes",recoveredDeltaEnd-deltaStart,
            "adtsBytes",adts.length(),"moovPresent",finalMoov);
        }else if(finalMoov){
          // Finalized MP4 with a codec/sample-rate different from Samsung AAC
          // still supports ordinary FFmpeg decoding. Use this only as fallback;
          // in-progress Samsung AAC MUST NOT be reread from 0 for each growth.
          adts=null;
          log.event("AAC","FINAL_FALLBACK","sourceBytes",snapshotBytes,
            "why","incremental AAC did not return a full new frame");
        }else{
          processedMirrorBytes=snapshotBytes;
          Thread.sleep(100);continue;
        }
        attempt++;
        long before=pcmBytes.get();
        sizeBefore=mirroredBytes;
        // Prefer Android SAF. The /proc/self/fd path was denied by FFmpegKit
        // on Android 15 despite Java ContentResolver permission being valid.
        final boolean useAlternate=alternateInput!=null &&
          !alternateInput.equals(path) && attempt>1 && attempt%4==0;
        String currentInput=adts!=null?adts.getAbsolutePath():(useAlternate?alternateInput:path);
        log.timing("FFMPEG","ATTEMPT_BEGIN","attempt",attempt,"sourceBytes",snapshotBytes);
        log.event("FFMPEG","ATTEMPT_BEGIN","attempt",attempt,"fileSize",sizeBefore,
          "alreadyPcmBytes",before,"source",currentInput,
          "sourceMode",currentInput.startsWith("saf:")?"SAF":"FILE_OR_PROC_FD",
          "alternateAttempt",useAlternate);
        status("FFmpeg 파일 증가분 디코딩 시도 "+attempt+"회 ("+
          (currentInput.startsWith("saf:")?"SAF":"파일 경로")+") · "+display(uri));
        // Full finalized MP4 keeps its existing replay guard. Only a
        // recovered ADTS DELTA skips PCM sent from the same uncommitted delta.
        long replaySkip=adts!=null?pendingDeltaPcmBytes:committedPcmBytes.get();
        log.event("CURSOR","BEFORE_FFMPEG","sourceStart",deltaStart,
          "sourceEnd",recoveredDeltaEnd,"skipPcmBytes",replaySkip,
          "committedAudioMs",committedPcmBytes.get()/32L);
        String result;
        if(adts!=null){
          if(incrementalDecoder==null){
            incrementalDecoder=new StreamingAacPcmDecoder(log);
            continuousAacDecoder=incrementalDecoder;
          }
          final int part=attempt;
          long fed=incrementalDecoder.feed(adts,attempt,pcm->{
            log.timing("PCM","LIVE_DECODER_PCM_FORWARD",
              "attempt",part,"bytes",pcm.length,
              "audioMs",committedPcmBytes.get()/32L);
            sendChunk(pcm,part);
            pcmBytes.addAndGet(pcm.length);
            lastPcm.set(SystemClock.elapsedRealtime());
          });
          result=fed>0?"STREAMING_AAC_ACCEPTED":"STREAMING_AAC_NO_FRAMES";
          log.event("STREAM","AAC_DELTA_ACCEPTED",
            "attempt",attempt,"frames",fed,
            "pcmDelivered",pcmBytes.get()-before,
            "sourceCursorBefore",deltaStart,"sourceCursorNext",recoveredDeltaEnd);
        }else{
          result=consumeOnce(currentInput,attempt,replaySkip);
        }
        if(result.startsWith("FATAL_UNDRAINED_PCM_"))
          throw new IOException("Refusing AAC cursor commit: previous PCM reader was not drained: "+result);
        processedMirrorBytes=snapshotBytes;
        if(adts!=null && adts.exists() && !adts.delete())
          log.event("AAC","TEMP_CLEANUP_FAILED","path",adts.getAbsolutePath());
        long newBytes=pcmBytes.get()-before;
        if(adts!=null){
          if("STREAMING_AAC_ACCEPTED".equals(result) || "FFMPEG_CLEAN_END".equals(result)){
            nextAacFrameSourceByte=recoveredDeltaEnd;
            pendingDeltaPcmBytes=0;
            log.timing("AAC","SOURCE_CURSOR_COMMITTED","sourceByte",nextAacFrameSourceByte,
              "freshPcmBytes",newBytes,"committedAudioMs",committedPcmBytes.get()/32L);
            saveAudioCursorCheckpoint("AAC_DELTA_FFMPEG_CLEAN_END");
          }else{
            pendingDeltaPcmBytes+=newBytes;
            processedMirrorBytes=-1; // repeat from cursor after bounded backoff
            log.event("AAC","DELTA_RETRY_PRESERVED","sourceByte",nextAacFrameSourceByte,
              "pcmAlreadySent",pendingDeltaPcmBytes,"reason",result);
          }
        }
        log.timing("FFMPEG","ATTEMPT_END","attempt",attempt,"reason",result,"freshPcmBytes",newBytes);
        log.event("FFMPEG","ATTEMPT_END","attempt",attempt,"reason",result,
          "newPcmBytes",newBytes,"totalPcmBytes",pcmBytes.get(),
          "sourceByteSizeNow",currentSize);
        if("STOPPED".equals(result)){endReason="USER_STOP";return;}
        if(newBytes>0){
          failures=0;
          if("FFMPEG_CLEAN_END".equals(result)){
            log.event("FFMPEG","CLEAN_EOF_WAIT_FOR_MORE_BYTES","attempt",attempt,
              "note","Mirrored file decoded, STT pending until persistent native process confirms captions");
          }
        }else failures++;
        // Important: partial M4A may not yet have moov. Wait for a size change and
        // retry instead of reporting bogus capture success.
        if(failures>=4 && currentSize==sizeBefore){
          log.event("FFMPEG","NO_DECODABLE_DATA_AFTER_RETRIES",
            "attempt",attempt,"size",currentSize,
            "note","Likely moov atom absent, inaccessible in-progress file, or unsupported SAF follow");
          // Still remain active to detect the next actual change; never spin.
        }
        // A 15-second stable-file sleep is incompatible with immediate
        // call captions when Samsung buffers small AAC frame writes.
        long waitUntil=SystemClock.elapsedRealtime()+STREAM_POLL_MS;
        long prev=currentSize;
        while(!stop && currentSize==prev && SystemClock.elapsedRealtime()<waitUntil){
          Thread.sleep(100);
        }
        if(stop){endReason="USER_STOP";return;}
        if(currentSize!=prev)log.event("FFMPEG","RETRY_AFTER_GROWTH","old",prev,"new",currentSize);
        else log.event("FFMPEG","RETRY_AFTER_STABLE_INTERVAL","size",currentSize);
      }
      endReason=stop?"USER_STOP":"ATTEMPTS_EXHAUSTED";
      }finally{
        if(incrementalDecoder!=null){
          try{
            if(!stop && sherpa!=null && sherpa.isAlive()){
              final int lastAttempt=attempt;
              incrementalDecoder.finish(pcm->{
                sendChunk(pcm,lastAttempt);
                pcmBytes.addAndGet(pcm.length);
              });
            }
          }catch(Throwable e){log.error("STREAM","FINAL_AAC_DRAIN_FAILED",e);}
          finally{
            incrementalDecoder.close();
            continuousAacDecoder=null;
          }
        }
      }
    }finally{
      if(pfd!=null)try{pfd.close();}catch(Exception ignored){}
      Process p=sherpa;
      if(p!=null && p.isAlive()){
        try{OutputStream out=p.getOutputStream();little32(out,0);little32(out,0);out.flush();out.close();}
        catch(Throwable e){log.error("STT","FINAL_EOF_FAILED",e);}
        boolean ended=p.waitFor(18,java.util.concurrent.TimeUnit.SECONDS);
        log.event("STT","NATIVE_PROCESS_END","ended",ended,
          "exitCode",ended?p.exitValue():-1,"resultCount",resultCount.get());
      }
    }
  }

  /** Diagnostic source/audio cursor checkpoint, written only after a
   *  newly recovered AAC delta has finished transmitting to the recognizer.
   *  This records the exact time to resume within the active recording.
   *  A NEW process is not automatically resumed without restoring its
   *  previous speech context; do not silently skip that context.
   */
  void saveAudioCursorCheckpoint(String reason){
    try{
      org.json.JSONObject state=new org.json.JSONObject();
      state.put("sourceUri",activeUri==null?"":activeUri.toString());
      state.put("aacSourceByteCursor",nextAacFrameSourceByte);
      state.put("pcmByteCursor",committedPcmBytes.get());
      state.put("audioTimeMs",committedPcmBytes.get()/32L);
      state.put("pcmChunkSequence",chunkCount.get());
      state.put("sourceSize",mirroredBytes);
      state.put("pendingDeltaPcmBytes",pendingDeltaPcmBytes);
      state.put("lastUpdatedWallEpochMs",System.currentTimeMillis());
      state.put("reason",reason);
      File file=new File(log.dir(),"audio-cursor-checkpoint.json");
      File tmp=new File(log.dir(),"audio-cursor-checkpoint.tmp");
      try(FileOutputStream out=new FileOutputStream(tmp,false)){
        out.write((state.toString()+"\n").getBytes(StandardCharsets.UTF_8));
        out.flush();out.getFD().sync();
      }
      if(file.exists()&&!file.delete())throw new IOException("Cannot replace cursor checkpoint");
      if(!tmp.renameTo(file))throw new IOException("Cannot atomically publish cursor checkpoint");
      log.timing("CURSOR","CHECKPOINT_SAVED",
        "sourceByte",nextAacFrameSourceByte,"audioTimeMs",committedPcmBytes.get()/32L,
        "pcmBytes",committedPcmBytes.get(),"reason",reason);
    }catch(Throwable e){log.error("CURSOR","CHECKPOINT_WRITE_FAILED",e);}
  }

  /** Exact AAC frame boundary recovery verified against original Samsung stsz table.
   * Input is a snapshot of our private SAF mirror, NEVER the original recorder.
   * Each attempt rewrites temporary ADTS; PCM replay guard below only sends fresh PCM.
   */
  long recoverMdatAac(File source,File output,long sourceBytes,long resumeByte) {
    if(source==null || !source.isFile())return -1;
    File binary=new File(context.getApplicationInfo().nativeLibraryDir,"libaac-mdat-recover.so");
    if(!binary.isFile() || !binary.canExecute()){
      log.event("AAC","RECOVER_BINARY_MISSING","path",binary.getAbsolutePath());
      return -1;
    }
    if(output.exists() && !output.delete()){
      log.event("AAC","CANNOT_CLEAR_STALE_ADTS","path",output.getAbsolutePath());
      return -1;
    }
    Process p=null;
    long begin=SystemClock.elapsedRealtime();
    try{
      ProcessBuilder pb=new ProcessBuilder(binary.getAbsolutePath(),source.getAbsolutePath(),
        output.getAbsolutePath(),"48000","1","-",Long.toString(resumeByte));
      pb.redirectErrorStream(true);
      String old=pb.environment().get("LD_LIBRARY_PATH");
      pb.environment().put("LD_LIBRARY_PATH",context.getApplicationInfo().nativeLibraryDir+
        (old==null?"":":"+old));
      p=pb.start();
      // C tool only emits a bounded diagnostic line, never transcribed audio.
      ByteArrayOutputStream diagnostic=new ByteArrayOutputStream();
      try(InputStream in=p.getInputStream()){
        byte[] chunk=new byte[512];int n;
        while((n=in.read(chunk))!=-1){
          if(diagnostic.size()<4096)diagnostic.write(chunk,0,Math.min(n,4096-diagnostic.size()));
        }
      }
      boolean ended=p.waitFor(15,java.util.concurrent.TimeUnit.SECONDS);
      if(!ended){p.destroyForcibly();log.event("AAC","RECOVER_TIMEOUT","ms",15000);return -1;}
      int code=p.exitValue();
      long length=output.exists()?output.length():0;
      String report=diagnostic.toString("UTF-8");
      long nextByte=-1,newFrames=-1;
      java.util.regex.Matcher m=java.util.regex.Pattern.compile(
        "RECOVERY_CURSOR source=(\\d+) next=(\\d+) frames=(\\d+)").matcher(report);
      if(m.find() && Long.parseLong(m.group(1))==resumeByte){
        nextByte=Long.parseLong(m.group(2));
        newFrames=Long.parseLong(m.group(3));
      }
      log.event("AAC","RECOVER_END","exit",code,"mdatBytes",sourceBytes,
        "sourceCursorStart",resumeByte,"sourceCursorNext",nextByte,
        "newFrames",newFrames,"adtsBytes",length,
        "elapsedMs",SystemClock.elapsedRealtime()-begin,
        "details",report.replace("\\n"," ").trim());
      return code==0 && length>=100 && nextByte>resumeByte?nextByte:-1;
    }catch(Throwable e){
      log.error("AAC","RECOVERY_FAILED",e);
      return -1;
    }finally{if(p!=null && p.isAlive())p.destroyForcibly();}
  }

  String consumeOnce(String input,int attempt,long alreadyDelivered){
    fifo=null;
    FFmpegSession session=null;
    final AtomicBoolean complete=new AtomicBoolean(false);
    final AtomicInteger returnCode=new AtomicInteger(Integer.MIN_VALUE);
    long begin=SystemClock.elapsedRealtime();
    log.timing("FFMPEG","START_COMMAND","attempt",attempt);
    long previousPcm=pcmBytes.get();
    String termination="UNKNOWN";
    final AtomicBoolean readerDone=new AtomicBoolean(false);
    final AtomicBoolean readerFailed=new AtomicBoolean(false);
    final AtomicLong readerProgressAt=new AtomicLong(begin);
    final AtomicLong ffmpegCompletedAt=new AtomicLong(0);
    Thread fifoReader=null;
    try {
      fifo=FFmpegKitConfig.registerNewFFmpegPipe(context);
      if(fifo==null)throw new IOException("FFmpegKit pipe registration failed");
      final String chosenPipe=fifo;
      log.event("PIPE","FIFO_CREATED","path",fifo);
      // Following a seekable finalized MP4 can deadlock at EOF; file growth
      // is handled by pollChanges + appendMirror + repeat demux with PCM cursor.
      final boolean followSupportedInput=false;
      String cmd="-y -hide_banner -loglevel repeat+level+info -nostdin "+
        (followSupportedInput?"-follow 1 ":"")+
        "-probesize 262144 -analyzeduration 2000000 "+
        "-i "+escape(input)+" -map 0:a:0 -vn -ac 1 -ar 16000 -c:a pcm_s16le "+
        "-f s16le -flush_packets 1 "+escape(chosenPipe);
      log.event("FFMPEG","COMMAND","command",cmd,"attempt",attempt,
        "followOptionEnabled",followSupportedInput,
        "safUsesRepeatedSnapshotReads",!followSupportedInput);
      ffmpeg=FFmpegKit.executeAsync(cmd,
        result->{
          int code=result.getReturnCode()==null?Integer.MIN_VALUE:result.getReturnCode().getValue();
          returnCode.set(code);
          complete.set(true);
          ffmpegCompletedAt.set(SystemClock.elapsedRealtime());
          log.event("FFMPEG","EXECUTE_COMPLETE","code",code,"state",String.valueOf(result.getState()),
            "failStack",String.valueOf(result.getFailStackTrace()),"durationMs",SystemClock.elapsedRealtime()-begin);
        },
        line->{
          String raw=line.getMessage();
          log.raw("ffmpeg-raw.txt","attempt="+attempt+" "+raw);
          log.event("FFMPEG","AV_LOG","attempt",attempt,"level",String.valueOf(line.getLevel()),
            "text",raw);
        },
        stat->{
          log.event("FFMPEG","STATS","attempt",attempt,"time",stat.getTime(),
            "size",stat.getSize(),"bitrate",stat.getBitrate(),"speed",stat.getSpeed());
        });
      session=ffmpeg;
      fifoReader=new Thread(()->{
        byte[] temp=new byte[8192];
        long replayBytesRemaining=alreadyDelivered;
        log.event("PIPE","REPLAY_GUARD_ACTIVE","attempt",attempt,"skipAlreadyProcessedPcmBytes",replayBytesRemaining);
        ByteArrayOutputStream pcmWindow=new ByteArrayOutputStream(WINDOW_BYTES+8192);
        int lowByte=-1;
        try(InputStream in=new FileInputStream(chosenPipe)){
          log.event("PIPE","FIFO_READ_OPEN","attempt",attempt);
          while(!stop){
            int n=in.read(temp);
            if(n<0){log.event("PIPE","FIFO_EOF","attempt",attempt);break;}
            if(n==0)continue;
            readerProgressAt.set(SystemClock.elapsedRealtime());
            int offset=0;
            if(replayBytesRemaining>0){
              int skip=(int)Math.min((long)n,replayBytesRemaining);
              replayBytesRemaining-=skip;
              offset=skip;
              if(skip>0 && replayBytesRemaining==0)
                log.event("PIPE","REPLAY_SKIP_COMPLETED","attempt",attempt,
                  "bytesSkipped",alreadyDelivered,"newAudioResumesNow",true);
              if(offset==n)continue;
            }
            int fresh=n-offset;
            long pcmArrivalNs=SystemClock.elapsedRealtimeNanos();
            long total=pcmBytes.addAndGet(fresh);
            log.timingAt(pcmArrivalNs,"PCM","NEW_BYTES_FROM_FFMPEG",
              "attempt",attempt,"freshBytes",fresh,"totalPcmBytes",total);
            lastPcm.set(SystemClock.elapsedRealtime());
            pcmWindow.write(temp,offset,fresh);
            if(total==fresh || total%65536<fresh){
              log.event("PCM","BUFFER_READ","attempt",attempt,"bytes",fresh,"totalReadBytes",total,
                "totalSeconds",total/32000.0,"queuedBytes",pcmWindow.size());
            }
            while(pcmWindow.size()>=WINDOW_BYTES){
              byte[] buffered=pcmWindow.toByteArray();
              byte[] current=Arrays.copyOfRange(buffered,0,WINDOW_BYTES);
              pcmWindow.reset();
              pcmWindow.write(buffered,WINDOW_BYTES,buffered.length-WINDOW_BYTES);
              sendChunk(current,attempt);
              readerProgressAt.set(SystemClock.elapsedRealtime());
            }
          }
          // Flush trailing complete PCM (down to 32ms); an incomplete VAD
          // window is carried inside the native process across all snapshots.
          if(pcmWindow.size()>=2 && !stop){
            byte[] buffered=pcmWindow.toByteArray();
            if((buffered.length&1)==1)buffered=Arrays.copyOf(buffered,buffered.length-1);
            sendChunk(buffered,attempt);
            readerProgressAt.set(SystemClock.elapsedRealtime());
          }
        }catch(Throwable t){
          readerFailed.set(true);
          log.error("PIPE","FIFO_READ_OR_STT_WRITE_FAILURE",t);
        }finally{
          readerDone.set(true);
          log.event("PIPE","READER_STOPPED","attempt",attempt,"totalBytes",pcmBytes.get());
        }
      },"FFmpeg-PCM-Consumer-"+attempt);
      fifoReader.start();
      // Never advance the AAC source cursor until FFmpeg AND the PCM
      // consumer have both fully finished. Previously this returned success
      // 3.5 seconds after FFmpeg exit even if the consumer was still writing
      // to the slow 174M recognizer, allowing two readers to interleave.
      while(!stop){
        if(complete.get() && readerDone.get()){
          termination=readerFailed.get()?"FIFO_READER_FAILED":"FFMPEG_EXIT_AND_FIFO_DRAINED";
          break;
        }
        long now=SystemClock.elapsedRealtime();
        long lastProgress=Math.max(readerProgressAt.get(),lastPcm.get());
        long idleMs=now-Math.max(begin,lastProgress);
        if(complete.get()&&!readerDone.get()){
          long completedAt=ffmpegCompletedAt.get();
          if(completedAt>0 && now-completedAt>120000){
            termination="FIFO_DRAIN_TIMEOUT";
            log.event("PIPE","READER_DRAIN_TIMEOUT",
              "attempt",attempt,"afterFfmpegMs",now-completedAt,
              "pcmBytes",pcmBytes.get(),"readerDone",readerDone.get());
            break;
          }
        }else if(idleMs>90000){
          termination="NO_PCM_OR_READER_PROGRESS_90_SECONDS";
          log.event("FFMPEG","WATCHDOG_NO_READER_PROGRESS","attempt",attempt,
            "idleMs",idleMs,"ffmpegCompleted",complete.get(),
            "readerDone",readerDone.get(),"pcmBytes",pcmBytes.get());
          break;
        }
        Thread.sleep(100);
      }
      if(stop)termination="STOPPED";
      boolean drained=readerDone.get();
      if(drained && !readerFailed.get() && complete.get() && returnCode.get()==0){
        log.timing("PIPE","READER_DRAIN_ACKNOWLEDGED","attempt",attempt,
          "totalPcmBytes",pcmBytes.get(),
          "durationMs",SystemClock.elapsedRealtime()-begin);
      }else{
        log.event("PIPE","READER_DRAIN_NOT_CONFIRMED","attempt",attempt,
          "termination",termination,"readerDone",drained,
          "readerFailed",readerFailed.get(),"ffmpegCompleted",complete.get(),
          "ffmpegExit",returnCode.get());
      }
      if(!complete.get() && ffmpeg!=null)FFmpegKit.cancel(ffmpeg.getSessionId());
      if(!drained){
        releasePipeReader(chosenPipe);
        if(fifoReader!=null)fifoReader.join(10000);
      }
      log.event("FFMPEG","SESSION_RESULT","attempt",attempt,"exit",returnCode.get(),
        "termination",termination,"readerDone",readerDone.get(),
        "readerFailed",readerFailed.get(),
        "addedPcm",pcmBytes.get()-previousPcm,
        "captions",resultCount.get(),"durationMs",SystemClock.elapsedRealtime()-begin);
      boolean clean=complete.get() && returnCode.get()==0 &&
        readerDone.get() && !readerFailed.get() && !stop;
      if(clean)return "FFMPEG_CLEAN_END";
      if(!readerDone.get() || readerFailed.get())
        return "FATAL_UNDRAINED_PCM_"+termination;
      return termination;
    }catch(Throwable e){
      log.error("FFMPEG","ATTEMPT_EXCEPTION",e);
      return stop?"STOPPED":"EXCEPTION_"+e.getClass().getSimpleName();
    }finally{
      if(session!=null)FFmpegKit.cancel(session.getSessionId());
      if(fifo!=null){
        if(!readerDone.get())releasePipeReader(fifo);
        FFmpegKitConfig.closeFFmpegPipe(fifo);
      }
      fifo=null;ffmpeg=null;
    }
  }

  void releasePipeReader(String namedPipe){
    // A writer connecting to a FIFO unblocks reader's open(). A reader that is
    // already actively reading is released by cancellation of FFmpeg's writer.
    new Thread(()->{
      try(FileOutputStream out=new FileOutputStream(namedPipe)){out.flush();}
      catch(Throwable ignored){}
    },"FIFO-Rescue-Writer").start();
  }
  void sendChunk(byte[] pcm,int attempt)throws Exception{
    if(stop)return;
    Process p=sherpa;
    if(p==null||!p.isAlive())throw new IOException("SenseVoice native process exited");
    int samples=pcm.length/2;
    int seq=chunkCount.incrementAndGet();
    double sum=0,peak=0,nonzero=0;
    for(int i=0;i+1<pcm.length;i+=2){
      int lo=pcm[i]&255,hi=pcm[i+1]<<8;
      short value=(short)(hi|lo);
      double f=value/32768.0;
      sum+=f*f;
      peak=Math.max(peak,Math.abs(f));
      if(value!=0)nonzero++;
    }
    double rms=Math.sqrt(sum/Math.max(1,samples));
    if(rms>=0.018){
      loudChunks++;quietChunks=0;
      if(!activeEnergyBurst && loudChunks>=2){
        activeEnergyBurst=true;
        log.timing("PCM","ENERGY_ONSET_CANDIDATE","seq",seq,"rms",rms,
          "audioOffsetMs",committedPcmBytes.get()/32L,
          "warning","acoustic energy threshold; NOT verified caller speech onset");
      }
    }else{
      quietChunks++;loudChunks=0;
      if(quietChunks>=3)activeEnergyBurst=false;
    }
    log.event("PCM","CHUNK_TO_STT","segment",seq,"attempt",attempt,"transportOnly",true,"samples",samples,
      "durationSec",samples/16000.0,"rms",rms,
      "peak",peak,"nonzeroPct",100.0*nonzero/Math.max(1,samples));
    OutputStream out=p.getOutputStream();
    long writeBeginNs=SystemClock.elapsedRealtimeNanos();
    log.timingAt(writeBeginNs,"PCM","PIPE_WRITE_BEGIN","seq",seq,"attempt",attempt,
      "samples",samples,"audioEndMs",(committedPcmBytes.get()+pcm.length)/32L,"rms",rms);
    little32(out,seq);little32(out,samples);out.write(pcm);out.flush();
    long writeEndNs=SystemClock.elapsedRealtimeNanos();
    committedPcmBytes.addAndGet(pcm.length);
    lastPcm.set(SystemClock.elapsedRealtime());
    log.timingAt(writeEndNs,"PCM","PIPE_WRITE_END","seq",seq,"attempt",attempt,
      "audioEndMs",committedPcmBytes.get()/32L,
      "writeDurationMs",(writeEndNs-writeBeginNs)/1000000.0);
    // One status update per second avoids UI broadcasts for every 200ms PCM packet.
    if(seq%5==0)callback.onStatus("PCM 입력 "+String.format(Locale.US,"%.1f",pcmBytes.get()/32000.0)+
      "초 / 온라인 인식 중 ("+seq+"번째 입력)",transcription);
  }
}
