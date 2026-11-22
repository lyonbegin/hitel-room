package com.lguplus.callrecorder.hitelqa;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Binder;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.os.Process;
import java.io.FileNotFoundException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.GZIPOutputStream;

/**
 * Temporary, package-checked QA bridge; not a production API.
 * Exposes ONLY the recorder's already-existing RecorderLog.snapshot() on a pipe.
 * No microphone, telephony, signing, FGS or application lifecycle methods changed.
 */
public final class RecorderTraceProvider extends ContentProvider {
    public static final String AUTHORITY="com.lguplus.callrecorder.hitelqa.trace";
    private static final String MAIN="com.lguplus.aicallagent";

    @Override public boolean onCreate() {
        RecorderLog.initialize(getContext());
        RecorderLog.mark("UNIFIED_PROVIDER_READY");
        return true;
    }

    private boolean allowed() {
        try {
            final int uid=Binder.getCallingUid();
            if(uid==Process.myUid())return true;
            final PackageManager pm=getContext().getPackageManager();
            final String[] packages=pm.getPackagesForUid(uid);
            if(packages!=null)for(String pkg:packages)if(MAIN.equals(pkg))return true;
        } catch(Throwable ignored){}
        return false;
    }

    private void ensureCaller() throws FileNotFoundException {
        if(!allowed())throw new FileNotFoundException("UNIFIED_TRACE_CALLER_DENIED");
    }

    @Override public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException {
        ensureCaller();
        if(!"r".equals(mode) || uri==null || !"/recorder.gz".equals(uri.getPath()))
            throw new FileNotFoundException("UNIFIED_TRACE_PATH_UNSUPPORTED");
        final ParcelFileDescriptor[] pipe;
        try {pipe=ParcelFileDescriptor.createPipe();}
        catch(Exception e){throw new FileNotFoundException("UNIFIED_TRACE_PIPE_FAILED");}
        new Thread(() -> {
            try(OutputStream os=new ParcelFileDescriptor.AutoCloseOutputStream(pipe[1]);
                GZIPOutputStream gz=new GZIPOutputStream(os)) {
                RecorderLog.mark("UNIFIED_PROVIDER_EXPORT_BEGIN");
                byte[] text=RecorderLog.snapshot().getBytes(StandardCharsets.UTF_8);
                gz.write(text);
                RecorderLog.mark("UNIFIED_PROVIDER_EXPORT_WRITTEN bytes="+text.length);
            }catch(Throwable t){
                RecorderLog.mark("UNIFIED_PROVIDER_EXPORT_FAILED type="+t.getClass().getSimpleName());
                try{pipe[1].close();}catch(Exception ignored){}
            }
        },"IXIO-Recorder-QA-Stream").start();
        return pipe[0];
    }

    @Override public Bundle call(String method,String arg,Bundle extras){
        if(!allowed())throw new SecurityException("UNIFIED_TRACE_CALLER_DENIED");
        Bundle result=new Bundle();
        if("clear".equals(method)){
            boolean ok=RecorderLog.clear();
            result.putBoolean("ok",ok);
            return result;
        }
        if("ping".equals(method)){
            result.putBoolean("ok",true);
            return result;
        }
        throw new IllegalArgumentException("UNIFIED_TRACE_METHOD_UNSUPPORTED");
    }

    @Override public String getType(Uri uri){return "application/gzip";}
    @Override public Cursor query(Uri uri,String[] projection,String selection,String[] args,String sort){return null;}
    @Override public Uri insert(Uri uri,ContentValues v){throw new UnsupportedOperationException();}
    @Override public int update(Uri uri,ContentValues v,String where,String[] args){throw new UnsupportedOperationException();}
    @Override public int delete(Uri uri,String where,String[] args){throw new UnsupportedOperationException();}
}
