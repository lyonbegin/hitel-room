package com.lguplus.aicallagent.hitelqa;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;
import android.widget.Toast;
import android.os.Handler;
import android.os.Looper;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

/** Non-invasive on-device export of the models already downloaded by IXIO.
 * Called ONLY after the original FileUnzipWorker has completed successfully.
 * Model download, unpacking, login, recorder and STT remain unchanged.
 * Never uploads anything to GitHub, a network server or a third party.
 */
public final class ModelZipExporter {
  private static final String TAG="IXIO_MODEL_EXPORT";
  private static final String DIR=Environment.DIRECTORY_DOWNLOADS+"/IXIO_Original_STT/";
  private static final String NAME="IXIO_STT_Original_4.0.4.zip";
  private static final String[] REQUIRED={"encoder.ort","decoder.ort","joiner.ort","tokens.txt"};
  private static final String[] OPTIONAL={"bpe.vocab","vad.onnx","anti.onnx"};
  private static final ExecutorService EXECUTOR=Executors.newSingleThreadExecutor();
  private static final long MAX_FILE=700L*1024*1024;
  private ModelZipExporter(){}

  public static void afterOriginalUnzipSuccess(Context c) {
    try {
      final Context app=c.getApplicationContext();
      EXECUTOR.execute(() -> {
        try{exportWhenReady(app);}
        catch(Throwable t){Log.e(TAG,"EXPORT_FAILED; original model worker remains unchanged",t);}
      });
    } catch(Throwable t) {
      Log.e(TAG,"EXPORT_SCHEDULING_FAILED; original model worker remains unchanged",t);
    }
  }

  private static void findModels(File dir, Map<String,File> found,int depth) {
    if(dir==null||depth>8||!dir.isDirectory())return;
    File[] files=dir.listFiles();
    if(files==null)return;
    for(File f:files){
      if(f.isDirectory()){
        // Walk nested version folders too. Only the seven exact model
        // basenames are copied, so account files are never exported.
        findModels(f,found,depth+1);
        continue;
      }
      if(!f.isFile()||f.length()<128||f.length()>MAX_FILE)continue;
      String n=f.getName();
      if(!known(n))continue;
      File previous=found.get(n);
      if(previous==null||f.lastModified()>previous.lastModified())
        found.put(n,f);
    }
  }
  private static boolean known(String name) {
    for(String s:REQUIRED)if(s.equals(name))return true;
    for(String s:OPTIONAL)if(s.equals(name))return true;
    return false;
  }

  private static void exportWhenReady(Context app)throws Exception{
    if(Build.VERSION.SDK_INT<29){
      Log.w(TAG,"EXPORT_SKIPPED: Android version below 10; MediaStore.Downloads not available");
      return;
    }
    Map<String,File> files=new HashMap<>();
    findModels(app.getFilesDir(),files,0);
    for(String req:REQUIRED){
      if(!files.containsKey(req)){
        Log.i(TAG,"WAIT_FOR_STT_UNZIP missing="+req);
        return;
      }
    }
    List<File> ordered=new ArrayList<>();
    for(String name:REQUIRED)ordered.add(files.get(name));
    for(String name:OPTIONAL)if(files.containsKey(name))ordered.add(files.get(name));
    for(File f:ordered){
      if(!f.canRead()||f.length()<128){
        Log.w(TAG,"MODEL_NOT_READABLE "+f.getName());
        return;
      }
    }
    String key="IXIO_MODEL_ZIP_EXPORT_SHA256";
    String fp=fingerprint(ordered);
    if(fp.equals(app.getSharedPreferences("ixio_model_export",Context.MODE_PRIVATE)
       .getString(key,""))){
      Log.i(TAG,"ALREADY_EXPORTED_SAME_MODELS");
      return;
    }

    ContentResolver resolver=app.getContentResolver();
    ContentValues cv=new ContentValues();
    cv.put(MediaStore.MediaColumns.DISPLAY_NAME,NAME);
    cv.put(MediaStore.MediaColumns.MIME_TYPE,"application/zip");
    cv.put(MediaStore.MediaColumns.RELATIVE_PATH,DIR);
    cv.put(MediaStore.MediaColumns.IS_PENDING,1);
    Uri uri=null;
    try{
      uri=resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,cv);
      if(uri==null)throw new IOException("MediaStore.Downloads insertion returned null");
      long bytes=0;
      try(OutputStream raw=resolver.openOutputStream(uri,"w")){
        if(raw==null)throw new IOException("Cannot open Downloads output stream");
        try(ZipOutputStream zip=new ZipOutputStream(raw)){
          byte[] buf=new byte[131072];
          for(File file:ordered){
            long before=file.length();
            zip.putNextEntry(new ZipEntry(file.getName()));
            long copied=0;
            try(InputStream in=new FileInputStream(file)){
              int n;
              while((n=in.read(buf))>=0){
                if(n==0)continue;
                zip.write(buf,0,n);
                copied+=n;
                bytes+=n;
              }
            }
            zip.closeEntry();
            if(copied!=before)throw new IOException(
              "STT model changed during export: "+file.getName());
          }
          zip.putNextEntry(new ZipEntry("IXIO_MODEL_EXPORT.txt"));
          zip.write(("source=existing IXIO app private files\n"+
                     "copied_models="+ordered.size()+"\n"+
                     "trigger=original FileUnzipWorker success\n"+
                     "network_upload=none\n").getBytes(StandardCharsets.UTF_8));
          zip.closeEntry();
        }
      }
      // Read back the actual MediaStore ZIP before making it visible.
      try(android.os.ParcelFileDescriptor pfd=resolver.openFileDescriptor(uri,"r")){
        if(pfd==null||pfd.getStatSize()<512)
          throw new IOException("Download ZIP missing after write");
      }
      ContentValues done=new ContentValues();
      done.put(MediaStore.MediaColumns.IS_PENDING,0);
      if(resolver.update(uri,done,null,null)<1)
        throw new IOException("Failed to publish ZIP in Downloads");
      app.getSharedPreferences("ixio_model_export",Context.MODE_PRIVATE).edit()
        .putString(key,fp).putString("uri",uri.toString()).apply();
      Log.i(TAG,"EXPORT_VERIFIED Download/IXIO_Original_STT/"+NAME+
        " files="+ordered.size()+" rawBytes="+bytes);
      new Handler(Looper.getMainLooper()).post(
        ()->Toast.makeText(app,"IXIO STT 모델 저장 완료: 다운로드/IXIO_Original_STT/"+NAME,
           Toast.LENGTH_LONG).show());
    }catch(Throwable e){
      if(uri!=null)try{resolver.delete(uri,null,null);}catch(Throwable ignore){}
      throw e;
    }
  }

  private static String fingerprint(List<File> models)throws Exception{
    MessageDigest digest=MessageDigest.getInstance("SHA-256");
    for(File file:models){
      String data=file.getName()+":"+file.length()+":"+file.lastModified()+";";
      digest.update(data.getBytes(StandardCharsets.UTF_8));
    }
    StringBuilder s=new StringBuilder();
    for(byte b:digest.digest())s.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
    return s.toString();
  }
}
