package app.hitel.samsungprobe;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import org.json.JSONObject;

/**
 * V23-only export. Save button produces ONE fixed latest ZIP in Downloads.
 * Earlier ZIPs with the same name are removed; earlier events are excluded
 * from subsequent exports using the persisted last-successful-save marker.
 * No V22 diagnostic classes are modified.
 */
final class V23FreshLogExport {
    private static final String FILE="HITEL14_LATEST_STT_LOG.zip";
    private static final String PREF="hitel_v23_latest_zip";
    private static final Object LOCK=new Object();
    private V23FreshLogExport(){}

    static String save(Context c)throws IOException {
        synchronized(LOCK){
            final long prior=c.getSharedPreferences(PREF,Context.MODE_PRIVATE)
                .getLong("lastSuccessMs",0L);
            final long cutoff=System.currentTimeMillis();
            ContentResolver resolver=c.getContentResolver();
            // Remove the former public ZIP, not the files currently being written
            // by active recognizers. No potentially active session directory is deleted.
            String selection=MediaStore.MediaColumns.DISPLAY_NAME+"=?";
            try(Cursor cursor=resolver.query(MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                new String[]{MediaStore.MediaColumns._ID},selection,
                new String[]{FILE},null)){
                if(cursor==null)throw new IOException("기존 다운로드 ZIP 조회 실패");
                while(cursor.moveToNext()){
                    Uri priorUri=android.content.ContentUris.withAppendedId(
                        MediaStore.Downloads.EXTERNAL_CONTENT_URI,cursor.getLong(0));
                    if(resolver.delete(priorUri,null,null)!=1)
                        throw new IOException("이전 ZIP 삭제 실패: "+priorUri);
                }
            }
            ContentValues values=new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME,FILE);
            values.put(MediaStore.MediaColumns.MIME_TYPE,"application/zip");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS+"/");
            values.put(MediaStore.MediaColumns.IS_PENDING,1);
            Uri uri=resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);
            if(uri==null)throw new IOException("새 다운로드 ZIP 생성 실패");
            boolean complete=false;
            try{
                try(OutputStream out=resolver.openOutputStream(uri,"w")){
                    if(out==null)throw new IOException("ZIP 쓰기 스트림 생성 실패");
                    try(ZipOutputStream zip=new ZipOutputStream(out,StandardCharsets.UTF_8)){
                        writeCurrentEvents(c,zip,prior,cutoff);
                    }
                }
                ContentValues published=new ContentValues();
                published.put(MediaStore.MediaColumns.IS_PENDING,0);
                if(resolver.update(uri,published,null,null)<1)
                    throw new IOException("새 ZIP 게시 실패");
                boolean events=false;
                try(InputStream input=resolver.openInputStream(uri);
                    ZipInputStream zip=new ZipInputStream(input,StandardCharsets.UTF_8)){
                    ZipEntry entry;
                    while((entry=zip.getNextEntry())!=null){
                        if("speaker_current.log".equals(entry.getName())){
                            events=true;
                            break;
                        }
                    }
                }
                if(!events)throw new IOException("새 ZIP 읽기 검증 실패");
                c.getSharedPreferences(PREF,Context.MODE_PRIVATE)
                    .edit().putLong("lastSuccessMs",cutoff).commit();
                complete=true;
                return "다운로드/"+FILE+" (이전 ZIP 교체 완료)";
            }finally{
                if(!complete)resolver.delete(uri,null,null);
            }
        }
    }

    private static void writeCurrentEvents(Context context, ZipOutputStream zip,
                                           long since,long until)throws IOException {
        File root=context.getFilesDir();
        putFiltered(zip,new File(root,"speaker-capture-events.log"),
            "speaker_current.log",since,until,false);
        File w03=null;
        try{w03=LabStore.logFile(context);}catch(Throwable ignored){}
        putFiltered(zip,w03,"w03_current.jsonl",since,until,true);
        File diagnostics=new File(root,"diagnostics");
        File[] sessions=diagnostics.listFiles();
        if(sessions!=null){
            for(File session:sessions){
                if(!session.isDirectory()||!session.getName().startsWith("run-"))
                    continue;
                File direct=new File(session,"events.jsonl");
                if(direct.isFile() && direct.lastModified()>=since){
                    // Record lines are timestamp-filtered per successful save.
                    putFiltered(zip,direct,session.getName()+"/events.jsonl",
                        since,until,true);
                }
            }
        }
        zip.putNextEntry(new ZipEntry("README.txt"));
        zip.write(("HITEL14 V23 latest-only diagnostics\n"+
            "Prior ZIP with this filename was removed before writing.\n"+
            "Only new timestamped records since the prior successful export are included.\n"+
            "No original call audio or PCM files are included.\n"+
            "Source run files in use are not deleted.\n"+
            "Window: "+since+" .. "+until+"\n").getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private static void putFiltered(ZipOutputStream zip,File file,String entry,
                                    long since,long until,boolean json)throws IOException{
        zip.putNextEntry(new ZipEntry(entry));
        if(file!=null&&file.isFile()){
            SimpleDateFormat fmt=new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS",Locale.US);
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(
                    new FileInputStream(file),StandardCharsets.UTF_8))){
                String line;
                while((line=reader.readLine())!=null){
                    long t=0L;
                    if(json){
                        try{
                            JSONObject event=new JSONObject(line);
                            t=event.optLong("wall_epoch_ms",
                              event.optLong("timestamp_ms",0L));
                            if(t==0L){
                                String iso=event.optString("timestamp","");
                                if(iso.length()>=23)
                                    t=fmt.parse(iso.substring(0,23).replace('T',' ')).getTime();
                            }
                        }catch(Exception ignored){}
                    }else{
                        try{
                            if(line.length()>=23)t=fmt.parse(line.substring(0,23)).getTime();
                        }catch(Exception ignored){}
                    }
                    if(t==0L){
                        // Unknown timestamp format: include only on the first export.
                        if(since>0L)continue;
                    }else if(t<=since||t>until)continue;
                    zip.write((line+"\n").getBytes(StandardCharsets.UTF_8));
                }
            }
        }
        zip.closeEntry();
    }
}
