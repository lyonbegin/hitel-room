package app.hitel.samsungprobe;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Independent durable recorder for playback-capture STT.
 * LabStore only exports completed W03 sessions; unlike that mechanism this
 * file records every SpeakerPlaybackCaptureService status while the UI is
 * backgrounded, before W03 starts, and after any W03 export.
 * Does not record raw audio or private text from other applications, only
 * diagnostics and any speech text already surfaced in the HITEL UI.
 */
public final class SpeakerCaptureLog {
    private static final String TAG="HITEL-SPEAKER-DIAG";
    private static final String LOG_NAME="speaker-capture-events.log";
    private static final long MAX_LOG_BYTES=4L*1024L*1024L;
    private static final Object LOCK=new Object();
    private SpeakerCaptureLog(){}

    public static void append(Context context,String type,String message){
        String now=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS",Locale.US)
            .format(new Date());
        String line=now+" | "+sanitize(type)+" | "+
            sanitize(message)+"\n";
        synchronized(LOCK){
            File output=new File(context.getFilesDir(),LOG_NAME);
            try {
                if(output.length()>=MAX_LOG_BYTES){
                    File older=new File(context.getFilesDir(),LOG_NAME+".previous");
                    if(older.exists()&&!older.delete())
                        Log.w(TAG,"could not remove older log");
                    if(!output.renameTo(older))
                        Log.w(TAG,"could not rotate capture log");
                }
                try(FileOutputStream out=new FileOutputStream(output,true)){
                    out.write(line.getBytes(StandardCharsets.UTF_8));
                    out.getFD().sync();
                }
            }catch(IOException error){
                Log.e(TAG,"diagnostic log write failed",error);
            }
        }
        Log.i(TAG,line.trim());
    }

    private static String sanitize(String text){
        if(text==null)return "";
        return text.replace('\n',' ').replace('\r',' ').replace('|','/');
    }

    public static String exportToDownloads(Context context) throws IOException {
        synchronized(LOCK){
            String name="HITEL14_SPEAKER_STT_LOG_"+
                new SimpleDateFormat("yyyyMMdd_HHmmss",Locale.US).format(new Date())+
                ".zip";
            if(Build.VERSION.SDK_INT>=29){
                ContentResolver resolver=context.getContentResolver();
                ContentValues cv=new ContentValues();
                cv.put(MediaStore.MediaColumns.DISPLAY_NAME,name);
                cv.put(MediaStore.MediaColumns.MIME_TYPE,"application/zip");
                cv.put(MediaStore.MediaColumns.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS);
                cv.put(MediaStore.MediaColumns.IS_PENDING,1);
                Uri uri=resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,cv);
                if(uri==null)throw new IOException("Downloads MediaStore insert returned null");
                boolean completed=false;
                try{
                    try(OutputStream output=resolver.openOutputStream(uri)){
                        if(output==null)throw new IOException("Cannot open ZIP for writing");
                        writeZip(context,output);
                    }
                    ContentValues done=new ContentValues();
                    done.put(MediaStore.MediaColumns.IS_PENDING,0);
                    if(resolver.update(uri,done,null,null)<1)
                        throw new IOException("Could not publish finished ZIP in Downloads");
                    completed=true;
                    return "다운로드/"+name;
                }finally{
                    if(!completed)resolver.delete(uri,null,null);
                }
            }
            File folder=context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if(folder==null)throw new IOException("external app files unavailable");
            if(!folder.isDirectory()&&!folder.mkdirs())
                throw new IOException("Cannot create export directory");
            File zip=new File(folder,name);
            try(FileOutputStream out=new FileOutputStream(zip)){writeZip(context,out);}
            return zip.getAbsolutePath();
        }
    }

    private static void copyFile(ZipOutputStream out,File source,String zipName)
        throws IOException {
        if(source==null||!source.isFile())return;
        out.putNextEntry(new ZipEntry(zipName));
        try(FileInputStream in=new FileInputStream(source)){
            byte[] buffer=new byte[32768];int n;
            while((n=in.read(buffer))!=-1)out.write(buffer,0,n);
        }
        out.closeEntry();
    }

    private static void writeZip(Context context,OutputStream output)
        throws IOException {
        try(ZipOutputStream zip=new ZipOutputStream(output)){
            File dir=context.getFilesDir();
            File log=new File(dir,LOG_NAME);
            if(!log.isFile())append(context,"EXPORT","No earlier speaker capture log; current export requested");
            copyFile(zip,new File(dir,LOG_NAME+".previous"),"speaker_capture_previous.log");
            copyFile(zip,new File(dir,LOG_NAME),"speaker_capture_events.log");
            try{
                File w03=LabStore.logFile(context);
                copyFile(zip,w03,"w03_events.jsonl");
            }catch(Throwable error){
                Log.w(TAG,"optional LabStore W03 copy unavailable",error);
                zip.putNextEntry(new ZipEntry("w03_unavailable.txt"));
                zip.write(("Existing W03 log is unavailable: "+error)
                    .getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
            zip.putNextEntry(new ZipEntry("README.txt"));
            String info="HITEL14 playback capture diagnostics\n"+
                "Installed package: "+context.getPackageName()+"\n"+
                "Android SDK: "+Build.VERSION.SDK_INT+"\n"+
                "Note: selecting this HITEL14 app as the captured application "+
                "does not create any source audio. Only MEDIA/GAME/UNKNOWN "+
                "audio actually played by that app is capturable. Telephone "+
                "call voice is protected from third-party playback capture.\n"+
                "SPEAKER_STT_STATUS and RMS=0 indicate no capturable source audio.\n"+
                "This ZIP intentionally does not contain raw call recordings.\n";
            zip.write(info.getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
    }
}
