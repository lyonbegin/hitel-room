package app.hitel.speakeronly;

import android.content.Context;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Durable, local-only event diary for diagnosis of protected Samsung in-progress recordings. */
public final class TraceJournal {
  private final Context context;
  private final File directory;
  private final File events;
  private final LatencyTrace latency;
  private static volatile TraceJournal activeJournal;
  private final long started=SystemClock.elapsedRealtime();
  private final SimpleDateFormat iso=new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ",Locale.US);
  private final String runId;
  private int lines=0;
  private String lastUI="";
  private Listener listener;

  public interface Listener { void line(String text); }
  public TraceJournal(Context app){
    context=app.getApplicationContext();
    runId=new SimpleDateFormat("yyyyMMdd-HHmmss",Locale.US).format(new Date())+"-"+SystemClock.elapsedRealtime();
    directory=new File(context.getFilesDir(),"diagnostics/run-"+runId);
    if(!directory.exists()&&!directory.mkdirs())throw new IllegalStateException("Cannot create diagnosis directory: "+directory);
    events=new File(directory,"events.jsonl");
    latency=new LatencyTrace(directory);
    activeJournal=this;
    event("APP","SESSION_START",map("runId",runId,"device",Build.MANUFACTURER+" / "+Build.MODEL,
      "android",Build.VERSION.SDK_INT,"brand",Build.BRAND,"abi",Arrays.toString(Build.SUPPORTED_ABIS),
      "appId",context.getPackageName(),"elapsedRealtime",started));
  }
  public String id(){return runId;}
  public File dir(){return directory;}
  public void timing(String stage,String name,Object... pairs){latency.add(stage,name,map(pairs));}
  public void timingAt(long bootNs,String stage,String name,Object... pairs){latency.at(bootNs,stage,name,map(pairs));}
  public static void uiTiming(long bootNs,String stage,String name,Object... pairs){
    TraceJournal journal=activeJournal;
    if(journal!=null)journal.timingAt(bootNs,stage,name,pairs);
  }
  public synchronized void listener(Listener value){listener=value;}
  public static Map<String,Object> map(Object... values){
    Map<String,Object> result=new LinkedHashMap<>();
    for(int i=0;i+1<values.length;i+=2)result.put(String.valueOf(values[i]),values[i+1]);
    return result;
  }
  private static String safe(Object value){return value==null?"null":String.valueOf(value);}
  public synchronized void event(String category,String name,Map<String,Object> details){
    JSONObject object=new JSONObject();
    try{
      long eventBootNs=SystemClock.elapsedRealtimeNanos();
      long wallMs=System.currentTimeMillis();
      object.put("timestamp",iso.format(new Date(wallMs)));
      object.put("wall_epoch_ms",wallMs);
      object.put("boot_ns",eventBootNs);
      object.put("elapsed_ms",SystemClock.elapsedRealtime()-started);
      object.put("thread",Thread.currentThread().getName());
      object.put("category",category);
      object.put("event",name);
      object.put("data",new JSONObject(details));
      String row=object.toString()+"\n";
      try(FileOutputStream out=new FileOutputStream(events,true)){
        out.write(row.getBytes(StandardCharsets.UTF_8));out.flush();
      }
      lines++;
      String ui="+"+(SystemClock.elapsedRealtime()-started)+"ms ["+category+"] "+name+" "+details;
      Log.i("GrowingM4aDiag",ui);
      lastUI=ui;
      if(listener!=null)listener.line(ui);
    }catch(Throwable error){Log.e("GrowingM4aDiag","Cannot log "+name,error);}
  }
  public void event(String category,String name,Object... data){event(category,name,map(data));}
  public void error(String category,String name,Throwable ex){
    StringWriter writer=new StringWriter();ex.printStackTrace(new PrintWriter(writer));
    event(category,name,map("type",ex.getClass().getName(),"message",safe(ex.getMessage()),
      "stacktrace",writer.toString()));
  }
  public synchronized void raw(String basename,String data){
    try(FileOutputStream out=new FileOutputStream(new File(directory,basename),true)){
      out.write((data+"\n").getBytes(StandardCharsets.UTF_8));
    }catch(Exception e){event("JOURNAL","RAW_WRITE_FAILED","filename",basename,"error",safe(e));}
  }
  public void diagnosticSummary(){
    event("APP","RUN_SUMMARY","eventCount",lines,"lastUI",lastUI,"runtimeMs",SystemClock.elapsedRealtime()-started);
    timing("APP","TIMELINE_SUMMARY","droppedEvents",latency.lost(),"note","no speech-onset ground truth without an external synchronized microphone");
    latency.close();
  }
  public synchronized void exportZip(OutputStream target)throws IOException {
    zipDirectory(directory,target,runId);
  }

  /**
   * Publish complete, verifiable ZIP to the user's regular Downloads folder.
   * User does NOT need to choose a destination in ACTION_CREATE_DOCUMENT.
   * Works with MediaStore.Downloads from Android 10 (API29) onward.
   * Unlike logcat, all diagnostic events are already persisted under
   * files/diagnostics/run-<id>; publication makes them user-accessible.
   */
  public static String saveToDownloads(Context context,String id)throws IOException {
    if(id==null||id.trim().isEmpty())throw new IOException("No diagnostic session ID");
    File dir=new File(context.getFilesDir(),"diagnostics/run-"+id);
    File events=new File(dir,"events.jsonl");
    if(!events.isFile())throw new IOException("Diagnostic events file not found: "+events);
    if(Build.VERSION.SDK_INT<29)
      throw new IOException("Direct Download export requires Android 10+; choose a ZIP destination on older Android");
    String filename="Galaxy-16kHz-AudioRoute-"+id+".zip";
    ContentResolver resolver=context.getContentResolver();
    ContentValues cv=new ContentValues();
    cv.put(MediaStore.MediaColumns.DISPLAY_NAME,filename);
    cv.put(MediaStore.MediaColumns.MIME_TYPE,"application/zip");
    cv.put(MediaStore.MediaColumns.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS);
    cv.put(MediaStore.MediaColumns.IS_PENDING,1);
    Uri uri=resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,cv);
    if(uri==null)throw new IOException("Cannot create Downloads record for "+filename);
    boolean complete=false;
    try{
      try(OutputStream out=resolver.openOutputStream(uri,"w")){
        if(out==null)throw new IOException("Cannot write Downloads ZIP stream");
        zipDirectory(dir,out,id);
      }
      ContentValues published=new ContentValues();
      published.put(MediaStore.MediaColumns.IS_PENDING,0);
      if(resolver.update(uri,published,null,null)<1)
        throw new IOException("Cannot publish ZIP in Downloads");
      complete=true;
      return "Download/"+filename;
    }finally{
      if(!complete)resolver.delete(uri,null,null);
    }
  }
  public static void zipDirectory(File directory,OutputStream target,String runId)throws IOException {
    // Flush all writes before packaging. ZIP is created and saved on device, never uploaded.
    try(ZipOutputStream zip=new ZipOutputStream(target,StandardCharsets.UTF_8)){
      zip.setLevel(6);
      byte[] buf=new byte[32768];
      File[] files=directory.listFiles();
      if(files!=null)for(File f:files){
        if(!f.isFile())continue;
        zip.putNextEntry(new ZipEntry(f.getName()));
        try(InputStream in=new FileInputStream(f)){
          int count;while((count=in.read(buf))!=-1){if(count>0)zip.write(buf,0,count);}
        }
        zip.closeEntry();
      }
      zip.putNextEntry(new ZipEntry("README.txt"));
      zip.write(("Growing Samsung call-recording M4A diagnostics.\n"+
        "LOCAL DEVICE DIAGNOSIS, does not prove native telephony audio capture.\n"+
        "events.jsonl: timestamped structured diagnostics, file growth, file header probes, FFmpeg output, PCM chunks, native STT.\n"+
        "latency-trace.jsonl: boot_ns CLOCK_BOOTTIME stage times, PCM delivery, native decode, broadcasts and UI frame callbacks.\n"+
        "ENERGY_ONSET_CANDIDATE is acoustic energy, NOT a proven time the caller started speaking. UI_NEXT_FRAME_CALLBACK does NOT prove actual display scanout.\n"+
        "ffmpeg-raw.txt: native FFmpeg log, stt-raw.txt: Sherpa-ONNX native process output.\n"+
        "May contain local file names, paths and transcripts. Share only after reviewing.\n"+
        "Run ID: "+runId+"\n").getBytes(StandardCharsets.UTF_8));
      zip.closeEntry();
    }
  }
}
