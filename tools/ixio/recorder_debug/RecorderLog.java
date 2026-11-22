package com.lguplus.callrecorder.hitelqa;

import android.content.Context;
import android.os.Build;
import android.os.Process;
import android.os.SystemClock;
import android.util.Log;
import android.util.Base64;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.HashMap;

/** Recovered original recorder app QA; no audio, tokens, phone numbers or text. */
public final class RecorderLog {
    private static final String TAG="HITEL_RECORDER_TRACE";
    private static final String FULL="hitel_recorder_flow.txt";
    private static final String KEY="hitel_recorder_critical.txt";
    private static final int LIMIT=2097152;
    private static Context app;
    private static long sequence;
    private static final HashMap<String,Integer> hotCounts=new HashMap<>();
    private RecorderLog(){}
    public static synchronized void initialize(Context c) {
        if(c==null)return;
        try{
            Context a=c.getApplicationContext();
            app=a==null?c:a;
            write("RECORDER_PROCESS_INIT sdk="+Build.VERSION.SDK_INT);
        }catch(Throwable t){Log.w(TAG,"INIT_FAILED "+t.getClass().getSimpleName());}
    }
    public static synchronized void mark(String label) {write(label);}
    public static synchronized void hot(String label) {
        // Never do per-buffer synchronous disk writes on real-time PCM paths.
        int n=hotCounts.containsKey(label)?hotCounts.get(label)+1:1;
        hotCounts.put(label,n);
        if(n==1 || n%100==0)write(label+" observed="+n);
    }
    private static String safeObject(Object value){
        if(value==null)return "null";
        if(value instanceof Boolean)return "boolean="+value;
        return "type="+value.getClass().getName();
    }
    public static synchronized void markInt(String label,int value){write(label+" value="+value);}
    public static synchronized void markObject(String label,Object value){write(label+" "+safeObject(value));}
    public static synchronized void hotInt(String label,int value){
        int n=hotCounts.containsKey(label)?hotCounts.get(label)+1:1;
        hotCounts.put(label,n);
        if(n==1 || n%100==0)write(label+" value="+value+" observed="+n);
    }
    public static synchronized void hotObject(String label,Object value){
        int n=hotCounts.containsKey(label)?hotCounts.get(label)+1:1;
        hotCounts.put(label,n);
        if(n==1 || n%100==0)write(label+" "+safeObject(value)+" observed="+n);
    }
    public static synchronized void error(int first,int second) {
        write("RECORDER_ON_ERROR code1="+first+" code2="+second);
    }
    private static File path(String name){
        try{return app==null?null:new File(app.getFilesDir(),name);}
        catch(Throwable t){return null;}
    }
    private static boolean important(String label) {
        return label.contains("onTransact") || label.contains("onStarted")
            || label.contains("onError") || label.contains("onCompleted")
            || label.contains("startRecording") || label.contains("onBind")
            || label.contains("CALLBACK") || label.contains("CATCH") || label.contains("THROW")
            || label.contains("RECORDER_ON_ERROR") || label.contains("PROCESS_INIT")
            || label.contains("UI_RECORDER") || label.contains("STATE_WRITE") || label.contains("STATE_VALUE")
            || label.contains("CALL_ARG") || label.contains("SharedPreferences") || label.contains("DataStore")
            || label.contains("onCheckedChanged") || label.contains("onClick") || label.contains("Switch");
    }
    private static void append(File f,String row)throws java.io.IOException {
        if(f==null)return;
        if(f.length()>LIMIT){
            File old=new File(f.getParentFile(),f.getName()+".old");
            if(old.exists())old.delete();
            f.renameTo(old);
        }
        try(FileOutputStream out=new FileOutputStream(f,true)){
            out.write((row+"\n").getBytes(StandardCharsets.UTF_8));
        }
    }
    private static void write(String text){
        if(text==null)return;
        try {
            text=text.replace('\n',' ').replace('\r',' ').replace('\t',' ');
            if(text.length()>300)text=text.substring(0,300);
            String time=new SimpleDateFormat("MM-dd HH:mm:ss.SSS",Locale.KOREA).format(new Date());
            String row=time+" #"+(++sequence)+" pid="+Process.myPid()+" tid="+Process.myTid()
                 +" elapsedMs="+SystemClock.elapsedRealtime()+" [RECORDER] "+text;
            Log.i(TAG,row);
            append(path(FULL),row);
            if(important(text))append(path(KEY),row);
        }catch(Throwable t){Log.w(TAG,"TRACE_WRITE_FAILED "+t.getClass().getSimpleName());}
    }
    private static String read(File f){
        if(f==null || !f.isFile())return "";
        try(FileInputStream in=new FileInputStream(f)){
            byte[] data=new byte[(int)Math.min(f.length(),LIMIT+4096)];int n=0,r;
            while(n<data.length && (r=in.read(data,n,data.length-n))>0)n+=r;
            return new String(data,0,n,StandardCharsets.UTF_8);
        }catch(Throwable t){return "[TRACE_READ_FAILED "+t.getClass().getSimpleName()+"]\n";}
    }
    public static synchronized String snapshot(){
        return "HITEL IXIO RECORDER INTERNAL TRACE\nAndroid "+Build.VERSION.SDK_INT
          +" PID="+Process.myPid()+" PACKAGE=com.lguplus.callrecorder TRACE_SCHEMA=RECORDER_SETTINGS_V2\n=== IMPORTANT EVENTS ===\n"
          +read(path(KEY+".old"))+read(path(KEY))
          +"\n=== RECENT FULL EVENTS ===\n"+read(path(FULL+".old"))+read(path(FULL));
    }
    public static synchronized String copy(){
        String s=snapshot();if(s.length()<200000)return s;
        try{
            java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();
            try(java.util.zip.GZIPOutputStream zip=new java.util.zip.GZIPOutputStream(bytes)){
                zip.write(s.getBytes(StandardCharsets.UTF_8));
            }
            return "HITEL IXIO RECORDER INTERNAL TRACE / TRACE_ENCODING=GZIP_BASE64\n"
              +"UNCOMPRESSED_CHARACTERS="+s.length()+"\nTRACE_GZIP_BASE64="
              +Base64.encodeToString(bytes.toByteArray(),Base64.DEFAULT);
        }catch(Throwable t){return s;}
    }
    public static synchronized boolean clear(){
        boolean ok=app!=null;
        for(String name:new String[]{FULL,FULL+".old",KEY,KEY+".old"}){
            File f=path(name);if(f!=null && f.exists() && !f.delete())ok=false;
        }
        hotCounts.clear();if(ok)write("UI_RECORDER_LOG_CLEARED PACKAGE=com.lguplus.callrecorder");return ok;
    }
}
