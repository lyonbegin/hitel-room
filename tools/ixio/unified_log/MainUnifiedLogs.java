package com.lguplus.aicallagent.hitelqa;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** One-click MAIN+RECORDER diagnostic ZIP, with explicit missing-system-logcat notice. */
public final class MainUnifiedLogs {
    private static final Uri REMOTE=Uri.parse("content://com.lguplus.callrecorder.hitelqa.trace/recorder.gz");
    private static final int MAX_RECORDER=12*1024*1024;
    private static final int CLIP_LIMIT=150000;
    private static volatile boolean running;
    private MainUnifiedLogs(){}

    private static String stamp(){
        return new SimpleDateFormat("yyyyMMdd_HHmmss",Locale.KOREA).format(new Date());
    }
    private static String failure(Throwable e){
        return e.getClass().getSimpleName()+(e.getMessage()==null?"":(" "+e.getMessage().replace('\n',' ')));
    }
    private static void toast(Activity a,String s){
        a.runOnUiThread(()->{
            try{Toast.makeText(a,s,Toast.LENGTH_LONG).show();}catch(Throwable ignored){}
        });
    }
    private static String recorder(Context c)throws IOException {
        try(InputStream source=c.getContentResolver().openInputStream(REMOTE)) {
            if(source==null)throw new IOException("RECORDER_PROVIDER_OPEN_RETURNED_NULL");
            try(GZIPInputStream gzip=new GZIPInputStream(source);
                ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
                byte[] data=new byte[32768];int n;
                while((n=gzip.read(data))!=-1){
                    if(bytes.size()+n>MAX_RECORDER)throw new IOException("RECORDER_TRACE_EXCEEDS_12MB");
                    bytes.write(data,0,n);
                }
                String result=new String(bytes.toByteArray(),StandardCharsets.UTF_8);
                if(!result.startsWith("HITEL IXIO RECORDER INTERNAL TRACE"))
                    throw new IOException("RECORDER_UNEXPECTED_TRACE_FORMAT");
                return result;
            }
        }
    }
    private static void entry(ZipOutputStream zip,String name,String text)throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(text.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
    private static final class Save {
        final String filename;
        final Uri uri;
        Save(String file,Uri ref){filename=file;uri=ref;}
    }
    private static Save save(Context c,String file,String main,String rec,String summary)throws IOException {
        ContentResolver resolver=c.getContentResolver();
        if(Build.VERSION.SDK_INT<29)throw new IOException("DOWNLOADS_MEDIASTORE_REQUIRES_API_29");
        ContentValues values=new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME,file);
        values.put(MediaStore.Downloads.MIME_TYPE,"application/zip");
        values.put(MediaStore.Downloads.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS+"/IXIO_Logs");
        values.put(MediaStore.Downloads.IS_PENDING,1);
        Uri uri=resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);
        if(uri==null)throw new IOException("MEDIASTORE_INSERT_FAILED");
        boolean success=false;
        try(OutputStream dest=resolver.openOutputStream(uri)) {
            if(dest==null)throw new IOException("MEDIASTORE_OUTPUT_NULL");
            try(ZipOutputStream zip=new ZipOutputStream(dest)){
                entry(zip,"00_README_STATUS.txt",summary);
                entry(zip,"01_IXIO_MAIN_INTERNAL_TRACE.txt",main);
                entry(zip,"02_IXIO_RECORDER_INTERNAL_TRACE.txt",rec);
                entry(zip,"03_ANDROID_SYSTEM_LOGCAT_NOT_INCLUDED.txt",
                    "Not accessible to unprivileged third-party Android apps. "+
                    "To include ActivityManager, SecurityException, AndroidRuntime, FGS, and binder/system logs, "+
                    "collect adb logcat -b all -v threadtime on the PC. "+
                    "This ZIP does not falsely claim system logcat was captured.\n");
            }
            success=true;
        }catch(Throwable e){
            resolver.delete(uri,null,null);
            if(e instanceof IOException)throw (IOException)e;
            throw new IOException(failure(e));
        }finally{
            if(success){
                ContentValues ready=new ContentValues();
                ready.put(MediaStore.Downloads.IS_PENDING,0);
                resolver.update(uri,ready,null,null);
            }
        }
        return new Save(file,uri);
    }
    private static String clipboard(String text,String summary,String filename){
        try {
            byte[] raw=text.getBytes(StandardCharsets.UTF_8);
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(GZIPOutputStream gz=new GZIPOutputStream(bytes)){gz.write(raw);}
            String encoded=Base64.encodeToString(bytes.toByteArray(),Base64.NO_WRAP);
            String result="HITEL IXIO UNIFIED / TRACE_ENCODING=GZIP_BASE64\n"
               +"UNCOMPRESSED_CHARACTERS="+text.length()+"\nTRACE_GZIP_BASE64="+encoded;
            if(result.length()<=CLIP_LIMIT)return result;
        }catch(Throwable ignored){}
        return "HITEL IXIO UNIFIED LOGS SAVED AS ZIP\n"+summary
             +"\nFULL_LOG_NOT_IN_CLIPBOARD_TOO_LARGE=true\n"
             +"UPLOAD_ZIP_FROM=Download/IXIO_Logs/"+filename+"\n";
    }
    private static void copy(Activity a){
        synchronized(MainUnifiedLogs.class){
            if(running){toast(a,"이미 로그를 수집 중입니다.");return;}
            running=true;
        }
        toast(a,"메인·녹음 앱 로그를 함께 수집합니다.");
        new Thread(()->{
            try {
                DiagLog.event("UI","UNIFIED_LOG_EXPORT_BEGIN");
                String main=DiagLog.snapshot();
                String rec;
                boolean recorderOk;
                String detail;
                try{
                    rec=recorder(a.getApplicationContext());
                    recorderOk=true;
                    detail="RECORDER_PROVIDER_STREAM_OK";
                }catch(Throwable e){
                    recorderOk=false;
                    detail="RECORDER_PROVIDER_UNAVAILABLE "+failure(e);
                    rec=detail+"\nRecorder trace is NOT present in this bundle.\n";
                    DiagLog.event("UI","UNIFIED_RECORDER_UNAVAILABLE type="+e.getClass().getSimpleName());
                }
                String file="IXIO_ALL_LOGS_"+stamp()+".zip";
                String summary="IXIO UNIFIED LOG COLLECTION\n"
                        +"MAIN_LOG=OK chars="+main.length()+"\n"
                        +"RECORDER_LOG="+(recorderOk?"OK":"FAILED")+" chars="+rec.length()+"\n"
                        +"RECORDER_DETAIL="+detail+"\n"
                        +"SYSTEM_LOGCAT=NOT_ACCESSIBLE_FROM_UNPRIVILEGED_APP\n"
                        +"GENERATED="+stamp()+"\n";
                Save saved=save(a.getApplicationContext(),file,main,rec,summary);
                String combined=summary+"\n=== MAIN APP LOG ===\n"+main+
                                 "\n=== RECORDER APP LOG ===\n"+rec;
                String clip=clipboard(combined,summary,file);
                final boolean recorderCaptured=recorderOk;
                a.runOnUiThread(()->{
                    try{
                        ClipboardManager cb=(ClipboardManager)a.getSystemService(Context.CLIPBOARD_SERVICE);
                        if(cb!=null)cb.setPrimaryClip(ClipData.newPlainText("IXIO 메인·녹음 통합 로그",clip));
                        Toast.makeText(a,(recorderCaptured?"두 앱 로그 저장 완료":"메인 로그 저장·녹음 앱 연결 실패")
                            +"\n다운로드/IXIO_Logs/"+file,Toast.LENGTH_LONG).show();
                    }catch(Throwable t){android.util.Log.w("IXIO_UNIFIED_LOGS","CLIPBOARD_ERROR "+failure(t));}
                });
                DiagLog.event("UI","UNIFIED_LOG_EXPORT_COMPLETED recorder="+recorderOk+" file="+file);
            }catch(Throwable e){
                DiagLog.event("UI","UNIFIED_LOG_EXPORT_FAILED "+e.getClass().getSimpleName());
                toast(a,"로그 수집 실패: "+failure(e));
            }finally {running=false;}
        },"IXIO-Unified-Log-Collect").start();
    }

    private static void clear(Activity a){
        new Thread(()->{
            boolean main=DiagLog.clear();
            boolean rec=false;
            try{
                Bundle b=a.getContentResolver().call(REMOTE,"clear",null,null);
                rec=b!=null && b.getBoolean("ok",false);
            }catch(Throwable t){
                android.util.Log.w("IXIO_UNIFIED_LOGS","REMOTE_CLEAR_FAILED "+failure(t));
            }
            final boolean mainOk=main,recOk=rec;
            toast(a,"메인 로그 "+(mainOk?"삭제":"실패")+
                     " / 녹음 로그 "+(recOk?"삭제":"실패 또는 녹음 앱 미설치"));
        },"IXIO-Unified-Log-Clear").start();
    }

    public static void show(Activity a){
        if(a==null||a.isFinishing())return;
        try {
            String t=DiagLog.snapshot();
            String preview=t.length()>2100?"…메인 앱 최근 기록…\n"+t.substring(t.length()-2100):t;
            new AlertDialog.Builder(a)
                .setTitle("IXIO 메인·통화녹음 통합 로그")
                .setMessage("통화 전 로그 지우기 → 통화 후 전체 로그 저장·복사.\n"
                    +"녹음 앱의 로그는 별도 보안 통로로 가져오며, 저장 결과에 포함 여부를 표시합니다.\n"
                    +"Android 시스템 전체 로그는 PC ADB 수집이 필요합니다.\n\n"+preview)
                .setNegativeButton("닫기",(d,w)->{})
                .setNeutralButton("두 앱 로그 지우기",(d,w)->clear(a))
                .setPositiveButton("전체 로그 저장·복사",(d,w)->copy(a))
                .show();
            DiagLog.event("UI","UNIFIED_LOG_DIALOG_OPENED");
        }catch(Throwable e){DiagLog.event("UI","UNIFIED_LOG_DIALOG_FAILED "+e.getClass().getSimpleName());}
    }
}
