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
  volatile boolean hasOnlineHypothesis=false;
  volatile long modelReadyElapsedMs=0;
  volatile Uri activeUri;
  volatile File workingMirror;
  volatile long mirroredBytes=0;
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
  // Send PCM to persistent Zipformer online recognizer every 100ms (not 500ms).
  // This is a transport flush only; model maintains its own 640ms chunk-16 state.
  static final int WINDOW_SAMPLES=1600;
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
    log.event("CONTROL","ENGINE_START","inputUri",String.valueOf(given),"folderMode",directoryMode,
      "targetAbi",Arrays.toString(Build.SUPPORTED_ABIS));
    try{
      // Warm 174M ASR BEFORE waiting for the first recording file.
      // The earlier v8 launched it only AFTER detecting the M4A and thus
      // incurred 13.79s of avoidable start-of-call silence on Galaxy Flip3.
      nativeStart();
      log.event("LATENCY","MODEL_PREWARM_LAUNCHED","note",
        "Start monitoring before call; recognizer loads while waiting for recording");
      status("한국어 STT 준비 중 · 통화 전 감시를 시작해 주십시오.");
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
        log.event("FOLDER","ACTIVE_FILE_DETECTED","name",growing.getName(),
          "size",growing.length(),"uri",growing.getUri().toString());
        status("증가하는 녹음 파일 감지: "+growing.getName());
        return growing.getUri();
      }
      Thread.sleep(250);
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
          if(lastSize>=0&&n>lastSize){observedGrowthBytes+=n-lastSize;fileChangeCount++;}
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
      try{Thread.sleep(180);}catch(InterruptedException e){break;}
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
        start=0;
      }
      if(available>=0 && available==mirroredBytes){
        if("initial".equals(label))log.event("MIRROR","NO_BYTES_AVAILABLE","size",available);
        return;
      }
      try(InputStream in=context.getContentResolver().openInputStream(uri)){
        if(in==null)throw new IOException("SAF source InputStream is null");
        long remaining=mirroredBytes;
        while(remaining>0){
          long skipped=in.skip(remaining);
          if(skipped>0){remaining-=skipped;continue;}
          if(in.read()<0)break;
          remaining--;
        }
        if(remaining>0){
          throw new EOFException("SAF stream shorter than mirrored cursor; missing="+remaining);
        }
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
          log.raw("stt-raw.txt",line);
          log.event("STT","NATIVE_OUTPUT","text",line);
          if(line.startsWith("ONLINE_READY:")){
            modelReadyElapsedMs=SystemClock.elapsedRealtime();
            log.event("ONLINE","MODEL_READY","settings",line,
              "modelReadyElapsedRealtimeMs",modelReadyElapsedMs);
            callback.onStatus("한국어 STT 모델 준비 완료 · 음성 감시 중",transcription);
          }
          if(line.startsWith("ONLINE_HYPOTHESIS:")){
            String[] on=line.split(":",3);
            if(on.length==3){
              log.event("ONLINE","HYPOTHESIS","audioMs",on[1],"text",on[2]);
              final String live=on[2].trim();
              // Do NOT gate screen updates on immutable-prefix word
              // commits. Android log showed 36 ONLINE_REWRITE_PENDING while
              // the model already recognized the full spoken sentence.
              // Provisional recognition is replaceable; corrections appear
              // in-place instead of blocking all future captions.
              if(!live.isEmpty()){
                hasOnlineHypothesis=true;
                transcription=live;
                String[] words=live.split("\\s+");
                String tail=words.length<=2?live:
                  words[words.length-2]+" "+words[words.length-1];
                long displayAt=SystemClock.elapsedRealtime();
                log.event("LATENCY","LIVE_HYPOTHESIS_VISIBLE","audioMs",on[1],
                    "elapsedRealtimeMs",displayAt,"tail",tail,
                    "recognizedChars",live.length());
                callback.onStatus("실시간 임시 자막: "+tail,live);
              }
            }
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
              if(!sections[2].trim().isEmpty()){
                if(!hasOnlineHypothesis)
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
    Process ready=PrewarmedRecognizer.acquire(context,5000);
    if(ready!=null){
      sherpa=ready;
      log.event("STT","PREWARM_PROCESS_REUSED","processAlive",sherpa.isAlive(),
        "warmupState",PrewarmedRecognizer.state());
      nativeReader(sherpa);
      return;
    }
    log.event("STT","PREWARM_FALLBACK","warmupState",PrewarmedRecognizer.state());
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
    sherpa=pb.start();
    log.event("STT","NATIVE_START","processAlive",sherpa.isAlive(),
      "command",executable.getName()+" [tokens] [zipformer-encoder] [decoder] [joiner]","abi",Arrays.toString(Build.SUPPORTED_ABIS));
    nativeReader(sherpa);
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
    // nativeStart() ran before file selection, ensuring call audio never
    // triggers expensive 174M model extraction or process initialization.
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
      while(!stop&&attempt<600){
        // The original Samsung recorder keeps one M4A open. AAC-LC inside its
        // mdat has no ADTS frame headers, while the trailing moov is absent.
        // Recover complete AAC frames from the latest seekable mirror, without
        // ever stopping the recorder or modifying its original file.
        long snapshotBytes=mirroredBytes;
        if(snapshotBytes<1024 || snapshotBytes==processedMirrorBytes){
          Thread.sleep(350);continue;
        }
        File local=workingMirror;
        String layout=local==null?"NO_MIRROR":describeMirrorLayout(local);
        boolean finalMoov=layout.contains("MOOV_FOUND;");
        File adts=null;
        if(!finalMoov){
          adts=new File(context.getCacheDir(),"aac-recovery-"+log.id()+".aac");
          if(!recoverMdatAac(local,adts,snapshotBytes)){
            processedMirrorBytes=snapshotBytes;
            Thread.sleep(350);
            continue;
          }
          log.event("AAC","LIVE_PREFIX_READY","inputBytes",snapshotBytes,
            "adtsBytes",adts.length(),"moovPresent",false);
        }else{
          log.event("AAC","FINAL_MOOV_FOUND","inputBytes",snapshotBytes,
            "note","Fallback to finalized original M4A for consistency");
        }
        attempt++;
        long before=pcmBytes.get();
        sizeBefore=mirroredBytes;
        // Prefer Android SAF. The /proc/self/fd path was denied by FFmpegKit
        // on Android 15 despite Java ContentResolver permission being valid.
        final boolean useAlternate=alternateInput!=null &&
          !alternateInput.equals(path) && attempt>1 && attempt%4==0;
        String currentInput=adts!=null?adts.getAbsolutePath():(useAlternate?alternateInput:path);
        log.event("FFMPEG","ATTEMPT_BEGIN","attempt",attempt,"fileSize",sizeBefore,
          "alreadyPcmBytes",before,"source",currentInput,
          "sourceMode",currentInput.startsWith("saf:")?"SAF":"FILE_OR_PROC_FD",
          "alternateAttempt",useAlternate);
        status("FFmpeg 파일 증가분 디코딩 시도 "+attempt+"회 ("+
          (currentInput.startsWith("saf:")?"SAF":"파일 경로")+") · "+display(uri));
        String result=consumeOnce(currentInput,attempt);
        processedMirrorBytes=snapshotBytes;
        if(adts!=null && adts.exists() && !adts.delete())
          log.event("AAC","TEMP_CLEANUP_FAILED","path",adts.getAbsolutePath());
        long newBytes=pcmBytes.get()-before;
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
        long waitUntil=SystemClock.elapsedRealtime()+(attempt==1 && alternateInput!=null?1000:15000);
        long prev=currentSize;
        while(!stop && currentSize==prev && SystemClock.elapsedRealtime()<waitUntil){
          Thread.sleep(800);
        }
        if(stop){endReason="USER_STOP";return;}
        if(currentSize!=prev)log.event("FFMPEG","RETRY_AFTER_GROWTH","old",prev,"new",currentSize);
        else log.event("FFMPEG","RETRY_AFTER_STABLE_INTERVAL","size",currentSize);
      }
      endReason=stop?"USER_STOP":"ATTEMPTS_EXHAUSTED";
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

  /** Exact AAC frame boundary recovery verified against original Samsung stsz table.
   * Input is a snapshot of our private SAF mirror, NEVER the original recorder.
   * Each attempt rewrites temporary ADTS; PCM replay guard below only sends fresh PCM.
   */
  boolean recoverMdatAac(File source,File output,long sourceBytes) {
    if(source==null || !source.isFile())return false;
    File binary=new File(context.getApplicationInfo().nativeLibraryDir,"libaac-mdat-recover.so");
    if(!binary.isFile() || !binary.canExecute()){
      log.event("AAC","RECOVER_BINARY_MISSING","path",binary.getAbsolutePath());
      return false;
    }
    if(output.exists() && !output.delete()){
      log.event("AAC","CANNOT_CLEAR_STALE_ADTS","path",output.getAbsolutePath());
      return false;
    }
    Process p=null;
    long begin=SystemClock.elapsedRealtime();
    try{
      ProcessBuilder pb=new ProcessBuilder(binary.getAbsolutePath(),source.getAbsolutePath(),
        output.getAbsolutePath(),"48000","1");
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
      if(!ended){p.destroyForcibly();log.event("AAC","RECOVER_TIMEOUT","ms",15000);return false;}
      int code=p.exitValue();
      long length=output.exists()?output.length():0;
      log.event("AAC","RECOVER_END","exit",code,"mdatBytes",sourceBytes,
        "adtsBytes",length,"elapsedMs",SystemClock.elapsedRealtime()-begin,
        "details",diagnostic.toString("UTF-8").replace("\\n"," ").trim());
      return code==0 && length>=100;
    }catch(Throwable e){
      log.error("AAC","RECOVERY_FAILED",e);
      return false;
    }finally{if(p!=null && p.isAlive())p.destroyForcibly();}
  }

  String consumeOnce(String input,int attempt){
    fifo=null;
    FFmpegSession session=null;
    final AtomicBoolean complete=new AtomicBoolean(false);
    final AtomicInteger returnCode=new AtomicInteger(Integer.MIN_VALUE);
    long begin=SystemClock.elapsedRealtime();
    long previousPcm=pcmBytes.get();
    String termination="UNKNOWN";
    final AtomicBoolean readerDone=new AtomicBoolean(false);
    final AtomicBoolean writerDone=new AtomicBoolean(false);
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
      final long alreadyDelivered=committedPcmBytes.get();
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
            long total=pcmBytes.addAndGet(fresh);
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
            }
          }
          // Flush trailing complete PCM (down to 32ms); an incomplete VAD
          // window is carried inside the native process across all snapshots.
          if(pcmWindow.size()>=1024 && !stop){
            byte[] buffered=pcmWindow.toByteArray();
            if((buffered.length&1)==1)buffered=Arrays.copyOf(buffered,buffered.length-1);
            sendChunk(buffered,attempt);
          }
        }catch(Throwable t){
          log.error("PIPE","FIFO_READ_OR_STT_WRITE_FAILURE",t);
        }finally{
          readerDone.set(true);
          log.event("PIPE","READER_STOPPED","attempt",attempt,"totalBytes",pcmBytes.get());
        }
      },"FFmpeg-PCM-Consumer-"+attempt);
      fifoReader.start();
      while(!stop){
        if(complete.get()&&readerDone.get()){termination="FFMPEG_EXIT";break;}
        if(complete.get() && SystemClock.elapsedRealtime()-begin>3500){
          termination="FFMPEG_EXIT_FIFO_WAIT";break;
        }
        long last=lastPcm.get();
        long idleMs=last==0?SystemClock.elapsedRealtime()-begin:SystemClock.elapsedRealtime()-last;
        if(idleMs>25000){
          termination="NO_PCM_FOR_25_SECONDS";
          log.event("FFMPEG","WATCHDOG_NO_PCM","attempt",attempt,
            "noOutputMs",idleMs,"inputFileSize",currentSize,
            "ffmpegCompleted",complete.get(),"pcmBytes",pcmBytes.get());
          break;
        }
        Thread.sleep(400);
      }
      if(stop)termination="STOPPED";
      log.event("FFMPEG","SESSION_STOP_REQUESTED","attempt",attempt,"why",termination,
        "sessionId",ffmpeg.getSessionId());
      FFmpegKit.cancel(ffmpeg.getSessionId());
      releasePipeReader(chosenPipe);
      if(fifoReader!=null)fifoReader.join(1700);
      log.event("FFMPEG","SESSION_RESULT","attempt",attempt,"exit",returnCode.get(),
        "termination",termination,"addedPcm",pcmBytes.get()-previousPcm,
        "captions",resultCount.get(),"durationMs",SystemClock.elapsedRealtime()-begin);
      return complete.get() && returnCode.get()==0?"FFMPEG_CLEAN_END":termination;
    }catch(Throwable e){
      log.error("FFMPEG","ATTEMPT_EXCEPTION",e);
      return stop?"STOPPED":"EXCEPTION_"+e.getClass().getSimpleName();
    }finally{
      if(session!=null)FFmpegKit.cancel(session.getSessionId());
      if(fifo!=null){
        releasePipeReader(fifo);
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
    log.event("PCM","CHUNK_TO_STT","segment",seq,"attempt",attempt,"transportOnly",true,"samples",samples,
      "durationSec",samples/16000.0,"rms",Math.sqrt(sum/Math.max(1,samples)),
      "peak",peak,"nonzeroPct",100.0*nonzero/Math.max(1,samples));
    OutputStream out=p.getOutputStream();
    little32(out,seq);little32(out,samples);out.write(pcm);out.flush();
    committedPcmBytes.addAndGet(pcm.length);
    callback.onStatus("PCM 입력 "+String.format(Locale.US,"%.1f",pcmBytes.get()/32000.0)+
      "초 / VAD 음성 분석 중 ("+seq+"번째 입력)",transcription);
  }
}
